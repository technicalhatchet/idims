'use client';

import { computeDiagnosisConfidence } from './intelligence/evidenceDisplay';

const TIER_META = {
  high: {
    label: 'High confidence',
    tone: 'text-emerald-300',
    bar: 'bg-emerald-400',
    track: 'bg-emerald-500/20',
  },
  medium: {
    label: 'Medium confidence',
    tone: 'text-amber-200',
    bar: 'bg-amber-400',
    track: 'bg-amber-500/20',
  },
  low: {
    label: 'Low confidence',
    tone: 'text-gray-300',
    bar: 'bg-gray-400',
    track: 'bg-white/10',
  },
};

function ConfidenceStars({ count, variant }) {
  const isMobile = variant === 'mobile';
  return (
    <span className={`text-[10px] tracking-widest ${isMobile ? 'text-amber-300/90' : 'text-amber-500'}`}>
      {'★'.repeat(count)}
      <span className="opacity-30">{'★'.repeat(Math.max(0, 5 - count))}</span>
    </span>
  );
}

export default function DiagnosisConfidenceMeter({ intelligence, variant = 'mobile' }) {
  const result = computeDiagnosisConfidence(intelligence);
  if (!result) return null;

  const isMobile = variant === 'mobile';
  const meta = TIER_META[result.tier] || TIER_META.low;

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-[11px] space-y-2 ${
        isMobile
          ? 'border-cyan-500/25 bg-cyan-500/[0.06] text-cyan-50'
          : 'border-cyan-200 bg-cyan-50 text-cyan-950 dark:border-cyan-800 dark:bg-cyan-950/30 dark:text-cyan-100'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold uppercase tracking-wide opacity-90">Diagnosis confidence</p>
        <ConfidenceStars count={result.stars} variant={variant} />
      </div>

      <div className="flex items-end justify-between gap-3">
        <span className={`text-2xl font-bold tabular-nums leading-none ${meta.tone}`}>
          {result.percent}%
        </span>
        <span className={`text-[10px] uppercase tracking-wide font-medium ${meta.tone}`}>
          {meta.label}
        </span>
      </div>

      <div className={`h-2 rounded-full overflow-hidden ${isMobile ? meta.track : `${meta.track}`}`}>
        <div
          className={`h-full transition-all ${meta.bar}`}
          style={{ width: `${result.percent}%` }}
        />
      </div>

      <p className={`opacity-80 leading-snug ${isMobile ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>
        {result.explanation}
      </p>
    </div>
  );
}
