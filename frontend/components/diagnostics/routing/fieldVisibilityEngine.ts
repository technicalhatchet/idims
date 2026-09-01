import { ruleWhenMatches } from './conditionMatcher';
import { getComplaintChipIds, getComplaintText } from './routingEngine';
import type { MeasurementContext } from '../knowledge/types';
import type { FieldVisibilityRule } from './types';

function rulesForField(
  fieldKey: string,
  rules: FieldVisibilityRule[] | undefined,
): FieldVisibilityRule[] {
  if (!rules?.length) return [];
  return rules.filter((rule) => rule.field === fieldKey);
}

/**
 * Fields without a visibility rule are always shown.
 * Fields with rules are shown when any showWhen clause matches (OR).
 */
export function isFieldVisible(
  fieldKey: string,
  fields: Record<string, unknown> = {},
  rules: FieldVisibilityRule[] | undefined,
  measurementContext?: MeasurementContext | null,
): boolean {
  const fieldRules = rulesForField(fieldKey, rules);
  if (!fieldRules.length) return true;

  const complaintChipIds = getComplaintChipIds(fields);
  const complaintText = getComplaintText(fields);

  return fieldRules.some((rule) =>
    ruleWhenMatches(
      rule.showWhen,
      complaintChipIds,
      complaintText,
      fields,
      undefined,
      measurementContext,
    ),
  );
}

export function filterVisibleSectionFields(
  section: { id: string; fields: Array<{ id: string }> },
  fields: Record<string, unknown> = {},
  rules: FieldVisibilityRule[] | undefined,
  measurementContext?: MeasurementContext | null,
) {
  return section.fields.filter((field) =>
    isFieldVisible(`${section.id}.${field.id}`, fields, rules, measurementContext),
  );
}
