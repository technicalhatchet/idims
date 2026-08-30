import { getComplaintChipIds, getComplaintText } from '../routing/routingEngine';
import { ruleWhenMatches } from '../routing/conditionMatcher';
import type { MeasurementEvaluation } from '../knowledge/types';
import { getEvidenceConfig } from './evidenceRegistry';
import { getDiagnosticTest } from './testCatalog';
import { buildAutoNoteBullets } from './buildAutoNoteBullets';
import { rankNextWizardSteps } from './rankNextWizardSteps';
import { collectActiveDmaTags } from './collectActiveDmaTags';
import { applyDmaHistoricalNudges } from './applyDmaHistoricalNudges';
import { applyDiagnosisFieldNudges } from './applyDiagnosisFieldNudges';
import { dedupeLedgerEntries } from './ledgerDisplay';
import { buildLedgerTrigger, isOppositeOkComponentElimination } from './ledgerTrigger';
import type {
  ComponentEvidenceScore,
  ComponentEvidenceState,
  DiagnosticIntelligenceResult,
  DmaEvidenceNudge,
  EvidenceConfig,
  EvidenceLedgerEntry,
  EvidenceRule,
  EvidenceWhenClause,
} from './evidenceTypes';

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text !== '' && text !== 'not_checked';
}

function isTestClause(clause: EvidenceWhenClause): clause is { type: 'test'; testId: string; filled?: boolean } {
  return typeof clause === 'object' && clause !== null && 'type' in clause && clause.type === 'test';
}

function evidenceWhenMatches(
  when: EvidenceWhenClause[],
  complaintChipIds: string[],
  complaintText: string,
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): boolean {
  if (!when?.length) return false;

  return when.every((clause) => {
    if (isTestClause(clause)) {
      const test = getDiagnosticTest(clause.testId);
      if (!test) return false;
      if (clause.filled === false) {
        const value = test.fieldKey ? fields[test.fieldKey] : undefined;
        return !isFieldFilled(value);
      }
      if (clause.filled === true || clause.filled === undefined) {
        if (test.fieldKey) {
          return isFieldFilled(fields[test.fieldKey]);
        }
        if (test.knowledgeId && measurementStatuses) {
          return measurementStatuses.has(test.knowledgeId);
        }
        return false;
      }
      return false;
    }
    return ruleWhenMatches([clause], complaintChipIds, complaintText, fields, measurementStatuses);
  });
}

function applyEffect(
  categoryScores: Map<string, number>,
  componentScores: Map<string, { evidence: number; state: ComponentEvidenceState }>,
  rule: EvidenceRule,
  ledger: EvidenceLedgerEntry[],
  triggerContext?: {
    fields: Record<string, unknown>;
    measurementStatuses?: Map<string, MeasurementEvaluation>;
    complaintChipLabels?: Record<string, string>;
  },
): void {
  const { effect } = rule;

  if (
    isOppositeOkComponentElimination(rule.explanation, effect.effect, rule.targetLayer)
  ) {
    return;
  }

  let delta = 0;

  if (rule.targetLayer === 'category') {
    const current = categoryScores.get(rule.target) ?? 0;
    if (effect.effect === 'increase') {
      delta = effect.value;
      categoryScores.set(rule.target, clampScore(current + effect.value));
    } else if (effect.effect === 'decrease' || effect.effect === 'unlikely') {
      delta = -effect.value;
      categoryScores.set(rule.target, clampScore(current - effect.value));
    }
  } else {
    const current = componentScores.get(rule.target) ?? { evidence: 0, state: 'unknown' as ComponentEvidenceState };
    if (effect.effect === 'increase') {
      delta = effect.value;
      componentScores.set(rule.target, {
        ...current,
        evidence: clampScore(current.evidence + effect.value),
      });
    } else if (effect.effect === 'decrease' || effect.effect === 'unlikely') {
      delta = -effect.value;
      componentScores.set(rule.target, {
        ...current,
        evidence: clampScore(current.evidence - effect.value),
      });
    } else if (effect.effect === 'confirm') {
      delta = 100 - current.evidence;
      componentScores.set(rule.target, { evidence: 100, state: 'confirmed' });
    } else if (effect.effect === 'eliminate') {
      if (current.state === 'confirmed') {
        return;
      }
      delta = -current.evidence;
      componentScores.set(rule.target, { evidence: 0, state: 'eliminated' });
    }
  }

  const trigger = triggerContext
    ? buildLedgerTrigger(
      rule.when,
      triggerContext.fields,
      triggerContext.measurementStatuses,
      triggerContext.complaintChipLabels,
    )
    : undefined;

  ledger.push({
    ruleId: rule.id,
    target: rule.target,
    targetLayer: rule.targetLayer,
    delta,
    explanation: rule.explanation,
    effect: effect.effect,
    source: 'rule',
    trigger,
  });
}

