'use client';

import type { Severity } from '@/types';

interface Props {
  severity: string;
  size?: 'sm' | 'md';
}

const config: Record<string, { bg: string; text: string; border: string }> = {
  Severe: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  severe: { bg: 'bg-red-500/20', text: 'text-red-400', border: 'border-red-500/30' },
  Medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  medium: { bg: 'bg-amber-500/20', text: 'text-amber-400', border: 'border-amber-500/30' },
  Low: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
  low: { bg: 'bg-emerald-500/20', text: 'text-emerald-400', border: 'border-emerald-500/30' },
};

export default function SeverityBadge({ severity, size = 'sm' }: Props) {
  const s = config[severity] || config.Medium;
  const sizeClasses = size === 'md' ? 'px-3 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center rounded-full font-bold uppercase tracking-wider border ${s.bg} ${s.text} ${s.border} ${sizeClasses}`}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}
