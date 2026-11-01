'use client';

interface Props {
  severity: string;
  size?: 'sm' | 'md';
}

const config: Record<string, { bg: string; text: string; border: string }> = {
  Severe: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
  severe: { bg: 'bg-red-500/10', text: 'text-red-500', border: 'border-red-500/20' },
  Medium: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  medium: { bg: 'bg-amber-500/10', text: 'text-amber-500', border: 'border-amber-500/20' },
  Low: { bg: 'bg-sky-500/10', text: 'text-sky-500', border: 'border-sky-500/20' },
  low: { bg: 'bg-sky-500/10', text: 'text-sky-500', border: 'border-sky-500/20' },
};

export default function SeverityBadge({ severity, size = 'sm' }: Props) {
  const s = config[severity] || config.Medium;
  const sizeClasses = size === 'md' ? 'px-2.5 py-1 text-xs' : 'px-2 py-0.5 text-[10px]';

  return (
    <span
      className={`inline-flex items-center rounded font-mono font-bold uppercase tracking-wider border ${s.bg} ${s.text} ${s.border} ${sizeClasses}`}
    >
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}
