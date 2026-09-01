'use client';

function MetricCard({ label, value, isLoading }) {
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
  const avgConfidence = metrics?.avgLeadConfidence;
  const avgLabel = avgConfidence == null ? '—' : `${avgConfidence}%`;
  const outcomesLabel = metrics?.outcomesRecorded == null ? '—' : String(metrics.outcomesRecorded);

  return (
    <div className="grid grid-cols-2 gap-2">
      <MetricCard
        label="Sessions this week"
        value={String(metrics?.sessionsThisWeek ?? 0)}
        isLoading={isLoading}
      />
      <MetricCard
        label="Open sessions"
        value={String(metrics?.openSessions ?? 0)}
        isLoading={isLoading}
      />
      <MetricCard
        label="Outcomes recorded"
        value={outcomesLabel}
        isLoading={isLoading}
      />
      <MetricCard
        label="Avg lead confidence"
        value={avgLabel}
        isLoading={isLoading}
      />
    </div>
  );
}
