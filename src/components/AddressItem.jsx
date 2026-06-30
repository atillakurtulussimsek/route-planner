"use client";

import { useState } from "react";
import {
  Pencil,
  Trash2,
  Check,
  X,
  Loader2,
  MapPin,
  AlertCircle,
  RotateCw,
} from "lucide-react";

/** Tek bir adres satırı: durum rozeti + düzenle/sil/yeniden dene eylemleri. */
export default function AddressItem({
  address,
  sequence,
  onUpdate,
  onRemove,
  onRetry,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(address.raw);

  function saveEdit() {
    const text = draft.trim();
    if (text && text !== address.raw) onUpdate(address.id, text);
    setEditing(false);
  }

  function cancelEdit() {
    setDraft(address.raw);
    setEditing(false);
  }

  return (
    <li className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 shadow-sm">
      {/* Sıra numarası / durum ikonu */}
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
        {sequence ?? <MapPin className="h-4 w-4" />}
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex items-center gap-2">
            <input
              autoFocus
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") saveEdit();
                if (e.key === "Escape") cancelEdit();
              }}
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <button
              onClick={saveEdit}
              className="rounded-md p-1 text-green-600 hover:bg-green-50"
              title="Kaydet"
            >
              <Check className="h-4 w-4" />
            </button>
            <button
              onClick={cancelEdit}
              className="rounded-md p-1 text-slate-500 hover:bg-slate-100"
              title="İptal"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        ) : (
          <>
            <p className="truncate text-sm font-medium text-slate-800" title={address.raw}>
              {address.raw}
            </p>
            <StatusLine address={address} onRetry={onRetry} />
          </>
        )}
      </div>

      {!editing && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => {
              setDraft(address.raw);
              setEditing(true);
            }}
            className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-blue-600"
            title="Düzenle"
          >
            <Pencil className="h-4 w-4" />
          </button>
          <button
            onClick={() => onRemove(address.id)}
            className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600"
            title="Sil"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      )}
    </li>
  );
}

/** Adresin geocoding durumunu gösteren küçük alt satır. */
function StatusLine({ address, onRetry }) {
  if (address.status === "pending") {
    return <span className="text-xs text-slate-400">Sırada bekliyor…</span>;
  }
  if (address.status === "geocoding") {
    return (
      <span className="flex items-center gap-1 text-xs text-blue-500">
        <Loader2 className="h-3 w-3 animate-spin" /> Koordinat çözülüyor…
      </span>
    );
  }
  if (address.status === "ok") {
    return (
      <span className="text-xs text-green-600">
        {address.lat.toFixed(5)}, {address.lon.toFixed(5)}
      </span>
    );
  }
  // error
  return (
    <span className="flex items-center gap-2 text-xs text-red-600">
      <span className="flex items-center gap-1">
        <AlertCircle className="h-3 w-3" />
        {address.error || "Hata"}
      </span>
      <button
        onClick={() => onRetry(address.id)}
        className="flex items-center gap-0.5 rounded px-1 text-blue-600 hover:underline"
        title="Tekrar dene"
      >
        <RotateCw className="h-3 w-3" /> Tekrar dene
      </button>
    </span>
  );
}
