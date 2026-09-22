/**
 * addressQuery.js — Türkçe adres metnini geocoder'ların anlayacağı biçime
 * çevirir ve kademeli (gittikçe daha genel) sorgu listesi üretir.
 *
 * Nominatim "Cad.", "Mah.", "Sok.", "No:5" gibi kısaltmaları anlamaz; bunlar
 * açık hâllerine çevrilir. Tam adres bulunamazsa sırayla kapı numarasız,
 * sokaksız ve yalnızca ilçe+il ile arama yapılır.
 *
 * Hem sunucu (API route) hem istemci tarafında kullanılabilir; bağımlılığı yoktur.
 */

const STREET_MARKERS = ["Caddesi", "Cadde", "Sokak", "Sokağı", "Bulvarı", "Bulvar"];

/** Kısaltmaları açar, kapı no / kat / daire yazımını sadeleştirir. */
export function normalizeAddress(text) {
  let s = String(text || "").trim();
  if (!s) return "";

  // Kısaltma → açık hâl (yalnızca kelime başında; nokta opsiyonel).
  const abbr = [
    [/(^|[\s,])(cad|cd)\.?(?=[\s,]|$)/gi, "$1Caddesi"],
    [/(^|[\s,])(sok|sk)\.?(?=[\s,]|$)/gi, "$1Sokak"],
    [/(^|[\s,])(mah|mh)\.?(?=[\s,]|$)/gi, "$1Mahallesi"],
    [/(^|[\s,])(bulv|blv|bul)\.?(?=[\s,]|$)/gi, "$1Bulvarı"],
    [/(^|[\s,])(apt)\.?(?=[\s,]|$)/gi, "$1Apartmanı"],
  ];
  for (const [re, rep] of abbr) s = s.replace(re, rep);

  // "No:5", "No 5", "No.5", "Numara 5" → "5"
  s = s.replace(/(^|[\s,])(no|numara)\s*[:.]?\s*(?=\d)/gi, "$1");

  // Kat / Daire bilgisi geocoding'e katkı sağlamaz; kaldır.
  s = s.replace(/(^|[\s,])(kat|k|daire|d)\s*[:.]\s*\S+/gi, "$1");
  s = s.replace(/(^|[\s,])(kat|daire)\s+\d+\S*/gi, "$1");

  return tidy(s);
}

/** Kapı numarasını (1-4 haneli sayı, "12/A" vb.) kaldırır; posta kodu (5 hane) kalır. */
export function stripHouseNumber(text) {
  return tidy(String(text || "").replace(/(^|[\s,])\d{1,4}(\/[\dA-Za-z]+|[A-Za-z])?(?=[\s,]|$)/g, "$1"));
}

/** Cadde/sokak/bulvar bölümünü (adıyla birlikte) kaldırır; mahalle ve üstü kalır. */
export function stripStreet(text) {
  const marker = new RegExp(`\\s(${STREET_MARKERS.join("|")})(?=[\\s,]|$)`, "u");
  const segments = String(text || "")
    .split(",")
    .map((seg) => {
      const m = seg.match(marker);
      if (!m) return seg;
      const end = m.index + m[0].length;
      // Mahalle adı aynı segmentteyse onu koru, yalnızca sokak kısmını sil.
      const mahIdx = seg.search(/Mahallesi(?=[\s,]|$)/u);
      const start = mahIdx >= 0 && mahIdx < m.index ? mahIdx + "Mahallesi".length : 0;
      return seg.slice(0, start) + " " + seg.slice(end);
    });
  return tidy(segments.join(","));
}

/** Yalnızca ilçe + il (son iki virgüllü parça; virgül yoksa son iki kelime). */
export function districtCityOnly(text) {
  const parts = String(text || "")
    .split(",")
    .map((p) => p.trim())
    .filter(Boolean);
  if (parts.length >= 2) return tidy(parts.slice(-2).join(", "));
  const words = (parts[0] || "").split(/\s+/).filter(Boolean);
  return tidy(words.slice(-2).join(" "));
}

/**
 * Kademeli sorgu listesi. Her eleman: { query, precision }.
 * precision: 'exact' | 'street' | 'neighborhood' | 'district'
 */
export function buildQueryTiers(text) {
  const normalized = normalizeAddress(text);
  if (!normalized) return [];

  const noHouse = stripHouseNumber(normalized);
  const district = districtCityOnly(normalized);
  const candidates = [
    { query: normalized, precision: "exact" },
    { query: noHouse, precision: "street" },
    { query: stripStreet(noHouse), precision: "neighborhood" },
    { query: district, precision: "district" },
  ];

  const key = (q) => q.toLocaleLowerCase("tr");
  const seen = new Set();
  return candidates
    .map((c, i) =>
      // Ara kademe sadeleşince ilçe+il sorgusuna eşitlendiyse doğru etiketi ver.
      i > 0 && key(c.query) === key(district) ? { ...c, precision: "district" } : c,
    )
    .filter(({ query }) => {
      if (!query || seen.has(key(query))) return false;
      seen.add(key(query));
      return true;
    });
}

function tidy(s) {
  return s
    .replace(/\s+/g, " ")
    .replace(/\s*,\s*/g, ", ")
    .replace(/(, )+/g, ", ")
    .replace(/^,\s*|,\s*$/g, "")
    .trim();
}
