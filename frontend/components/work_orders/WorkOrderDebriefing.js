import { useEffect, useState } from 'react';

import { apiClient } from '../../utils/api-client';

function BriefcaseIcon({ className }) {
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

function formatEstTimestamp(isoString) {
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

export default function WorkOrderDebriefing({ workOrderId, variant = 'desktop' }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMobile = variant === 'mobile';

  useEffect(() => {
    if (!workOrderId) return undefined;
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);
      try {
        const data = await apiClient(`work-orders/${workOrderId}/timeline`);
        if (!cancelled) {
          setEntries(Array.isArray(data) ? data : []);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err.message || 'Failed to load debriefing log');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, [workOrderId]);

  const shellClass = isMobile
    ? 'rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden mb-4'
    : 'bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-6';

  const headerClass = isMobile
    ? 'px-4 py-3 border-b border-white/10 flex items-center gap-2'
    : 'px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex items-center gap-2';

  const bodyClass = isMobile ? 'px-4 py-4' : 'px-6 py-5';

  return (
    <div className={shellClass}>
      <div className={headerClass}>
        <BriefcaseIcon
          className={isMobile ? 'h-4 w-4 text-cyan-400' : 'h-5 w-5 text-gray-500 dark:text-gray-400'}
        />
        <h2 className={`font-medium ${isMobile ? 'text-sm text-white' : 'text-lg text-gray-900 dark:text-white'}`}>
          Debriefing
        </h2>
      </div>
      <div className={bodyClass}>
        {loading && (
          <p className={`text-sm ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
            Loading activity…
          </p>
        )}
        {!loading && error && (
          <p className="text-sm text-red-400">{error}</p>
        )}
        {!loading && !error && entries.length === 0 && (
          <p className={`text-sm ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
            No activity recorded yet.
          </p>
        )}
        {!loading && !error && entries.length > 0 && (
          <ul className={`space-y-4 ${isMobile ? '' : 'max-h-96 overflow-y-auto pr-1'}`}>
            {entries.map((entry) => (
              <li
                key={entry.id}
                className={
                  isMobile
                    ? 'border-b border-white/5 last:border-0 pb-3 last:pb-0'
                    : 'border-b border-gray-100 dark:border-gray-700 last:border-0 pb-4 last:pb-0'
                }
              >
                <p className={`text-sm font-semibold ${isMobile ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
                  {entry.headline}
                </p>
                <p className={`text-xs mt-1 ${isMobile ? 'text-gray-400' : 'text-gray-600 dark:text-gray-400'}`}>
                  {entry.actor_label}{' '}
                  <span className={isMobile ? 'text-gray-200' : 'text-gray-800 dark:text-gray-200'}>
                    {entry.actor_name}
                  </span>
                </p>
                <p className={`text-xs mt-0.5 ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-500'}`}>
                  at: {entry.occurred_at_est || formatEstTimestamp(entry.occurred_at)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
