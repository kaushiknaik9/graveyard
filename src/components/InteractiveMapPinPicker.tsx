'use client';

import { useState, useEffect } from 'react';
import { MapPin, Compass } from 'lucide-react';

interface Props {
  initialLat: number;
  initialLng: number;
  onSelectCoords: (lat: number, lng: number) => void;
  onClose?: () => void;
}

export default function InteractiveMapPinPicker({
  initialLat,
  initialLng,
  onSelectCoords,
  onClose,
}: Props) {
  const [lat, setLat] = useState(initialLat || 15.3647);
  const [lng, setLng] = useState(initialLng || 75.1240);

  useEffect(() => {
    if (initialLat && initialLng) {
      setLat(initialLat);
      setLng(initialLng);
    }
  }, [initialLat, initialLng]);

  const handleAdjust = (dLat: number, dLng: number) => {
    const newLat = lat + dLat;
    const newLng = lng + dLng;
    setLat(newLat);
    setLng(newLng);
    onSelectCoords(newLat, newLng);
  };

  const handleApply = () => {
    onSelectCoords(lat, lng);
    onClose?.();
  };

  return (
    <div className="rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-surface)] p-4 text-[var(--text-primary)] shadow-xl">
      <div className="flex items-center justify-between pb-3 border-b border-[var(--border-subtle)]">
        <div className="flex items-center gap-2">
          <MapPin size={16} className="text-[#F7D10C]" />
          <h4 className="font-mono text-xs font-bold text-[var(--text-primary)] uppercase">
            Manual Street Pin
          </h4>
        </div>
        <span className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)]">
          {lat.toFixed(5)}, {lng.toFixed(5)}
        </span>
      </div>

      <p className="text-xs text-[var(--text-secondary)] my-2.5">
        Desktop browser GPS unavailable. Use directional controls or nudge the pin to match your street.
      </p>

      {/* Map Embed Frame */}
      <div className="relative w-full h-52 rounded-xl overflow-hidden border border-[var(--border-subtle)] bg-zinc-950">
        <iframe
          title="Street Pin Location Picker"
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.003}%2C${lat - 0.002}%2C${lng + 0.003}%2C${lat + 0.002}&layer=mapnik&marker=${lat}%2C${lng}`}
          className="w-full h-full filter contrast-125"
        />

        {/* Center Target Crosshair */}
        <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
          <div className="relative">
            <MapPin size={26} className="text-red-500 fill-red-500 drop-shadow-md -translate-y-3 animate-bounce" />
          </div>
        </div>

        {/* Directional Nudge Pad */}
        <div className="absolute bottom-2 right-2 flex flex-col items-center bg-black/80 backdrop-blur-md rounded-xl p-1.5 border border-white/20 shadow-lg font-mono">
          <button
            type="button"
            onClick={() => handleAdjust(0.0006, 0)}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white text-xs font-bold cursor-pointer"
            title="Move North"
          >
            ▲
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => handleAdjust(0, -0.0006)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white text-xs font-bold cursor-pointer"
              title="Move West"
            >
              ◀
            </button>
            <Compass size={14} className="text-[#F7D10C] my-auto" />
            <button
              type="button"
              onClick={() => handleAdjust(0, 0.0006)}
              className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white text-xs font-bold cursor-pointer"
              title="Move East"
            >
              ▶
            </button>
          </div>
          <button
            type="button"
            onClick={() => handleAdjust(-0.0006, 0)}
            className="p-1 hover:bg-zinc-800 rounded text-zinc-300 hover:text-white text-xs font-bold cursor-pointer"
            title="Move South"
          >
            ▼
          </button>
        </div>
      </div>

      {/* Preset Landmark Quick-Pickers */}
      <div className="mt-3 flex flex-wrap gap-1.5 font-mono text-[10px]">
        <span className="text-[var(--text-muted)] uppercase font-semibold self-center mr-1">Quick Select:</span>
        <button
          type="button"
          onClick={() => { setLat(15.3647); setLng(75.1240); onSelectCoords(15.3647, 75.1240); }}
          className="px-2 py-1 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] transition cursor-pointer"
        >
          Vidyanagar (Zone 2)
        </button>
        <button
          type="button"
          onClick={() => { setLat(15.3524); setLng(75.1388); onSelectCoords(15.3524, 75.1388); }}
          className="px-2 py-1 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] transition cursor-pointer"
        >
          Central Hubballi (Zone 1)
        </button>
        <button
          type="button"
          onClick={() => { setLat(15.4589); setLng(75.0078); onSelectCoords(15.4589, 75.0078); }}
          className="px-2 py-1 rounded bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-secondary)] border border-[var(--border-subtle)] transition cursor-pointer"
        >
          Dharwad (Zone 4)
        </button>
      </div>

      <div className="flex gap-2 mt-4 pt-2 border-t border-[var(--border-subtle)]">
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2 rounded-xl bg-[var(--bg-elevated)] text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--bg-elevated-hover)] transition cursor-pointer"
          >
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleApply}
          className="flex-1 py-2 rounded-xl bg-[#F7D10C] text-[#09090b] text-xs font-mono font-bold hover:brightness-105 transition shadow-sm cursor-pointer"
        >
          ✓ Set Pin Location
        </button>
      </div>
    </div>
  );
}
