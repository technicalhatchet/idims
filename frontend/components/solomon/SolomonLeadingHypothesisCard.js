'use client';

import {
  formatDiyLeadCard,
  shouldShowLeadingHypothesis,
} from '../diagnostics/intelligence/evidenceDisplay';
import { diagnosticStatusEyebrow } from '../diagnostics/intelligence/diagnosticJourneyPresentation';
import SolomonCategoryIcon from './categoryIcons';

/**
 * Compact mobile diagnostic status card — tap opens reasoning sheet.
 */
export default function SolomonLeadingHypothesisCard({
  intelligence,
  onOpenReasoning,
  variant = 'mobile',
  density = 'default',
  visitedStepKeys = [],
  procedureRuns = {},
  fields = {},
  currentStepKey = null,
  oemDiagnosticPathExhausted = false,
  oemManufacturerPathActive = false,
  oemConfirmedRepairProcedureId = null,
  oemCurrentTestFocus = null,
}) {
  if (
    !shouldShowLeadingHypothesis(intelligence, {
      visitedStepKeys,
      procedureRuns,
      fields,
      currentStepKey,
    })
  ) {
    return null;
  }

  const lead = formatDiyLeadCard(intelligence, {
    procedureRuns,
    oemDiagnosticPathExhausted,
    oemManufacturerPathActive,
    oemConfirmedRepairProcedureId,
    oemCurrentTestFocus,
  });
  if (!lead) return null;

  const eyebrow = diagnosticStatusEyebrow(lead.foregroundMode);
  const showCategoryIcon = lead.foregroundMode === 'active_hypothesis'
    || lead.foregroundMode === 'confirmed_fault'
    || lead.foregroundMode === 'remaining_upstream_path';

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
          {eyebrow}
        </p>
        <div className={`flex items-start justify-between gap-3 ${isCompact ? 'mt-1.5' : 'mt-2'}`}>
          {showCategoryIcon ? (
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
          ) : null}
          <div className="min-w-0 flex-1">
            <p className={`font-semibold leading-tight ${
              isCompact
                ? 'text-sm text-[var(--solomon-text-primary)]'
                : isMobile
                  ? 'text-base text-white'
                  : 'text-base text-gray-900 dark:text-white'
            }`}
            >
              {lead.headline}
            </p>
            {lead.showPercent && lead.percent != null ? (
              <div className={`flex items-baseline gap-2 ${isCompact ? 'mt-1' : 'mt-1.5'}`}>
                <span className={`font-bold tabular-nums text-emerald-400 leading-none ${
                  isCompact ? 'text-lg' : 'text-2xl'
                }`}
                >
                  {lead.percent}%
                </span>
                {lead.strengthWord ? (
                  <span className={`font-semibold uppercase tracking-wide text-emerald-300/90 ${
                    isCompact ? 'text-[10px]' : 'text-xs'
                  }`}
                  >
                    {lead.strengthWord}
                  </span>
                ) : null}
              </div>
            ) : lead.strengthWord && lead.foregroundMode === 'confirmed_fault' ? (
              <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-emerald-300/90">
                {lead.strengthWord}
              </p>
            ) : (
              <p className={`mt-1 text-xs leading-snug ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
                {lead.subtitle}
              </p>
            )}
            {lead.ruledOutLabels?.length > 0 && !isCompact ? (
              <div className="mt-2">
                <p className={`text-[10px] uppercase tracking-wide ${isMobile ? 'text-gray-500' : 'text-gray-500'}`}>
                  Ruled out
                </p>
                <ul className="mt-1 space-y-0.5">
                  {lead.ruledOutLabels.slice(0, 6).map((label) => (
                    <li key={label} className={`text-xs ${isMobile ? 'text-gray-300' : 'text-gray-600 dark:text-gray-300'}`}>
                      ✓ {label}
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
            {lead.remainingPathLabel && !isCompact ? (
              <div className="mt-2 rounded-md border border-white/10 bg-white/[0.03] px-2 py-1.5">
                <p className="text-[10px] uppercase tracking-wide text-cyan-400/80">
                  Remaining fault path
                </p>
                <p className="text-xs font-medium text-white/90 mt-0.5">{lead.remainingPathLabel}</p>
                {lead.remainingPathDetail ? (
                  <p className="text-[11px] text-gray-400 mt-1 leading-snug">{lead.remainingPathDetail}</p>
                ) : null}
              </div>
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
