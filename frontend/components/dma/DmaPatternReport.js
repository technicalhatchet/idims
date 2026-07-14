function RateBar({ value, tone = 'cyan' }) {
  const width = Math.max(0, Math.min(100, Number(value) || 0));
  const toneClass = tone === 'amber'
    ? 'bg-amber-400'
    : tone === 'emerald'
      ? 'bg-emerald-400'
      : 'bg-cyan-400';

  return (
    <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
      <div className={`h-full ${toneClass}`} style={{ width: `${width}%` }} />
    </div>
  );
}

function FixList({ fixes = [] }) {
  if (!fixes.length) {
    return <p className="text-xs text-gray-500">No confirmed fixes recorded</p>;
  }
  return (
    <ul className="text-xs text-gray-400 space-y-0.5">
      {fixes.map((fix) => (
        <li key={fix.label}>
          <span className="text-gray-300">{fix.label}</span>
          <span className="text-gray-500"> · {fix.count} case{fix.count === 1 ? '' : 's'}</span>
        </li>
      ))}
    </ul>
  );
}

function BucketCard({ title, subtitle, bucket }) {
  if (!bucket) return null;
  return (
    <div className="rounded-xl border border-white/10 bg-[#0D1525] p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold text-white">{title}</p>
        {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
      </div>
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div>
          <p className="text-gray-500 uppercase tracking-wide text-[10px]">Cases</p>
          <p className="text-lg font-semibold text-white tabular-nums">{bucket.total_cases}</p>
        </div>
        <div>
          <p className="text-gray-500 uppercase tracking-wide text-[10px]">Fix success</p>
          <p className="text-lg font-semibold text-emerald-300 tabular-nums">{bucket.success_rate_pct}%</p>
        </div>
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-gray-400">
          <span>Successful repairs</span>
          <span>{bucket.successful_repairs}/{bucket.total_cases}</span>
        </div>
        <RateBar value={bucket.success_rate_pct} tone="emerald" />
      </div>
      <div className="space-y-1">
        <div className="flex justify-between text-[11px] text-gray-400">
          <span>Callback rate</span>
          <span>{bucket.callback_cases}/{bucket.total_cases}</span>
        </div>
        <RateBar value={bucket.callback_rate_pct} tone="amber" />
      </div>
      <div>
        <p className="text-[10px] uppercase tracking-wide text-gray-500 mb-1.5">Top fixes</p>
        <FixList fixes={bucket.top_fixes} />
      </div>
    </div>
  );
}

function PatternTable({ rows, renderTitle, emptyLabel }) {
  if (!rows?.length) {
    return (
      <p className="text-sm text-gray-500 rounded-xl border border-white/10 bg-[#0D1525] p-4">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ul className="space-y-3">
      {rows.map((row) => (
        <li
          key={renderTitle(row)}
          className="rounded-xl border border-white/10 bg-[#0D1525] p-4 space-y-2"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-white">{renderTitle(row)}</p>
              <p className="text-xs text-gray-500 mt-0.5">
                {row.total_cases} case{row.total_cases === 1 ? '' : 's'}
              </p>
            </div>
            <div className="text-right text-xs shrink-0">
              <p className="text-emerald-300 font-semibold tabular-nums">{row.success_rate_pct}% fix</p>
              <p className="text-amber-300/90 tabular-nums">{row.callback_rate_pct}% callback</p>
            </div>
          </div>
          <FixList fixes={row.top_fixes} />
        </li>
      ))}
    </ul>
  );
}

export default function DmaPatternReport({ report }) {
  if (!report) return null;

  const { summary, by_problem_code, by_resolution_code, by_tag, common_fixes, evidence_paths } = report;

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300/90">Overview</h2>
        <BucketCard
          title="All matching repairs"
          subtitle={`${summary.work_order_cases} work-order outcomes · ${summary.field_record_cases} field records · ${summary.cases_with_evidence_snapshot} with diagnostic evidence snapshot`}
          bucket={summary}
        />
      </section>

      {common_fixes?.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300/90">Common fixes</h2>
          <div className="rounded-xl border border-white/10 bg-[#0D1525] p-4">
            <ul className="space-y-2">
              {common_fixes.map((fix) => (
                <li key={fix.label} className="flex items-center justify-between gap-3 text-sm">
                  <span className="text-gray-200">{fix.label}</span>
                  <span className="text-gray-500 tabular-nums shrink-0">{fix.count}</span>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300/90">Evidence paths</h2>
        <p className="text-xs text-gray-500">
          Leading diagnostic evidence category at save time, paired with problem code — read-only analytics only.
        </p>
        <PatternTable
          rows={evidence_paths}
          renderTitle={(row) => `${row.leading_category_label} · ${row.problem_label}`}
          emptyLabel="Not enough cases with diagnostic evidence snapshots yet. Save Diagnostic Results notes with evidence to build this report."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300/90">By repair tag</h2>
        <PatternTable
          rows={by_tag}
          renderTitle={(row) => row.label}
          emptyLabel="No tag groups met the minimum case count."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300/90">By problem code</h2>
        <PatternTable
          rows={by_problem_code}
          renderTitle={(row) => row.label}
          emptyLabel="No problem-code groups met the minimum case count."
        />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-cyan-300/90">By resolution code</h2>
        <PatternTable
          rows={by_resolution_code}
          renderTitle={(row) => row.label}
          emptyLabel="No resolution-code groups met the minimum case count."
        />
      </section>
    </div>
  );
}
