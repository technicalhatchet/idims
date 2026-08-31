import { getMeasurementKnowledge } from '../knowledge/knowledgeRegistry';
import { getFieldKnowledgeId, listSmartFieldKeysForTemplate } from '../knowledge/fieldBindings';
import type {
  EliminationConfig,
  EliminationHypothesis,
  EliminationRule,
  EliminationWhenClause,
} from '../knowledge/types';
import type { WizardDefinition } from '../types';
import type {
  EvidenceComponentDefinition,
  EvidenceConfig,
  EvidenceRule,
  EvidenceWhenClause,
} from './evidenceTypes';

import { hasEvidenceConfig } from './evidenceRegistry';

/** True when template has a checked-in `knowledge/evidence/<template>.json` file. */
export function isHandCraftedEvidenceTemplate(templateId: string): boolean {
  return hasEvidenceConfig(templateId);
}

function isFailureHypothesis(id: string): boolean {
  return id.endsWith('_failed')
    || id.endsWith('_fault')
    || id.includes('failed')
    || id.includes('fault')
    || id.includes('restricted')
    || id.includes('blocked');
}

function eliminationWhenClauses(when: EliminationWhenClause | EliminationWhenClause[]): EliminationWhenClause[] {
  return Array.isArray(when) ? when : [when];
}

function inferRecommendStepKey(
  when: EliminationWhenClause | EliminationWhenClause[],
  wizard: WizardDefinition | null,
  templateId: string,
): string | undefined {
  if (!wizard?.defaultSteps?.length) return undefined;

  for (const clause of eliminationWhenClauses(when)) {
    if (clause.type === 'field') {
      const sectionId = clause.path.split('.')[0];
      const step = wizard.defaultSteps.find((s) => s.sectionId === sectionId)?.stepKey;
      if (step) return step;
    }

    if (clause.type === 'measurement') {
      for (const fieldKey of listSmartFieldKeysForTemplate(templateId)) {
        if (getFieldKnowledgeId(templateId, fieldKey) === clause.knowledgeId) {
          const sectionId = fieldKey.split('.')[0];
          const step = wizard.defaultSteps.find((s) => s.sectionId === sectionId)?.stepKey;
          if (step) return step;
        }
      }
    }
  }

  return undefined;
}

function dmaTagsForWhen(when: EliminationWhenClause | EliminationWhenClause[]): string[] | undefined {
  for (const clause of eliminationWhenClauses(when)) {
    if (clause.type !== 'measurement') continue;
    const knowledge = getMeasurementKnowledge(clause.knowledgeId);
    if (knowledge?.dmaTags?.length) return knowledge.dmaTags;
  }
  return undefined;
}

function buildComponents(
  elimination: EliminationConfig,
  referencedIds: Set<string>,
): EvidenceComponentDefinition[] {
  const byId = new Map(elimination.hypotheses.map((entry) => [entry.id, entry]));
  const categoryTags = new Map(
    elimination.categories.map((category) => [category.id, category.dmaTags || []]),
  );

  return [...referencedIds]
    .map((id) => byId.get(id))
    .filter((entry): entry is EliminationHypothesis => Boolean(entry))
    .map((entry) => ({
      id: entry.id,
      label: entry.label,
      categoryId: entry.category,
      dmaTags: categoryTags.get(entry.category),
    }));
}

function addSuspectRules(
  rules: EvidenceRule[],
  elimRule: EliminationRule,
  when: EvidenceWhenClause[],
  hypothesisById: Map<string, EliminationHypothesis>,
  recommendStepKey?: string,
): void {
  for (const hypothesisId of elimRule.suspect || []) {
    const hypothesis = hypothesisById.get(hypothesisId);
    if (!hypothesis) continue;
    rules.push({
      id: `evidence_suspect_${elimRule.id}_${hypothesisId}`,
      when,
      target: hypothesis.category,
      targetLayer: 'category',
      effect: { effect: 'increase', value: 18 },
      explanation: `Symptom suggests ${hypothesis.label.toLowerCase()}.`,
      recommendStepKey,
      dmaTags: undefined,
    });
  }
}

/** Derive Phase 6 evidence config from Phase 5 elimination knowledge. */
export function buildBaselineEvidenceConfig(
  templateId: string,
  elimination: EliminationConfig,
  wizard: WizardDefinition | null,
): EvidenceConfig {
  const hypothesisById = new Map(elimination.hypotheses.map((entry) => [entry.id, entry]));
  const referencedHypothesisIds = new Set<string>();
  const rules: EvidenceRule[] = [];

  for (const elimRule of elimination.rules) {
    const when: EvidenceWhenClause[] = eliminationWhenClauses(elimRule.when) as EvidenceWhenClause[];
    const recommendStepKey = inferRecommendStepKey(elimRule.when, wizard, templateId);
    const dmaTags = dmaTagsForWhen(elimRule.when);

    for (const hypothesisId of elimRule.confirm || []) {
      referencedHypothesisIds.add(hypothesisId);
      const hypothesis = hypothesisById.get(hypothesisId);
      if (!hypothesis) continue;

      rules.push({
        id: `evidence_confirm_${elimRule.id}_${hypothesisId}`,
        when,
        target: hypothesisId,
        targetLayer: 'component',
        effect: { effect: 'confirm' },
        explanation: `${hypothesis.label} — supported by diagnostic test evidence.`,
        recommendStepKey,
        dmaTags,
      });

      if (isFailureHypothesis(hypothesisId)) {
        rules.push({
          id: `evidence_cat_${elimRule.id}_${hypothesisId}`,
          when,
          target: hypothesis.category,
          targetLayer: 'category',
          effect: { effect: 'increase', value: 28 },
          explanation: `${hypothesis.label} — category evidence increased.`,
          recommendStepKey,
          dmaTags,
        });
      }
    }

    for (const hypothesisId of elimRule.eliminate || []) {
      referencedHypothesisIds.add(hypothesisId);
      const hypothesis = hypothesisById.get(hypothesisId);
      if (!hypothesis) continue;

      rules.push({
        id: `evidence_eliminate_${elimRule.id}_${hypothesisId}`,
        when,
        target: hypothesisId,
        targetLayer: 'component',
        effect: { effect: 'eliminate' },
        explanation: `${hypothesis.label} ruled out by test evidence.`,
        recommendStepKey,
        dmaTags,
      });
    }

    addSuspectRules(rules, elimRule, when, hypothesisById, recommendStepKey);
  }

  return {
    templateId,
    categories: elimination.categories.map((category) => ({
      id: category.id,
      label: category.label,
      dmaTags: category.dmaTags,
    })),
    components: buildComponents(elimination, referencedHypothesisIds),
    rules,
  };
}
