/**
 * Critical Mass: missed visits. A job still Scheduled / Pending / En Route whose visit
 * date is before today. Same rule as the dashboard count (backend
 * OPEN_OVERDUE_STATUSES in work_order_dashboard_stats_service.py), so the panel lists
 * exactly the jobs behind the number on the card.
 */
import { differenceInCalendarDays, isBefore, parseISO, startOfDay } from 'date-fns';

export const CRITICAL_MASS_STATUSES = new Set(['scheduled', 'pending', 'en_route']);

/** Naive API times are UTC. */
export function parseScheduled(wo) {
  if (!wo?.scheduled_start) return null;
  const s = String(wo.scheduled_start).trim();
  if (!s) return null;
  const hasZone = s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s);
  const d = parseISO(hasZone ? s : `${s}Z`);
  return d && !Number.isNaN(d.getTime()) ? d : null;
}

export function isCriticalMass(wo, now = new Date()) {
  if (!wo || !CRITICAL_MASS_STATUSES.has(wo.status)) return false;
  const d = parseScheduled(wo);
  return Boolean(d) && isBefore(startOfDay(d), startOfDay(now));
}

export function daysOverdue(wo, now = new Date()) {
  const d = parseScheduled(wo);
  if (!d) return 0;
  return Math.max(0, differenceInCalendarDays(startOfDay(now), startOfDay(d)));
}

/** Most overdue first (oldest visit first on ties). */
export function sortCriticalMass(items, now = new Date()) {
  return (items || [])
    .filter((wo) => isCriticalMass(wo, now))
    .sort((a, b) => daysOverdue(b, now) - daysOverdue(a, now)
      || (parseScheduled(a)?.getTime() || 0) - (parseScheduled(b)?.getTime() || 0));
}

/** "04 // OVERDUE 6d" */
export function overdueTag(index, days) {
  return `${String(index + 1).padStart(2, '0')} // OVERDUE ${days}d`;
}

export function criticalMassClientLabel(wo) {
  return (
    wo?.client?.company_name ||
    wo?.client_name ||
    `${wo?.client?.first_name || ''} ${wo?.client?.last_name || ''}`.trim() ||
    'No client'
  );
}

export function criticalMassApplianceLabel(wo) {
  return (
    [wo?.equipment_make, wo?.equipment_type && String(wo.equipment_type).replace(/_/g, ' ')].filter(Boolean).join(' ') ||
    'Appliance'
  );
}

/** Best number to call for this job, or '' when there isn't one. */
export function criticalMassPhone(wo) {
  return wo?.client?.mobile || wo?.client?.phone || wo?.client_phone || wo?.property?.tenant_phone || wo?.tenant_phone || '';
}
