"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { geocodeAddress } from "@/lib/geocoding";
import { optimizeRoute } from "@/lib/optimizer";
import { exportAddresses, importAddresses } from "@/lib/persistence";

// Nominatim politikası: saniyede en fazla 1 istek. Güvenli pay ile 1100ms.
const GEOCODE_THROTTLE_MS = 1100;

function makeId() {
  return `${Date.now()}-${Math.round(performance.now())}-${Math.floor(
    performance.now() % 1000,
  )}`;
}

/**
 * Uygulamanın tüm durumunu ve iş akışını yöneten merkezi hook.
 *
 * Otomatik Geocoding kuyruğu:
 *  - Adres eklenince status 'pending' olur.
 *  - Bir efekt, aynı anda yalnızca BİR 'pending' adresi sıralı olarak işler
 *    (paralel değil) ve her istek arasında GEOCODE_THROTTLE_MS bekler.
 */
export function useRoutePlanner() {
  const [addresses, setAddresses] = useState([]);
  const [route, setRoute] = useState(null); // { order, geometry, distance, duration }
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizeError, setOptimizeError] = useState(null);

  // Kuyruk işleme kilidi + tetikleyici sayaç.
  const processingRef = useRef(false);
  const [queueTick, setQueueTick] = useState(0);

  // ---- Yardımcı state güncelleyiciler -------------------------------------

  const patchAddress = useCallback((id, patch) => {
    setAddresses((prev) =>
      prev.map((a) => (a.id === id ? { ...a, ...patch } : a)),
    );
  }, []);

  // Adres listesi değişince mevcut rota geçersiz olur.
  const invalidateRoute = useCallback(() => {
    setRoute(null);
    setOptimizeError(null);
  }, []);

  // ---- CRUD ----------------------------------------------------------------

  const addAddress = useCallback(
    (raw) => {
      const text = (raw || "").trim();
      if (!text) return;
      setAddresses((prev) => [
        ...prev,
        { id: makeId(), raw: text, lat: null, lon: null, status: "pending", error: null },
      ]);
      invalidateRoute();
    },
    [invalidateRoute],
  );

  const removeAddress = useCallback(
    (id) => {
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      invalidateRoute();
    },
    [invalidateRoute],
  );

  const updateAddress = useCallback(
    (id, raw) => {
      const text = (raw || "").trim();
      if (!text) return;
      // Metin değişti → koordinatları sıfırla, tekrar geocode'a sok.
      patchAddress(id, { raw: text, lat: null, lon: null, status: "pending", error: null });
      invalidateRoute();
    },
    [patchAddress, invalidateRoute],
  );

  const retryAddress = useCallback(
    (id) => {
      patchAddress(id, { lat: null, lon: null, status: "pending", error: null });
    },
    [patchAddress],
  );

  const clearAll = useCallback(() => {
    setAddresses([]);
    invalidateRoute();
  }, [invalidateRoute]);

  // ---- Otomatik Geocoding kuyruğu -----------------------------------------

  useEffect(() => {
    if (processingRef.current) return;

    const next = addresses.find((a) => a.status === "pending");
    if (!next) return;

    processingRef.current = true;
    patchAddress(next.id, { status: "geocoding" });

    (async () => {
      try {
        const result = await geocodeAddress(next.raw);
        if (result) {
          patchAddress(next.id, {
            lat: result.lat,
            lon: result.lon,
            status: "ok",
            error: null,
          });
        } else {
          patchAddress(next.id, { status: "error", error: "Adres bulunamadı." });
        }
      } catch (err) {
        patchAddress(next.id, { status: "error", error: err.message });
      } finally {
        // Throttle: bir sonraki isteğe geçmeden önce bekle.
        setTimeout(() => {
          processingRef.current = false;
          setQueueTick((t) => t + 1); // kalan 'pending' varsa efekti yeniden tetikle
        }, GEOCODE_THROTTLE_MS);
      }
    })();
    // queueTick bağımlılığı, kuyruğun zincirleme ilerlemesini sağlar.
  }, [addresses, queueTick, patchAddress]);

  // ---- Optimizasyon --------------------------------------------------------

  const geocodedAddresses = addresses.filter((a) => a.status === "ok");
  const isGeocoding = addresses.some(
    (a) => a.status === "pending" || a.status === "geocoding",
  );
  const canOptimize = geocodedAddresses.length >= 2 && !isGeocoding && !isOptimizing;

  const optimize = useCallback(async () => {
    setOptimizeError(null);

    const ready = addresses.filter((a) => a.status === "ok");
    if (ready.length < 2) {
      setOptimizeError("Optimizasyon için koordinatı çözülmüş en az 2 adres gerekir.");
      return;
    }

    setIsOptimizing(true);
    try {
      const result = await optimizeRoute(
        ready.map((a) => ({ lat: a.lat, lon: a.lon })),
      );
      // result.order, `ready` dizisinin indekslerine göredir; gerçek adres
      // id'lerine eşleyerek saklıyoruz.
      const orderedIds = result.order.map((i) => ready[i].id);
      setRoute({
        orderedIds,
        geometry: result.geometry,
        distance: result.distance,
        duration: result.duration,
      });
    } catch (err) {
      setOptimizeError(err.message);
      setRoute(null);
    } finally {
      setIsOptimizing(false);
    }
  }, [addresses]);

  // ---- Import / Export -----------------------------------------------------

  const exportJSON = useCallback(() => {
    exportAddresses(addresses);
  }, [addresses]);

  const importJSON = useCallback(
    async (file) => {
      const normalized = await importAddresses(file);
      setAddresses(normalized);
      invalidateRoute();
    },
    [invalidateRoute],
  );

  return {
    // state
    addresses,
    route,
    isOptimizing,
    optimizeError,
    isGeocoding,
    geocodedCount: geocodedAddresses.length,
    canOptimize,
    // eylemler
    addAddress,
    removeAddress,
    updateAddress,
    retryAddress,
    clearAll,
    optimize,
    exportJSON,
    importJSON,
  };
}
