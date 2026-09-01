'use client';

import { useMemo, useState } from 'react';
import { FaCheck, FaCircle, FaExclamationTriangle, FaEye } from 'react-icons/fa';
import { buildMeasurementStatusMap } from '../diagnostics/knowledge/measurementContext';
import {
  buildSolomonDataPointRows,
  SOLOMON_DATA_POINT_STATUS,
  SOLOMON_DATA_POINT_STATUS_LABELS,
} from './buildSolomonDataPointRows';

const STATUS_TONE_CLASS = {
  [SOLOMON_DATA_POINT_STATUS.pending]: 'text-[var(--solomon-text-muted)]',
  [SOLOMON_DATA_POINT_STATUS.observed]: 'text-[var(--solomon-status-diagnostic)]',
  [SOLOMON_DATA_POINT_STATUS.measured]: 'text-[var(--solomon-status-complete)]',
  [SOLOMON_DATA_POINT_STATUS.unresolved]: 'text-[var(--solomon-status-repair)]',
};

const STATUS_ICON = {
  [SOLOMON_DATA_POINT_STATUS.pending]: FaCircle,
  [SOLOMON_DATA_POINT_STATUS.observed]: FaEye,
  [SOLOMON_DATA_POINT_STATUS.measured]: FaCheck,
  [SOLOMON_DATA_POINT_STATUS.unresolved]: FaExclamationTriangle,
};

function DataPointRow({ row, onStepSelect }) {
  const toneClass = STATUS_TONE_CLASS[row.status] || STATUS_TONE_CLASS.pending;
  const StatusIcon = STATUS_ICON[row.status] || FaCircle;
  const statusLabel = SOLOMON_DATA_POINT_STATUS_LABELS[row.status];

  return (
    <button
      type="button"
      onClick={() => onStepSelect?.(row.stepKey)}
      disabled={!onStepSelect || !row.stepKey}
      className="solomon-focus-ring flex w-full min-h-[44px] items-start gap-2 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-[color:var(--solomon-border-subtle)] hover:bg-[var(--solomon-surface-elevated)] disabled:cursor-default disabled:hover:border-transparent disabled:hover:bg-transparent"
    >
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-[var(--solomon-text-primary)] leading-tight truncate">
          {row.label}
        </p>
        {row.value ? (
          <p className="mt-0.5 text-[11px] text-[var(--solomon-text-secondary)] truncate">{row.value}</p>
        ) : null}
      </div>
      <span className={`inline-flex shrink-0 items-center gap-1 text-[10px] font-medium uppercase tracking-wide ${toneClass}`}>
        <StatusIcon size={9} aria-hidden />
        <span>{statusLabel}</span>
      </span>
    </button>
  );
}

export default function SolomonDataPointsPanel({
  templateId,
  fields = {},
  measurementStatuses,
  visitedStepKeys = [],
  onStepSelect,
  defaultExpanded = true,
  previewLimit = 6,
  className = '',
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const resolvedMeasurementStatuses = useMemo(() => {
    if (measurementStatuses) return measurementStatuses;
    return buildMeasurementStatusMap(templateId, fields);
  }, [measurementStatuses, templateId, fields]);

  const rows = useMemo(
    () => buildSolomonDataPointRows({
      templateId,
      fields,
      measurementStatuses: resolvedMeasurementStatuses,
      visitedStepKeys,
    }),
    [templateId, fields, resolvedMeasurementStatuses, visitedStepKeys],
  );

  if (!rows.length) return null;

  const filledCount = rows.filter((row) => row.status !== SOLOMON_DATA_POINT_STATUS.pending).length;
  const visibleRows = expanded ? rows : rows.slice(0, previewLimit);

  return (
    <section
      aria-label="Data collected"
      className={`rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] ${className}`}
    >
      <button
        type="button"
        onClick={() => setExpanded((value) => !value)}
        className="solomon-focus-ring flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left rounded-t-[var(--solomon-radius-card)]"
        aria-expanded={expanded}
      >
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.08em] text-[var(--solomon-text-secondary)]">
            Data collected
          </p>
          <p className="mt-0.5 text-[11px] text-[var(--solomon-text-muted)]">
            {filledCount} of {rows.length} points captured
          </p>
        </div>
        <span className="text-[var(--solomon-text-muted)] text-xs" aria-hidden>
          {expanded ? '▾' : '▸'}
        </span>
      </button>

      <ul className="border-t border-[color:var(--solomon-border-muted)] px-1 py-1">
        {visibleRows.map((row) => (
          <li key={row.id}>
            <DataPointRow row={row} onStepSelect={onStepSelect} />
          </li>
        ))}
      </ul>

      {!expanded && rows.length > previewLimit ? (
        <p className="px-3 pb-2 text-[10px] text-[var(--solomon-text-muted)]">
          +{rows.length - previewLimit} more — expand to view all
        </p>
      ) : null}
    </section>
  );
}
