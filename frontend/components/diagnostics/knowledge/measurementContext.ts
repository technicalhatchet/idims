import { getFieldKnowledgeId } from './fieldBindings';
import { getMeasurementKnowledge } from './knowledgeRegistry';
import { evaluateMeasurement } from './measurementRulesEngine';
import type { MeasurementContext, MeasurementEvaluation, MeasurementStatus } from './types';

export type { MeasurementContext } from './types';
export { buildMeasurementContext } from './platformRegistry';

export function buildMeasurementStatusMap(
  templateId: string | null | undefined,
  fields: Record<string, unknown> = {},
  ctx?: MeasurementContext | null,
): Map<string, MeasurementEvaluation> {
  const map = new Map<string, MeasurementEvaluation>();
  if (!templateId) return map;

  const measurementContext: MeasurementContext = ctx || { templateId };

  for (const [fieldKey, rawValue] of Object.entries(fields)) {
    const knowledgeId = getFieldKnowledgeId(templateId, fieldKey, measurementContext);
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
  ctx?: MeasurementContext | null,
): MeasurementEvaluation | null {
  const measurementContext: MeasurementContext = ctx || { templateId: templateId || '' };
  const knowledgeId = getFieldKnowledgeId(templateId, fieldKey, measurementContext);
  if (!knowledgeId) return null;
  return evaluateMeasurement(getMeasurementKnowledge(knowledgeId), rawValue);
}
