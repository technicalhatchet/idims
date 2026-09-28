import { isOemPlatformReady } from '../components/diagnostics/procedures/oemDiagnosticGating';
import { buildMeasurementContext } from '../components/diagnostics/knowledge/measurementContext';
import type { MeasurementContext } from '../components/diagnostics/knowledge/types';

/** Capitalize first character only — preserve the rest of user typing. */
export function normalizeMakeDraft(value: string): string {
  const text = String(value ?? '');
  if (!text) return '';
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** Uppercase model draft without stripping characters. */
export function normalizeModelDraft(value: string): string {
  return String(value ?? '').toUpperCase();
}

export type SolomonEquipmentDraft = {
  equipment_make?: string;
  equipment_model?: string;
  equipment_serial?: string;
  equipment_version?: string;
  equipment_subtype?: string;
};

/** Diagnostic context loads only after committed identity passes OEM gating (min model length). */
export function isDiagnosticEquipmentCommitted(
  equipment: SolomonEquipmentDraft | null | undefined,
  templateId?: string | null,
): boolean {
  if (!equipment) return false;
  const ctx: MeasurementContext = buildMeasurementContext({
    templateId: templateId || '',
    equipmentMake: equipment.equipment_make,
    equipmentModel: equipment.equipment_model,
  });
  return isOemPlatformReady(ctx);
}

/** Apply an explicit model suggestion (user selection) — does not auto-apply while typing. */
export function commitModelSuggestion(
  draft: SolomonEquipmentDraft,
  suggestionModel: string,
): SolomonEquipmentDraft {
  return {
    ...draft,
    equipment_model: normalizeModelDraft(suggestionModel),
  };
}

/** Ignore stale async lookup results when the user has typed ahead. */
export function shouldApplyEquipmentLookupResult(
  lookupForModel: string,
  currentDraftModel: string,
): boolean {
  return normalizeModelDraft(lookupForModel) === normalizeModelDraft(currentDraftModel);
}

export function equipmentDraftKey(equipment: SolomonEquipmentDraft | null | undefined): string {
  if (!equipment) return '';
  return [
    equipment.equipment_make?.trim() || '',
    equipment.equipment_model?.trim() || '',
    equipment.equipment_serial?.trim() || '',
    equipment.equipment_version?.trim() || '',
  ].join('|');
}
