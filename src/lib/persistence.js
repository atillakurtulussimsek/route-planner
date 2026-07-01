/**
 * persistence.js — Oturum durumunun JSON olarak dışa/içe aktarımı.
 *
 * Harici veritabanı yoktur; kullanıcı listesini bir .json dosyası olarak indirir
 * (Export) ve sonra yükleyerek (Import) tam olarak geri döner.
 */

const SCHEMA_VERSION = 1;

/**
 * Adres listesini JSON dosyası olarak indirir.
 * @param {Array} addresses - Mevcut adres state'i.
 * @param {string|null} [startId] - Başlangıç (depo) olarak seçili adresin id'si.
 */
export function exportAddresses(addresses, startId = null) {
  const payload = {
    schemaVersion: SCHEMA_VERSION,
    app: "route-planner",
    exportedAt: new Date().toISOString(),
    // Not: id'ler import'ta yeniden üretildiği için başlangıç, id yerine
    // adres başına `isStart` bayrağı olarak taşınır (import bunu yeni id'ye eşler).
    addresses: (addresses || []).map((a) => ({
      raw: a.raw,
      customer: a.customer || "",
      orderNo: a.orderNo || "",
      lat: a.lat ?? null,
      lon: a.lon ?? null,
      isStart: startId != null && a.id === startId,
    })),
  };

  const blob = new Blob([JSON.stringify(payload, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);

  const stamp = new Date().toISOString().slice(0, 19).replace(/[:T]/g, "-");
  const link = document.createElement("a");
  link.href = url;
  link.download = `rota-planlayici-${stamp}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Yüklenen JSON dosyasını okur, doğrular ve normalize edilmiş adres listesi döner.
 * Koordinatı olan kayıtlar 'ok', olmayanlar 'pending' olarak işaretlenir
 * (pending olanlar otomatik tekrar geocode edilir).
 *
 * @param {File} file - <input type="file"> ile seçilen dosya.
 * @returns {Promise<{addresses: Array, startId: string|null}>} Normalize edilmiş
 *   adres dizisi ve (varsa) başlangıç olarak işaretli adresin yeni id'si.
 */
export function importAddresses(file) {
  return new Promise((resolve, reject) => {
    if (!file) {
      reject(new Error("Dosya seçilmedi."));
      return;
    }

    const reader = new FileReader();

    reader.onerror = () => reject(new Error("Dosya okunamadı."));

    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);

        if (!data || !Array.isArray(data.addresses)) {
          throw new Error("Geçersiz dosya: 'addresses' listesi bulunamadı.");
        }

        let startId = null;
        const normalized = data.addresses
          .filter((a) => a && typeof a.raw === "string" && a.raw.trim())
          .map((a, idx) => {
            const lat = typeof a.lat === "number" ? a.lat : null;
            const lon = typeof a.lon === "number" ? a.lon : null;
            const hasCoords = lat !== null && lon !== null;
            const id = `${Date.now()}-${idx}-${Math.round(performance.now())}`;
            // Başlangıç bayrağını yeni üretilen id'ye eşle (yalnızca ilki geçerli).
            if (a.isStart === true && startId === null) startId = id;
            return {
              id,
              raw: a.raw.trim(),
              customer: typeof a.customer === "string" ? a.customer.trim() : "",
              orderNo: typeof a.orderNo === "string" ? a.orderNo.trim() : "",
              lat,
              lon,
              status: hasCoords ? "ok" : "pending",
              error: null,
            };
          });

        if (normalized.length === 0) {
          throw new Error("Dosyada geçerli adres bulunamadı.");
        }

        resolve({ addresses: normalized, startId });
      } catch (err) {
        reject(
          new Error(
            err instanceof SyntaxError
              ? "Dosya geçerli bir JSON değil."
              : err.message,
          ),
        );
      }
    };

    reader.readAsText(file);
  });
}
