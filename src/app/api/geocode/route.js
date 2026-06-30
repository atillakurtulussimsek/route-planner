/**
 * /api/geocode — Nominatim Geocoding proxy route'u.
 *
 * Neden proxy?
 *  - Nominatim, tarayıcıdan doğrudan çağrıda CORS ve User-Agent politikası
 *    açısından sorunludur. Sunucu tarafından çağırarak geçerli bir User-Agent
 *    göndeririz (Nominatim kullanım koşulu).
 *
 * Throttle (1 istek/sn) kuralı istemci kuyruğunda uygulanır; burada ek olarak
 * 5 sn'lik bir fetch timeout'u ile asılı kalmayı önleriz.
 */

import dns from "node:dns";
import net from "node:net";

// Bu makinede/ortamda IPv6 erişimi olmayabilir. Node'un fetch'i (undici) IPv6'yı
// deneyip takılınca "Geocoding servisine ulaşılamadı." hatası oluşur.
//  - ipv4first: DNS sonuçlarında IPv4'ü öne al.
//  - autoSelectFamily(false): "Happy Eyeballs" paralel IPv6/IPv4 denemesini kapat;
//    böylece erişilemeyen IPv6 adresi hiç denenmez ve bağlantı IPv4'e gider.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "RoutePlanner/1.0 (acik-kaynak teslimat rota araci)";

// Public Nominatim ara sıra timeout/bağlantı reset verir. Geçici hatalarda
// kısa bir bekleme ile en fazla bu kadar kez yeniden deneriz.
const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (!query) {
    return Response.json({ error: "Adres sorgusu (q) boş olamaz." }, { status: 400 });
  }

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
        return Response.json(
          { error: `Nominatim hata verdi (HTTP ${res.status}).` },
          { status: 502 },
        );
      }

      const results = await res.json();

      if (!Array.isArray(results) || results.length === 0) {
        return Response.json({ found: false });
      }

      const top = results[0];
      return Response.json({
        found: true,
        lat: parseFloat(top.lat),
        lon: parseFloat(top.lon),
        displayName: top.display_name || query,
      });
    } catch (err) {
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

      // Son deneme değilse kısa bekleyip tekrar dene.
      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  const message =
    lastErr?.name === "TimeoutError"
      ? "Geocoding isteği zaman aşımına uğradı."
      : "Geocoding servisine ulaşılamadı.";
  return Response.json({ error: message }, { status: 504 });
}
