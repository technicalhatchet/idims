/** @param {unknown} raw */
export function parseAutoApproveLimitInput(raw) {
  if (raw === '' || raw == null) return null;
  const n = Number(String(raw).replace(/[$,\s]/g, ''));
  if (!Number.isFinite(n) || n < 0) return undefined;
  return Math.round(n * 100) / 100;
}

/** @param {number | null | undefined} limit */
export function formatAutoApproveLimit(limit) {
  if (limit == null) return '';
  return Number(limit).toFixed(2);
}

/**
 * @param {{ property?: { estimate_auto_approve_limit?: number | null }, client?: { estimate_auto_approve_limit?: number | null } } | null | undefined} workOrder
 */
export function effectiveAutoApproveLimitForWorkOrder(workOrder) {
  const propLimit = workOrder?.property?.estimate_auto_approve_limit;
  if (propLimit != null) return propLimit;
  const clientLimit = workOrder?.client?.estimate_auto_approve_limit;
  if (clientLimit != null) return clientLimit;
  return null;
}
