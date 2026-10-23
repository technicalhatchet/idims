export default function PortalEstimateApprovalBadge({ workOrder }) {
  const summary = workOrder?.estimate_approval;
  if (!summary?.badge && !summary?.estimate_changed_since_approval) return null;

  const badge = summary.badge;
  const changed = summary.estimate_changed_since_approval;

  let label = null;
  let color = '#9ca3af';
  const latest = summary.latest;
  if (badge === 'approved') {
    if (latest?.decision_source === 'staff_on_behalf' && latest?.staff_user_name) {
      label = `Approved by ${latest.staff_user_name} on behalf of customer`;
    } else {
      label = 'Estimate approved';
    }
    color = '#22c55e';
  } else if (badge === 'declined') {
    label = 'Estimate declined';
    color = '#f59e0b';
  }

  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {label && (
        <span
          className="inline-flex items-center rounded-md px-2 py-1 font-semibold"
          style={{ background: `${color}22`, color, border: `1px solid ${color}44` }}
        >
          {label}
          {badge === 'approved'
            && latest?.decision_source !== 'staff_on_behalf'
            && latest?.signer_name
            ? ` — ${latest.signer_name}`
            : ''}
        </span>
      )}
      {changed && (
        <span className="text-amber-400 font-medium">Estimate changed since approval</span>
      )}
    </div>
  );
}
