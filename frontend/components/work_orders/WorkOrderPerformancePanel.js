import { useCallback, useEffect, useState } from 'react';

import { apiClient } from '../../utils/api-client';

function formatMinutes(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const rounded = Math.round(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${rounded} min`;
}

function percentLabel(pct) {
  if (pct == null || Number.isNaN(pct)) return null;
  return `${pct}% of estimate`;
}

function percentTone(pct) {
  if (pct == null) return 'text-gray-500 dark:text-gray-400';
  if (pct <= 100) return 'text-green-600 dark:text-green-400';
  if (pct <= 125) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

async function fetchPerformance(workOrderId) {
  return apiClient(`work-orders/${workOrderId}/performance`);
}

export default function WorkOrderPerformancePanel({ workOrderId, variant = 'desktop' }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const isMobile = variant === 'mobile';

  const load = useCallback(async () => {
    if (!workOrderId) return;
    try {
      setData(await fetchPerformance(workOrderId));
      setError(null);
    } catch (err) {
      setError(err.message || 'Failed to load performance');
    } finally {
      setLoading(false);
    }
  }, [workOrderId]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  useEffect(() => {
    if (!data?.active_on_site) return undefined;
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [data?.active_on_site, load]);

  const summary = data?.summary;
  const active = data?.active_on_site;
  const visits = data?.visits || [];
  const hasContent = active || visits.length > 0;

  const cardClass = isMobile
    ? 'rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden mb-4'
    : 'bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-4';

  const labelClass = isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400';
  const valueClass = isMobile ? 'text-white' : 'text-gray-900 dark:text-white';
  const titleClass = isMobile
    ? 'text-sm font-medium text-white'
    : 'text-md font-medium text-gray-700 dark:text-gray-300';

  return (
    <div>
      <h3 className={`${titleClass} mb-2`}>On-Site Performance</h3>
      <div className={cardClass}>
        <div className="px-4 py-4 sm:px-6">
          {loading && (
            <p className={`text-sm ${labelClass}`}>Loading performance…</p>
          )}
          {!loading && error && (
            <p className="text-sm text-red-400">{error}</p>
          )}
          {!loading && !error && !hasContent && (
            <p className={`text-sm ${labelClass}`}>
              On-site time is recorded when a visit leaves In Progress, compared to SKU duration estimates.
            </p>
          )}
          {!loading && !error && hasContent && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-4">
                <div>
                  <p className={`text-xs uppercase tracking-wide ${labelClass}`}>Total on-site</p>
                  <p className={`text-lg font-semibold ${valueClass}`}>
                    {formatMinutes(summary?.total_actual_minutes)}
                    {active && (
                      <span className={`text-sm font-normal ml-1 ${labelClass}`}>
                        (+{formatMinutes(active.elapsed_minutes)} active)
                      </span>
                    )}
                  </p>
                </div>
                <div>
                  <p className={`text-xs uppercase tracking-wide ${labelClass}`}>Estimated</p>
                  <p className={`text-lg font-semibold ${valueClass}`}>
                    {formatMinutes(summary?.total_estimated_minutes)}
                  </p>
                </div>
                <div className="col-span-2 sm:col-span-1">
                  <p className={`text-xs uppercase tracking-wide ${labelClass}`}>Vs estimate</p>
                  <p className={`text-lg font-semibold ${percentTone(summary?.percent_of_estimate)}`}>
                    {percentLabel(summary?.percent_of_estimate) || '—'}
                  </p>
                </div>
              </div>

              {active && (
                <div
                  className={
                    isMobile
                      ? 'mb-3 rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-3 py-2 text-sm text-cyan-200'
                      : 'mb-3 rounded-lg border border-cyan-200 dark:border-cyan-800 bg-cyan-50 dark:bg-cyan-900/20 px-3 py-2 text-sm text-cyan-800 dark:text-cyan-200'
                  }
                >
                  <span className="font-medium capitalize">{active.appointment_type}</span>
                  {' '}visit in progress — {formatMinutes(active.elapsed_minutes)} on site
                  {active.percent_of_estimate != null && (
                    <span className={`ml-1 ${percentTone(active.percent_of_estimate)}`}>
                      ({percentLabel(active.percent_of_estimate)})
                    </span>
                  )}
                </div>
              )}

              {visits.length > 0 && (
                <div className="space-y-2">
                  {visits.map((visit) => (
                    <div
                      key={visit.appointment_id}
                      className={
                        isMobile
                          ? 'flex justify-between items-center text-sm border border-white/10 rounded-lg px-3 py-2'
                          : 'flex justify-between items-center text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 bg-gray-50 dark:bg-gray-700/50'
                      }
                    >
                      <span className={`capitalize ${valueClass}`}>{visit.appointment_type}</span>
                      <span className={labelClass}>
                        {formatMinutes(visit.actual_minutes)}
                        {visit.estimated_minutes != null && (
                          <span> / {formatMinutes(visit.estimated_minutes)} est</span>
                        )}
                        {visit.percent_of_estimate != null && (
                          <span className={`ml-2 font-medium ${percentTone(visit.percent_of_estimate)}`}>
                            {percentLabel(visit.percent_of_estimate)}
                          </span>
                        )}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
