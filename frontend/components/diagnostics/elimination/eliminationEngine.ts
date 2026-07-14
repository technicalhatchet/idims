import { getComplaintChipIds, getComplaintText } from '../routing/routingEngine';
import { ruleWhenMatches } from '../routing/conditionMatcher';
import type {
  EliminationConfig,
  EliminationEvaluationResult,
  EliminationHypothesis,
  EliminationWhenClause,
} from '../knowledge/types';
import type { MeasurementEvaluation } from '../knowledge/types';

function buildOppositeMap(hypotheses: EliminationHypothesis[]): Map<string, string> {
  const map = new Map<string, string>();
  for (const hypothesis of hypotheses) {
    if (hypothesis.oppositeId) {
      map.set(hypothesis.id, hypothesis.oppositeId);
      map.set(hypothesis.oppositeId, hypothesis.id);
    }
  }
  return map;
}

function eliminationWhenMatches(
  when: EliminationWhenClause,
  complaintChipIds: string[],
  complaintText: string,
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): boolean {
  if (when.type === 'measurement') {
    const evaluation = measurementStatuses?.get(when.knowledgeId);
    if (!evaluation) return false;
    return (when.statusIn || []).includes(evaluation.status);
  }
  if (when.type === 'chip') {
    return complaintChipIds.includes(when.id);
  }
  if (when.type === 'field') {
    return ruleWhenMatches([when], complaintChipIds, complaintText, fields, measurementStatuses);
  }
  return false;
}

export function evaluateElimination(
  config: EliminationConfig | null | undefined,
  fields: Record<string, unknown> = {},
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): EliminationEvaluationResult | null {
  if (!config?.rules?.length) return null;

  const complaintChipIds = getComplaintChipIds(fields);
  const complaintText = getComplaintText(fields);
  const hypothesisById = new Map(config.hypotheses.map((h) => [h.id, h]));
  const oppositeMap = buildOppositeMap(config.hypotheses);

  const eliminatedIds = new Set<string>();
  const confirmedIds = new Set<string>();
  const suspectedIds = new Set<string>();
  const matchedRuleIds: string[] = [];

  for (const rule of config.rules) {
    if (!eliminationWhenMatches(rule.when, complaintChipIds, complaintText, fields, measurementStatuses)) {
      continue;
    }
    matchedRuleIds.push(rule.id);
    for (const id of rule.eliminate || []) eliminatedIds.add(id);
    for (const id of rule.confirm || []) confirmedIds.add(id);
    for (const id of rule.suspect || []) suspectedIds.add(id);
  }

  for (const id of confirmedIds) {
    eliminatedIds.delete(id);
    suspectedIds.delete(id);
    const opposite = oppositeMap.get(id);
    if (opposite) {
      eliminatedIds.delete(opposite);
      suspectedIds.delete(opposite);
    }
  }

  for (const id of suspectedIds) {
    eliminatedIds.delete(id);
    const opposite = oppositeMap.get(id);
    if (opposite) eliminatedIds.delete(opposite);
  }

  const mapHypothesis = (id: string) => {
    const h = hypothesisById.get(id);
    return h
      ? { id: h.id, label: h.label, category: h.category }
      : { id, label: id, category: 'unknown' };
  };

  return {
    eliminated: [...eliminatedIds].map(mapHypothesis),
    confirmed: [...confirmedIds].map(mapHypothesis),
    suspected: [...suspectedIds].map(mapHypothesis),
    matchedRuleIds,
  };
}
