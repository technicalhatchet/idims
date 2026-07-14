import refrigeratorEvidence from '../knowledge/evidence/refrigerator.json';
import type { EvidenceConfig } from './evidenceTypes';

const EVIDENCE_BY_TEMPLATE = new Map<string, EvidenceConfig>([
  [(refrigeratorEvidence as EvidenceConfig).templateId, refrigeratorEvidence as EvidenceConfig],
]);

export function getEvidenceConfig(templateId: string | null | undefined): EvidenceConfig | null {
  if (!templateId) return null;
  return EVIDENCE_BY_TEMPLATE.get(templateId) || null;
}
