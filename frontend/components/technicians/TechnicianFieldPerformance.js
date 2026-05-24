import {
  PERFORMANCE_PERIODS,
  buildPerformanceCards,
  formatPerfMinutes,
  formatPercent,
  hasFieldPerformanceData,
} from './technicianPerformanceShared';

function PeriodPicker({ period, onPeriodChange, variant = 'desktop' }) {
  const isMobile = variant === 'mobile';

  if (isMobile) {
    return (
      <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
        {PERFORMANCE_PERIODS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => onPeriodChange(id)}
            className="px-4 py-2 text-xs uppercase tracking-wide font-medium rounded-lg whitespace-nowrap"
            style={{
              background: period === id ? 'rgba(255, 122, 0, 0.25)' : 'rgba(13, 21, 37, 0.4)',
              border: `1px solid ${period === id ? 'rgba(255, 122, 0, 0.6)' : 'rgba(255,255,255,0.1)'}`,
              color: period === id ? '#FF7A00' : '#9CA3AF',
            }}
          >
            {label}
          </button>
        ))}
      </div>
    );
  }

  return (
    <select
      value={period}
      onChange={(e) => onPeriodChange(e.target.value)}
      className="form-select rounded-md border-gray-300 dark:border-gray-600 shadow-sm focus:border-blue-500 focus:ring-blue-500 sm:text-sm dark:bg-gray-700 dark:text-white"
    >
      {PERFORMANCE_PERIODS.map(({ id, label }) => (
        <option key={id} value={id}>{label}</option>
      ))}
    </select>
  );
}

function MetricTile({ label, value, sub, variant = 'desktop' }) {
  const isMobile = variant === 'mobile';
  const tileClass = isMobile
    ? 'rounded-lg p-4 border border-orange-400/30 bg-[rgba(13,21,37,0.85)]'
    : 'bg-gray-50 dark:bg-gray-700 rounded-lg p-4';

  return (
    <div className={tileClass}>
      <p className={`text-xs uppercase tracking-wide mb-1 ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
        {label}
      </p>
      <p className={`text-2xl font-semibold ${isMobile ? 'text-white' : 'text-gray-900 dark:text-white'}`}>{value}</p>
      {sub && (
        <p className={`text-xs mt-1 ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>{sub}</p>
      )}
    </div>
  );
}

export default function TechnicianFieldPerformance({
  performance,
  period,
  onPeriodChange,
  variant = 'desktop',
  showHeader = true,
}) {
  const isMobile = variant === 'mobile';
  const field = performance?.field;
  const cards = buildPerformanceCards(performance);
  const hasField = hasFieldPerformanceData(performance);

  const shellClass = isMobile
    ? ''
    : 'bg-white dark:bg-gray-800 shadow rounded-lg overflow-hidden';

  const headerClass = isMobile
    ? 'mb-4'
    : 'px-6 py-5 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900 flex justify-between items-center';

  return (
    <div className={shellClass}>
      {showHeader && (
        <div className={headerClass}>
          <div>
            <h2 className={`text-lg font-medium ${isMobile ? 'text-white' : 'text-gray-900 dark:text-white'}`}>
              Field Performance
            </h2>
            {performance?.period && (
              <p className={`text-sm mt-1 ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
                {performance.period}
                {performance.date_range?.start && performance.date_range?.end && (
                  <span>
                    {' '}
                    · {new Date(performance.date_range.start).toLocaleDateString()}
                    {' – '}
                    {new Date(performance.date_range.end).toLocaleDateString()}
                  </span>
                )}
              </p>
            )}
          </div>
          {onPeriodChange && (
            <PeriodPicker period={period} onPeriodChange={onPeriodChange} variant={variant} />
          )}
        </div>
      )}

      {!showHeader && onPeriodChange && (
        <PeriodPicker period={period} onPeriodChange={onPeriodChange} variant={variant} />
      )}

      <div className={isMobile ? '' : 'px-6 py-5 space-y-6'}>
        {!hasField && (
          <p className={`text-sm ${isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}`}>
            No field metrics recorded for this period yet. Metrics appear as visits move through en route, in progress, and completed.
          </p>
        )}

        {hasField && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              {cards.map((card) => (
                <MetricTile key={card.key} {...card} variant={variant} />
              ))}
            </div>

            {performance?.metrics?.length > 0 && (
              <div className={isMobile ? 'mt-4 rounded-lg p-4 border border-white/10 bg-white/[0.03]' : ''}>
                <h3 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${isMobile ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                  Job volume
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {performance.metrics.slice(0, 4).map((metric) => (
                    <MetricTile
                      key={metric.name}
                      label={metric.name}
                      value={metric.value}
                      variant={variant}
                    />
                  ))}
                </div>
              </div>
            )}

            <div className={isMobile ? 'mt-4 rounded-lg p-4 border border-white/10 bg-white/[0.03]' : 'border-t border-gray-200 dark:border-gray-700 pt-4'}>
              <h3 className={`text-sm font-semibold uppercase tracking-wide mb-3 ${isMobile ? 'text-gray-400' : 'text-gray-700 dark:text-gray-300'}`}>
                Outcomes
              </h3>
              <div className={`space-y-2 text-sm ${isMobile ? 'text-gray-300' : 'text-gray-600 dark:text-gray-400'}`}>
                <div className="flex justify-between gap-4">
                  <span>Parts hold time</span>
                  <span className={isMobile ? 'text-white' : 'text-gray-900 dark:text-white'}>
                    {field.parts_hold_minutes ? formatPerfMinutes(field.parts_hold_minutes) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Avg time to close</span>
                  <span className={isMobile ? 'text-white' : 'text-gray-900 dark:text-white'}>
                    {field.avg_time_to_close_minutes != null ? formatPerfMinutes(field.avg_time_to_close_minutes) : 'N/A'}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Late arrivals</span>
                  <span className={isMobile ? 'text-white' : 'text-gray-900 dark:text-white'}>
                    {field.schedule_adherence?.late_count ?? 0}
                  </span>
                </div>
                <div className="flex justify-between gap-4">
                  <span>Work orders with metrics</span>
                  <span className={isMobile ? 'text-white' : 'text-gray-900 dark:text-white'}>
                    {field.work_orders_with_data ?? 0}
                  </span>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
