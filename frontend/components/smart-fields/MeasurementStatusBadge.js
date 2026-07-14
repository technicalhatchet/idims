'use client';

const STATUS_META = {
  normal: { label: 'Normal', dot: 'bg-emerald-400', text: 'text-emerald-300' },
  warning: { label: 'Check', dot: 'bg-amber-400', text: 'text-amber-200' },
  critical: { label: 'Critical', dot: 'bg-red-400', text: 'text-red-300' },
  unknown: { label: '—', dot: 'bg-gray-500', text: 'text-gray-400' },
  not_tested: { label: 'Not tested', dot: 'bg-gray-600', text: 'text-gray-500' },
};

export default function MeasurementStatusBadge({ status, variant = 'mobile' }) {
  const meta = STATUS_META[status] || STATUS_META.unknown;
  const isMobile = variant === 'mobile';
  return (
    <span
      className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
        isMobile ? meta.text : `${meta.text} dark:${meta.text}`
      }`}
    >
      <span className={`h-2 w-2 rounded-full ${meta.dot}`} aria-hidden />
      {meta.label}
    </span>
  );
}
