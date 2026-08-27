import { getComplaintChipIds, getComplaintText } from '../../diagnostics/routing/routingEngine';
import { ruleWhenMatches } from '../../diagnostics/routing/conditionMatcher';
import { getPrerequisiteStatus } from '../../diagnostics/routing/prerequisiteEngine';
import { getEvidenceConfig } from '../../diagnostics/intelligence/evidenceRegistry';
import { getDiagnosticTest } from '../../diagnostics/intelligence/testCatalog';
import { formatLedgerTriggerLine } from '../../diagnostics/intelligence/ledgerTrigger';
import { resolveStepKeyLabel } from '../../diagnostics/intelligence/stepKeyLabels';
import type { MeasurementEvaluation } from '../../diagnostics/knowledge/types';
import type { ResolvedDiagnosticWizardStep, WizardDefinition } from '../../diagnostics/types';
import type {
  DiagnosticIntelligenceResult,
  EvidenceLedgerEntry,
  EvidenceRule,
  EvidenceWhenClause,
} from '../../diagnostics/intelligence/evidenceTypes';

function isFieldFilled(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  const text = String(value).trim();
  return text !== '' && text !== 'not_checked';
}

function isTestClause(
  clause: EvidenceWhenClause,
): clause is { type: 'test'; testId: string; filled?: boolean } {
  return typeof clause === 'object' && clause !== null && 'type' in clause && clause.type === 'test';
}

export function isTestFilled(
  testId: string,
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): boolean {
  const test = getDiagnosticTest(testId);
  if (!test) return false;
  if (test.fieldKey) return isFieldFilled(fields[test.fieldKey]);
  if (test.knowledgeId && measurementStatuses) return measurementStatuses.has(test.knowledgeId);
  return false;
}

export function ruleHasUnfilledTestClause(
  rule: EvidenceRule,
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): boolean {
  for (const clause of rule.when) {
    if (!isTestClause(clause)) continue;
    const filled = isTestFilled(clause.testId, fields, measurementStatuses);
    const needsFilled = clause.filled === true || clause.filled === undefined;
    if (needsFilled && !filled) return true;
  }
  return false;
}

export function unfilledTestLabel(
  rule: EvidenceRule,
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): string | null {
  for (const clause of rule.when) {
    if (!isTestClause(clause)) continue;
    const filled = isTestFilled(clause.testId, fields, measurementStatuses);
    const needsFilled = clause.filled === true || clause.filled === undefined;
    if (needsFilled && !filled) {
      const test = getDiagnosticTest(clause.testId);
      return test?.label || clause.testId;
    }
  }
  return null;
}

export function rulesForRecommendedStep(
  config: { rules: EvidenceRule[] },
  stepKey: string,
  categoryId: string,
): EvidenceRule[] {
  return config.rules.filter(
    (rule) =>
      rule.recommendStepKey === stepKey
      && rule.target === categoryId
      && rule.targetLayer === 'category',
  );
}

function evidenceWhenAllMatch(
  when: EvidenceWhenClause[],
  complaintChipIds: string[],
  complaintText: string,
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
): boolean {
  if (!when?.length) return false;

  return when.every((clause) => {
    if (isTestClause(clause)) {
      const filled = isTestFilled(clause.testId, fields, measurementStatuses);
      if (clause.filled === false) return !filled;
      if (clause.filled === true || clause.filled === undefined) return filled;
      return false;
    }
    return ruleWhenMatches(
      [clause as Parameters<typeof ruleWhenMatches>[0][0]],
      complaintChipIds,
      complaintText,
      fields,
      measurementStatuses,
    );
  });
}

export function firedRuleIds(intelligence: DiagnosticIntelligenceResult): Set<string> {
  return new Set(intelligence.ledger.map((entry) => entry.ruleId));
}

function explanationInLedger(explanation: string, ledger: EvidenceLedgerEntry[]): boolean {
  return ledger.some((entry) => entry.explanation === explanation);
}

