import { format, parseISO } from 'date-fns';

export const PORTAL_LABOR_WARRANTY_DAYS = 90;
const PORTAL_TZ = 'America/New_York';

function ymdInPortalTz(isoOrDate) {
  if (!isoOrDate) return null;
  const d = typeof isoOrDate === 'string' ? parseISO(isoOrDate) : isoOrDate;
  if (Number.isNaN(d.getTime())) return null;
  return new Intl.DateTimeFormat('en-CA', { timeZone: PORTAL_TZ }).format(d);
}

function ymdToUtcDate(ymd) {
  const [y, m, day] = ymd.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day));
}

function addCalendarDaysYmd(ymd, days) {
  const d = ymdToUtcDate(ymd);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function calendarDaysBetweenYmd(fromYmd, toYmd) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((ymdToUtcDate(toYmd) - ymdToUtcDate(fromYmd)) / msPerDay);
}

/** Same service date shown on warranty / repair cards (order created date, local calendar day). */
export function getPortalLaborServiceDateIso(workOrder) {
  return workOrder?.created_at || null;
}

export function getPortalLaborWarrantyExpiryYmd(workOrder) {
  const serviceYmd = ymdInPortalTz(getPortalLaborServiceDateIso(workOrder));
  if (!serviceYmd) return null;
  return addCalendarDaysYmd(serviceYmd, PORTAL_LABOR_WARRANTY_DAYS);
}

export function getPortalLaborWarrantyExpiryDate(workOrder) {
  const ymd = getPortalLaborWarrantyExpiryYmd(workOrder);
  if (!ymd) return null;
  return parseISO(`${ymd}T12:00:00`);
}

export function isPortalLaborWarrantyExpired(workOrder, now = new Date()) {
  const expiryYmd = getPortalLaborWarrantyExpiryYmd(workOrder);
  const todayYmd = ymdInPortalTz(now);
  if (!expiryYmd || !todayYmd) return true;
  return todayYmd > expiryYmd;
}

/** Whole calendar days until expiry (inclusive of expiry day as 0 when today === expiry). */
export function getPortalLaborWarrantyDaysLeft(workOrder, now = new Date()) {
  const expiryYmd = getPortalLaborWarrantyExpiryYmd(workOrder);
  const todayYmd = ymdInPortalTz(now);
  if (!expiryYmd || !todayYmd) return 0;
  return calendarDaysBetweenYmd(todayYmd, expiryYmd);
}

export function formatPortalLaborWarrantyExpiryLabel(workOrder) {
  const expiry = getPortalLaborWarrantyExpiryDate(workOrder);
  if (!expiry) return 'N/A';
  return format(expiry, 'MMM d, yyyy');
}

const OPEN_WO_STATUSES = new Set([
  'pending',
  'scheduled',
  'en_route',
  'in_progress',
  'waiting_on_parts',
  'parts_on_order',
  'on_hold',
  'completed_pending_payment',
]);

export function isPortalWorkOrderOpen(status) {
  const s = String(status || '').toLowerCase();
  return OPEN_WO_STATUSES.has(s);
}

export function countPortalActiveLaborWarranties(workOrders = [], now = new Date()) {
  return workOrders.filter((wo) => {
    if (isPortalLaborWarrantyExpired(wo, now)) return false;
    const s = String(wo.status || '').toLowerCase();
    return ['completed', 'closed'].includes(s);
  }).length;
}

/** Unified countdown copy for warranty UI. */
export function formatPortalWarrantyDaysLeftLabel(daysLeft) {
  if (daysLeft < 0) return 'Expired';
  if (daysLeft === 0) return 'Expires today';
  if (daysLeft === 1) return 'Expires tomorrow';
  return `Expires in ${daysLeft} days`;
}
