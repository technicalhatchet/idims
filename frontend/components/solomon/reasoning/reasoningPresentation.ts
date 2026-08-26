import {
  getComponentsForCategory,
  getEvidenceLedgerForCategory,
} from '../../diagnostics/intelligence/diagnosticIntelligenceEngine';
import { formatLeadCauseStrength } from '../../diagnostics/intelligence/evidenceDisplay';
import { formatLedgerTriggerLine } from '../../diagnostics/intelligence/ledgerTrigger';
import type { MeasurementEvaluation } from '../../diagnostics/knowledge/types';
import type {
  DiagnosticIntelligenceResult,
  EvidenceLedgerEntry,
} from '../../diagnostics/intelligence/evidenceTypes';
import {
  buildProveWrongLines,
  buildWhySynthesisLines,
  buildWhyThisTestLineFromConfig,
  getEvidenceConfigForTemplate,
} from './reasoningPresentationHelpers';

export interface ReasoningLine {
  text: string;
  delta?: number;
  label?: string;
  triggerText?: string;
}

export interface ReasoningSection {
  id: string;
  title: string;
  lines: ReasoningLine[];
  emptyHint?: string;
  defaultOpen?: boolean;
}

export interface ReasoningPresentation {
  evidenceSummary: ReasoningSection;
  whyTop: ReasoningSection;
  whyThisTest: ReasoningSection;
  unresolved: ReasoningSection;
  supporting: ReasoningSection;
  contradicting: ReasoningSection;
  proveWrong: ReasoningSection;
}

export interface ReasoningPresentationOptions {
  templateId?: string | null;
  fields?: Record<string, unknown>;
  measurementStatuses?: Map<string, MeasurementEvaluation>;
  stepKeyLabels?: Record<string, string>;
}

function ledgerLinesWithTriggers(entries: EvidenceLedgerEntry[], limit = 8): ReasoningLine[] {
  return entries.slice(0, limit).map((entry) => ({
    text: entry.explanation,
    delta: entry.delta,
    triggerText: formatLedgerTriggerLine(entry.trigger) || undefined,
  }));
}

function positiveLedger(entries: EvidenceLedgerEntry[]): EvidenceLedgerEntry[] {
  return entries.filter((entry) => entry.delta > 0);
}

function negativeLedger(entries: EvidenceLedgerEntry[]): EvidenceLedgerEntry[] {
  return entries.filter((entry) => entry.delta < 0);
}

export function buildReasoningPresentation(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
  stepKeyLabels: Record<string, string> = {},
  options: ReasoningPresentationOptions = {},
): ReasoningPresentation | null {
  if (!intelligence?.topCategories?.length) return null;

  const fields = options.fields || {};
  const measurementStatuses = options.measurementStatuses;
  const templateId = options.templateId;
  const labels = options.stepKeyLabels || stepKeyLabels;

  const topCategory = intelligence.topCategories[0];
  const categoryLedger = getEvidenceLedgerForCategory(intelligence, topCategory.id);
  const positiveEntries = positiveLedger(categoryLedger);
  const strength = formatLeadCauseStrength(intelligence);
  const config = templateId ? getEvidenceConfigForTemplate(templateId) : null;

  const leadLines: ReasoningLine[] = [];
  if (strength) {
    leadLines.push({
      label: strength.categoryLabel,
      text: strength.tierLabel,
    });
    if (strength.marginOverNext > 0) {
      leadLines.push({
        text: `Evidence score ${strength.evidenceScore} (${strength.marginOverNext} points ahead of the next cause).`,
      });
    } else {
      leadLines.push({
        text: `Evidence score ${strength.evidenceScore}.`,
      });
    }
    if (strength.alternateLabels.length) {
      leadLines.push({
        text: `Also considering: ${strength.alternateLabels.join(', ')}.`,
      });
    }
  }

  const evidenceSummary: ReasoningSection = {
    id: 'b1',
    title: 'Lead cause',
    lines: leadLines,
    emptyHint: 'Answer a few more checks to see competing causes.',
    defaultOpen: true,
  };

  const whyTop: ReasoningSection = {
    id: 'b3',
    title: 'Why?',
    lines: buildWhySynthesisLines(topCategory.label, positiveEntries, strength?.summary || ''),
    emptyHint: `No supporting rules fired yet for ${topCategory.label}.`,
    defaultOpen: true,
  };

  const recommended = intelligence.recommendedStepKeys || [];
  const whyThisTest: ReasoningSection = {
    id: 'b4',
    title: 'Why this test?',
    lines: config
      ? recommended.slice(0, 4).map((stepKey) =>
        buildWhyThisTestLineFromConfig(
          stepKey,
          topCategory.id,
          topCategory.label,
          config,
          intelligence,
          fields,
          measurementStatuses,
          labels,
        ),
      )
      : recommended.slice(0, 4).map((stepKey) => ({
        label: labels[stepKey] || stepKey,
        text: `Next guided step to sharpen ${topCategory.label}.`,
      })),
    emptyHint: 'Keep walking the wizard — suggested tests appear as evidence builds.',
    defaultOpen: true,
  };

  const unresolvedComponents = getComponentsForCategory(intelligence, topCategory.id)
    .filter((component) => component.state === 'unknown' && component.evidence <= 0);
  const lowCategories = intelligence.categories.filter(
    (category) => category.evidence > 0 && category.id !== topCategory.id,
  );

  const unresolved: ReasoningSection = {
    id: 'b5',
    title: 'Unresolved',
    lines: [
      ...unresolvedComponents.slice(0, 4).map((component) => ({
        label: component.label,
        text: 'Still untested in this category.',
      })),
      ...lowCategories.slice(0, 2).map((category) => ({
        label: category.label,
        text: 'Alternate cause still on the table.',
      })),
    ],
    emptyHint: 'Major paths are covered — review before closing out.',
    defaultOpen: false,
  };

  const supporting: ReasoningSection = {
    id: 'b2',
    title: 'Supporting evidence',
    lines: ledgerLinesWithTriggers(positiveEntries, 12),
    emptyHint: 'No supporting evidence recorded yet.',
    defaultOpen: false,
  };

  const contradicting: ReasoningSection = {
    id: 'c2',
    title: 'Contradicting evidence',
    lines: ledgerLinesWithTriggers(negativeLedger(categoryLedger), 12),
    emptyHint: 'Nothing is pushing against the leading cause yet.',
    defaultOpen: false,
  };

  const proveWrongLines = config
    ? buildProveWrongLines(
      topCategory.id,
      topCategory.label,
      config,
      intelligence,
      fields,
      measurementStatuses,
      labels,
    )
    : [];

  const proveWrong: ReasoningSection = {
    id: 'c3',
    title: 'What would prove this wrong?',
    lines: proveWrongLines,
    emptyHint: 'Complete targeted tests to falsify the leading hypothesis.',
    defaultOpen: false,
  };

  return {
    evidenceSummary,
    whyTop,
    whyThisTest,
    unresolved,
    supporting,
    contradicting,
    proveWrong,
  };
}
