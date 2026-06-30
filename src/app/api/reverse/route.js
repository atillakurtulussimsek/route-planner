/**
 * /api/reverse — Nominatim Ters Geocoding (reverse) proxy route'u.
 *
 * Haritaya tıklanan koordinatı (lat, lon) insan-okur bir adres metnine çevirir.
 * `/api/geocode` ile aynı gerekçelerle proxy'dir (CORS + User-Agent + IPv4 zorlama).
 */

import dns from "node:dns";
import net from "node:net";

// IPv6 erişimi olmayan ortamlarda Node fetch'inin (undici) takılmasını önlemek
// için IPv4'ü önceliklendir ve Happy Eyeballs'ı kapat.
// Bkz. /api/geocode route'undaki ayrıntılı not.
dns.setDefaultResultOrder("ipv4first");
net.setDefaultAutoSelectFamily(false);

const NOMINATIM_REVERSE_URL = "https://nominatim.openstreetmap.org/reverse";
const USER_AGENT = "RoutePlanner/1.0 (acik-kaynak teslimat rota araci)";

const MAX_ATTEMPTS = 2;
const RETRY_DELAY_MS = 1200;

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const lat = parseFloat(searchParams.get("lat"));
  const lon = parseFloat(searchParams.get("lon"));

  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    return Response.json(
      { error: "Geçerli lat/lon parametreleri gerekli." },
      { status: 400 },
    );
  }

  const url =
    `${NOMINATIM_REVERSE_URL}?format=json&zoom=18&addressdetails=0` +
    `&lat=${encodeURIComponent(lat)}&lon=${encodeURIComponent(lon)}`;

  let lastErr = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    try {
      const res = await fetch(url, {
        headers: {
          "User-Agent": USER_AGENT,
          "Accept-Language": "tr,en",
          Referer: "https://route-planner.local",
        },
        signal: AbortSignal.timeout(10000),
      });

      if (!res.ok) {
        return Response.json(
          { error: `Nominatim hata verdi (HTTP ${res.status}).` },
          { status: 502 },
        );
      }

      const data = await res.json();

      // Reverse, denizde/boş alanda display_name döndürmeyebilir.
      if (!data || !data.display_name) {
        return Response.json({ found: false });
      }

      return Response.json({
        found: true,
        displayName: data.display_name,
      });
    } catch (err) {
      lastErr = err;
      console.error(
        `[/api/reverse] Nominatim fetch hatası (deneme ${attempt}/${MAX_ATTEMPTS}):`,
        {
          name: err?.name,
          message: err?.message,
          code: err?.cause?.code,
          cause: err?.cause?.message,
        },
      );

      if (attempt < MAX_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS);
      }
    }
  }

  const message =
    lastErr?.name === "TimeoutError"
      ? "Ters geocoding isteği zaman aşımına uğradı."
      : "Ters geocoding servisine ulaşılamadı.";
  return Response.json({ error: message }, { status: 504 });
}
