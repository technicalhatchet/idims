import { getFieldKnowledgeId } from './fieldBindings';
import { getMeasurementKnowledge } from './knowledgeRegistry';
import { evaluateMeasurement } from './measurementRulesEngine';
import type { MeasurementEvaluation, MeasurementStatus } from './types';

export function buildMeasurementStatusMap(
  templateId: string | null | undefined,
  fields: Record<string, unknown> = {},
): Map<string, MeasurementEvaluation> {
  const map = new Map<string, MeasurementEvaluation>();
  if (!templateId) return map;

  for (const [fieldKey, rawValue] of Object.entries(fields)) {
    const knowledgeId = getFieldKnowledgeId(templateId, fieldKey);
    if (!knowledgeId) continue;
    const definition = getMeasurementKnowledge(knowledgeId);
    const evaluation = evaluateMeasurement(definition, rawValue);
    if (evaluation) {
      map.set(knowledgeId, evaluation);
    }
  }
  return map;
}

export function getMeasurementStatusForKnowledge(
  statusMap: Map<string, MeasurementEvaluation>,
  knowledgeId: string,
): MeasurementStatus | null {
  return statusMap.get(knowledgeId)?.status ?? null;
}

export function evaluateFieldMeasurement(
  templateId: string | null | undefined,
  fieldKey: string,
  rawValue: unknown,
): MeasurementEvaluation | null {
  const knowledgeId = getFieldKnowledgeId(templateId, fieldKey);
  if (!knowledgeId) return null;
  return evaluateMeasurement(getMeasurementKnowledge(knowledgeId), rawValue);
}
