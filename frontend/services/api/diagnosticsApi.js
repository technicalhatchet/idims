import { apiClient } from '../../utils/api-client';

/**
 * Prior diagnostic measurements for the same equipment serial.
 * Returns readings keyed by field path (sectionId.fieldId).
 */
export async function getDiagnosticLastMeasurements({
  equipmentSerial,
  templateId,
  excludeWorkOrderId = null,
} = {}) {
  const serial = String(equipmentSerial || '').trim();
  if (!serial || !templateId) return { readings: {} };

  const params = new URLSearchParams({
    equipment_serial: serial,
    template_id: templateId,
  });
  if (excludeWorkOrderId) {
    params.append('exclude_work_order_id', String(excludeWorkOrderId));
  }

  return apiClient(`work-orders/diagnostics/last-measurements?${params.toString()}`);
}

/**
 * Rewrite structured diagnostic facts into service note prose (Gemini or deterministic fallback).
 */
export async function generateDiagnosticNotes(facts) {
  return apiClient('diagnostics/generate-notes', {
    method: 'POST',
    body: JSON.stringify(facts),
  });
}
