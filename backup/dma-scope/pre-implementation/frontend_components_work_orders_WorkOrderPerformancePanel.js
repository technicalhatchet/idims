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

function boolTone(value) {
  if (value === true) return 'text-green-600 dark:text-green-400';
  if (value === false) return 'text-amber-600 dark:text-amber-400';
  return 'text-gray-500 dark:text-gray-400';
}

async function fetchPerformance(workOrderId) {
  return apiClient(`work-orders/${workOrderId}/performance`);
}

function MetricBlock({ label, value, sub, toneClass, labelClass, valueClass }) {
  return (
    <div>
      <p className={`text-xs uppercase tracking-wide ${labelClass}`}>{label}</p>
      <p className={`text-base font-semibold ${toneClass || valueClass}`}>{value}</p>
      {sub && <p className={`text-xs mt-0.5 ${labelClass}`}>{sub}</p>}
    </div>
  );
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
    if (!data?.on_site?.active_on_site && !data?.active_on_site) return undefined;
    const interval = setInterval(load, 60000);
    return () => clearInterval(interval);
  }, [data?.on_site?.active_on_site, data?.active_on_site, load]);

  const onSite = data?.on_site || data;
  const summary = onSite?.summary || data?.summary;
  const active = onSite?.active_on_site || data?.active_on_site;
  const visits = onSite?.visits || data?.visits || [];
  const enRoute = data?.en_route;
  const adherence = data?.schedule_adherence;
  const partsHold = data?.parts_hold;
  const timeToClose = data?.time_to_close;
  const firstVisit = data?.first_visit_completion;
  const callback = data?.callback_redo;
  const accessFailures = data?.access_failures;

  const hasContent =
    active ||
    visits.length > 0 ||
    enRoute?.visits?.length > 0 ||
    adherence?.visits?.length > 0 ||
    partsHold?.periods?.length > 0 ||
    timeToClose ||
    firstVisit?.recorded ||
    callback?.recorded ||
    accessFailures?.count > 0;

  const cardClass = isMobile
    ? 'rounded-xl border border-white/10 bg-white/[0.03] overflow-hidden mb-4'
    : 'bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden mb-4';

  const labelClass = isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400';
  const valueClass = isMobile ? 'text-white' : 'text-gray-900 dark:text-white';
  const titleClass = isMobile
    ? 'text-sm font-medium text-white'
    : 'text-md font-medium text-gray-700 dark:text-gray-300';
  const sectionClass = isMobile
    ? 'border-t border-white/10 pt-4 mt-4'
    : 'border-t border-gray-200 dark:border-gray-700 pt-4 mt-4';
  const rowClass = isMobile
    ? 'flex justify-between items-center text-sm border border-white/10 rounded-lg px-3 py-2'
    : 'flex justify-between items-center text-sm border border-gray-200 dark:border-gray-700 rounded-md px-3 py-2 bg-gray-50 dark:bg-gray-700/50';

  return (
    <div>
      <h3 className={`${titleClass} mb-2`}>Performance</h3>
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
              Metrics are recorded as visits progress — on-site time, travel, schedule adherence, and outcomes.
            </p>
          )}
          {!loading && !error && hasContent && (
            <>
              {/* On-site */}
              <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${labelClass}`}>On-site time</p>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-3">
                <MetricBlock
                  label="Total on-site"
                  value={
                    <>
                      {formatMinutes(summary?.total_actual_minutes)}
                      {active && (
                        <span className={`text-sm font-normal ml-1 ${labelClass}`}>
                          (+{formatMinutes(active.elapsed_minutes)} active)
                        </span>
                      )}
                    </>
                  }
                  labelClass={labelClass}
                  valueClass={valueClass}
                />
                <MetricBlock
                  label="Estimated"
                  value={formatMinutes(summary?.total_estimated_minutes)}
                  labelClass={labelClass}
                  valueClass={valueClass}
                />
                <MetricBlock
                  label="Vs estimate"
                  value={percentLabel(summary?.percent_of_estimate) || '—'}
                  sub={summary?.avg_percent_of_estimate != null ? `Avg ${summary.avg_percent_of_estimate}% per visit` : null}
                  toneClass={percentTone(summary?.percent_of_estimate)}
                  labelClass={labelClass}
                  valueClass={valueClass}
                />
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
                <div className="space-y-2 mb-1">
                  {visits.map((visit) => (
                    <div key={visit.appointment_id} className={rowClass}>
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

              {/* En route */}
              {(enRoute?.visits?.length > 0 || enRoute?.summary?.total_actual_minutes > 0) && (
                <div className={sectionClass}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${labelClass}`}>En-route time</p>
                  <div className="grid grid-cols-2 gap-4 mb-2">
                    <MetricBlock
                      label="Total travel"
                      value={formatMinutes(enRoute.summary?.total_actual_minutes)}
                      labelClass={labelClass}
                      valueClass={valueClass}
                    />
                    <MetricBlock
                      label="Vs estimate"
                      value={percentLabel(enRoute.summary?.percent_of_estimate) || '—'}
                      toneClass={percentTone(enRoute.summary?.percent_of_estimate)}
                      labelClass={labelClass}
                      valueClass={valueClass}
                    />
                  </div>
                </div>
              )}

              {/* Schedule adherence */}
              {adherence?.visits?.length > 0 && (
                <div className={sectionClass}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${labelClass}`}>Schedule adherence</p>
                  <div className="grid grid-cols-3 gap-3 mb-2">
                    <MetricBlock
                      label="On time"
                      value={adherence.summary?.on_time_count ?? 0}
                      labelClass={labelClass}
                      valueClass="text-green-600 dark:text-green-400"
                    />
                    <MetricBlock
                      label="Late"
                      value={adherence.summary?.late_count ?? 0}
                      labelClass={labelClass}
                      valueClass="text-amber-600 dark:text-amber-400"
                    />
                    <MetricBlock
                      label="Early"
                      value={adherence.summary?.early_count ?? 0}
                      labelClass={labelClass}
                      valueClass={valueClass}
                    />
                  </div>
                </div>
              )}

              {/* WO-level outcomes */}
              {(partsHold?.periods?.length > 0 ||
                timeToClose ||
                firstVisit?.recorded ||
                callback?.recorded ||
                accessFailures?.count > 0) && (
                <div className={sectionClass}>
                  <p className={`text-xs font-semibold uppercase tracking-wide mb-3 ${labelClass}`}>Work order outcomes</p>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                    {partsHold?.periods?.length > 0 && (
                      <MetricBlock
                        label="Parts hold"
                        value={formatMinutes(partsHold.total_minutes)}
                        sub={partsHold.active ? 'Currently waiting on parts' : null}
                        labelClass={labelClass}
                        valueClass={valueClass}
                      />
                    )}
                    {timeToClose && (
                      <MetricBlock
                        label="Time to close"
                        value={formatMinutes(timeToClose.actual_minutes)}
                        labelClass={labelClass}
                        valueClass={valueClass}
                      />
                    )}
                    {firstVisit?.recorded && (
                      <MetricBlock
                        label="First-visit fix"
                        value={firstVisit.achieved ? 'Yes' : 'No'}
                        sub={firstVisit.achieved ? 'No follow-up visit needed' : 'Follow-up visit on file'}
                        toneClass={boolTone(firstVisit.achieved)}
                        labelClass={labelClass}
                        valueClass={valueClass}
                      />
                    )}
                    {callback?.recorded && (
                      <MetricBlock
                        label="Callback / redo"
                        value={callback.is_callback ? 'Yes' : 'No'}
                        sub={callback.follow_up_visits > 0 ? `${callback.follow_up_visits} follow-up visit(s)` : null}
                        toneClass={callback.is_callback ? 'text-amber-600 dark:text-amber-400' : 'text-green-600 dark:text-green-400'}
                        labelClass={labelClass}
                        valueClass={valueClass}
                      />
                    )}
                    {accessFailures?.count > 0 && (
                      <MetricBlock
                        label="Unreachable"
                        value={accessFailures.count}
                        sub="Could not access property"
                        toneClass="text-red-600 dark:text-red-400"
                        labelClass={labelClass}
                        valueClass={valueClass}
                      />
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
