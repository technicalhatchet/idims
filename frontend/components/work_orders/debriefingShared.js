import { apiClient } from '../../utils/api-client';

export function BriefcaseIcon({ className }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={className}
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <rect x="2" y="7" width="20" height="14" rx="2" />
      <path d="M16 7V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v2" />
      <path d="M2 12h20" />
    </svg>
  );
}

export function formatEstTimestamp(isoString) {
  if (!isoString) return '';
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString('en-US', {
    timeZone: 'America/New_York',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
    timeZoneName: 'short',
  });
}

export async function fetchDebriefingEntries(workOrderId) {
  const data = await apiClient(`work-orders/${workOrderId}/timeline`);
  return Array.isArray(data) ? data : [];
}

export function getDebriefingPageHref(workOrderId, variant = 'mobile') {
  const from = variant === 'mobile' ? 'mobile' : 'desktop';
  return `/work_orders/${workOrderId}/debriefing?from=${from}`;
}

export function DebriefingList({ entries, loading, error, isMobile, className = '' }) {
  if (loading) {
    return (
      <p className={`text-sm py-6 text-center ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'} ${className}`}>
        Loading activity…
      </p>
    );
  }
  if (error) {
    return <p className={`text-sm text-red-400 py-4 text-center ${className}`}>{error}</p>;
  }
  if (entries.length === 0) {
    return (
      <p className={`text-sm py-6 text-center ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'} ${className}`}>
        No activity recorded yet.
      </p>
    );
  }
  return (
    <ul className={`space-y-4 ${className}`}>
      {entries.map((entry) => (
        <li
          key={entry.id}
          className={
            isMobile
              ? 'border-b border-white/5 last:border-0 pb-3 last:pb-0 print:border-gray-300 print:pb-3'
              : 'border-b border-gray-100 dark:border-gray-700 last:border-0 pb-4 last:pb-0 print:border-gray-300 print:pb-3'
          }
        >
          <p className={`text-sm font-semibold ${isMobile ? 'text-white print:text-black' : 'text-gray-900 dark:text-white print:text-black'}`}>
            {entry.headline}
          </p>
          <p className={`text-xs mt-1 ${isMobile ? 'text-gray-400 print:text-gray-700' : 'text-gray-600 dark:text-gray-400 print:text-gray-700'}`}>
            {entry.actor_label}{' '}
            <span className={isMobile ? 'text-gray-200 print:text-black' : 'text-gray-800 dark:text-gray-200 print:text-black'}>
              {entry.actor_name}
            </span>
          </p>
          <p className={`text-xs mt-0.5 ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-500 print:text-gray-600'}`}>
            at: {entry.occurred_at_est || formatEstTimestamp(entry.occurred_at)}
          </p>
        </li>
      ))}
    </ul>
  );
}
