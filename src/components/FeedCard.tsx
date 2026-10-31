'use client';

import Image from 'next/image';
import { AlertTriangle, Users, CheckCircle2 } from 'lucide-react';
import SeverityBadge from './SeverityBadge';
import { Pothole } from '../types';

interface Props {
  pothole: Pothole;
  onRepair?: () => void;
}

export default function FeedCard({ pothole, onRepair }: Props) {
  const repaired = pothole.status === 'repaired';
  return (
    <article className="flex flex-col gap-3 overflow-hidden rounded-xl border border-white/10 dark:border-gray-700/40 bg-white dark:bg-gray-900 shadow-sm transition hover:shadow-md">
      <Image
        src={pothole.photoUrl}
        alt={`Pothole reported at ${pothole.lat}, ${pothole.lng}`}
        fill
        sizes="300px"
        className="object-cover"
      />
      <div className="flex flex-col gap-2 p-3">
        <div className="flex items-center justify-between gap-2">
          <SeverityBadge severity={pothole.severity} />
          <span className="text-xs text-gray-500 dark:text-gray-400 font-medium tracking-wide uppercase">
            {new Date(pothole.timestamp).toLocaleDateString()}
            {new Date(pothole.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-500" fill="currentColor" />
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200">
            {pothole.lat.toFixed(4)}, {pothole.lng.toFixed(4)}
          </span>
        </div>
        <div className="flex items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-2">
            <Users className="w-3 h-3 text-gray-400" fill="currentColor" />
            <span className="text-xs text-gray-600 dark:text-gray-300">{pothole.confirmationCount} confirmations</span>
          </div>
          {repaired && (
            <CheckCircle2 className="w-4 h-4 text-emerald-500" fill="currentColor" />
          )}
        </div>
        {repaired && (
          <div className="flex items-center justify-between pt-2 border-t border-gray-100 dark:border-gray-800">
            <span className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 tracking-wider uppercase">repaired</span>
            <button
              onClick={onRepair}
              className="px-3 py-1.5 rounded-md text-xs font-semibold bg-emerald-50 dark:bg-emerald-900/20 text-emerald-600 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-800 hover:bg-emerald-100 dark:hover:bg-emerald-900/40 transition"
            >
              Verified Fixed
            </button>
          </div>
        )}
      </div>
    </article>
  );
}