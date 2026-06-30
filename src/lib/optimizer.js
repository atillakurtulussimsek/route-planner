/**
 * optimizer.js — İstemci tarafı Rota Optimizasyonu yardımcısı.
 *
 * Kendi `/api/optimize` proxy route'umuza koordinat listesi gönderir; route
 * OSRM "Trip" servisini (TSP çözümü) çağırır ve sonucu normalize eder.
 *
 * Mimari kararlar (bkz. memory-bank/activeContext.md):
 *  - source=first  → ilk adres sabit başlangıç noktasıdır (depo).
 *  - roundtrip=false → açık rota; başlangıca geri dönülmez.
 */

/**
 * Koordinat listesini optimize eder.
 * @param {Array<{lat:number, lon:number}>} coordinates - En az 2 koordinat.
 * @returns {Promise<{
 *   order: number[],            // ziyaret sırasına göre giriş indeksleri
 *   geometry: Array<[number,number]>, // polyline [lat, lon] noktaları
 *   distance: number,           // metre
 *   duration: number            // saniye
 * }>}
 */
export async function optimizeRoute(coordinates) {
  if (!Array.isArray(coordinates) || coordinates.length < 2) {
    throw new Error("Optimizasyon için en az 2 geçerli koordinat gerekir.");
  }

  const res = await fetch("/api/optimize", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ coordinates }),
  });

  if (!res.ok) {
    let message = `Optimizasyon servisi hata verdi (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* gövde JSON değilse varsayılan mesajı kullan */
    }
    throw new Error(message);
  }

  return res.json();
}
