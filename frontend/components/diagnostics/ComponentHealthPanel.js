'use client';

import { useState } from 'react';
import { listAllComponents } from './intelligence/evidenceDisplay';

const HEALTH_META = {
  confirmed: {
    symbol: '✗',
    label: 'Failed',
    tone: 'text-red-300',
    row: 'border-red-500/20 bg-red-500/[0.06]',
  },
  eliminated: {
    symbol: '✓',
    label: 'OK',
    tone: 'text-emerald-300',
    row: 'border-emerald-500/15 bg-emerald-500/[0.04]',
  },
  unlikely: {
    symbol: '~',
    label: 'Less likely',
    tone: 'text-amber-300',
    row: 'border-amber-500/15 bg-amber-500/[0.04]',
  },
  unknown: {
    symbol: '·',
    label: 'Not tested',
    tone: 'text-gray-500',
    row: 'border-white/5 bg-white/[0.02]',
  },
};

function sortComponents(components) {
  const rank = { confirmed: 0, unlikely: 1, eliminated: 2, unknown: 3 };
  return [...components].sort((a, b) => {
    const rankDiff = (rank[a.state] ?? 9) - (rank[b.state] ?? 9);
    if (rankDiff !== 0) return rankDiff;
    return a.label.localeCompare(b.label);
  });
}

export default function ComponentHealthPanel({ intelligence, variant = 'mobile' }) {
  const [expanded, setExpanded] = useState(true);
  const components = sortComponents(listAllComponents(intelligence?.componentsByCategory));
  const tested = components.filter((component) => component.state !== 'unknown');

  if (!components.length) return null;

  const isMobile = variant === 'mobile';

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-[11px] ${
        isMobile
          ? 'border-violet-500/25 bg-violet-500/[0.06] text-violet-50'
          : 'border-violet-200 bg-violet-50 text-violet-950 dark:border-violet-800 dark:bg-violet-950/30 dark:text-violet-100'
      }`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="w-full flex items-center justify-between gap-2 text-left"
      >
        <p className="font-semibold uppercase tracking-wide opacity-90">Component health</p>
        <span className="opacity-70 text-[10px]">
          {tested.length}/{components.length} checked {expanded ? '▾' : '▸'}
        </span>
      </button>

      {expanded && (
        <ul className="mt-2 space-y-1">
          {components.map((component) => {
            const meta = HEALTH_META[component.state] || HEALTH_META.unknown;
            return (
              <li
                key={component.id}
                className={`flex items-center gap-2 rounded-lg border px-2 py-1.5 ${meta.row}`}
              >
                <span className={`w-4 text-center font-bold ${meta.tone}`}>{meta.symbol}</span>
                <span className="flex-1 truncate opacity-95">{component.label}</span>
                <span className={`text-[10px] uppercase tracking-wide shrink-0 ${meta.tone}`}>
                  {meta.label}
                </span>
                {component.evidence > 0 && component.state === 'unknown' ? (
                  <span className="tabular-nums text-[10px] opacity-60">{component.evidence}</span>
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
