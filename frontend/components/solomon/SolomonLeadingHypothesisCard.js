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
}) {
  const lead = formatDiyLeadCard(intelligence);
  if (!lead) return null;

  const isMobile = variant === 'mobile';

  return (
    <button
      type="button"
      onClick={onOpenReasoning}
      className={`w-full text-left rounded-xl border transition-colors ${
        isMobile
          ? 'border-emerald-500/25 bg-[#0D1525] hover:border-emerald-400/40 active:bg-emerald-500/5'
          : 'border-emerald-200 bg-emerald-50/80 hover:bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/30'
      }`}
    >
      <div className="px-3 py-3">
        <p className="text-[10px] uppercase tracking-[0.18em] text-cyan-400/85 font-medium">
          Current leading hypothesis
        </p>
        <div className="flex items-start justify-between gap-3 mt-2">
          <div
            className={`shrink-0 flex h-10 w-10 items-center justify-center rounded-lg ${
              isMobile ? 'bg-emerald-500/10 text-emerald-400' : 'bg-emerald-100 text-emerald-600'
            }`}
          >
            <SolomonCategoryIcon
              categoryId={lead.categoryId}
              categoryLabel={lead.categoryLabel}
              size={20}
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className={`text-base font-semibold leading-tight ${isMobile ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
              {lead.categoryLabel}
            </p>
            <div className="flex items-baseline gap-2 mt-1.5">
              <span className="text-2xl font-bold tabular-nums text-emerald-400 leading-none">
                {lead.percent}%
              </span>
              <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">
                {lead.strengthWord}
              </span>
            </div>
            <p className={`text-xs mt-2 leading-snug line-clamp-2 ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
              {lead.subtitle}
            </p>
          </div>
          <span className={`shrink-0 text-lg pt-1 ${isMobile ? 'text-gray-500' : 'text-gray-400'}`} aria-hidden>
            ›
          </span>
        </div>
      </div>
    </button>
  );
}
