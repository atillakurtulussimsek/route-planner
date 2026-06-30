"use client";

import { Navigation, Clock, MapPin } from "lucide-react";

/** Optimize rota özetini gösterir: toplam mesafe, süre, durak sayısı. */
export default function StatsPanel({ route, stopCount }) {
  if (!route) return null;

  const km = (route.distance / 1000).toFixed(1);
  const minutes = Math.round(route.duration / 60);
  const durationText =
    minutes >= 60
      ? `${Math.floor(minutes / 60)} sa ${minutes % 60} dk`
      : `${minutes} dk`;

  return (
    <div className="grid grid-cols-3 gap-2">
      <Stat icon={<MapPin className="h-4 w-4" />} label="Durak" value={stopCount} />
      <Stat icon={<Navigation className="h-4 w-4" />} label="Mesafe" value={`${km} km`} />
      <Stat icon={<Clock className="h-4 w-4" />} label="Süre" value={durationText} />
    </div>
  );
}

function Stat({ icon, label, value }) {
  return (
    <div className="flex flex-col items-center justify-center rounded-lg border border-slate-200 bg-white px-2 py-2 text-center shadow-sm">
      <div className="flex items-center gap-1 text-xs text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-0.5 text-sm font-bold text-slate-800">{value}</div>
    </div>
  );
}
