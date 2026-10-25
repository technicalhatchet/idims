/** TechDeck “parts waiting” — open jobs on parts hold or with ordered/needed lines. */

import { isWorkOrderClosed, normalizeStatusKey } from './workOrderPermissions';

export const WO_PARTS_HOLD_STATUSES = new Set(['waiting_on_parts', 'parts_on_order']);

const EXCLUDED_WO_STATUSES = new Set(['completed', 'canceled', 'closed', 'refunded']);

export function workOrderEligibleForPartsWaiting(workOrder) {
  if (!workOrder) return false;
  if (isWorkOrderClosed(workOrder)) return false;
  const st = normalizeStatusKey(workOrder.status);
  if (EXCLUDED_WO_STATUSES.has(st)) return false;
  return true;
}

/** Aligns with `parts_waiting` in work_order_dashboard_stats_service.py */
export function matchesPartsWaitingStatCriteria(workOrder) {
  if (!workOrderEligibleForPartsWaiting(workOrder)) return false;
  const st = normalizeStatusKey(workOrder.status);
  if (WO_PARTS_HOLD_STATUSES.has(st)) return true;
  return (
    Array.isArray(workOrder.parts) &&
    workOrder.parts.some((p) => ['ordered', 'needed'].includes(p.status))
  );
}
