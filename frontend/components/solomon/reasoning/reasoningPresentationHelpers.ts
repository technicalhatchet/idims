import { getComplaintChipIds, getComplaintText } from '../../diagnostics/routing/routingEngine';
import { ruleWhenMatches } from '../../diagnostics/routing/conditionMatcher';
import { getEvidenceConfig } from '../../diagnostics/intelligence/evidenceRegistry';
import { getDiagnosticTest } from '../../diagnostics/intelligence/testCatalog';
import { formatLedgerTriggerLine } from '../../diagnostics/intelligence/ledgerTrigger';
import { resolveStepKeyLabel } from '../../diagnostics/intelligence/stepKeyLabels';
import type { MeasurementEvaluation } from '../../diagnostics/knowledge/types';
import type {
  DiagnosticIntelligenceResult,
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

export function buildWhyThisTestLineFromConfig(
  stepKey: string,
  categoryId: string,
  categoryLabel: string,
  config: { rules: EvidenceRule[] },
  intelligence: DiagnosticIntelligenceResult,
  fields: Record<string, unknown>,
  measurementStatuses?: Map<string, MeasurementEvaluation>,
  stepKeyLabels: Record<string, string> = {},
): { label: string; text: string; triggerText?: string } {
  const stepLabel = resolveStepKeyLabel(stepKey, stepKeyLabels) || stepKey;
  const rules = rulesForRecommendedStep(config, stepKey, categoryId);
  const fired = firedRuleIds(intelligence);
  const firedRules = rules.filter((rule) => fired.has(rule.id));
  const pendingRules = rules.filter(
    (rule) => !fired.has(rule.id) && ruleHasUnfilledTestClause(rule, fields, measurementStatuses),
  );

  const primaryLedger = intelligence.ledger.find(
    (entry) => firedRules.some((rule) => rule.id === entry.ruleId),
  );

  let text = '';
  if (firedRules.length && pendingRules.length) {
    text = `${firedRules[0].explanation} Still unresolved: ${pendingRules
      .slice(0, 2)
      .map((rule) => rule.explanation)
      .join('; ')}`;
  } else if (firedRules.length) {
    text = firedRules[0].explanation;
  } else if (pendingRules.length) {
    const labels = pendingRules
      .slice(0, 2)
      .map((rule) => unfilledTestLabel(rule, fields, measurementStatuses) || rule.explanation);
    text = `This step should resolve: ${labels.join('; ')}`;
  } else if (rules.length) {
    text = `Checks in ${stepLabel} help separate ${categoryLabel} from other causes.`;
  } else {
    text = `Continue ${stepLabel} to reduce uncertainty about ${categoryLabel}.`;
  }

  return {
    label: stepLabel,
    text,
    triggerText: primaryLedger ? formatLedgerTriggerLine(primaryLedger.trigger) || undefined : undefined,
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
): Array<{ label?: string; text: string; triggerText?: string }> {
  const fired = firedRuleIds(intelligence);
  const complaintChipIds = getComplaintChipIds(fields);
  const complaintText = getComplaintText(fields);
  const lines: Array<{ label?: string; text: string; triggerText?: string }> = [];

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
    if (effect === 'increase' || effect === 'confirm') {
      text = `If this check does not support ${categoryLabel}: ${rule.explanation}`;
    } else if (effect === 'decrease' || effect === 'unlikely') {
      text = `If this finding occurs, ${categoryLabel} becomes less likely: ${rule.explanation}`;
    } else if (effect === 'eliminate') {
      text = `Could rule out part of the ${categoryLabel} path: ${rule.explanation}`;
    }

    lines.push({ label, text });
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

export function buildWhySynthesisLines(
  categoryLabel: string,
  positiveEntries: Array<{ explanation: string }>,
  summary: string,
): Array<{ text: string }> {
  const lines: Array<{ text: string }> = [];
  if (summary) lines.push({ text: summary });
  if (positiveEntries.length) {
    const themes = positiveEntries
      .slice(0, 2)
      .map((entry) => entry.explanation)
      .join('; ');
    lines.push({ text: `So far: ${themes}` });
  } else if (!summary) {
    lines.push({ text: `Early hypothesis: ${categoryLabel}. More checks will sharpen this.` });
  }
  return lines.slice(0, 3);
}

export function getEvidenceConfigForTemplate(templateId: string | null | undefined) {
  return getEvidenceConfig(templateId);
}
