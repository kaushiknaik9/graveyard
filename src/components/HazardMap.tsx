'use client';

import { useState } from 'react';
import { Report } from '../types';
import { MapPin, Sparkles, Navigation, Layers, ExternalLink, ThumbsUp, X } from 'lucide-react';
import SeverityBadge from './SeverityBadge';
import { googleMapsUrl, formatCoords, timeAgo } from '../lib/utils';

interface Props {
  reports: Report[];
  onUpvote?: (id: string) => void;
  userVotedIds?: Set<string>;
}

export default function HazardMap({ reports, onUpvote, userVotedIds }: Props) {
  const [selectedReport, setSelectedReport] = useState<Report | null>(null);

  const centerLat = reports.length > 0 ? reports[0].latitude : 15.3647;
  const centerLng = reports.length > 0 ? reports[0].longitude : 75.1240;

  return (
    <div className="relative w-full h-[70vh] md:h-[76vh] rounded-2xl overflow-hidden border border-[var(--border-subtle)] bg-[var(--bg-surface)] shadow-md flex flex-col">
      {/* Top Map Control Bar */}
      <div className="absolute top-4 left-4 right-4 z-20 flex items-center justify-between pointer-events-none">
        <div className="px-3.5 py-1.5 rounded-xl bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] text-xs text-[var(--text-primary)] flex items-center gap-2 shadow-sm pointer-events-auto font-mono">
          <Layers size={14} className="text-[#F7D10C]" />
          <span className="font-bold">{reports.length} Telemetry Pins</span>
        </div>

        {/* Legend */}
        <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 rounded-xl bg-[var(--bg-surface)]/90 backdrop-blur-md border border-[var(--border-subtle)] font-mono text-[11px] shadow-sm pointer-events-auto">
          <span className="flex items-center gap-1.5 text-red-500 font-semibold">
            <span className="w-2 h-2 rounded-full bg-red-500" /> Severe
          </span>
          <span className="flex items-center gap-1.5 text-amber-500 font-semibold">
            <span className="w-2 h-2 rounded-full bg-amber-500" /> Medium
          </span>
          <span className="flex items-center gap-1.5 text-emerald-500 font-semibold">
            <span className="w-2 h-2 rounded-full bg-emerald-500" /> Repaired
          </span>
        </div>
      </div>

      {/* Main Map Tile Canvas */}
      <div className="relative flex-1 w-full bg-zinc-950">
        <iframe
          title="Live Hazard Geospatial Grid"
          width="100%"
          height="100%"
          frameBorder="0"
          scrolling="no"
          marginHeight={0}
          marginWidth={0}
          src={`https://www.openstreetmap.org/export/embed.html?bbox=${centerLng - 0.05}%2C${centerLat - 0.03}%2C${centerLng + 0.05}%2C${centerLat + 0.03}&layer=mapnik`}
          className="w-full h-full filter contrast-125 brightness-90 pointer-events-auto"
        />

        {/* Dynamic Simulated Interactive Geo-pins placed on the viewport */}
        <div className="absolute inset-0 pointer-events-none">
          {reports.slice(0, 15).map((r) => {
            const offsetX = 50 + (r.longitude - centerLng) * 800;
            const offsetY = 50 - (r.latitude - centerLat) * 800;
            const clampedX = Math.max(8, Math.min(92, offsetX));
            const clampedY = Math.max(12, Math.min(88, offsetY));

            const isSevere = r.severity === 'Severe';
            const isRepaired = r.status === 'Repaired';
            const pinColor = isRepaired
              ? 'bg-emerald-500 text-black shadow-emerald-500/30'
              : isSevere
              ? 'bg-red-500 text-white shadow-red-500/40 animate-bounce'
              : 'bg-[#F7D10C] text-black shadow-yellow-500/30';

            return (
              <button
                key={r.id}
                type="button"
                onClick={() => setSelectedReport(r)}
                style={{ left: `${clampedX}%`, top: `${clampedY}%` }}
                className={`absolute pointer-events-auto transform -translate-x-1/2 -translate-y-full p-1.5 rounded-full shadow-lg transition hover:scale-125 z-10 cursor-pointer ${pinColor}`}
                title={`${r.severity} hazard: ${r.address || 'Street'}`}
              >
                <MapPin size={16} className="fill-current" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected Incident Drawer Popup */}
      {selectedReport && (
        <div className="absolute bottom-4 inset-x-4 z-30 max-w-lg mx-auto bg-[var(--bg-surface)] border border-[var(--border-strong)] rounded-2xl p-4 shadow-xl animate-slide-up text-[var(--text-primary)]">
          <div className="flex items-start justify-between gap-3 mb-2">
            <div className="flex items-center gap-2">
              <SeverityBadge severity={selectedReport.severity} size="sm" />
              <span className="font-mono text-xs font-bold text-[var(--text-secondary)]">
                {selectedReport.ward || 'Municipal Ward'}
              </span>
            </div>
            <button
              onClick={() => setSelectedReport(null)}
              className="text-[var(--text-muted)] hover:text-[var(--text-primary)] transition p-1 cursor-pointer"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex gap-3">
            <img
              src={selectedReport.image_url}
              alt="Hazard"
              className="w-16 h-16 rounded-xl object-cover bg-zinc-900 border border-[var(--border-subtle)] shrink-0"
            />
            <div className="flex-1 min-w-0">
              <h4 className="text-sm font-bold text-[var(--text-primary)] truncate">
                {selectedReport.address || 'Street Location'}
              </h4>
              <p className="text-xs text-[var(--text-secondary)] line-clamp-1 mt-0.5">
                {selectedReport.status === 'Repaired' ? 'Road repaired by municipal crew' : `Verified road hazard • ~${selectedReport.estimated_diameter_cm || 30}cm`}
              </p>
              <div className="flex items-center gap-2 mt-2 font-mono text-[11px] text-[var(--text-muted)]">
                <span>{timeAgo(selectedReport.created_at)}</span>
                <span>•</span>
                <span>{formatCoords(selectedReport.latitude, selectedReport.longitude)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-[var(--border-subtle)]">
            <a
              href={googleMapsUrl(selectedReport.latitude, selectedReport.longitude)}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-xs font-semibold text-[#F7D10C] hover:underline flex items-center gap-1.5 transition"
            >
              <Navigation size={12} />
              Open GPS Navigation
            </a>

            {onUpvote && (
              <button
                type="button"
                onClick={() => onUpvote(selectedReport.id)}
                disabled={userVotedIds?.has(selectedReport.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold flex items-center gap-1.5 transition cursor-pointer ${
                  userVotedIds?.has(selectedReport.id)
                    ? 'bg-[#F7D10C] text-black'
                    : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)]'
                }`}
              >
                <ThumbsUp size={12} className={userVotedIds?.has(selectedReport.id) ? 'fill-black' : ''} />
                {userVotedIds?.has(selectedReport.id) ? 'Confirmed' : `${selectedReport.upvotes || 0} Confirm`}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
