import type { MeasurementKnowledgeDefinition } from '../knowledge/types';
import { isOpenCircuitReading, parseMeasurementNumber } from '../knowledge/parseMeasurementValue';

/** Resistance (Ω) measurements that support OL via open-circuit branches. */
export function supportsOpenCircuitMeasurementSubmit(
  knowledge: MeasurementKnowledgeDefinition | null | undefined,
): boolean {
  if (!knowledge) return false;
  return knowledge.unit === 'Ω' || Boolean(knowledge.openCircuitCritical);
}

export function hasNumericMeasurementDraft(draft: string): boolean {
  const trimmed = draft.trim();
  if (!trimmed || isOpenCircuitReading(trimmed)) return false;
  return parseMeasurementNumber(trimmed) !== null;
}

export type MeasurementCtaMode = 'ol' | 'submit';

export function resolveMeasurementCtaMode(
  draft: string,
  knowledge: MeasurementKnowledgeDefinition | null | undefined,
): MeasurementCtaMode {
  if (!supportsOpenCircuitMeasurementSubmit(knowledge)) {
    return 'submit';
  }
  return hasNumericMeasurementDraft(draft) ? 'submit' : 'ol';
}
