import { useCallback, useEffect, useState } from 'react';

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

function DebriefingList({ entries, loading, error, isMobile }) {
  if (loading) {
    return (
      <p className={`text-sm py-6 text-center ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
        Loading activity…
      </p>
    );
  }
  if (error) {
    return <p className="text-sm text-red-400 py-4 text-center">{error}</p>;
  }
  if (entries.length === 0) {
    return (
      <p className={`text-sm py-6 text-center ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
        No activity recorded yet.
      </p>
    );
  }
  return (
    <ul className="space-y-4">
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
  );
}

export default function WorkOrderDebriefing({ workOrderId, variant = 'desktop' }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [loadedOnce, setLoadedOnce] = useState(false);
  const isMobile = variant === 'mobile';

  const loadEntries = useCallback(async () => {
    if (!workOrderId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient(`work-orders/${workOrderId}/timeline`);
      setEntries(Array.isArray(data) ? data : []);
      setLoadedOnce(true);
    } catch (err) {
      setError(err.message || 'Failed to load debriefing log');
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    if (!open) return undefined;
    loadEntries();
    return undefined;
  }, [open, loadEntries]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (e) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open]);

  const entryLabel =
    loadedOnce && !loading
      ? entries.length === 0
        ? 'No entries yet'
        : `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`
      : 'Activity & change history';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={
          isMobile
            ? 'w-full mb-4 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3 flex items-center gap-3 text-left active:bg-white/[0.06] transition-colors'
            : 'w-full mb-6 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow px-5 py-4 flex items-center gap-3 text-left hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors'
        }
      >
        <span
          className={
            isMobile
              ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-500/10 border border-cyan-500/25'
              : 'flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 dark:bg-gray-900 border border-gray-200 dark:border-gray-700'
          }
        >
          <BriefcaseIcon
            className={isMobile ? 'h-4 w-4 text-cyan-400' : 'h-5 w-5 text-gray-600 dark:text-gray-400'}
          />
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block font-medium ${isMobile ? 'text-sm text-white' : 'text-base text-gray-900 dark:text-white'}`}>
            Debriefing
          </span>
          <span className={`block text-xs mt-0.5 truncate ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
            {entryLabel}
          </span>
        </span>
        <svg
          viewBox="0 0 24 24"
          className={`h-4 w-4 shrink-0 ${isMobile ? 'text-gray-500' : 'text-gray-400'}`}
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>

      {open && (
        <div className="fixed inset-0 z-[9999] flex items-end sm:items-center justify-center p-0 sm:p-4">
          <button
            type="button"
            aria-label="Close debriefing"
            className="absolute inset-0 bg-black/65"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="debriefing-modal-title"
            className={
              isMobile
                ? 'relative w-full max-h-[88vh] flex flex-col rounded-t-2xl border-t border-white/10 bg-[#0f172a] shadow-2xl'
                : 'relative w-full max-w-lg max-h-[85vh] flex flex-col rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 shadow-2xl'
            }
            style={isMobile ? { paddingBottom: 'max(16px, env(safe-area-inset-bottom))' } : undefined}
          >
            <div
              className={
                isMobile
                  ? 'flex items-center justify-between gap-3 px-4 py-4 border-b border-white/10 shrink-0'
                  : 'flex items-center justify-between gap-3 px-5 py-4 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 shrink-0 rounded-t-xl'
              }
            >
              <div className="flex items-center gap-2 min-w-0">
                <BriefcaseIcon
                  className={isMobile ? 'h-5 w-5 text-cyan-400 shrink-0' : 'h-5 w-5 text-gray-600 dark:text-gray-400 shrink-0'}
                />
                <h2
                  id="debriefing-modal-title"
                  className={`font-semibold truncate ${isMobile ? 'text-base text-white' : 'text-lg text-gray-900 dark:text-white'}`}
                >
                  Debriefing
                </h2>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className={
                  isMobile
                    ? 'shrink-0 p-2 text-gray-400 hover:text-white rounded-lg'
                    : 'shrink-0 p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 rounded-lg'
                }
                aria-label="Close"
              >
                <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            <div className={`flex-1 overflow-y-auto overscroll-contain ${isMobile ? 'px-4 py-4' : 'px-5 py-5'}`}>
              <DebriefingList entries={entries} loading={loading} error={error} isMobile={isMobile} />
            </div>

            {!loading && !error && entries.length > 0 && (
              <div
                className={
                  isMobile
                    ? 'shrink-0 px-4 py-3 border-t border-white/10 text-center'
                    : 'shrink-0 px-5 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 rounded-b-xl text-center'
                }
              >
                <button
                  type="button"
                  onClick={loadEntries}
                  className={`text-xs font-medium ${isMobile ? 'text-cyan-400' : 'text-blue-600 dark:text-blue-400'}`}
                >
                  Refresh
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
