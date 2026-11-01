'use client';

import { useState } from 'react';
import {
  MapPin,
  ThumbsUp,
  Share2,
  ExternalLink,
  Clock,
  CheckCircle2,
  Check,
} from 'lucide-react';
import { Report } from '@/types';
import { timeAgo, googleMapsUrl, PLACEHOLDER_IMAGE } from '@/lib/utils';

interface Props {
  report: Report;
  onUpvote?: (id: string) => void;
  hasVoted?: boolean;
  onZoomImage?: (url: string) => void;
}

export default function ReportCard({ report, onUpvote, hasVoted, onZoomImage }: Props) {
  const [showProofPhoto, setShowProofPhoto] = useState(false);
  const [sharedToast, setSharedToast] = useState(false);

  const isRepaired = report.status === 'Repaired';
  const isDispatched = report.status === 'In Progress' || isRepaired;
  const isAcknowledged = report.status === 'Acknowledged' || isDispatched;

  const handleShare = async () => {
    const url = googleMapsUrl(report.latitude, report.longitude);
    const text = `🚨 Road Hazard: ${report.severity} severity at ${report.address || report.ward || 'Reported Location'}`;

    if (navigator.share) {
      try {
        await navigator.share({ title: 'Forge Road Hazard Alert', text, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      setSharedToast(true);
      setTimeout(() => setSharedToast(false), 2000);
    }
  };

  const activePhoto = showProofPhoto && report.resolution_image_url
    ? report.resolution_image_url
    : report.image_url;

  // Determine citizen-friendly address
  const isAddressRawCoords = !report.address || /^-?\d+(\.\d+)?[,\s]+-?\d+(\.\d+)?$/.test(report.address.trim());
  const displayAddress = isAddressRawCoords
    ? (report.ward ? `${report.ward} Road Hazard` : 'Reported Road Hazard')
    : report.address;

  return (
    <article className="bg-[var(--bg-surface)] border border-[var(--border-subtle)] rounded-2xl overflow-hidden shadow-sm transition-all hover:border-[var(--border-strong)]">
      {/* Header */}
      <div className="p-4 flex items-center justify-between gap-3 border-b border-[var(--border-subtle)] bg-[var(--bg-surface)]">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-9 h-9 rounded-lg bg-[var(--bg-elevated)] border border-[var(--border-subtle)] font-mono text-xs font-bold text-[var(--text-primary)] flex items-center justify-center shrink-0">
            {(report.user_name?.[0] || 'C').toUpperCase()}
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs sm:text-sm font-bold text-[var(--text-primary)] truncate">
                {report.user_name || 'Citizen Reporter'}
              </span>
              {report.ward && (
                <span className="font-mono text-[10px] px-2 py-0.5 rounded-md bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-subtle)] truncate max-w-[150px]">
                  {report.ward}
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 font-mono text-[11px] text-[var(--text-muted)] mt-0.5">
              <Clock size={11} />
              <span>{timeAgo(report.created_at)}</span>
              <span>•</span>
              <span className="truncate max-w-[140px]">{report.ward || 'Road Hazard'}</span>
            </div>
          </div>
        </div>

        {/* Severity & Status Badge Pair */}
        <div className="flex items-center gap-1.5 shrink-0">
          <span
            className={`font-mono text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border ${
              report.severity === 'Severe'
                ? 'bg-red-500/10 text-red-500 border-red-500/20'
                : report.severity === 'Medium'
                ? 'bg-amber-500/10 text-amber-500 border-amber-500/20'
                : 'bg-sky-500/10 text-sky-500 border-sky-500/20'
            }`}
          >
            {report.severity}
          </span>
          <span
            className={`font-mono text-[10px] font-semibold px-2 py-0.5 rounded border ${
              isRepaired
                ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20'
                : 'bg-[var(--bg-elevated)] text-[var(--text-secondary)] border-[var(--border-subtle)]'
            }`}
          >
            {report.status}
          </span>
        </div>
      </div>

      {/* Constrained Image Viewport */}
      <div className="relative h-[320px] sm:h-[360px] w-full bg-zinc-950 overflow-hidden border-y border-[var(--border-subtle)] cursor-zoom-in group">
        <img
          src={activePhoto}
          alt={`Hazard at ${displayAddress}`}
          className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          onClick={() => onZoomImage?.(activePhoto)}
          onError={(e) => {
            (e.target as HTMLImageElement).src = PLACEHOLDER_IMAGE;
          }}
        />

        {/* Top-Right: Before/After Proof Toggle (Visible if Repaired) */}
        {isRepaired && report.resolution_image_url && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setShowProofPhoto(!showProofPhoto);
            }}
            className="absolute top-3 right-3 px-3 py-1.5 rounded-lg bg-black/80 backdrop-blur-md border border-white/20 text-white font-mono text-[11px] font-bold shadow-lg hover:bg-black transition-all flex items-center gap-1.5"
          >
            <CheckCircle2 size={13} className="text-emerald-400" />
            <span>{showProofPhoto ? 'Show Original Hazard' : 'Show Repaired Road'}</span>
          </button>
        )}

        {/* Bottom Citizen Badge */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <div className="backdrop-blur-md bg-black/75 border border-white/10 text-white px-3 py-1.5 rounded-lg font-mono text-[11px] flex items-center gap-2 shadow-lg">
            <span className="text-[#F7D10C] font-bold">Verified Hazard</span>
            <span className="text-zinc-500">•</span>
            <span>~{report.estimated_diameter_cm || 30}cm</span>
            {report.ward && (
              <>
                <span className="text-zinc-500">•</span>
                <span className="text-zinc-300 truncate max-w-[160px]">{report.ward}</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Body: Location, Progress & Community Confirmation */}
      <div className="p-4 sm:p-5 space-y-4">
        {/* Address & Google Maps Link */}
        <div className="flex items-start justify-between gap-3 text-xs">
          <div className="flex items-start gap-1.5 min-w-0">
            <MapPin size={14} className="text-[#F7D10C] shrink-0 mt-0.5" />
            <span className="font-semibold text-[var(--text-primary)] leading-snug">
              {displayAddress}
            </span>
          </div>

          <a
            href={googleMapsUrl(report.latitude, report.longitude)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[11px] text-[var(--text-secondary)] hover:text-[#F7D10C] shrink-0 flex items-center gap-1 transition-colors"
            title="Open in Google Maps"
          >
            <span>View Map</span>
            <ExternalLink size={11} />
          </a>
        </div>

        {/* Citizen Repair Timeline */}
        <div className="space-y-1.5 pt-1">
          <div className="flex items-center justify-between font-mono text-[10px] text-[var(--text-muted)] uppercase tracking-wider">
            <span>REPAIR PROGRESS</span>
            <span className={isRepaired ? 'text-emerald-500 font-bold' : 'text-[#F7D10C] font-bold'}>
              {report.status}
            </span>
          </div>

          <div className="grid grid-cols-4 gap-1.5">
            {/* Step 1: Reported */}
            <div className="space-y-1">
              <div className="h-1.5 rounded-full bg-[#F7D10C]" />
              <span className="block font-mono text-[9px] text-[var(--text-secondary)] text-center">
                1. Reported
              </span>
            </div>

            {/* Step 2: Verified */}
            <div className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  isAcknowledged ? 'bg-[#F7D10C]' : 'bg-[var(--border-subtle)]'
                }`}
              />
              <span className="block font-mono text-[9px] text-[var(--text-secondary)] text-center">
                2. Verified
              </span>
            </div>

            {/* Step 3: Dispatched */}
            <div className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  isDispatched ? 'bg-[#F7D10C]' : 'bg-[var(--border-subtle)]'
                }`}
              />
              <span className="block font-mono text-[9px] text-[var(--text-secondary)] text-center">
                3. Dispatched
              </span>
            </div>

            {/* Step 4: Repaired */}
            <div className="space-y-1">
              <div
                className={`h-1.5 rounded-full transition-colors ${
                  isRepaired ? 'bg-emerald-500' : 'bg-[var(--border-subtle)]'
                }`}
              />
              <span
                className={`block font-mono text-[9px] text-center ${
                  isRepaired ? 'text-emerald-500 font-bold' : 'text-[var(--text-secondary)]'
                }`}
              >
                4. Repaired
              </span>
            </div>
          </div>
        </div>

        {/* Official Resolution Note (if repaired) */}
        {isRepaired && report.resolution_note && (
          <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-[var(--text-primary)] flex items-start gap-2">
            <Check size={14} className="text-emerald-500 shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-emerald-500 block text-[11px] font-mono">
                MUNICIPAL RESOLUTION:
              </span>
              <p className="mt-0.5 text-[var(--text-secondary)]">{report.resolution_note}</p>
            </div>
          </div>
        )}

        {/* Action Footer: Upvote & Share */}
        <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => onUpvote?.(report.id)}
            disabled={hasVoted}
            className={`px-3.5 py-2 rounded-xl text-xs font-bold font-mono flex items-center gap-2 transition-all cursor-pointer ${
              hasVoted
                ? 'bg-[#F7D10C] text-[#09090b] shadow-sm cursor-default'
                : 'bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-primary)] border border-[var(--border-subtle)] active:scale-95'
            }`}
          >
            <ThumbsUp size={13} className={hasVoted ? 'fill-current' : ''} />
            <span>{hasVoted ? 'Confirmed' : '+1 Confirm Hazard'}</span>
            <span className="opacity-75">({report.upvotes || 0})</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleShare}
              className="p-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--bg-elevated)] hover:bg-[var(--bg-elevated-hover)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
              title="Share Incident"
            >
              <Share2 size={14} />
            </button>
            {sharedToast && (
              <span className="font-mono text-[10px] text-[#F7D10C] animate-fade-in">
                Link copied!
              </span>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}