function buildComponentScores(
  config: EvidenceConfig,
  componentScores: Map<string, { evidence: number; state: ComponentEvidenceState }>,
): Record<string, ComponentEvidenceScore[]> {
  const byCategory: Record<string, ComponentEvidenceScore[]> = {};
  for (const component of config.components || []) {
    const score = componentScores.get(component.id) ?? { evidence: 0, state: 'unknown' as ComponentEvidenceState };
    const entry: ComponentEvidenceScore = {
      id: component.id,
      label: component.label,
      categoryId: component.categoryId,
      evidence: score.evidence,
      state: score.state,
    };
    if (!byCategory[component.categoryId]) byCategory[component.categoryId] = [];
    byCategory[component.categoryId].push(entry);
  }
  for (const categoryId of Object.keys(byCategory)) {
    byCategory[categoryId].sort((a, b) => b.evidence - a.evidence);
  }
  return byCategory;
}

export function evaluateDiagnosticIntelligence(
  templateId: string | null | undefined,
  fields: Record<string, unknown> = {},
  measurementStatuses?: Map<string, MeasurementEvaluation>,
  options?: {
    visitedStepKeys?: string[];
    defaultStepOrder?: string[];
    complaintChips?: Array<{ id: string; label: string }>;
    dmaNudges?: DmaEvidenceNudge[] | null;
    fieldLabels?: Record<string, string>;
    stepKeyLabels?: Record<string, string>;
  },
): DiagnosticIntelligenceResult | null {
  const config = getEvidenceConfig(templateId);
  if (!config?.rules?.length) return null;

  const complaintChipIds = getComplaintChipIds(fields);
  const complaintText = getComplaintText(fields);
  const complaintChipLabels = Object.fromEntries(
    (options?.complaintChips || [])
      .filter((chip) => complaintChipIds.includes(chip.id))
      .map((chip) => [chip.id, chip.label]),
  );

  const categoryScores = new Map<string, number>(
    config.categories.map((c) => [c.id, 0]),
  );
  const componentScores = new Map<string, { evidence: number; state: ComponentEvidenceState }>();
  const ledger: EvidenceLedgerEntry[] = [];
  const matchedRules: EvidenceRule[] = [];

  for (const rule of config.rules) {
    if (!evidenceWhenMatches(rule.when, complaintChipIds, complaintText, fields, measurementStatuses)) {
      continue;
    }
    matchedRules.push(rule);
    applyEffect(categoryScores, componentScores, rule, ledger, {
      fields,
      measurementStatuses,
      complaintChipLabels,
    });
  }

  const dmaNudgeCount = applyDmaHistoricalNudges(
    config,
    categoryScores,
    ledger,
    options?.dmaNudges,
  );

  applyDiagnosisFieldNudges(config, categoryScores, componentScores, ledger, fields || {});

  const categories = config.categories
    .map((cat, index) => ({
      id: cat.id,
      label: cat.label,
      evidence: categoryScores.get(cat.id) ?? 0,
      rank: index + 1,
    }))
    .sort((a, b) => b.evidence - a.evidence)
    .map((cat, index) => ({ ...cat, rank: index + 1 }));

  const topCategories = categories.filter((c) => c.evidence > 0).slice(0, 3);

  const recommendedStepKeys = rankNextWizardSteps({
    config,
    matchedRules,
    topCategories,
    visitedStepKeys: options?.visitedStepKeys || [],
    defaultStepOrder: options?.defaultStepOrder || [],
  });

  const componentsByCategory = buildComponentScores(config, componentScores);

  const autoNoteBullets = buildAutoNoteBullets({
    templateId: config.templateId,
    fields,
    complaintChipIds,
    complaintChips: options?.complaintChips,
    config,
    intelligence: {
      categories,
      topCategories,
      ledger,
      componentsByCategory,
      matchedRuleCount: matchedRules.length,
      recommendedStepKeys,
      autoNoteBullets: [],
      activeDmaTags: collectActiveDmaTags(config, matchedRules),
      dmaNudgeCount,
    },
    measurementStatuses,
    fieldLabels: options?.fieldLabels,
    stepKeyLabels: options?.stepKeyLabels,
  });

  const activeDmaTags = collectActiveDmaTags(config, matchedRules);

  return {
    categories,
    topCategories,
    ledger,
    componentsByCategory,
    matchedRuleCount: matchedRules.length,
    recommendedStepKeys,
    autoNoteBullets,
    activeDmaTags,
    dmaNudgeCount,
  };
}

export function getEvidenceLedgerForCategory(
  result: DiagnosticIntelligenceResult | null | undefined,
  categoryId: string,
): EvidenceLedgerEntry[] {
  if (!result?.ledger?.length) return [];
  return dedupeLedgerEntries(
    result.ledger.filter(
      (entry) => entry.target === categoryId && entry.targetLayer === 'category',
    ),
  );
}

export function getEvidenceLedgerForComponent(
  result: DiagnosticIntelligenceResult | null | undefined,
  componentId: string,
): EvidenceLedgerEntry[] {
  if (!result?.ledger?.length) return [];
  return dedupeLedgerEntries(
    result.ledger.filter(
      (entry) => entry.target === componentId && entry.targetLayer === 'component',
    ),
  );
}

export function getComponentsForCategory(
  result: DiagnosticIntelligenceResult | null | undefined,
  categoryId: string,
) {
  const components = result?.componentsByCategory?.[categoryId] || [];
  return components.filter(
    (component) => component.evidence > 0 || component.state !== 'unknown',
  );
}
