/**
 * /api/geocode — Geocoding proxy route'u (Nominatim + Photon yedek).
 *
 * Neden proxy?
 *  - Nominatim, tarayıcıdan doğrudan çağrıda CORS ve User-Agent politikası
 *    açısından sorunludur. Sunucu tarafından çağırarak geçerli bir User-Agent
 *    göndeririz (Nominatim kullanım koşulu).
 *
 * Akış (bkz. lib/addressQuery.js):
 *  1. Adres metni normalize edilir (Cad.→Caddesi, No:5→5, Kat/Daire silinir).
 *  2. Kademeli sorgular denenir: tam adres → kapı no'suz → sokaksız → ilçe+il.
 *  3. Her kademede önce Nominatim, bulamazsa Photon (photon.komoot.io) sorulur.
 *  Yanıttaki `precision` alanı hangi kademede bulunduğunu söyler
 *  ('exact' | 'street' | 'neighborhood' | 'district').
 *
 * Nominatim politikası (1 istek/sn) için kademeler arasında beklenir; istemci
 * kuyruğu da adresler arasında ayrıca throttle uygular.
 */

import dns from "node:dns";
import net from "node:net";
import { buildQueryTiers } from "@/lib/addressQuery";

// Bu makinede/ortamda IPv6 erişimi olmayabilir. Node'un fetch'i (undici) IPv6'yı
// deneyip takılınca "Geocoding servisine ulaşılamadı." hatası oluşur.
//  - ipv4first: DNS sonuçlarında IPv4'ü öne al.
//  - autoSelectFamily(false): "Happy Eyeballs" paralel IPv6/IPv4 denemesini kapat;
//    böylece erişilemeyen IPv6 adresi hiç denenmez ve bağlantı IPv4'e gider.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const PHOTON_URL = "https://photon.komoot.io/api/";
const USER_AGENT = "RoutePlanner/1.0 (acik-kaynak teslimat rota araci)";

// Public Nominatim ara sıra timeout/bağlantı reset verir. Geçici hatalarda
// kısa bir bekleme ile en fazla bu kadar kez yeniden deneriz.
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1200;
// Aynı istek içinde ardışık Nominatim çağrıları arasında bekleme (1 istek/sn).
const NOMINATIM_GAP_MS = 1100;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function normalizeTr(text) {
  return String(text || "").toLocaleLowerCase("tr").trim();
}

const STREET_WORDS = ["caddesi", "cadde", "sokak", "sokağı", "bulvarı", "bulvar"];

/**
 * Normalize edilmiş sorguda verilen işaret kelimelerinden (ör. "sokak") hemen
 * önceki kelimeyi döndürür: "cumhuriyet mahallesi istiklal sokak 5" → "istiklal".
 */
function extractNameBefore(q, markers) {
  const re = new RegExp(`(\\S+)\\s+(?:${markers.join("|")})(?=[\\s,]|$)`, "u");
  const m = q.match(re);
  return m ? m[1] : null;
}

class UpstreamError extends Error {
  constructor(message, status) {
    super(message);
    this.status = status;
  }
}

/**
 * Nominatim araması. Bulamazsa null; HTTP hatası → UpstreamError(502);
 * ağ/timeout hatası (denemeler tükenince) → orijinal hata fırlatılır.
 */
async function geocodeWithNominatim(query) {
  const url = `${NOMINATIM_URL}?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(query)}`;
  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "tr,en",
          Referer: "https://route-planner.local",
        },
        // Yanıt gelmezse 10 sn sonra iptal et (public Nominatim ara sıra yavaş).
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        throw new UpstreamError(`Nominatim hata verdi (HTTP ${res.status}).`, 502);
      }

      const results = await res.json();
      if (!Array.isArray(results) || results.length === 0) return null;

      const top = results[0];
      return {
        lat: parseFloat(top.lat),
        lon: parseFloat(top.lon),
        displayName: top.display_name || query,
      };
    } catch (err) {
      if (err instanceof UpstreamError) throw err;
      lastErr = err;
      // Gerçek nedeni sunucu terminaline yaz ki teşhis edilebilsin.
      console.error(
        `[/api/geocode] Nominatim fetch hatası (deneme ${attempt}/${MAX_ATTEMPTS}):`,
        {
          name: err?.name,
          message: err?.message,
          code: err?.cause?.code,
          cause: err?.cause?.message,
        },
      );
      if (attempt < MAX_ATTEMPTS) await sleep(RETRY_DELAY_MS);
    }
  }

  throw lastErr;
}

