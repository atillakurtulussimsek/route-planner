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
  User,
  Hash,
  Home,
} from "lucide-react";

/** Tek bir adres satırı: durum rozeti + başlangıç/düzenle/sil/yeniden dene eylemleri. */
export default function AddressItem({
  address,
  sequence,
  isStart = false,
  onUpdate,
  onRemove,
  onRetry,
  onSetStart,
}) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(() => ({
    raw: address.raw,
    customer: address.customer || "",
    orderNo: address.orderNo || "",
  }));

  function startEdit() {
    setDraft({
      raw: address.raw,
      customer: address.customer || "",
      orderNo: address.orderNo || "",
    });
    setEditing(true);
  }

  function saveEdit() {
    const raw = draft.raw.trim();
    if (!raw) return; // adres boş bırakılamaz
    onUpdate(address.id, {
      raw,
      customer: draft.customer.trim(),
      orderNo: draft.orderNo.trim(),
    });
    setEditing(false);
  }

  function cancelEdit() {
    setEditing(false);
  }

  function handleKey(e) {
    if (e.key === "Enter") saveEdit();
    if (e.key === "Escape") cancelEdit();
  }

  return (
    <li
      className={`flex items-start gap-3 rounded-lg border p-3 shadow-sm ${
        isStart
          ? "border-emerald-300 bg-emerald-50"
          : "border-slate-200 bg-white"
      }`}
    >
      {/* Sıra numarası / durum ikonu (başlangıçsa ev ikonu) */}
      <div
        className={`mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
          isStart
            ? "bg-emerald-600 text-white"
            : "bg-slate-100 text-slate-600"
        }`}
        title={isStart ? "Başlangıç (depo)" : undefined}
      >
        {isStart ? (
          <Home className="h-4 w-4" />
        ) : (
          sequence ?? <MapPin className="h-4 w-4" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <div className="flex flex-col gap-2">
            <input
              autoFocus
              value={draft.raw}
              onChange={(e) => setDraft((d) => ({ ...d, raw: e.target.value }))}
              onKeyDown={handleKey}
              placeholder="Adres"
              className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
            />
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={draft.customer}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, customer: e.target.value }))
                }
                onKeyDown={handleKey}
                placeholder="Müşteri adı (opsiyonel)"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
              <input
                value={draft.orderNo}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, orderNo: e.target.value }))
                }
                onKeyDown={handleKey}
                placeholder="Sipariş no (opsiyonel)"
                className="w-full rounded-md border border-slate-300 px-2 py-1 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
              />
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={saveEdit}
                className="flex items-center gap-1 rounded-md bg-green-600 px-2.5 py-1 text-xs font-medium text-white transition hover:bg-green-700"
                title="Kaydet"
              >
                <Check className="h-3.5 w-3.5" /> Kaydet
              </button>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-1 rounded-md border border-slate-300 px-2.5 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
                title="İptal"
              >
                <X className="h-3.5 w-3.5" /> İptal
              </button>
            </div>
          </div>
        ) : (
          <>
            <p className="truncate text-sm font-medium text-slate-800" title={address.raw}>
              {address.raw}
            </p>
            {(address.customer || address.orderNo) && (
              <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-slate-600">
                {address.customer && (
                  <span className="flex items-center gap-1" title="Müşteri">
                    <User className="h-3 w-3 text-slate-400" />
                    <span className="truncate">{address.customer}</span>
                  </span>
                )}
                {address.orderNo && (
                  <span className="flex items-center gap-1" title="Sipariş no">
                    <Hash className="h-3 w-3 text-slate-400" />
                    <span className="truncate">{address.orderNo}</span>
                  </span>
                )}
              </div>
            )}
            <StatusLine address={address} onRetry={onRetry} />
          </>
        )}
      </div>

      {!editing && (
        <div className="flex shrink-0 items-center gap-1">
          <button
            onClick={() => onSetStart(address.id)}
            className={`rounded-md p-1.5 hover:bg-emerald-50 ${
              isStart
                ? "text-emerald-600"
                : "text-slate-400 hover:text-emerald-600"
            }`}
            title={
              isStart
                ? "Başlangıç işaretini kaldır"
                : "Başlangıç (depo) yap"
            }
            aria-pressed={isStart}
          >
            <Home className="h-4 w-4" />
          </button>
          <button
            onClick={startEdit}
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
