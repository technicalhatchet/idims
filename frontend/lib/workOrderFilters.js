/** Normalize WO status strings for comparisons (techboard, mobile list, ops). */
export function normalizeWorkOrderStatus(status) {
  if (!status) return '';
  const raw = typeof status === 'object' && status.value != null ? status.value : status;
  return String(raw).toLowerCase().trim();
}

/** Matches techboard "need scheduling" count — pending with no appointment on the calendar. */
export function isWorkOrderNeedsScheduling(wo) {
  if (!wo) return false;
  const st = normalizeWorkOrderStatus(wo.status);
  if (st !== 'pending') return false;
  if (wo.scheduled_start) return false;
  if (Array.isArray(wo.appointments) && wo.appointments.some((a) => a?.scheduled_start)) {
    return false;
  }
  return true;
}

export function filterWorkOrdersByListParams(items, params = {}) {
  if (!Array.isArray(items) || !items.length) return [];
  let list = [...items];

  const statusParam = params.status_filter || params.status;
  if (statusParam) {
    list = list.filter(
      (wo) => normalizeWorkOrderStatus(wo.status) === normalizeWorkOrderStatus(statusParam),
    );
  }

  if (params.preset === 'needs_scheduling') {
    list = list.filter(isWorkOrderNeedsScheduling);
    return list;
  }

  if (params.schedule === 'unscheduled' || params.unscheduled) {
    list = list.filter((wo) => !wo.scheduled_start);
  }

  if (params.start_date && params.end_date) {
    const startMs = Date.parse(params.start_date);
    const endMs = Date.parse(params.end_date);
    if (Number.isFinite(startMs) && Number.isFinite(endMs)) {
      list = list.filter((wo) => {
        if (!wo.scheduled_start) return false;
        const ms = Date.parse(
          wo.scheduled_start.endsWith('Z') ? wo.scheduled_start : `${wo.scheduled_start}Z`,
        );
        return Number.isFinite(ms) && ms >= startMs && ms <= endMs;
      });
    }
  }

  if (params.technician_id) {
    const techId = String(params.technician_id);
    list = list.filter((wo) => String(wo.assigned_technician_id || '') === techId);
  }

  return list;
}
