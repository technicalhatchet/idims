'use client';

import { formatDiyLeadCard } from '../diagnostics/intelligence/evidenceDisplay';
import SolomonCategoryIcon from './categoryIcons';

/**
 * Compact mobile card — tap opens Diagnostic Reasoning sheet.
 */
export default function SolomonLeadingHypothesisCard({
  intelligence,
  onOpenReasoning,
  variant = 'mobile',
  density = 'default',
}) {
  const lead = formatDiyLeadCard(intelligence);
  if (!lead) return null;

  const isMobile = variant === 'mobile';
  const isCompact = density === 'compact';

  return (
    <button
      type="button"
      onClick={onOpenReasoning}
      className={`w-full text-left rounded-[var(--solomon-radius-card)] border transition-colors ${
        isMobile
          ? isCompact
            ? 'border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] hover:bg-[var(--solomon-surface-elevated)]'
            : 'border-emerald-500/25 bg-[#0D1525] hover:border-emerald-400/40 active:bg-emerald-500/5'
          : 'border-emerald-200 bg-emerald-50/80 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
      }`}
    >
      <div className={isCompact ? 'px-2.5 py-2' : 'px-3 py-3'}>
        <p className={`uppercase tracking-[0.18em] font-medium ${
          isCompact
            ? 'text-[9px] text-[var(--solomon-text-muted)]'
            : 'text-[10px] text-cyan-400/85'
        }`}
        >
          Current leading hypothesis
        </p>
        <div className={`flex items-start justify-between gap-3 ${isCompact ? 'mt-1.5' : 'mt-2'}`}>
          <div
            className={`shrink-0 flex items-center justify-center rounded-lg ${
              isMobile
                ? isCompact
                  ? 'h-8 w-8 bg-emerald-500/10 text-emerald-400'
                  : 'h-10 w-10 bg-emerald-500/10 text-emerald-400'
                : 'h-10 w-10 bg-emerald-100 text-emerald-600'
            }`}
          >
            <SolomonCategoryIcon
              categoryId={lead.categoryId}
              categoryLabel={lead.categoryLabel}
              size={isCompact ? 16 : 20}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`font-semibold leading-tight ${
              isCompact
                ? 'text-sm text-[var(--solomon-text-primary)]'
                : isMobile
                  ? 'text-base text-white'
                  : 'text-base text-gray-900 dark:text-white'
            }`}
            >
              {lead.categoryLabel}
            </p>
            <div className={`flex items-baseline gap-2 ${isCompact ? 'mt-1' : 'mt-1.5'}`}>
              <span className={`font-bold tabular-nums text-emerald-400 leading-none ${
                isCompact ? 'text-lg' : 'text-2xl'
              }`}
              >
                {lead.percent}%
              </span>
              <span className={`font-semibold uppercase tracking-wide text-emerald-300/90 ${
                isCompact ? 'text-[10px]' : 'text-xs'
              }`}
              >
                {lead.strengthWord}
              </span>
            </div>
            {!isCompact ? (
              <p className={`text-xs mt-2 leading-snug line-clamp-2 ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
                {lead.subtitle}
              </p>
            ) : null}
          </div>
          <span className={`shrink-0 pt-1 ${isMobile ? 'text-gray-500' : 'text-gray-400'}`} aria-hidden>
            ›
          </span>
        </div>
      </div>
    </button>
  );
}
