/**
 * geocoding.js — İstemci tarafı Geocoding yardımcısı.
 *
 * Nominatim'e DOĞRUDAN istek atmaz; kendi `/api/geocode` proxy route'umuza gider.
 * Böylece CORS sorunu yaşanmaz ve User-Agent politikası sunucuda uygulanır.
 *
 * Not: Saniyede 1 istek (throttle) kuralı, çağıran taraftaki sıralı kuyrukta
 * (useRoutePlanner hook'u) yönetilir. Buradaki `delay` ise yardımcıdır.
 */

/** Belirtilen milisaniye kadar bekler. */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Tek bir adres metnini koordinata çevirir.
 * @param {string} query - Geocode edilecek adres metni.
 * @returns {Promise<{lat:number, lon:number, displayName:string} | null>}
 *          Bulunamazsa null döner. Ağ/sunucu hatasında throw eder.
 */
export async function geocodeAddress(query) {
  const trimmed = (query || "").trim();
  if (!trimmed) return null;

  const res = await fetch(`/api/geocode?q=${encodeURIComponent(trimmed)}`);

  if (!res.ok) {
    let message = `Geocoding servisi hata verdi (HTTP ${res.status}).`;
    try {
      const body = await res.json();
      if (body?.error) message = body.error;
    } catch {
      /* gövde JSON değilse varsayılan mesajı kullan */
    }
    throw new Error(message);
  }

  const data = await res.json();
  return data?.found ? { lat: data.lat, lon: data.lon, displayName: data.displayName } : null;
}
