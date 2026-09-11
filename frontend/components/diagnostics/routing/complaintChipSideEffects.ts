import { getComplaintChipIds } from './routingEngine';

type ChipFieldPrefill = {
  chipId: string;
  field: string;
  value: string;
  /** Only prefill when the target field is empty or unset. */
  whenUnset?: boolean;
};

/** Intentionally empty — chips route OEM/intelligence but must not prefill fields that imply confirmed tests. */
const CHIP_FIELD_PREFILLS: ChipFieldPrefill[] = [];

function isFieldUnset(value: unknown): boolean {
  return value === undefined || value === null || value === '';
}

/**
 * When complaint chips are selected, prefill related evidence fields so intelligence
 * and OEM procedure routing align with the stated complaint (e.g. lid lock → bad).
 */
export function applyComplaintChipSideEffects(
  previousChipIds: string[],
  fields: Record<string, unknown>,
): string[] {
  const nextChipIds = getComplaintChipIds(fields);
  const prefilledFields: string[] = [];

  for (const rule of CHIP_FIELD_PREFILLS) {
    const newlySelected =
      nextChipIds.includes(rule.chipId) && !previousChipIds.includes(rule.chipId);
    if (!newlySelected) continue;

    const current = fields[rule.field];
    if (rule.whenUnset && !isFieldUnset(current)) continue;

    fields[rule.field] = rule.value;
    prefilledFields.push(rule.field);
  }

  return prefilledFields;
}
