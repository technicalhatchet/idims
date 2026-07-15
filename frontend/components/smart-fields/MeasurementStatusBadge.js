'use client';

const STATUS_TONES = {
  normal: { dot: 'bg-emerald-400', text: 'text-emerald-300', sub: 'text-emerald-400/70' },
  warning: { dot: 'bg-amber-400', text: 'text-amber-200', sub: 'text-amber-300/70' },
  critical: { dot: 'bg-red-400', text: 'text-red-300', sub: 'text-red-400/70' },
  unknown: { dot: 'bg-gray-500', text: 'text-gray-400', sub: 'text-gray-500' },
  not_tested: { dot: 'bg-gray-600', text: 'text-gray-500', sub: 'text-gray-600' },
};

const FALLBACK_STATUS_LABELS = {
  normal: 'OK',
  warning: 'Check',
  critical: 'Critical',
  unknown: '—',
  not_tested: 'Not tested',
};

export default function MeasurementStatusBadge({ status, evaluation, variant = 'mobile' }) {
  const meta = STATUS_TONES[status] || STATUS_TONES.unknown;
  const isMobile = variant === 'mobile';
  const diagnosisLabel = evaluation?.diagnosisLabel;
  const severityLabel = evaluation?.severityLabel || FALLBACK_STATUS_LABELS[status] || '—';
  const primaryLabel = diagnosisLabel || FALLBACK_STATUS_LABELS[status] || '—';

  return (
    <span className={`inline-flex flex-col items-end gap-0.5 text-right ${isMobile ? '' : ''}`}>
      <span
        className={`inline-flex items-center gap-1.5 text-[11px] font-semibold leading-tight ${
          isMobile ? meta.text : meta.text
        }`}
      >
        <span className={`h-2 w-2 rounded-full shrink-0 ${meta.dot}`} aria-hidden />
        {primaryLabel}
      </span>
      {diagnosisLabel && severityLabel && severityLabel !== primaryLabel ? (
        <span className={`text-[9px] uppercase tracking-wide font-medium ${meta.sub}`}>
          {severityLabel}
        </span>
      ) : null}
    </span>
  );
}
