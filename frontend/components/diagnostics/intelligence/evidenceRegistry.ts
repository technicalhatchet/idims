import refrigeratorEvidence from '../knowledge/evidence/refrigerator.json';
import { getEliminationConfig } from '../knowledge/knowledgeRegistry';
import { getWizardDefinition } from '../registry/wizardRegistry';
import {
  buildBaselineEvidenceConfig,
  isHandCraftedEvidenceTemplate,
} from './buildBaselineEvidenceConfig';
import type { EvidenceConfig } from './evidenceTypes';

const HAND_CRAFTED = new Map<string, EvidenceConfig>([
  [(refrigeratorEvidence as EvidenceConfig).templateId, refrigeratorEvidence as EvidenceConfig],
]);

const GENERATED_CACHE = new Map<string, EvidenceConfig>();

function resolveEvidenceConfig(templateId: string): EvidenceConfig | null {
  if (HAND_CRAFTED.has(templateId)) {
    return HAND_CRAFTED.get(templateId) || null;
  }

  const cached = GENERATED_CACHE.get(templateId);
  if (cached) return cached;

  const elimination = getEliminationConfig(templateId);
  if (!elimination?.categories?.length || !elimination.rules?.length) {
    return null;
  }

  const config = buildBaselineEvidenceConfig(
    templateId,
    elimination,
    getWizardDefinition(templateId),
  );
  if (!config.rules.length) return null;

  GENERATED_CACHE.set(templateId, config);
  return config;
}

export function getEvidenceConfig(templateId: string | null | undefined): EvidenceConfig | null {
  if (!templateId) return null;
  return resolveEvidenceConfig(templateId);
}

export function listEvidenceTemplateIds(): string[] {
  const ids = new Set<string>(HAND_CRAFTED.keys());
  for (const templateId of [
    'standalone_freezer',
    'washer',
    'electric_dryer',
    'gas_dryer',
    'stacked_laundry',
    'aio_laundry',
    'dishwasher',
    'microwave',
    'electric_range',
    'gas_range',
  ]) {
    if (resolveEvidenceConfig(templateId)) ids.add(templateId);
  }
  return [...ids];
}

export function getEvidenceConfigSource(templateId: string): 'hand-crafted' | 'generated' | null {
  if (!templateId) return null;
  if (isHandCraftedEvidenceTemplate(templateId)) return 'hand-crafted';
  return resolveEvidenceConfig(templateId) ? 'generated' : null;
}
