/**
 * routePrint.js — Optimize edilmiş rutayı yazdırılabilir bir liste olarak açar.
 *
 * Harici bağımlılık YOK: gizli bir <iframe> içine (srcdoc) HTML yazıp tarayıcının
 * yazdır diyaloğunu açar. Kullanıcı oradan "PDF olarak kaydet" seçerek listeyi
 * PDF'e dönüştürebilir. Yöneticilere rut bilgisi vermek için tasarlanmıştır.
 */

function escapeHtml(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Saniye → "1 sa 20 dk" / "45 dk" (StatsPanel ile aynı biçim). */
function formatDuration(durationSec) {
  const minutes = Math.round(durationSec / 60);
  if (minutes >= 60) return `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`;
  return `${minutes} dk`;
}

function buildHtml({ stops, distance, duration, dateText }) {
  const km = (distance / 1000).toFixed(1);
  const durText = formatDuration(duration);

  // Rut planındaki ziyaret sırasına göre 1'den başlayarak artan sırala.
  const rows = [...stops]
    .sort((a, b) => a.seq - b.seq)
    .map(
      (s) => `
      <tr>
        <td class="seq">${s.seq}</td>
        <td>${escapeHtml(s.customer) || "—"}</td>
        <td>${escapeHtml(s.orderNo) || "—"}</td>
        <td>${escapeHtml(s.raw)}</td>
        <td class="coord">${s.lat.toFixed(5)}, ${s.lon.toFixed(5)}</td>
      </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="tr">
<head>
<meta charset="utf-8" />
<title>Teslimat Rota Listesi</title>
<style>
  * { box-sizing: border-box; }
  body { font-family: -apple-system, "Segoe UI", Roboto, Arial, sans-serif; color: #1e293b; margin: 24px; }
  h1 { font-size: 18px; margin: 0 0 4px; }
  .meta { font-size: 12px; color: #64748b; margin-bottom: 16px; }
  .summary { display: flex; gap: 28px; font-size: 13px; margin-bottom: 16px; padding: 10px 14px; border: 1px solid #e2e8f0; border-radius: 8px; background: #f8fafc; }
  .summary span { color: #64748b; }
  .summary b { display: block; font-size: 15px; color: #0f172a; }
  table { width: 100%; border-collapse: collapse; font-size: 12px; }
  th, td { text-align: left; padding: 8px 10px; border-bottom: 1px solid #e2e8f0; vertical-align: top; }
  th { background: #f1f5f9; font-size: 11px; text-transform: uppercase; letter-spacing: .03em; color: #475569; }
  td.seq { font-weight: 700; width: 36px; }
  td.coord { white-space: nowrap; color: #64748b; font-variant-numeric: tabular-nums; }
  tr:nth-child(even) td { background: #fbfdff; }
  /* Kağıt her zaman dikey (portrait) kullanılsın. */
  @page { size: A4 portrait; margin: 16mm; }
  @media print { body { margin: 0; } }
</style>
</head>
<body>
  <h1>Teslimat Rota Listesi</h1>
  <div class="meta">Oluşturulma: ${escapeHtml(dateText)}</div>
  <div class="summary">
    <span>Durak<b>${stops.length}</b></span>
    <span>Toplam Mesafe<b>${km} km</b></span>
    <span>Tahmini Süre<b>${durText}</b></span>
  </div>
  <table>
    <thead>
      <tr>
        <th>#</th>
        <th>Müşteri</th>
        <th>Sipariş No</th>
        <th>Adres</th>
        <th>Koordinat</th>
      </tr>
    </thead>
    <tbody>${rows}</tbody>
  </table>
</body>
</html>`;
}

/**
 * Verilen rota verisini gizli iframe'de açar ve yazdır diyaloğunu tetikler.
 * @param {{stops: Array<{seq,raw,customer,orderNo,lat,lon}>, distance:number, duration:number, dateText:string}} data
 */
export function printRouteList(data) {
  const html = buildHtml(data);

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;";
  iframe.srcdoc = html;

  iframe.onload = () => {
    const win = iframe.contentWindow;
    win.focus();
    win.print();
    // print() çoğu tarayıcıda diyalog kapanana kadar bloklar; sonra iframe'i kaldır.
    setTimeout(() => iframe.remove(), 1000);
  };

  document.body.appendChild(iframe);
}
