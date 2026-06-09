/** SKU ↔ visit helpers for Phase 5 (display, discount, duration). */

import { differenceInMinutes, parseISO } from 'date-fns';
import { DEFAULT_MIN_SLOT_MINUTES } from './appointment-scheduling';

export const REPAIR_COMPLETE_APPOINTMENT_STATUSES = ['completed', 'completed_pending_payment'];

export function resolveAppointmentServiceIds(appointment) {
  if (!appointment) return [];
  if (Array.isArray(appointment.service_ids) && appointment.service_ids.length > 0) {
    return appointment.service_ids.map((id) => String(id));
  }
  if (Array.isArray(appointment.services) && appointment.services.length > 0) {
    return appointment.services.map((s) => String(s.id)).filter(Boolean);
  }
  return [];
}

export function serviceIdsMatch(a, b) {
  return String(a) === String(b);
}

export function isRepairServiceType(serviceType) {
  return String(serviceType || '').toLowerCase() === 'repair';
}

export function isDiagnosticServiceType(serviceType) {
  return String(serviceType || '').toLowerCase() === 'diagnostic';
}

export function catalogServiceIsRepair(service) {
  if (!service) return false;
  if (isRepairServiceType(service.service_type)) return true;
  return String(service.name || '').toLowerCase().includes('repair');
}

export function workOrderLineIsRepair(line) {
  if (!line) return false;
  const fromDef = line.service_definition?.service_type ?? line.service?.service_type;
  if (isRepairServiceType(fromDef)) return true;
  return String(line.name || '').toLowerCase().includes('repair');
}

export function appointmentHasRepairSku(appointment, { catalogServices = [], workOrderServices = [] } = {}) {
  if (!appointment) return false;

  const apptId = String(appointment.id);
  const linkedIds = new Set(resolveAppointmentServiceIds(appointment));

  for (const line of workOrderServices) {
    const onAppt =
      String(line.appointment_id) === apptId ||
      (line.service_id && linkedIds.has(String(line.service_id)));
    if (onAppt && workOrderLineIsRepair(line)) return true;
  }

  for (const svc of appointment.services || []) {
    if (catalogServiceIsRepair(svc)) return true;
  }

  for (const id of linkedIds) {
    const svc = catalogServices.find((s) => serviceIdsMatch(s.id, id));
    if (catalogServiceIsRepair(svc)) return true;
  }

  return false;
}

export function appointmentHasDiagnosticSku(appointment, { catalogServices = [], workOrderServices = [] } = {}) {
  if (!appointment) return false;

  const apptId = String(appointment.id);
  const linkedIds = new Set(resolveAppointmentServiceIds(appointment));

  const lineIsDiag = (line) => {
    const fromDef = line.service_definition?.service_type ?? line.service?.service_type;
    if (isDiagnosticServiceType(fromDef)) return true;
    return String(line.name || '').toLowerCase().includes('diagnostic');
  };

  for (const line of workOrderServices) {
    const onAppt =
      String(line.appointment_id) === apptId ||
      (line.service_id && linkedIds.has(String(line.service_id)));
    if (onAppt && lineIsDiag(line)) return true;
  }

  for (const svc of appointment.services || []) {
    if (isDiagnosticServiceType(svc.service_type)) return true;
  }

  for (const id of linkedIds) {
    const svc = catalogServices.find((s) => serviceIdsMatch(s.id, id));
    if (svc && isDiagnosticServiceType(svc.service_type)) return true;
  }

  return false;
}

/**
 * Completed visit with repair SKU(s) — triggers diagnostic discount (replaces appointment_type gate).
 */
export function hasCompletedVisitWithRepairSku(
  appointments = [],
  { catalogServices = [], workOrderServices = [] } = {}
) {
  return (appointments || []).some((appt) => {
    const status = String(appt.status || '').toLowerCase();
    if (!REPAIR_COMPLETE_APPOINTMENT_STATUSES.includes(status)) return false;
    return appointmentHasRepairSku(appt, { catalogServices, workOrderServices });
  });
}

/** @deprecated Use hasCompletedVisitWithRepairSku — kept as alias for existing imports. */
export function hasCompletedRepairAppointment(
  appointments = [],
  options = {}
) {
  return hasCompletedVisitWithRepairSku(appointments, options);
}

/**
 * Visit badge: Diagnostic | Repair | Mixed (visit 2+ defaults to Repair when repair SKU present).
 */
export function deriveVisitDisplayKind(appointment, visitIndex, options = {}) {
  const hasRepair = appointmentHasRepairSku(appointment, options);
  const hasDiag = appointmentHasDiagnosticSku(appointment, options);

  if (visitIndex > 0) {
    if (hasRepair) return 'repair';
    if (hasDiag) return 'diagnostic';
    return 'visit';
  }

  if (hasRepair && hasDiag) return 'mixed';
  if (hasRepair) return 'repair';
  if (hasDiag) return 'diagnostic';
  return 'diagnostic';
}

export const VISIT_DISPLAY_LABELS = {
  diagnostic: 'Diagnostic',
  repair: 'Repair',
  mixed: 'Mixed',
  visit: 'Visit',
};

