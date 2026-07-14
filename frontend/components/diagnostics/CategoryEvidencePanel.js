'use client';

import { useState } from 'react';
import {
  getComponentsForCategory,
  getEvidenceLedgerForCategory,
  getEvidenceLedgerForComponent,
} from './intelligence/diagnosticIntelligenceEngine';
import { resolveStepKeyLabel } from './intelligence/stepKeyLabels';

const COMPONENT_STATE_META = {
  confirmed: { label: 'Confirmed', symbol: '✓', tone: 'text-emerald-400' },
  eliminated: { label: 'Ruled out', symbol: '✗', tone: 'text-gray-400' },
  unlikely: { label: 'Less likely', symbol: '~', tone: 'text-amber-400' },
  unknown: { label: 'Unknown', symbol: '·', tone: 'text-gray-500' },
};

function EvidenceBar({ score, variant, tone = 'emerald' }) {
  const isMobile = variant === 'mobile';
  const width = Math.max(0, Math.min(100, score));
  const fill =
    tone === 'violet'
      ? isMobile
        ? 'bg-violet-400'
        : 'bg-violet-600 dark:bg-violet-400'
      : isMobile
        ? 'bg-emerald-400'
        : 'bg-emerald-600 dark:bg-emerald-400';

  return (
    <div
      className={`h-1.5 rounded-full overflow-hidden flex-1 ${
        isMobile ? 'bg-white/10' : 'bg-gray-200 dark:bg-gray-700'
      }`}
    >
      <div className={`h-full transition-all ${fill}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function LedgerList({ entries, variant }) {
  if (!entries?.length) return null;
  const isMobile = variant === 'mobile';

  return (
    <ul
      className={`ml-1 pl-2 border-l space-y-0.5 opacity-90 ${
        isMobile ? 'border-emerald-500/30' : 'border-emerald-300 dark:border-emerald-700'
      }`}
    >
      {entries.map((entry, index) => (
        <li
          key={`${entry.ruleId}-${index}`}
          className={entry.source === 'dma' ? 'text-cyan-200/90' : ''}
        >
          {entry.delta >= 0 ? '+' : ''}
          {entry.delta} {entry.explanation}
          {entry.source === 'dma' ? ' (repair memory)' : ''}
        </li>
      ))}
    </ul>
  );
}

function ComponentStateBadge({ state, variant }) {
  const meta = COMPONENT_STATE_META[state] || COMPONENT_STATE_META.unknown;
  const isMobile = variant === 'mobile';

  return (
    <span
      className={`shrink-0 text-[10px] uppercase tracking-wide ${meta.tone} ${
        isMobile ? '' : 'dark:opacity-90'
      }`}
    >
      {meta.symbol} {meta.label}
    </span>
  );
}

function ComponentEvidenceList({ intelligence, categoryId, variant, expandedComponentId, onToggleComponent }) {
  const components = getComponentsForCategory(intelligence, categoryId);
  if (!components.length) {
    return (
      <p className={`text-[10px] opacity-60 pl-1 ${variant === 'mobile' ? '' : 'dark:opacity-70'}`}>
        No component-level evidence yet.
      </p>
    );
  }

  return (
    <ul className="space-y-1.5 pl-1">
      {components.map((component) => {
        const ledger = getEvidenceLedgerForComponent(intelligence, component.id);
        const isExpanded = expandedComponentId === component.id;
        return (
          <li key={component.id} className="space-y-0.5">
            <button
              type="button"
              onClick={() => onToggleComponent(isExpanded ? null : component.id)}
              className="w-full text-left"
            >
              <div className="flex items-center gap-2">
                <span className="min-w-[5.5rem] truncate opacity-90">{component.label}</span>
                <EvidenceBar score={component.evidence} variant={variant} tone="violet" />
                <span className="tabular-nums w-6 text-right opacity-80">{component.evidence}</span>
                <ComponentStateBadge state={component.state} variant={variant} />
              </div>
            </button>
            {isExpanded && ledger.length > 0 && (
              <LedgerList entries={ledger} variant={variant} />
            )}
          </li>
        );
      })}
    </ul>
  );
}

export default function CategoryEvidencePanel({
  intelligence,
  variant = 'mobile',
  stepKeyLabels = {},
  dmaNudgesLoading = false,
}) {
  const [expandedCategoryId, setExpandedCategoryId] = useState(null);
  const [expandedComponentId, setExpandedComponentId] = useState(null);

  if (!intelligence?.topCategories?.length) return null;

  const isMobile = variant === 'mobile';
  const checkCount = intelligence.matchedRuleCount || 0;
  const topStepKey = intelligence.recommendedStepKeys?.[0];
  const topStepLabel = resolveStepKeyLabel(topStepKey, stepKeyLabels);

  const handleCategoryToggle = (categoryId) => {
    if (expandedCategoryId === categoryId) {
      setExpandedCategoryId(null);
      setExpandedComponentId(null);
      return;
    }
    setExpandedCategoryId(categoryId);
    setExpandedComponentId(null);
  };

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-[11px] space-y-2 ${
        isMobile
          ? 'border-emerald-500/25 bg-emerald-500/[0.06] text-emerald-50'
          : 'border-emerald-200 bg-emerald-50 text-emerald-950 dark:border-emerald-800 dark:bg-emerald-950/30 dark:text-emerald-100'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold uppercase tracking-wide opacity-90">Diagnostic evidence</p>
        <span className="opacity-70">{checkCount} rule{checkCount === 1 ? '' : 's'} matched</span>
      </div>

      <ul className="space-y-2">
        {intelligence.topCategories.map((category) => {
          const ledger = getEvidenceLedgerForCategory(intelligence, category.id);
          const isExpanded = expandedCategoryId === category.id;
          const components = getComponentsForCategory(intelligence, category.id);

          return (
            <li key={category.id} className="space-y-1">
              <button
                type="button"
                onClick={() => handleCategoryToggle(category.id)}
                className="w-full text-left space-y-1"
              >
                <div className="flex items-center gap-2">
                  <span className="min-w-[7rem] font-medium truncate">{category.label}</span>
                  <EvidenceBar score={category.evidence} variant={variant} />
                  <span className="tabular-nums w-6 text-right">{category.evidence}</span>
                  <span className="opacity-50 text-[10px]">{isExpanded ? '▾' : '▸'}</span>
                </div>
              </button>

              {isExpanded && (
                <div className="space-y-2 pt-0.5">
                  {ledger.length > 0 && (
                    <div className="space-y-0.5">
                      <p className="opacity-60 text-[10px] uppercase tracking-wide pl-1">Category evidence</p>
                      <LedgerList entries={ledger} variant={variant} />
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="opacity-60 text-[10px] uppercase tracking-wide pl-1">
                      Components{components.length ? ` (${components.length})` : ''}
                    </p>
                    <ComponentEvidenceList
                      intelligence={intelligence}
                      categoryId={category.id}
                      variant={variant}
                      expandedComponentId={expandedComponentId}
                      onToggleComponent={setExpandedComponentId}
                    />
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>

      {topStepLabel && (
        <p className="opacity-75 pt-0.5 border-t border-emerald-500/15 pt-2">
          Suggested next step: <span className="font-medium">{topStepLabel}</span>
          <span className="opacity-60"> — highlighted in progress bar</span>
        </p>
      )}

      {(dmaNudgesLoading || intelligence.dmaNudgeCount > 0) && (
        <p className="opacity-70 text-[10px] pt-1">
          {dmaNudgesLoading
            ? 'Checking repair memory for similar cases…'
            : `Repair memory applied to ${intelligence.dmaNudgeCount} evidence line${intelligence.dmaNudgeCount === 1 ? '' : 's'}`}
        </p>
      )}
    </div>
  );
}
