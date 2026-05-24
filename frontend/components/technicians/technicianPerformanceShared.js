export const PERFORMANCE_PERIODS = [
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'quarter', label: 'Quarter' },
  { id: 'year', label: 'Year' },
];

export function formatPerfMinutes(minutes) {
  if (minutes == null || Number.isNaN(minutes)) return '—';
  const rounded = Math.round(minutes);
  const h = Math.floor(rounded / 60);
  const m = rounded % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${rounded} min`;
}

export function formatPercent(value) {
  if (value == null || Number.isNaN(value)) return 'N/A';
  return `${value}%`;
}

export function hasFieldPerformanceData(performance) {
  if (!performance?.field) return false;
  const f = performance.field;
  return (
    (f.visit_count || 0) > 0 ||
    (f.en_route?.visit_count || 0) > 0 ||
    (f.schedule_adherence?.visit_count || 0) > 0 ||
    (f.parts_hold_minutes || 0) > 0 ||
    f.avg_time_to_close_minutes != null ||
    (f.first_visit_total || 0) > 0 ||
    (f.access_failure_count || 0) > 0
  );
}

export function buildPerformanceCards(performance) {
  const field = performance?.field || {};
  const onSite = field.on_site || {};
  const adherence = field.schedule_adherence || {};
  const enRoute = field.en_route || {};

  return [
    {
      key: 'visits',
      label: 'Visits tracked',
      value: field.visit_count ?? 0,
      sub: performance?.completed_jobs != null ? `${performance.completed_jobs} jobs completed` : null,
    },
    {
      key: 'on_site',
      label: 'Avg on-site',
      value: onSite.avg_actual_minutes != null ? formatPerfMinutes(onSite.avg_actual_minutes) : 'N/A',
      sub: onSite.avg_percent_of_estimate != null ? `${onSite.avg_percent_of_estimate}% of SKU est` : null,
    },
    {
      key: 'on_time',
      label: 'On-time rate',
      value: formatPercent(adherence.on_time_rate),
      sub: adherence.visit_count ? `${adherence.on_time_count}/${adherence.visit_count} arrivals` : null,
    },
    {
      key: 'efficiency',
      label: 'Field efficiency',
      value: formatPercent(performance?.efficiency_score),
      sub: 'On-site vs estimate',
    },
    {
      key: 'en_route',
      label: 'En-route time',
      value: enRoute.total_actual_minutes ? formatPerfMinutes(enRoute.total_actual_minutes) : 'N/A',
      sub: enRoute.percent_of_estimate != null ? `${enRoute.percent_of_estimate}% of est travel` : null,
    },
    {
      key: 'first_visit',
      label: 'First-visit fix',
      value: field.first_visit_fix_rate != null ? formatPercent(field.first_visit_fix_rate) : 'N/A',
      sub: field.first_visit_total ? `${field.first_visit_fix_count}/${field.first_visit_total} jobs` : null,
    },
    {
      key: 'callback',
      label: 'Callbacks',
      value: field.callback_count ?? 0,
      sub: field.callback_total ? `${field.callback_total} jobs with follow-ups` : null,
    },
    {
      key: 'access',
      label: 'Unreachable / failed',
      value: field.access_failure_count ?? 0,
      sub: 'Access failure visits',
    },
  ];
}
