import type { MeasurementEvaluation } from '../knowledge/types';
import { ruleWhenMatches } from './conditionMatcher';
import { getComplaintChipIds, getComplaintText } from './routingEngine';
import type { ActiveFieldRecommendation, FieldRecommendationRule } from './types';

export function evaluateRecommendations(
  rules: FieldRecommendationRule[] | undefined,
  fields: Record<string, unknown> = {},
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): ActiveFieldRecommendation[] {
  if (!rules?.length) return [];

  const complaintChipIds = getComplaintChipIds(fields);
  const complaintText = getComplaintText(fields);
  const seen = new Set<string>();
  const active: ActiveFieldRecommendation[] = [];

  for (const rule of rules) {
    if (!ruleWhenMatches(rule.when, complaintChipIds, complaintText, fields, measurementStatuses)) continue;
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
  fieldHelp: Record<string, string> | undefined,
): string | null {
  const text = fieldHelp?.[fieldKey];
  return text?.trim() ? text.trim() : null;
}
