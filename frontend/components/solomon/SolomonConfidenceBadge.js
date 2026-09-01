'use client';

import { computeDiagnosisConfidence } from '../diagnostics/intelligence/evidenceDisplay';

const TIER_LABELS = {
  low: 'Early confidence',
  medium: 'Trending confidence',
  high: 'Strong confidence',
};

const TIER_BAR_CLASS = {
  low: 'bg-amber-400',
  medium: 'bg-[var(--solomon-primary-from)]',
  high: 'bg-emerald-400',
};

export default function SolomonConfidenceBadge({
  intelligence,
  className = '',
  compact = false,
}) {
  const confidence = computeDiagnosisConfidence(intelligence);
  if (!confidence) return null;

  const tierLabel = TIER_LABELS[confidence.tier] || 'Confidence';
  const barClass = TIER_BAR_CLASS[confidence.tier] || TIER_BAR_CLASS.low;

  return (
    <div
      role="group"
      aria-label={`Diagnostic confidence: ${confidence.percent} percent, ${tierLabel}`}
      className={`rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] ${
        compact ? 'px-2.5 py-2' : 'px-3 py-2.5'
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className={`font-medium text-[var(--solomon-text-secondary)] ${compact ? 'text-[10px]' : 'text-[11px]'}`}>
          {tierLabel}
        </p>
        <p className={`font-bold tabular-nums text-[var(--solomon-text-primary)] ${compact ? 'text-sm' : 'text-base'}`}>
          {confidence.percent}%
        </p>
      </div>
      <div
        className={`mt-1.5 h-1.5 overflow-hidden rounded-full bg-[var(--solomon-border-muted)] ${compact ? 'mt-1' : ''}`}
        aria-hidden
      >
        <div
          className={`h-full rounded-full transition-all ${barClass}`}
          style={{ width: `${Math.min(100, confidence.percent)}%` }}
        />
      </div>
      {!compact && confidence.explanation ? (
        <p className="mt-1.5 text-[10px] leading-snug text-[var(--solomon-text-muted)] line-clamp-2">
          {confidence.explanation}
        </p>
      ) : null}
    </div>
  );
}
