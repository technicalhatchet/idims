'use client';

import { useMemo } from 'react';
import { normalizeEvidenceShares } from '../diagnostics/intelligence/evidenceDisplay';

function FaultBar({ percent }) {
  return (
    <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-[var(--solomon-border-muted)]">
      <div
        className="h-full rounded-full bg-[var(--solomon-primary-from)]"
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

export default function SolomonFaultRanking({
  intelligence,
  className = '',
  limit = 3,
}) {
  const categories = useMemo(
    () => normalizeEvidenceShares(intelligence?.topCategories || [])
      .filter((category) => category.sharePercent > 0)
      .slice(0, limit),
    [intelligence?.topCategories, limit],
  );

  if (!categories.length) return null;

  return (
    <section
      aria-label="Fault ranking"
      className={`rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2.5 ${className}`}
    >
      <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--solomon-text-secondary)]">
        Fault ranking
      </p>
      <ul className="mt-2 space-y-2">
        {categories.map((category, index) => (
          <li key={category.id} className="flex items-center gap-2 min-w-0">
            <span className="w-4 shrink-0 text-[10px] tabular-nums text-[var(--solomon-text-muted)]">
              {index + 1}
            </span>
            <span className="min-w-[5.5rem] max-w-[42%] truncate text-xs font-medium text-[var(--solomon-text-primary)]">
              {category.label}
            </span>
            <FaultBar percent={category.sharePercent} />
            <span className="w-9 shrink-0 text-right text-xs font-semibold tabular-nums text-[var(--solomon-text-primary)]">
              {category.sharePercent}%
            </span>
          </li>
        ))}
      </ul>
    </section>
  );
}
