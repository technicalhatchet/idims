/** Defaults and helpers for portal self-scheduling settings. */

export const DEFAULT_PORTAL_SCHEDULING = {
  self_scheduling_enabled: true,
  scheduling_windows: {
    morning: { enabled: true, start: '08:00', end: '12:00' },
    afternoon: { enabled: true, start: '12:00', end: '17:00' },
    evening: { enabled: false, start: '17:00', end: '21:00' },
  },
  same_day_lead_minutes_before_close: 60,
  narrowing_batch_time: '17:30',
  auto_assign: {
    strategy: 'closest_travel',
    fallback_technician_id: null,
  },
  priority_service: {
    enabled: true,
    priority_diagnostic_multiplier: 1.5,
    priority_trip_multiplier: 1.0,
    priority_flat_fee: 75,
    emergency_diagnostic_multiplier: 2.0,
    emergency_trip_multiplier: 1.5,
    emergency_flat_fee: 125,
    request_cutoff_time: '23:59',
  },
  comms: {
    narrowing_sms: true,
    narrowing_email: true,
    same_day_approval_sms: true,
    same_day_approval_email: true,
    denial_sms: true,
    denial_email: true,
  },
  payment: {
    requires_payment: false,
    square_application_id: '',
    square_location_id: '',
    square_access_token: '',
    square_environment: 'sandbox',
  },
  booking: {
    min_days_out: 1,
    max_days_out: 21,
  },
};

export const AUTO_ASSIGN_STRATEGIES = [
  { value: 'closest_travel', label: 'Closest by travel time' },
  { value: 'round_robin', label: 'Round robin' },
  { value: 'manual_only', label: 'Manual assignment only' },
];

export const SCHEDULING_WINDOW_LABELS = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
};

function deepMerge(base, patch) {
  const out = { ...base };
  Object.entries(patch || {}).forEach(([key, value]) => {
    if (value && typeof value === 'object' && !Array.isArray(value) && typeof out[key] === 'object') {
      out[key] = deepMerge(out[key], value);
    } else {
      out[key] = value;
    }
  });
  return out;
}

export function normalizePortalScheduling(raw) {
  return deepMerge(DEFAULT_PORTAL_SCHEDULING, raw || {});
}

export function formatWindowRange(window) {
  if (!window?.start || !window?.end) return '';
  const fmt = (t) => {
    const [h, m] = t.split(':').map(Number);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  };
  return `${fmt(window.start)} – ${fmt(window.end)}`;
}
