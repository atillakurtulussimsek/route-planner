"use client";

import { useEffect, useMemo } from "react";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Polyline,
  useMap,
  useMapEvents,
} from "react-leaflet";
import L from "leaflet";

// Türkiye merkezli varsayılan görünüm (henüz nokta yokken).
const DEFAULT_CENTER = [39.0, 35.0];
const DEFAULT_ZOOM = 6;

/**
 * Numaralı durak pini (Leaflet divIcon — harici marker görseli gerektirmez).
 * type: 'start' (yeşil) | 'end' (kırmızı) | 'mid'/'plain' (mavi)
 */
function makePinIcon(label, type) {
  return L.divIcon({
    className: `stop-pin ${type}`,
    html: `<div><span>${label}</span></div>`,
    iconSize: [28, 28],
    iconAnchor: [14, 28], // pinin ucu (sivri kısım) koordinata otursun
    popupAnchor: [0, -28],
  });
}

/** Tüm nokta/çizgileri kapsayacak şekilde haritayı otomatik sığdırır. */
function FitBounds({ positions }) {
  const map = useMap();

  useEffect(() => {
    if (!positions || positions.length === 0) return;
    if (positions.length === 1) {
      map.setView(positions[0], 14);
      return;
    }
    const bounds = L.latLngBounds(positions);
    map.fitBounds(bounds, { padding: [40, 40] });
  }, [map, positions]);

  return null;
}

/**
 * Pick modu aktifken haritaya tıklamayı yakalar ve koordinatı yukarı bildirir.
 * (react-leaflet event'leri yalnızca MapContainer çocuğu bir bileşenden dinlenir.)
 */
function ClickToAdd({ enabled, onPick }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

/**
 * @param {Array<{lat,lon,label,seq,type,id}>} stops - haritada gösterilecek duraklar
 * @param {Array<[number,number]>|null} polyline - optimize güzergah çizgisi
 * @param {boolean} pickMode - haritadan tıklayarak nokta ekleme modu açık mı
 * @param {(lat:number, lon:number)=>void} onPick - tıklanan koordinatı bildirir
 */
export default function MapView({ stops = [], polyline = null, pickMode = false, onPick }) {
  const positions = useMemo(() => {
    const pts = stops.map((s) => [s.lat, s.lon]);
    if (polyline?.length) pts.push(...polyline);
    return pts;
  }, [stops, polyline]);

  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      scrollWheelZoom
      className={`h-full w-full ${pickMode ? "pick-mode-cursor" : ""}`}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> katkıda bulunanları'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      {polyline?.length > 1 && (
        <Polyline positions={polyline} pathOptions={{ color: "#2563eb", weight: 5, opacity: 0.75 }} />
      )}

      {stops.map((s) => (
        <Marker
          key={s.id}
          position={[s.lat, s.lon]}
          icon={makePinIcon(s.label, s.type)}
        >
          <Popup>
            <strong>
              {s.seq ? `${s.seq}. Durak` : "Durak"}
            </strong>
            <br />
            {s.raw}
          </Popup>
        </Marker>
      ))}

      <FitBounds positions={positions} />
      <ClickToAdd enabled={pickMode} onPick={onPick} />
    </MapContainer>
  );
}
