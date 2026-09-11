import type { MeasurementContext } from '../knowledge/types';

/** Avoid partial model strings (e.g. "WFW") resolving a platform and shifting the layout. */
export const MIN_EQUIPMENT_MODEL_LENGTH_FOR_OEM_UI = 6;

export function isOemPlatformReady(
  measurementContext: MeasurementContext | null | undefined,
): boolean {
  const make = String(measurementContext?.equipmentMake || '').trim();
  const model = String(measurementContext?.equipmentModel || '').trim();
  return Boolean(make && model.length >= MIN_EQUIPMENT_MODEL_LENGTH_FOR_OEM_UI);
}

export function hasComplaintDiagnosticContext(
  fields: Record<string, unknown> = {},
  complaintChipIds: string[] = [],
  errorCodes: string[] = [],
  visitedStepKeys: string[] = [],
): boolean {
  if (complaintChipIds.length > 0) return true;
  if (errorCodes.length > 0) return true;
  if (visitedStepKeys.includes('complaint')) return true;
  const complaintText = String(fields['customer_complaint.complaint'] || '').trim();
  return complaintText.length >= 8;
}