export function deriveVisitDisplayLabel(appointment, visitIndex, options = {}) {
  const kind = deriveVisitDisplayKind(appointment, visitIndex, options);
  return VISIT_DISPLAY_LABELS[kind] || kind;
}

export function sumPlannedDurationMinutes(serviceIds, catalogServices = []) {
  if (!serviceIds?.length) return DEFAULT_MIN_SLOT_MINUTES;
  let total = 0;
  for (const id of serviceIds) {
    const svc = catalogServices.find((s) => serviceIdsMatch(s.id, id));
    if (svc?.duration_minutes) total += svc.duration_minutes;
  }
  return total > 0 ? total : DEFAULT_MIN_SLOT_MINUTES;
}

export const FIELD_VISIT_SKU_TYPES = new Set(['diagnostic', 'repair', 'inspection', 'maintenance', 'follow-up']);

/** Catalog SKUs schedulable on a field visit (diagnostic + repair, etc.). */
export function selectableVisitCatalogSkus(catalogServices = []) {
  return (catalogServices || []).filter((s) => {
    const type = String(s.service_type || '').toLowerCase();
    return !type || FIELD_VISIT_SKU_TYPES.has(type);
  });
}

/**
 * Chip label: category once + trimmed SKU name.
 * e.g. "Diagnostic · Electric Range" not "Diagnostic · Electric Range Diagnostic".
 */
export function formatVisitSkuChipLabel(service) {
  if (!service) return '';
  const type = String(service.service_type || '').toLowerCase();
  const rawName = String(service.name || '').trim();
  if (!type) return rawName;

  const typeTitle = type
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('-');

  const typePattern = type.replace(/-/g, '[\\s-]?');
  let trimmedName = rawName
    .replace(new RegExp(`\\s+${typePattern}\\s*$`, 'i'), '')
    .replace(new RegExp(`^${typePattern}\\s+`, 'i'), '')
    .trim();

  if (!trimmedName) trimmedName = rawName;
  return `${typeTitle} · ${trimmedName}`;
}

export function formatSkuSelectOption(service) {
  if (!service) return null;
  const typeLabel = service.service_type
    ? `${String(service.service_type).charAt(0).toUpperCase()}${String(service.service_type).slice(1)} · `
    : '';
  return {
    value: service.id,
    label: `${typeLabel}${service.name}${service.sku_code ? ` (${service.sku_code})` : ''} — ${service.duration_minutes || 0} min — $${Number(service.base_price || 0).toFixed(2)}`,
    serviceType: service.service_type,
  };
}

export function buildGroupedSkuSelectOptions(catalogServices = []) {
  const skus = selectableVisitCatalogSkus(catalogServices);
  const types = [...new Set(skus.map((s) => s.service_type || 'other'))].sort();
  return types.map((type) => ({
    label: VISIT_DISPLAY_LABELS[type] || String(type).replace(/-/g, ' '),
    options: skus.filter((s) => (s.service_type || 'other') === type).map(formatSkuSelectOption).filter(Boolean),
  }));
}

/** Legacy appointment_type for API until column is deprecated. */
export function deriveLegacyAppointmentType(serviceIds = [], catalogServices = []) {
  const ids = serviceIds || [];
  let hasRepair = false;
  let hasDiag = false;
  for (const id of ids) {
    const svc = catalogServices.find((s) => serviceIdsMatch(s.id, id));
    if (!svc) continue;
    if (isRepairServiceType(svc.service_type)) hasRepair = true;
    if (isDiagnosticServiceType(svc.service_type)) hasDiag = true;
  }
  if (hasRepair && !hasDiag) return 'repair';
  if (hasDiag) return 'diagnostic';
  if (hasRepair) return 'repair';
  return 'diagnostic';
}

/** SKU lines attached to a visit with billing status from work order lines. */
export function listVisitSkuLines(appointment, { catalogServices = [], workOrderServices = [] } = {}) {
  const apptId = appointment?.id ? String(appointment.id) : null;
  const linkedIds = resolveAppointmentServiceIds(appointment);

  return linkedIds.map((serviceId) => {
    const catalog = catalogServices.find((s) => serviceIdsMatch(s.id, serviceId));
    const line = (workOrderServices || []).find((row) => serviceIdsMatch(row.service_id, serviceId));
    return {
      serviceId,
      name: line?.name || catalog?.name || 'Service',
      billing_status: line?.billing_status || 'not_billable',
      price: line?.price ?? catalog?.base_price,
      service_type: catalog?.service_type || line?.service_definition?.service_type,
      canMove: (line?.billing_status || 'not_billable') === 'not_billable',
    };
  });
}

export function calendarBlockMinutes(scheduledStart, scheduledEnd) {
  if (!scheduledStart || !scheduledEnd) return DEFAULT_MIN_SLOT_MINUTES;
  try {
    const start = scheduledStart instanceof Date ? scheduledStart : parseISO(scheduledStart);
    const end = scheduledEnd instanceof Date ? scheduledEnd : parseISO(scheduledEnd);
    const mins = differenceInMinutes(end, start);
    return mins > 0 ? mins : DEFAULT_MIN_SLOT_MINUTES;
  } catch {
    return DEFAULT_MIN_SLOT_MINUTES;
  }
}
