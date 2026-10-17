export default function PortalDiagnosticPrepaidBadge({ workOrder }) {
  const prepaid =
    workOrder?.portal_diagnostic_prepaid
    || workOrder?.portal_scheduling_meta?.payment?.square_payment_id;
  if (!prepaid) return null;

  return (
    <span
      className="inline-flex items-center rounded px-2 py-0.5 text-xs font-semibold uppercase tracking-wide"
      style={{
        background: 'rgba(34, 197, 94, 0.15)',
        border: '1px solid rgba(34, 197, 94, 0.35)',
        color: '#86efac',
      }}
    >
      Prepaid (portal)
    </span>
  );
}
