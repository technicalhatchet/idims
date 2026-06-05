/** Shared work-order and appointment edit permission helpers (mirror backend rules). */

export function normalizeId(id) {
  if (id == null || id === '') return null;
  return String(id).toLowerCase();
}

export function isWorkOrderClosed(workOrder) {
  if (!workOrder) return false;
  return Boolean(workOrder.is_closed) || String(workOrder.status || '').toLowerCase() === 'closed';
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

export function canCreateOrDeleteAppointments({ role, workOrder }) {
  if (isWorkOrderClosed(workOrder)) return false;
  return isManagerOrAdminRole(role);
}

export function canEditWorkOrderBilling({ role, workOrder }) {
  if (isWorkOrderClosed(workOrder)) return false;
  return isManagerOrAdminRole(role);
}

export function canEditWorkOrderParts({ role, workOrder }) {
  if (isWorkOrderClosed(workOrder)) return false;
  return isManagerOrAdminRole(role) || role === 'technician';
}

/** Technicians may administratively close completed orders they can view. */
export function canCloseWorkOrder({ role, workOrder }) {
  if (!workOrder || isWorkOrderClosed(workOrder)) return false;
  if (String(workOrder.status || '').toLowerCase() !== 'completed') return false;
  return isManagerOrAdminRole(role) || role === 'technician';
}
