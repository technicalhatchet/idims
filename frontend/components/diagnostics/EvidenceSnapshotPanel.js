'use client';

import { resolveStepKeyLabel } from './intelligence/stepKeyLabels';

export default function EvidenceSnapshotPanel({
  snapshot,
  stepKeyLabels = {},
  variant = 'mobile',
  title = 'Evidence at save',
}) {
  if (!snapshot?.topCategories?.length) return null;

  const isMobile = variant === 'mobile';
  const categories = snapshot.topCategories
    .map((c) => `${c.label} (${c.evidence})`)
    .join(', ');
  const suggested = resolveStepKeyLabel(snapshot.recommendedStepKeys?.[0], stepKeyLabels);

  return (
    <div
      className={`rounded-xl border px-3 py-2.5 text-[11px] space-y-1 ${
        isMobile
          ? 'border-slate-500/25 bg-slate-500/[0.06] text-slate-100'
          : 'border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-100'
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="font-semibold uppercase tracking-wide opacity-90">{title}</p>
        {snapshot.capturedAt && (
          <span className="opacity-60 text-[10px]">
            {new Date(snapshot.capturedAt).toLocaleString()}
          </span>
        )}
      </div>
      <p>
        <span className="opacity-70">Top evidence: </span>
        <span className="font-medium">{categories}</span>
      </p>
      {snapshot.matchedRuleCount != null && (
        <p className="opacity-70">{snapshot.matchedRuleCount} rules matched at capture</p>
      )}
      {suggested && (
        <p>
          <span className="opacity-70">Suggested next was: </span>
          <span className="font-medium">{suggested}</span>
        </p>
      )}
    </div>
  );
}
