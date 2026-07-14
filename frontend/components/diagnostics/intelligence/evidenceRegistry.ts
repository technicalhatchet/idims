import aioLaundryEvidence from '../knowledge/evidence/aio_laundry.json';
import dishwasherEvidence from '../knowledge/evidence/dishwasher.json';
import electricDryerEvidence from '../knowledge/evidence/electric_dryer.json';
import electricRangeEvidence from '../knowledge/evidence/electric_range.json';
import gasDryerEvidence from '../knowledge/evidence/gas_dryer.json';
import gasRangeEvidence from '../knowledge/evidence/gas_range.json';
import microwaveEvidence from '../knowledge/evidence/microwave.json';
import refrigeratorEvidence from '../knowledge/evidence/refrigerator.json';
import stackedLaundryEvidence from '../knowledge/evidence/stacked_laundry.json';
import standaloneFreezerEvidence from '../knowledge/evidence/standalone_freezer.json';
import washerEvidence from '../knowledge/evidence/washer.json';
import type { EvidenceConfig } from './evidenceTypes';

const EVIDENCE_BY_TEMPLATE = new Map<string, EvidenceConfig>(
  [
    refrigeratorEvidence,
    standaloneFreezerEvidence,
    washerEvidence,
    electricDryerEvidence,
    gasDryerEvidence,
    stackedLaundryEvidence,
    aioLaundryEvidence,
    dishwasherEvidence,
    microwaveEvidence,
    electricRangeEvidence,
    gasRangeEvidence,
  ].map((config) => [(config as EvidenceConfig).templateId, config as EvidenceConfig]),
);

export function getEvidenceConfig(templateId: string | null | undefined): EvidenceConfig | null {
  if (!templateId) return null;
  return EVIDENCE_BY_TEMPLATE.get(templateId) || null;
}

export function listEvidenceTemplateIds(): string[] {
  return [...EVIDENCE_BY_TEMPLATE.keys()];
}

export function getEvidenceConfigSource(templateId: string): 'hand-crafted' | null {
  if (!templateId) return null;
  return EVIDENCE_BY_TEMPLATE.has(templateId) ? 'hand-crafted' : null;
}

export function hasEvidenceConfig(templateId: string): boolean {
  return EVIDENCE_BY_TEMPLATE.has(templateId);
}
