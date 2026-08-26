/** Whether a standalone diagnostic has enough data to create an in_progress row. */
export function hasSolomonDiagnosticProgress(payload) {
  if (!payload?.templateId) return false;
  if (Array.isArray(payload.visitedStepKeys) && payload.visitedStepKeys.length > 0) return true;
  if (payload.currentStepKey) return true;
  if (Array.isArray(payload.timeline) && payload.timeline.length > 0) return true;

  const fields = payload.fields || {};
  return Object.values(fields).some((value) => {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    return text !== '' && text !== 'not_checked';
  });
}

export function standaloneUpdateBodyFromCreateBody(body, status = 'in_progress') {
  return {
    payload: body.payload,
    equipment_make: body.equipment_make,
    equipment_model: body.equipment_model,
    equipment_type: body.equipment_type,
    equipment_subtype: body.equipment_subtype,
    equipment_serial: body.equipment_serial,
    customer_complaint: body.customer_complaint,
    outcome_id: body.outcome_id,
    context: body.context,
    status,
  };
}
