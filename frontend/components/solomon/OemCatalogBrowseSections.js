'use client';

import { useMemo, useState } from 'react';
import { partitionOemCatalogEntries } from '../diagnostics/procedures/oemWizardDecisions';

/**
 * Truthful OEM catalog browse: available vs completed vs skipped (presentation only).
 */
export default function OemCatalogBrowseSections({
  catalogEntries = [],
  catalogOnlyAvailable = [],
  procedureRuns = {},
  oemWizardLeadDecisions,
  renderEntry,
  isCompact = false,
}) {
  const partitionedAll = useMemo(
    () => partitionOemCatalogEntries(catalogEntries, procedureRuns, oemWizardLeadDecisions),
    [catalogEntries, procedureRuns, oemWizardLeadDecisions],
  );

  const available = useMemo(() => {
    const allowed = new Set(catalogOnlyAvailable.map((item) => item.procedureId));
    return partitionedAll.available.filter((item) => allowed.has(item.procedureId));
  }, [catalogOnlyAvailable, partitionedAll.available]);

  const completed = partitionedAll.completed;
  const skipped = partitionedAll.skipped.filter(
    (item) => !completed.some((done) => done.procedureId === item.procedureId),
  );

  const [completedOpen, setCompletedOpen] = useState(false);
  const [skippedOpen, setSkippedOpen] = useState(false);

  if (!available.length && !completed.length && !skipped.length) {
    return null;
  }

  const spacing = isCompact ? 'mt-2' : 'mt-2.5';

  return (
    <div className={`space-y-3 ${spacing}`}>
      {available.length ? (
        <div className={`space-y-2 ${spacing}`}>
          {available.map((entry) => renderEntry(entry))}
        </div>
      ) : (
        <p className="text-xs text-[var(--solomon-text-secondary)]">
          No additional OEM tests are available to run from this list.
        </p>
      )}

      {completed.length ? (
        <div>
          <button
            type="button"
            onClick={() => setCompletedOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/40 px-3 py-2 text-left"
            aria-expanded={completedOpen}
            data-oem-catalog-completed
          >
            <span className="text-sm font-medium text-[var(--solomon-text-primary)]">
              Completed OEM tests
            </span>
            <span className="text-xs text-[var(--solomon-text-muted)]">
              {completedOpen ? 'Hide' : 'Show'} ({completed.length})
            </span>
          </button>
          {completedOpen ? (
            <div className={`space-y-2 ${spacing}`}>
              {completed.map((entry) => renderEntry(entry))}
            </div>
          ) : null}
        </div>
      ) : null}

      {skipped.length ? (
        <div>
          <button
            type="button"
            onClick={() => setSkippedOpen((current) => !current)}
            className="flex w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/40 px-3 py-2 text-left"
            aria-expanded={skippedOpen}
            data-oem-catalog-skipped
          >
            <span className="text-sm font-medium text-[var(--solomon-text-primary)]">
              Skipped OEM tests
            </span>
            <span className="text-xs text-[var(--solomon-text-muted)]">
              {skippedOpen ? 'Hide' : 'Show'} ({skipped.length})
            </span>
          </button>
          {skippedOpen ? (
            <div className={`space-y-2 ${spacing}`}>
              {skipped.map((entry) => renderEntry(entry))}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function OemCatalogBrowseToggle({
  catalogOpen,
  onToggle,
  availableCount,
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between gap-2 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/50 px-3 py-2.5 text-left hover:bg-[var(--solomon-surface-elevated)]/60"
      aria-expanded={catalogOpen}
    >
      <div className="min-w-0">
        <p className="text-sm font-medium text-[var(--solomon-text-primary)]">
          Available OEM tests
        </p>
        <p className="mt-0.5 text-xs text-[var(--solomon-text-secondary)]">
          Browse manufacturer tests that are still available
          {availableCount > 0 ? ` (${availableCount})` : ''}
        </p>
      </div>
      <span className="shrink-0 text-xs text-[var(--solomon-text-muted)]">
        {catalogOpen ? 'Hide' : 'Show'}
      </span>
    </button>
  );
}
