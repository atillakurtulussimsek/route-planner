/**
 * /api/optimize — OSRM "Trip" (TSP) proxy route'u.
 *
 * Gelen koordinat listesini OSRM public sunucusunun Trip servisine gönderir.
 * Trip servisi Gezgin Satıcı Problemi'ni (yaklaşık) çözer ve optimum ziyaret
 * sırasını döndürür.
 *
 * Parametreler (mimari kararlar):
 *  - source=first    → ilk koordinat sabit başlangıç (depo).
 *  - roundtrip=false → açık rota (başlangıca dönülmez).
 *  - geometries=geojson & overview=full → harita çizimi için tam polyline.
 */

const OSRM_TRIP_URL = "https://router.project-osrm.org/trip/v1/driving";

export async function POST(request) {
  let body;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "İstek gövdesi geçerli JSON değil." }, { status: 400 });
  }

  const coordinates = body?.coordinates;

  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    return Response.json(
      { error: "En az 2 geçerli koordinat gönderilmelidir." },
      { status: 400 },
    );
  }

  const allValid = coordinates.every(
    (c) => c && Number.isFinite(c.lat) && Number.isFinite(c.lon),
  );
  if (!allValid) {
    return Response.json(
      { error: "Koordinatlardan bazıları geçersiz (lat/lon eksik)." },
      { status: 400 },
    );
  }

  // OSRM "lon,lat" sırası bekler.
  const coordStr = coordinates.map((c) => `${c.lon},${c.lat}`).join(";");
  const url =
    `${OSRM_TRIP_URL}/${coordStr}` +
    `?source=first&roundtrip=false&geometries=geojson&overview=full`;

  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(15000) });

    if (!res.ok) {
      return Response.json(
        { error: `OSRM hata verdi (HTTP ${res.status}).` },
        { status: 502 },
      );
    }

    const data = await res.json();

    if (data.code !== "Ok" || !Array.isArray(data.trips) || data.trips.length === 0) {
      return Response.json(
        { error: `Rota hesaplanamadı: ${data.message || data.code || "bilinmeyen hata"}.` },
        { status: 422 },
      );
    }

    const trip = data.trips[0];

    // waypoints[i].waypoint_index = i. giriş noktasının rotadaki sırası.
    // order[sıra] = girişIndeksi  →  ziyaret sırasına göre giriş indeksleri.
    const order = new Array(data.waypoints.length);
    data.waypoints.forEach((wp, inputIdx) => {
      order[wp.waypoint_index] = inputIdx;
    });

    // GeoJSON [lon,lat] → Leaflet [lat,lon]
    const geometry = (trip.geometry?.coordinates || []).map(([lon, lat]) => [lat, lon]);

    return Response.json({
      order,
      geometry,
      distance: trip.distance, // metre
      duration: trip.duration, // saniye
    });
  } catch (err) {
    const message =
      err?.name === "TimeoutError"
        ? "Optimizasyon isteği zaman aşımına uğradı."
        : "OSRM servisine ulaşılamadı.";
    return Response.json({ error: message }, { status: 504 });
  }
}