export function buildWhyThisTestForTopStep(
  intelligence: DiagnosticIntelligenceResult,
  categoryId: string,
  categoryLabel: string,
  config: { rules: EvidenceRule[] },
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
  stepKeyLabels: Record<string, string> = {},
  positiveLedger: EvidenceLedgerEntry[] = [],
): { text: string; stepKey?: string; stepLabel?: string } | null {
  const stepKey = intelligence.recommendedStepKeys?.[0];
  if (!stepKey) return null;

  const stepLabel = resolveStepKeyLabel(stepKey, stepKeyLabels) || stepKey;
  const rules = rulesForRecommendedStep(config, stepKey, categoryId);
  const fired = firedRuleIds(intelligence);
  const pendingRules = rules.filter(
    (rule) => !fired.has(rule.id) && ruleHasUnfilledTestClause(rule, fields, measurementStatuses),
  );
  const firedRules = rules.filter((rule) => fired.has(rule.id));

  // Priority 1 — unfilled discriminators / rule explanations
  if (pendingRules.length) {
    const testLabels = pendingRules
      .slice(0, 2)
      .map((rule) => unfilledTestLabel(rule, fields, measurementStatuses) || rule.explanation);
    const uniqueLabels = [...new Set(testLabels)];
    return {
      stepKey,
      stepLabel,
      text: `This test helps resolve: ${uniqueLabels.join('; ')}.`,
    };
  }

  if (firedRules.length) {
    const explanation = firedRules[0].explanation;
    if (!explanationInLedger(explanation, positiveLedger)) {
      return {
        stepKey,
        stepLabel,
        text: explanation,
      };
    }
    return {
      stepKey,
      stepLabel,
      text: `This step checks details still needed to confirm or rule out ${categoryLabel}.`,
    };
  }

  // Priority 2 — competing hypotheses
  const alternates = intelligence.topCategories
    .slice(1)
    .filter((category) => category.evidence > 0);
  if (alternates.length) {
    return {
      stepKey,
      stepLabel,
      text: `Solomon needs to determine whether ${categoryLabel} explains the symptoms or ${alternates[0].label} is involved.`,
    };
  }

  // Priority 3 — concise fallback
  if (rules.length) {
    return {
      stepKey,
      stepLabel,
      text: `Checks in ${stepLabel} help separate ${categoryLabel} from other possible causes.`,
    };
  }

  return {
    stepKey,
    stepLabel,
    text: `Continue ${stepLabel} to reduce uncertainty about ${categoryLabel}.`,
  };
}

export function buildProveWrongLines(
  categoryId: string,
  categoryLabel: string,
  config: { rules: EvidenceRule[] },
  intelligence: DiagnosticIntelligenceResult,
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
  stepKeyLabels: Record<string, string> = {},
): Array<{ label?: string; text: string; triggerText?: string; whyText?: string }> {
  const fired = firedRuleIds(intelligence);
  const complaintChipIds = getComplaintChipIds(fields);
  const complaintText = getComplaintText(fields);
  const lines: Array<{ label?: string; text: string; triggerText?: string; whyText?: string }> = [];

  for (const rule of config.rules) {
    if (rule.target !== categoryId || rule.targetLayer !== 'category') continue;
    if (fired.has(rule.id)) continue;
    if (!ruleHasUnfilledTestClause(rule, fields, measurementStatuses)) continue;

    const wouldMatchIfFilled = rule.when.every((clause) => {
      if (isTestClause(clause)) {
        const needsFilled = clause.filled === true || clause.filled === undefined;
        if (needsFilled) return true;
      }
      return evidenceWhenAllMatch(
        [clause],
        complaintChipIds,
        complaintText,
        fields,
        measurementStatuses,
      );
    });
    if (!wouldMatchIfFilled) continue;

    const effect = rule.effect.effect;
    const testLabel = unfilledTestLabel(rule, fields, measurementStatuses);
    const stepLabel = rule.recommendStepKey
      ? resolveStepKeyLabel(rule.recommendStepKey, stepKeyLabels)
      : null;
    const label = testLabel || stepLabel || 'Key check';

    let text = rule.explanation;
    let whyText: string | undefined;
    if (effect === 'increase' || effect === 'confirm') {
      text = `A result that does not support ${categoryLabel} would weaken this diagnosis.`;
      whyText = rule.explanation;
    } else if (effect === 'decrease' || effect === 'unlikely') {
      text = `If this finding occurs, ${categoryLabel} becomes less likely.`;
      whyText = rule.explanation;
    } else if (effect === 'eliminate') {
      text = `This check could rule out part of the ${categoryLabel} path.`;
      whyText = rule.explanation;
    }

    const triggerTest = unfilledTestLabel(rule, fields, measurementStatuses);
    lines.push({
      label,
      text,
      whyText,
      triggerText: triggerTest ? `Check: ${triggerTest}` : undefined,
    });
    if (lines.length >= 5) break;
  }

  const second = intelligence.topCategories[1];
  if (second && second.evidence > 0 && intelligence.topCategories[0].evidence - second.evidence < 15) {
    lines.push({
      label: second.label,
      text: `A strong finding for ${second.label} could overtake the current lead.`,
    });
  }

  return lines;
}

export function buildWhySynthesisOnly(summary: string, categoryLabel: string): string {
  if (summary?.trim()) return summary.trim();
  return `Solomon is still gathering information about ${categoryLabel}.`;
}

