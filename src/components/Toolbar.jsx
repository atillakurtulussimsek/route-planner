"use client";

import { useRef } from "react";
import { Route, Download, Upload, Trash2, Loader2 } from "lucide-react";

/** Ana eylem çubuğu: Optimize Et / Dışa Aktar / İçe Aktar / Temizle. */
export default function Toolbar({
  canOptimize,
  isOptimizing,
  hasAddresses,
  onOptimize,
  onExport,
  onImport,
  onClear,
}) {
  const fileRef = useRef(null);

  function handleFile(e) {
    const file = e.target.files?.[0];
    if (file) onImport(file);
    // Aynı dosyayı tekrar seçebilmek için input'u sıfırla.
    e.target.value = "";
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      <button
        onClick={onOptimize}
        disabled={!canOptimize}
        className="flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        title={
          canOptimize
            ? "Rotayı optimize et"
            : "En az 2 adresin koordinatı çözülmüş olmalı"
        }
      >
        {isOptimizing ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Route className="h-4 w-4" />
        )}
        {isOptimizing ? "Hesaplanıyor…" : "Rotayı Optimize Et"}
      </button>

      <button
        onClick={onExport}
        disabled={!hasAddresses}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
        title="Listeyi JSON olarak indir"
      >
        <Download className="h-4 w-4" /> Dışa Aktar
      </button>

      <button
        onClick={() => fileRef.current?.click()}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
        title="JSON dosyasından yükle"
      >
        <Upload className="h-4 w-4" /> İçe Aktar
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="application/json,.json"
        onChange={handleFile}
        className="hidden"
      />

      <button
        onClick={onClear}
        disabled={!hasAddresses}
        className="flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-red-600 transition hover:bg-red-50 disabled:opacity-50"
        title="Tüm adresleri sil"
      >
        <Trash2 className="h-4 w-4" /> Temizle
      </button>
    </div>
  );
}
