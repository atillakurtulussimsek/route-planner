"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { MapPinned, AlertCircle, Loader2 } from "lucide-react";
import { useRoutePlanner } from "@/hooks/useRoutePlanner";
import AddressManager from "@/components/AddressManager";
import Toolbar from "@/components/Toolbar";
import StatsPanel from "@/components/StatsPanel";

// react-leaflet sunucuda render edilemez (window'a ihtiyaç duyar) → ssr:false.
const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-slate-400">
      <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Harita yükleniyor…
    </div>
  ),
});

export default function Home() {
  const planner = useRoutePlanner();
  const [importError, setImportError] = useState(null);

  // Haritada gösterilecek durakları hesapla.
  const stops = useMemo(() => {
    const byId = new Map(planner.addresses.map((a) => [a.id, a]));

    if (planner.route?.orderedIds?.length) {
      const ids = planner.route.orderedIds;
      return ids
        .map((id, idx) => {
          const a = byId.get(id);
          if (!a || a.lat == null) return null;
          const type = idx === 0 ? "start" : idx === ids.length - 1 ? "end" : "mid";
          return { id: a.id, lat: a.lat, lon: a.lon, raw: a.raw, customer: a.customer, orderNo: a.orderNo, seq: idx + 1, label: idx + 1, type };
        })
        .filter(Boolean);
    }

    // Rota yoksa, koordinatı çözülmüş tüm adresleri sade pin olarak göster;
    // başlangıç olarak işaretli adres, rota öncesinde de ayırt edilsin diye
    // yeşil 'start' pini olarak vurgulanır.
    return planner.addresses
      .filter((a) => a.status === "ok")
      .map((a) => {
        const isStart = a.id === planner.startId;
        return { id: a.id, lat: a.lat, lon: a.lon, raw: a.raw, customer: a.customer, orderNo: a.orderNo, seq: null, label: isStart ? "🏠" : "•", type: isStart ? "start" : "plain" };
      });
  }, [planner.addresses, planner.route, planner.startId]);

  async function handleImport(file) {
    setImportError(null);
    try {
      await planner.importJSON(file);
    } catch (err) {
      setImportError(err.message);
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* Üst başlık */}
      <header className="flex shrink-0 items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 shadow-sm">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-blue-600 text-white">
          <MapPinned className="h-5 w-5" />
        </div>
        <div>
          <h1 className="text-base font-bold leading-tight text-slate-800">
            Rota Planlayıcı
          </h1>
          <p className="text-xs text-slate-500">
            Lojistik teslimatlar için açık kaynaklı rota optimizasyonu
          </p>
        </div>
      </header>

      {/* Ana içerik: sol panel (adresler) + sağ panel (harita) */}
      <main className="flex min-h-0 flex-1 flex-col lg:flex-row">
        {/* Sol panel */}
        <section className="flex w-full flex-col gap-3 border-b border-slate-200 bg-slate-50 p-4 lg:w-[420px] lg:shrink-0 lg:border-b-0 lg:border-r">
          <Toolbar
            canOptimize={planner.canOptimize}
            isOptimizing={planner.isOptimizing}
            hasAddresses={planner.addresses.length > 0}
            hasRoute={planner.hasRoute}
            pickMode={planner.pickMode}
            onTogglePickMode={planner.togglePickMode}
            onOptimize={planner.optimize}
            onPrintRoute={planner.printRoute}
            onExport={planner.exportJSON}
            onImport={handleImport}
            onClear={planner.clearAll}
          />

          {planner.pickMode && (
            <Banner
              type="info"
              text="Haritadan ekleme modu açık: bir nokta eklemek için harita üzerinde istediğin yere tıkla. Kapatmak için butona tekrar bas."
            />
          )}

          {/* Uyarı / hata mesajları */}
          {planner.optimizeError && (
            <Banner type="error" text={planner.optimizeError} />
          )}
          {importError && <Banner type="error" text={importError} />}

          <StatsPanel route={planner.route} stopCount={stops.length} />

          <div className="min-h-0 flex-1">
            <AddressManager
              addresses={planner.addresses}
              route={planner.route}
              isGeocoding={planner.isGeocoding}
              startId={planner.startId}
              onAdd={planner.addAddress}
              onUpdate={planner.updateAddress}
              onRemove={planner.removeAddress}
              onRetry={planner.retryAddress}
              onSetStart={planner.setStart}
            />
          </div>
        </section>

        {/* Sağ panel: harita */}
        <section className="relative min-h-[300px] flex-1">
          <MapView
            stops={stops}
            polyline={planner.route?.geometry || null}
            pickMode={planner.pickMode}
            onPick={planner.addAddressFromCoords}
          />
        </section>
      </main>
    </div>
  );
}

/** Basit uyarı kutusu. */
function Banner({ type, text }) {
  const styles =
    type === "error"
      ? "border-red-200 bg-red-50 text-red-700"
      : type === "info"
        ? "border-blue-200 bg-blue-50 text-blue-700"
        : "border-amber-200 bg-amber-50 text-amber-700";
  return (
    <div className={`flex items-start gap-2 rounded-lg border px-3 py-2 text-sm ${styles}`}>
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{text}</span>
    </div>
  );
}
