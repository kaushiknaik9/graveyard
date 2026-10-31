'use client';

type Severity = 'low' | 'medium' | 'severe';

interface Props {
  severity: Severity;
}

const severityStyles: Record<Severity, { bg: string; border: string; text: string }> = {
  low: { bg: 'bg-green-100 dark:bg-green-900', border: 'border-green-200 dark:border-green-800', text: 'text-green-700 dark:text-green-400' },
  medium: { bg: 'bg-amber-100 dark:bg-amber-900', border: 'border-amber-200 dark:border-amber-800', text: 'text-amber-700 dark:text-amber-400' },
  severe: { bg: 'bg-red-100 dark:bg-red-900', border: 'border-red-200 dark:border-red-800', text: 'text-red-700 dark:text-red-400' },
};

export default function SeverityBadge({ severity }: Props) {
  const s = severityStyles[severity];
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-md text-[10px] font-bold tracking-wider uppercase ${s.bg} ${s.border} ${s.text}`}>
      {severity.charAt(0).toUpperCase() + severity.slice(1)}
    </span>
  );
}
