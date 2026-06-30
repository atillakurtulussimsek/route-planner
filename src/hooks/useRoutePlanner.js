"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { geocodeAddress, reverseGeocode } from "@/lib/geocoding";
import { optimizeRoute } from "@/lib/optimizer";
import { exportAddresses, importAddresses } from "@/lib/persistence";
import { printRouteList } from "@/lib/routePrint";

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

  // Haritadan tıklayarak nokta ekleme modu (Toolbar butonu ile aç/kapat).
  const [pickMode, setPickMode] = useState(false);

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
        {
          id: makeId(),
          raw: text,
          customer: "",
          orderNo: "",
          lat: null,
          lon: null,
          status: "pending",
          error: null,
        },
      ]);
      invalidateRoute();
    },
    [invalidateRoute],
  );

  // Haritaya tıklanan koordinatı doğrudan ekler. Koordinat zaten elde olduğu
  // için nokta anında 'ok' durumunda görünür; insan-okur etiket arkaplanda ters
  // geocoding ile getirilip güncellenir (başarısız olursa koordinat etiketi kalır).
  const addAddressFromCoords = useCallback(
    async (lat, lon) => {
      if (!Number.isFinite(lat) || !Number.isFinite(lon)) return;

      const id = makeId();
      const coordLabel = `Konum: ${lat.toFixed(5)}, ${lon.toFixed(5)}`;
      setAddresses((prev) => [
        ...prev,
        {
          id,
          raw: coordLabel,
          customer: "",
          orderNo: "",
          lat,
          lon,
          status: "ok",
          error: null,
        },
      ]);
      invalidateRoute();

      try {
        const label = await reverseGeocode(lat, lon);
        if (label) patchAddress(id, { raw: label });
      } catch {
        /* ters geocoding başarısız olsa da koordinat geçerli; etiket koordinatta kalır */
      }
    },
    [invalidateRoute, patchAddress],
  );

  const togglePickMode = useCallback(() => {
    setPickMode((prev) => !prev);
  }, []);

  const removeAddress = useCallback(
    (id) => {
      setAddresses((prev) => prev.filter((a) => a.id !== id));
      invalidateRoute();
    },
    [invalidateRoute],
  );

  // fields: { raw?, customer?, orderNo? } — verilen alanları günceller.
  // Yalnızca ADRES metni değişirse koordinatlar sıfırlanıp yeniden geocode'a
  // sokulur ve rota geçersiz olur; müşteri adı / sipariş no değişimi koordinatı
  // ve rotayı etkilemez.
  const updateAddress = useCallback(
    (id, fields) => {
      const current = addresses.find((a) => a.id === id);
      if (!current) return;

      const patch = {};
      if (typeof fields.customer === "string") patch.customer = fields.customer.trim();
      if (typeof fields.orderNo === "string") patch.orderNo = fields.orderNo.trim();

      let textChanged = false;
      if (typeof fields.raw === "string") {
        const text = fields.raw.trim();
        if (text && text !== current.raw) {
          patch.raw = text;
          patch.lat = null;
          patch.lon = null;
          patch.status = "pending";
          patch.error = null;
          textChanged = true;
        }
      }

      if (Object.keys(patch).length === 0) return;
      patchAddress(id, patch);
      if (textChanged) invalidateRoute();
    },
    [addresses, patchAddress, invalidateRoute],
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

  // ---- Rota listesini yazdır / PDF ----------------------------------------

  // Optimize edilmiş rutayı ziyaret sırasına göre yazdırılabilir liste olarak açar
  // (yöneticilere rut bilgisi vermek için). Yalnızca rota varken anlamlıdır.
  const printRoute = useCallback(() => {
    if (!route?.orderedIds?.length) return;
    const byId = new Map(addresses.map((a) => [a.id, a]));
    const stops = route.orderedIds
      .map((id, idx) => {
        const a = byId.get(id);
        if (!a || a.lat == null) return null;
        return {
          seq: idx + 1,
          raw: a.raw,
          customer: a.customer || "",
          orderNo: a.orderNo || "",
          lat: a.lat,
          lon: a.lon,
        };
      })
      .filter(Boolean);
    if (stops.length === 0) return;

    printRouteList({
      stops,
      distance: route.distance,
      duration: route.duration,
      dateText: new Date().toLocaleString("tr-TR"),
    });
  }, [addresses, route]);

  return {
    // state
    addresses,
    route,
    isOptimizing,
    optimizeError,
    isGeocoding,
    geocodedCount: geocodedAddresses.length,
    canOptimize,
    pickMode,
    // eylemler
    addAddress,
    addAddressFromCoords,
    togglePickMode,
    removeAddress,
    updateAddress,
    retryAddress,
    clearAll,
    optimize,
    exportJSON,
    importJSON,
    printRoute,
    hasRoute: !!route?.orderedIds?.length,
  };
}
