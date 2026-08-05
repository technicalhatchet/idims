/** Visit statuses eligible for attaching SKUs from the field dock. */
const OPEN_VISIT_STATUSES = new Set(['scheduled', 'en_route', 'in_progress', 'reschedule']);

function visitStatus(appt) {
  const raw = appt?.status;
  return (raw?.value ?? raw ?? '').toString().toLowerCase();
}

function scheduledMs(appt) {
  if (!appt?.scheduled_start) return Number.POSITIVE_INFINITY;
  const raw = appt.scheduled_start;
  const iso = typeof raw === 'string' && !raw.endsWith('Z') && !raw.includes('+')
    ? `${raw}Z`
    : raw;
  const ms = new Date(iso).getTime();
  return Number.isNaN(ms) ? Number.POSITIVE_INFINITY : ms;
}

/**
 * Pick the visit to edit when adding services from the mobile dock:
 * prefer in_progress, then closest scheduled_start to now.
 */
export function pickTargetAppointmentForSkuAdd(appointments) {
  const open = (appointments || []).filter((a) => OPEN_VISIT_STATUSES.has(visitStatus(a)));
  if (!open.length) return null;

  const inProgress = open.filter((a) => visitStatus(a) === 'in_progress');
  const pool = inProgress.length ? inProgress : open;
  const now = Date.now();

  return pool.slice().sort((a, b) => Math.abs(scheduledMs(a) - now) - Math.abs(scheduledMs(b) - now))[0];
}
