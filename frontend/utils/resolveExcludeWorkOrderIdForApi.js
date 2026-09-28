const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/**
 * Work-order UUID for API query params that exclude the current visit.
 * Solomon draft scopes (`solomon-*`) and other non-WO ids must not be sent — the API validates UUID.
 */
export function resolveExcludeWorkOrderIdForApi(workOrderId) {
  if (workOrderId == null || workOrderId === '') return null;
  const raw = String(workOrderId).trim();
  if (!raw || raw.startsWith('solomon-')) return null;
  return UUID_RE.test(raw) ? raw : null;
}
