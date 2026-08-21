import { getDiagnosticTemplate } from '../constants/diagnosticTemplates';

const TEMPLATE_TO_SUBTYPE = {
  refrigerator: 'refrigerator',
  standalone_freezer: 'freezer',
  dishwasher: 'dishwasher',
  washer: 'washing_machine',
  electric_dryer: 'dryer',
  gas_dryer: 'dryer',
  stacked_laundry: 'aio_laundry',
  aio_laundry: 'aio_laundry',
  electric_range: 'oven',
  gas_range: 'oven',
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
    equipment_model: equipmentMeta.equipment_model?.trim() || null,
    equipment_type: equipmentMeta.equipment_type || 'appliance',
    equipment_subtype:
      equipmentMeta.equipment_subtype?.trim()
      || templateIdToEquipmentSubtype(templateId)
      || null,
    equipment_serial: equipmentMeta.equipment_serial?.trim() || null,
    customer_complaint: equipmentMeta.customer_complaint?.trim() || complaintFromPayload(payload),
    payload: cleanPayload,
    outcome_id: equipmentMeta.outcome_id || null,
    context: equipmentMeta.context || null,
  };
}

export function diagnosticDraftScopeId(diagnosticId) {
  return diagnosticId ? `solomon-${diagnosticId}` : 'solomon-new';
}