export function getEvidenceConfigForTemplate(templateId: string | null | undefined) {
  return getEvidenceConfig(templateId);
}

export function getNextTestPreview(
  wizardDefinition: { defaultSteps?: Array<{ stepKey?: string; title?: string; description?: string; estimatedMinutes?: number }> } | null | undefined,
  stepKey: string | undefined,
  stepKeyLabels: Record<string, string> = {},
): { stepNumber?: number; title: string; description?: string; estimatedMinutes?: number } | null {
  if (!stepKey || !wizardDefinition?.defaultSteps?.length) return null;

  const index = wizardDefinition.defaultSteps.findIndex(
    (step) => step.stepKey === stepKey,
  );
  if (index < 0) return null;

  const step = wizardDefinition.defaultSteps[index];
  const title = resolveStepKeyLabel(stepKey, stepKeyLabels) || step.title || stepKey;
  return {
    stepNumber: index + 1,
    title,
    description: step.description,
    estimatedMinutes: step.estimatedMinutes,
  };
}

export type DiagnosticPathStepStatus = 'completed' | 'current' | 'locked' | 'upcoming';

export interface DiagnosticPathStepPresentation {
  stepKey: string;
  stepNumber: number;
  title: string;
  stepTitle: string;
  status: DiagnosticPathStepStatus;
  summary?: string;
}

function shortenPathSummary(text: string): string {
  const cleaned = text.replace(/^Complaint:.*?—\s*/i, '').trim();
  if (cleaned.length <= 72) return cleaned;
  return `${cleaned.slice(0, 69)}…`;
}

function stepPathSummary(
  stepKey: string,
  intelligence: DiagnosticIntelligenceResult,
  categoryId: string,
  config: { rules: EvidenceRule[] } | null,
): string | undefined {
  if (!config || !categoryId) return undefined;

  const rules = rulesForRecommendedStep(config, stepKey, categoryId);
  for (const rule of rules) {
    const entry = intelligence.ledger.find(
      (item) => item.ruleId === rule.id && item.delta > 0 && item.target === categoryId,
    );
    if (entry?.explanation) return shortenPathSummary(entry.explanation);
  }

  for (const entry of intelligence.ledger) {
    if (entry.delta <= 0 || entry.target !== categoryId) continue;
    const rule = config.rules.find((item) => item.id === entry.ruleId);
    if (rule?.recommendStepKey === stepKey && entry.explanation) {
      return shortenPathSummary(entry.explanation);
    }
  }

  return undefined;
}

export function buildDiagnosticPathPresentation(args: {
  wizardSteps: ResolvedDiagnosticWizardStep[];
  wizardDefinition: WizardDefinition | null | undefined;
  visitedStepKeys: string[];
  currentStepKey: string | null | undefined;
  intelligence: DiagnosticIntelligenceResult;
  stepKeyLabels?: Record<string, string>;
  templateId?: string | null;
  reviewStepId?: string;
}): DiagnosticPathStepPresentation[] | null {
  const {
    wizardSteps,
    wizardDefinition,
    visitedStepKeys,
    currentStepKey,
    intelligence,
    stepKeyLabels = {},
    templateId,
    reviewStepId = 'diagnostic_review',
  } = args;

  if (!wizardSteps?.length) return null;

  const bodySteps = wizardSteps.filter(
    (step) => step.id !== reviewStepId && step.meta?.stepKey,
  );
  if (!bodySteps.length) return null;

  const visitedSet = new Set(visitedStepKeys);
  const visitedStepIds = new Set(
    bodySteps
      .filter((step) => visitedSet.has(step.meta?.stepKey || ''))
      .map((step) => step.id),
  );
  const config = templateId ? getEvidenceConfig(templateId) : null;
  const topCategoryId = intelligence.topCategories[0]?.id;

  return bodySteps.map((step, index) => {
    const stepKey = step.meta?.stepKey || '';
    const stepTitle = step.title || resolveStepKeyLabel(stepKey, stepKeyLabels) || stepKey;

    let status: DiagnosticPathStepStatus;
    if (stepKey && stepKey === currentStepKey) {
      status = 'current';
    } else if (visitedSet.has(stepKey)) {
      status = 'completed';
    } else if (wizardDefinition) {
      const prereq = getPrerequisiteStatus(
        stepKey,
        wizardDefinition,
        visitedStepIds,
        reviewStepId,
      );
      status = prereq.met ? 'upcoming' : 'locked';
    } else {
      status = 'upcoming';
    }

    const summary =
      status === 'completed'
        ? stepPathSummary(stepKey, intelligence, topCategoryId, config)
        : undefined;

    return {
      stepKey,
      stepNumber: index + 1,
      title: summary || stepTitle,
      stepTitle,
      status,
      summary,
    };
  });
}
