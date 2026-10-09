/**
 * Canonical paths for technician / field UI.
 * Desktop office list stays at /work_orders; mobile "Master OPS" list lives under techboard.
 */

/** Tactical mobile work-order list (formerly /work_orders/test). */
export const TECH_WORK_ORDERS_LIST_PATH = '/techboard/work-orders';

/** Mobile work-order detail shell. */
export function techWorkOrderDetailPath(workOrderId, { tab } = {}) {
  const base = `/work_orders/${workOrderId}/mobile`;
  if (tab) return `${base}?tab=${encodeURIComponent(tab)}`;
  return base;
}

export function techWorkOrdersListUrl(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${TECH_WORK_ORDERS_LIST_PATH}?${qs}` : TECH_WORK_ORDERS_LIST_PATH;
}

/** Techboard banner: same subset as pendingScheduling stat on techboard. */
export function techWorkOrdersNeedsSchedulingUrl() {
  return techWorkOrdersListUrl({ preset: 'needs_scheduling' });
}
