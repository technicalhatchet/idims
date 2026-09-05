import { getDiagnosticTemplate } from '../constants/diagnosticTemplates';
import { sanitizeSolomonAlphanumeric } from './solomonFieldSanitize';

const TEMPLATE_TO_SUBTYPE = {
  refrigerator: 'refrigerator',
  standalone_freezer: 'freezer',
  dishwasher: 'dishwasher',
  washer: 'washing_machine',
  electric_dryer: 'electric_dryer',
  gas_dryer: 'gas_dryer',
  stacked_laundry: 'aio_laundry',
  aio_laundry: 'aio_laundry',
  electric_range: 'electric_range',
  gas_range: 'gas_range',
  microwave: 'microwave',
};

export function templateIdToEquipmentSubtype(templateId) {
  return TEMPLATE_TO_SUBTYPE[templateId] || templateId || null;
}

export function complaintFromPayload(payload) {
  const fields = payload?.fields || {};
  return String(fields['customer_complaint.complaint'] || '').trim() || null;
}

/** Build API body for create/update standalone diagnostic from wizard payload. */
export function buildStandaloneDiagnosticBody(payload, equipmentMeta = {}) {
  const templateId = payload?.templateId;
  const template = getDiagnosticTemplate(templateId);
  const cleanPayload = {
    ...payload,
    appointmentId: null,
  };

  return {
    equipment_make: equipmentMeta.equipment_make?.trim() || null,
    equipment_model: sanitizeSolomonAlphanumeric(equipmentMeta.equipment_model) || null,
    equipment_type: equipmentMeta.equipment_type || 'appliance',
    equipment_subtype:
      equipmentMeta.equipment_subtype?.trim()
      || templateIdToEquipmentSubtype(templateId)
      || null,
    equipment_serial: sanitizeSolomonAlphanumeric(equipmentMeta.equipment_serial) || null,
    customer_complaint: equipmentMeta.customer_complaint?.trim() || complaintFromPayload(payload),
    payload: cleanPayload,
    outcome_id: equipmentMeta.outcome_id || null,
    context: equipmentMeta.context || null,
    status: equipmentMeta.status || 'in_progress',
  };
}

export function diagnosticDraftScopeId(diagnosticId) {
  return diagnosticId ? `solomon-${diagnosticId}` : 'solomon-new';
}

export function isPendingDiagnosticId(id) {
  return String(id || '').startsWith('pending-');
}

function templateIdToLabel(templateId) {
  if (!templateId) return null;
  return templateId.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Build list/detail row shape from API create/update body (offline cache). */
export function standaloneRowFromApiBody(id, body, extra = {}) {
  const payload = body.payload || {};
  const templateId = payload.templateId;
  return {
    id,
    outcome_id: body.outcome_id ?? extra.outcome_id ?? null,
    equipment_make: body.equipment_make ?? null,
    equipment_model: body.equipment_model ?? null,
    equipment_type: body.equipment_type || 'appliance',
    equipment_subtype: body.equipment_subtype ?? null,
    equipment_serial: body.equipment_serial ?? null,
    customer_complaint: body.customer_complaint ?? null,
    payload,
    context: body.context ?? extra.context ?? null,
    template_id: templateId ?? null,
    template_label: templateIdToLabel(templateId),
    status: extra.status ?? body.status ?? 'in_progress',
    outcome_summary: extra.outcome_summary ?? body.outcome_summary ?? null,
    created_at: extra.created_at || new Date().toISOString(),
    updated_at: extra.updated_at || new Date().toISOString(),
    pendingSync: extra.pendingSync ?? false,
    ...extra,
  };
}
