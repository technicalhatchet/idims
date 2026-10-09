/**
 * Canonical paths for TechDeck (mobile / field IDIMS).
 * Office desktop routes stay on /work_orders, /dashboard, etc.
 */

export const TECH_HOME = '/techboard';

/** Master OPS work-order list. */
export const TECH_WORK_ORDERS_LIST_PATH = '/techboard/work-orders';

/** Ops Board — schedule timeline (formerly schedule-test). */
export const TECH_OPS_PATH = '/techboard/ops';

/** Mission Queue — today’s dispatch list (formerly techdashboard/opsboard). */
export const TECH_MISSION_QUEUE_PATH = '/techboard/mission-queue';

export const TECH_ROUTE_PATH = '/techboard/route';
export const TECH_DMA_PATH = '/techboard/dma';
export const TECH_PARTS_WAIT_PATH = '/techboard/partswait';
export const TECH_MASS_PATH = '/techboard/mass';
export const TECH_PERFORMANCE_PATH = '/techboard/performance';

/** Mobile work-order detail. */
export function techWorkOrderDetailPath(workOrderId, { tab } = {}) {
  const base = `${TECH_WORK_ORDERS_LIST_PATH}/${workOrderId}`;
  if (tab) return `${base}?tab=${encodeURIComponent(tab)}`;
  return base;
}

export function techWorkOrderEditPath(workOrderId) {
  return `${TECH_WORK_ORDERS_LIST_PATH}/${workOrderId}/edit`;
}

export function techWorkOrderDebriefingPath(workOrderId, { from } = {}) {
  const base = `${TECH_WORK_ORDERS_LIST_PATH}/${workOrderId}/debriefing`;
  if (from) return `${base}?from=${encodeURIComponent(from)}`;
  return base;
}

export function techWorkOrderNewPath(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${TECH_WORK_ORDERS_LIST_PATH}/new?${qs}` : `${TECH_WORK_ORDERS_LIST_PATH}/new`;
}

export function techWorkOrdersListUrl(query = {}) {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${TECH_WORK_ORDERS_LIST_PATH}?${qs}` : TECH_WORK_ORDERS_LIST_PATH;
}

/** Techboard banner: pending WOs that still need a calendar slot. */
export function techWorkOrdersNeedsSchedulingUrl() {
  return techWorkOrdersListUrl({ preset: 'needs_scheduling' });
}

/** DMA hub and sub-routes under /techboard/dma */
export function techDmaPath(subpath = '', query = {}) {
  const trimmed = String(subpath || '').replace(/^\//, '');
  const base = trimmed ? `${TECH_DMA_PATH}/${trimmed}` : TECH_DMA_PATH;
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => {
    if (value != null && value !== '') params.set(key, String(value));
  });
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

/** True when pathname is a TechDeck work-order detail URL. */
export function isTechWorkOrderDetailPath(pathname) {
  if (!pathname) return false;
  if (/^\/techboard\/work-orders\/[^/]+$/.test(pathname)) return true;
  return /^\/work_orders\/[^/]+\/mobile$/.test(pathname);
}
