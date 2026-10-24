export default function RecallBadge({ recalls, staffView = false }) {
  if (!recalls) return null;
  const pending = recalls.pending_count || 0;
  const confirmed = (recalls.confirmed_recalls || []).length;

  if (staffView && pending > 0) {
    return (
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
        style={{
          background: 'rgba(245, 158, 11, 0.15)',
          color: '#fbbf24',
          border: '1px solid rgba(245, 158, 11, 0.35)',
        }}
      >
        Recall · Unconfirmed
      </span>
    );
  }

  if (confirmed > 0 || (!staffView && pending === 0 && confirmed)) {
    return (
      <span
        className="inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold"
        style={{
          background: 'rgba(239, 68, 68, 0.15)',
          color: '#f87171',
          border: '1px solid rgba(239, 68, 68, 0.35)',
        }}
      >
        Recall
      </span>
    );
  }

  return null;
}
