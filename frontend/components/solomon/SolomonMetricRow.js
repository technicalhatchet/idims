'use client';

import useSolomonTheme from '../../hooks/useSolomonTheme';

function MetricCard({ label, value, isLoading, compact = false }) {
  if (compact) {
    return (
      <div className="min-w-0 rounded-[var(--solomon-radius-control)] border border-[color:var(--solomon-border-muted)] bg-[var(--solomon-surface)]/60 px-2 py-1.5">
        <p className="text-[9px] uppercase tracking-[0.08em] text-[var(--solomon-text-muted)] leading-tight truncate">
          {label}
        </p>
        <p className="mt-0.5 text-sm font-semibold tabular-nums text-[var(--solomon-text-secondary)] leading-none">
          {isLoading ? '…' : value}
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-2.5 py-2.5 min-w-0">
      <p className="text-[10px] uppercase tracking-[0.06em] text-[var(--solomon-text-muted)] leading-tight">
        {label}
      </p>
      <p className="mt-1 text-lg font-semibold tabular-nums text-[var(--solomon-text-primary)] leading-none">
        {isLoading ? '…' : value}
      </p>
    </div>
  );
}

export default function SolomonMetricRow({ metrics, isLoading }) {
  const { isProfessional } = useSolomonTheme();
  const avgConfidence = metrics?.avgLeadConfidence;
  const avgLabel = avgConfidence == null ? '—' : `${avgConfidence}%`;
  const outcomesLabel = metrics?.outcomesRecorded == null ? '—' : String(metrics.outcomesRecorded);

  return (
    <div className={`grid grid-cols-2 ${isProfessional ? 'gap-1.5' : 'gap-2'}`}>
      <MetricCard
        label="Sessions this week"
        value={String(metrics?.sessionsThisWeek ?? 0)}
        isLoading={isLoading}
        compact={isProfessional}
      />
      <MetricCard
        label="Open sessions"
        value={String(metrics?.openSessions ?? 0)}
        isLoading={isLoading}
        compact={isProfessional}
      />
      <MetricCard
        label="Outcomes recorded"
        value={outcomesLabel}
        isLoading={isLoading}
        compact={isProfessional}
      />
      <MetricCard
        label="Avg lead confidence"
        value={avgLabel}
        isLoading={isLoading}
        compact={isProfessional}
      />
    </div>
  );
}
