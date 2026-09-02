import type { MeasurementContext, MeasurementEvaluation } from '../knowledge/types';
import { getComplaintChipIds, getDiagnosticMatchText } from './routingEngine';
import { ruleWhenMatches } from './conditionMatcher';
import type { ActiveFieldRecommendation, FieldRecommendationRule } from './types';

export function evaluateRecommendations(
  rules: FieldRecommendationRule[] | undefined,
  fields: Record<string, unknown> = {},
  measurementStatuses?: Map<string, MeasurementEvaluation>,
  measurementContext?: MeasurementContext | null,
): ActiveFieldRecommendation[] {
  if (!rules?.length) return [];

  const complaintChipIds = getComplaintChipIds(fields);
  const complaintText = getDiagnosticMatchText(fields);
  const seen = new Set<string>();
  const active: ActiveFieldRecommendation[] = [];

  for (const rule of rules) {
    if (
      !ruleWhenMatches(
        rule.when,
        complaintChipIds,
        complaintText,
        fields,
        measurementStatuses,
        measurementContext,
      )
    ) {
      continue;
    }
    if (seen.has(rule.id)) continue;
    seen.add(rule.id);
    active.push({
      id: rule.id,
      field: rule.field,
      message: rule.message,
      tone: rule.tone || 'tip',
    });
  }

  return active;
}

export function recommendationsForSection(
  sectionId: string,
  recommendations: ActiveFieldRecommendation[] = [],
) {
  return recommendations.filter((rec) => {
    if (!rec.field) return true;
    return rec.field.startsWith(`${sectionId}.`);
  });
}

export function recommendationsForField(
  fieldKey: string,
  recommendations: ActiveFieldRecommendation[] = [],
) {
  return recommendations.filter((rec) => rec.field === fieldKey);
}

export function getFieldHelp(
  fieldKey: string,
  fieldHelp: Record<string, import('./types').FieldHelpEntry> | undefined,
): string | null {
  const text = fieldHelp?.[fieldKey];
  if (typeof text === 'string') return text.trim() || null;
  return text?.default?.trim() || null;
}

export { resolveFieldHelp } from './scopedFieldHelp';