/**
 * Yedek geocoder: Photon (Komoot, OSM tabanlı). Nominatim'in anlamadığı
 * "Cad.", "Mah.", "No:5" gibi Türkçe kısaltmalara toleranslıdır.
 *
 * Photon bulanık (fuzzy) eşleştiği için alakasız sonuç döndürebilir. Bu yüzden
 * sonuç iki aşamada doğrulanır; geçemezse null döner:
 *  1. İl/ilçe (state/county/city) alanlarından en az biri sorguda geçmeli.
 *  2. Sorguda sokak/cadde varsa sonucun sokağı (veya adı) o sokak adını
 *     içermeli; sokak yok ama mahalle varsa sonucun mahallesi/semti eşleşmeli.
 *
 * @returns {Promise<{lat:number, lon:number, displayName:string} | null>}
 */
async function geocodeWithPhoton(query) {
  const url = `${PHOTON_URL}?limit=1&q=${encodeURIComponent(query)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": USER_AGENT },
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`Photon HTTP ${res.status}`);

  const data = await res.json();
  const feature = data?.features?.[0];
  const coords = feature?.geometry?.coordinates;
  if (!Array.isArray(coords) || coords.length < 2) return null;

  const p = feature.properties || {};
  const q = normalizeTr(query);
  const adminFields = [p.state, p.county, p.city].filter(Boolean);
  const adminMatches = adminFields.some((f) => q.includes(normalizeTr(f)));
  if (adminFields.length > 0 && !adminMatches) return null;

  const streetName = extractNameBefore(q, STREET_WORDS);
  const hoodName = extractNameBefore(q, ["mahallesi"]);
  if (streetName) {
    const haystack = normalizeTr([p.street, p.name].filter(Boolean).join(" "));
    if (!haystack.includes(streetName)) return null;
  } else if (hoodName) {
    const haystack = normalizeTr([p.locality, p.district, p.name].filter(Boolean).join(" "));
    if (!haystack.includes(hoodName)) return null;
  }

  const displayName = [
    p.name,
    [p.street, p.housenumber].filter(Boolean).join(" "),
    p.locality,
    p.district,
    p.city,
    p.state,
    p.country,
  ]
    .filter(Boolean)
    .filter((v, i, arr) => arr.indexOf(v) === i)
    .join(", ");

  const [lon, lat] = coords;
  return { lat, lon, displayName: displayName || query };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (!query) {
    return Response.json({ error: "Adres sorgusu (q) boş olamaz." }, { status: 400 });
  }

  const tiers = buildQueryTiers(query);
  if (tiers.length === 0) {
    return Response.json({ found: false });
  }

  let lastErr = null;

  for (let i = 0; i < tiers.length; i++) {
    const { query: q, precision } = tiers[i];
    if (i > 0) await sleep(NOMINATIM_GAP_MS);

    // 1) Nominatim
    try {
      const hit = await geocodeWithNominatim(q);
      if (hit) {
        return Response.json({ found: true, source: "nominatim", precision, query: q, ...hit });
      }
    } catch (err) {
      if (err instanceof UpstreamError) {
        return Response.json({ error: err.message }, { status: err.status });
      }
      lastErr = err;
    }

    // 2) Photon (Nominatim bulamadı ya da ulaşılamadı)
    try {
      const hit = await geocodeWithPhoton(q);
      if (hit) {
        return Response.json({ found: true, source: "photon", precision, query: q, ...hit });
      }
    } catch (err) {
      console.error("[/api/geocode] Photon yedek geocoding hatası:", err?.message);
      if (!lastErr) lastErr = err;
    }
  }

  // Hiçbir kademede sonuç yok. Servislere hiç ulaşılamadıysa hata, aksi hâlde
  // "bulunamadı" döner.
  if (lastErr) {
    const message =
      lastErr?.name === "TimeoutError"
        ? "Geocoding isteği zaman aşımına uğradı."
        : "Geocoding servisine ulaşılamadı.";
    return Response.json({ error: message }, { status: 504 });
  }
  return Response.json({ found: false });
}
