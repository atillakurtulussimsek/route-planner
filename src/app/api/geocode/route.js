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

const NOMINATIM_URL = "https://nominatim.openstreetmap.org/search";
const USER_AGENT = "RoutePlanner/1.0 (acik-kaynak teslimat rota araci)";

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get("q") || "").trim();

  if (!query) {
    return Response.json({ error: "Adres sorgusu (q) boş olamaz." }, { status: 400 });
  }

  const url = `${NOMINATIM_URL}?format=json&limit=1&addressdetails=0&q=${encodeURIComponent(query)}`;

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": USER_AGENT,
        "Accept-Language": "tr,en",
        Referer: "https://route-planner.local",
      },
      // Yanıt gelmezse 5 sn sonra iptal et.
      signal: AbortSignal.timeout(5000),
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
    const message =
      err?.name === "TimeoutError"
        ? "Geocoding isteği zaman aşımına uğradı."
        : "Geocoding servisine ulaşılamadı.";
    return Response.json({ error: message }, { status: 504 });
  }
}
