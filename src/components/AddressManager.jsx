"use client";

import { useState } from "react";
import { Plus, Loader2 } from "lucide-react";
import AddressItem from "./AddressItem";

/**
 * Adres ekleme formu + adres listesi.
 * Sıralama: rota hesaplandıysa ziyaret sırasına göre numaralı gösterilir.
 */
export default function AddressManager({
  addresses,
  route,
  isGeocoding,
  startId,
  onAdd,
  onUpdate,
  onRemove,
  onRetry,
  onSetStart,
}) {
  const [input, setInput] = useState("");

  function handleSubmit(e) {
    e.preventDefault();
    const text = input.trim();
    if (!text) return;
    onAdd(text);
    setInput("");
  }

  // Rota varsa adresleri ziyaret sırasına diz, yoksa ekleme sırası.
  let displayList = addresses;
  let seqOf = () => null;
  if (route?.orderedIds?.length) {
    const seqMap = new Map(route.orderedIds.map((id, idx) => [id, idx + 1]));
    displayList = [...addresses].sort(
      (a, b) => (seqMap.get(a.id) ?? 1e9) - (seqMap.get(b.id) ?? 1e9),
    );
    seqOf = (id) => seqMap.get(id) ?? null;
  }

  return (
    <div className="flex h-full flex-col">
      <form onSubmit={handleSubmit} className="mb-3 flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Adres girin (örn. Atatürk Cad. No:1, Kadıköy, İstanbul)"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-200"
        />
        <button
          type="submit"
          className="flex shrink-0 items-center gap-1 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition hover:bg-blue-700 disabled:opacity-50"
          disabled={!input.trim()}
        >
          <Plus className="h-4 w-4" /> Ekle
        </button>
      </form>

      <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
        <span>{addresses.length} adres</span>
        {isGeocoding && (
          <span className="flex items-center gap-1 text-blue-500">
            <Loader2 className="h-3 w-3 animate-spin" /> Koordinatlar çözülüyor…
          </span>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        {addresses.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-400">
            Henüz adres yok.
            <br />
            Yukarıdaki formdan teslimat adreslerini ekleyin.
          </div>
        ) : (
          <ul className="space-y-2">
            {displayList.map((a) => (
              <AddressItem
                key={a.id}
                address={a}
                sequence={seqOf(a.id)}
                isStart={a.id === startId}
                onUpdate={onUpdate}
                onRemove={onRemove}
                onRetry={onRetry}
                onSetStart={onSetStart}
              />
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
