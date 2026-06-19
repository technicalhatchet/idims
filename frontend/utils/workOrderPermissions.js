/** Shared work-order and appointment edit permission helpers (mirror backend rules). */

export function normalizeId(id) {
  if (id == null || id === '') return null;
  return String(id).toLowerCase();
}

export function isWorkOrderClosed(workOrder) {
  if (!workOrder) return false;
  return Boolean(workOrder.is_closed) || String(workOrder.status || '').toLowerCase() === 'closed';
}

/** Cancelled/refunded work orders cannot be edited (mirror backend IMMUTABLE_WO_STATUSES). */
const IMMUTABLE_WO_STATUSES = new Set(['canceled', 'refunded']);

/**
 * Work order statuses that make the order read-only for editing purposes.
 * "redo" = work has moved to a child order, parent should be frozen.
 */
const READ_ONLY_WO_STATUSES = new Set(['redo']);

/** Accept legacy API/DB spelling until migration completes. */
export function normalizeStatusKey(status) {
  const s = String(status || '').toLowerCase();
  return s === 'cancelled' ? 'canceled' : s;
}

export function isWorkOrderImmutable(workOrder) {
  if (!workOrder) return false;
  return IMMUTABLE_WO_STATUSES.has(normalizeStatusKey(workOrder.status));
}

/**
 * True when the work order should be treated as read-only for editing.
 * Includes: redo status (work moved to child), but NOT immutable statuses
 * (which are handled separately and also block closing).
 */
export function isWorkOrderReadOnly(workOrder) {
  if (!workOrder) return false;
  return READ_ONLY_WO_STATUSES.has(normalizeStatusKey(workOrder.status));
}

export function isManagerOrAdminRole(role) {
  return role === 'admin' || role === 'manager';
}

export function resolveCurrentTechnicianId(user, technicians = []) {
  if (!user || !Array.isArray(technicians)) return null;
  const email = (user.email || '').toLowerCase();

  for (const tech of technicians) {
    if (tech.user_id && user.app_user_id && normalizeId(tech.user_id) === normalizeId(user.app_user_id)) {
      return String(tech.id);
    }
    const techEmail = (tech.user?.email || tech.email || '').toLowerCase();
    if (email && techEmail && techEmail === email) {
      return String(tech.id);
    }
  }
  return null;
}

export const CLOSED_APPOINTMENT_STATUS_ONLY = ['redo', 'refund', 'completed'];

export function canEditAppointment({ appointment, role, currentTechnicianId, workOrder }) {
  if (!appointment || isWorkOrderClosed(workOrder)) return false;
  if (isManagerOrAdminRole(role)) return true;
  if (role === 'technician') {
    if (!currentTechnicianId) return false;
    return normalizeId(appointment.assigned_technician_id) === normalizeId(currentTechnicianId);
  }
  return false;
}

export function canUpdateAppointmentStatus({ appointment, role, currentTechnicianId, workOrder }) {
  if (!appointment) return false;
  if (isWorkOrderClosed(workOrder)) {
    if (isManagerOrAdminRole(role)) return true;
    if (role === 'technician' && currentTechnicianId) {
      return normalizeId(appointment.assigned_technician_id) === normalizeId(currentTechnicianId);
    }
    return false;
  }
  return canEditAppointment({ appointment, role, currentTechnicianId, workOrder });
}

export function canCreateRedoWorkOrder({ role }) {
  return isManagerOrAdminRole(role) || role === 'technician';
}

export function getPendingRedoAppointments(workOrder) {
  if (!workOrder?.appointments?.length) return [];
  const childByAppt = new Map(
    (workOrder.child_redo_work_orders || []).map((child) => [
      normalizeId(child.redo_source_appointment_id),
      child,
    ])
  );
  return workOrder.appointments.filter(
    (appt) =>
      String(appt.status || '').toLowerCase() === 'redo' &&
      !childByAppt.has(normalizeId(appt.id))
  );
}

/** Field techs schedule follow-ups on site; managers/admins schedule from office. */
export function canCreateAppointments({ role, workOrder }) {
  if (isWorkOrderClosed(workOrder)) return false;
  return isManagerOrAdminRole(role) || role === 'technician';
}

export function canDeleteAppointments({ role, workOrder }) {
  if (isWorkOrderClosed(workOrder)) return false;
  return isManagerOrAdminRole(role);
}

/** @deprecated Prefer canCreateAppointments / canDeleteAppointments */
export function canCreateOrDeleteAppointments({ role, workOrder }) {
  return canCreateAppointments({ role, workOrder });
}

export function canEditWorkOrderBilling({ role, workOrder }) {
  if (isWorkOrderClosed(workOrder)) return false;
  return isManagerOrAdminRole(role);
}

export function canEditWorkOrderParts({ role, workOrder }) {
  if (isWorkOrderClosed(workOrder)) return false;
  return isManagerOrAdminRole(role) || role === 'technician';
}

/** Statuses eligible for administrative close (mirrors backend CLOSE_ELIGIBLE_WO_STATUSES). */
const CLOSE_ELIGIBLE_WO_STATUSES = new Set(['completed', 'redo']);

/** Technicians may administratively close completed or redo orders they can view. */
export function canCloseWorkOrder({ role, workOrder }) {
  if (!workOrder || isWorkOrderClosed(workOrder)) return false;
  const status = normalizeStatusKey(workOrder.status);
  if (!CLOSE_ELIGIBLE_WO_STATUSES.has(status)) return false;
  return isManagerOrAdminRole(role) || role === 'technician';
}

const CLOSE_ELIGIBLE_APPOINTMENT_STATUSES = new Set([
  'canceled',
  'completed',
  'failed',
  'refund',
  'redo',
  'unreachable',
]);

/** Every visit canceled or completed — pending payment / phone payment block close. */
export function allAppointmentsCloseEligible(workOrder) {
  const appts = workOrder?.appointments || [];
  if (!appts.length) return true;
  return appts.every((a) =>
    CLOSE_ELIGIBLE_APPOINTMENT_STATUSES.has(normalizeStatusKey(a.status))
  );
}

/** @deprecated Use allAppointmentsCloseEligible — failed/APR is not close-eligible. */
export function allAppointmentsTerminal(workOrder) {
  return allAppointmentsCloseEligible(workOrder);
}

/** Show Close when WO is completed, not closed, role allowed, and visits are wrapped up. */
export function canShowCloseOrderAction({ role, workOrder }) {
  if (!canCloseWorkOrder({ role, workOrder })) return false;
  return allAppointmentsCloseEligible(workOrder);
}

export function canReopenWorkOrder({ role, workOrder }) {
  if (role !== 'admin') return false;
  if (!workOrder?.is_closed || workOrder?.is_redo) return false;
  return true;
}
