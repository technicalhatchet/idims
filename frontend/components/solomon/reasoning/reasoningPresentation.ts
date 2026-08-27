import {
  getComponentsForCategory,
  getEvidenceLedgerForCategory,
} from '../../diagnostics/intelligence/diagnosticIntelligenceEngine';
import { formatDiyLeadCard, formatLeadCauseStrength } from '../../diagnostics/intelligence/evidenceDisplay';
import { formatLedgerTriggerLine } from '../../diagnostics/intelligence/ledgerTrigger';
import type { MeasurementEvaluation } from '../../diagnostics/knowledge/types';
import type {
  DiagnosticIntelligenceResult,
  EvidenceLedgerEntry,
} from '../../diagnostics/intelligence/evidenceTypes';
import type { WizardDefinition } from '../../diagnostics/types';
import {
  buildProveWrongLines,
  buildWhySynthesisOnly,
  buildWhyThisTestForTopStep,
  buildDiagnosticPathPresentation,
  getEvidenceConfigForTemplate,
  getNextTestPreview,
} from './reasoningPresentationHelpers';
import type { DiagnosticPathStepPresentation } from './reasoningPresentationHelpers';

export interface ReasoningLine {
  text: string;
  delta?: number;
  label?: string;
  triggerText?: string;
  whyText?: string;
}

export interface ReasoningSection {
  id: string;
  title: string;
  lines: ReasoningLine[];
  emptyHint?: string;
  defaultOpen?: boolean;
  count?: number;
}

export interface ReasoningPresentation {
  leadCard: ReturnType<typeof formatDiyLeadCard>;
  leadStrength: ReturnType<typeof formatLeadCauseStrength>;
  evidenceSummary: ReasoningSection;
  whyTop: ReasoningSection;
  whyThisTest: ReasoningSection;
  unresolved: ReasoningSection;
  supporting: ReasoningSection;
  contradicting: ReasoningSection;
  proveWrong: ReasoningSection;
  nextTestPreview: ReturnType<typeof getNextTestPreview>;
  diagnosticPath: DiagnosticPathStepPresentation[] | null;
}

export interface ReasoningPresentationOptions {
  templateId?: string | null;
  fields?: Record<string, unknown>;
  measurementStatuses?: Map<string, MeasurementEvaluation>;
  stepKeyLabels?: Record<string, string>;
  wizardDefinition?: WizardDefinition | null;
  layout?: 'inline' | 'sheet';
  wizardSteps?: import('../../diagnostics/types').ResolvedDiagnosticWizardStep[];
  visitedStepKeys?: string[];
  currentStepKey?: string | null;
  reviewStepId?: string;
}

function ledgerLinesWithTriggers(entries: EvidenceLedgerEntry[], limit = 12): ReasoningLine[] {
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
  const layout = options.layout || 'inline';
  const isSheet = layout === 'sheet';

  const topCategory = intelligence.topCategories[0];
  const categoryLedger = getEvidenceLedgerForCategory(intelligence, topCategory.id);
  const positiveEntries = positiveLedger(categoryLedger);
  const negativeEntries = negativeLedger(categoryLedger);
  const strength = formatLeadCauseStrength(intelligence);
  const leadCard = formatDiyLeadCard(intelligence);
  const config = templateId ? getEvidenceConfigForTemplate(templateId) : null;

  const leadLines: ReasoningLine[] = [];
  if (strength && !isSheet) {
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

  const synthesisText = buildWhySynthesisOnly(strength?.summary || '', topCategory.label);

  const whyTop: ReasoningSection = {
    id: 'b3',
    title: isSheet ? 'Why we believe this' : 'Why?',
    lines: [{ text: synthesisText }],
    emptyHint: `No supporting rules fired yet for ${topCategory.label}.`,
    defaultOpen: isSheet ? false : true,
  };

  const topStepKey = intelligence.recommendedStepKeys?.[0];
  const whyThisTestLine = config
    ? buildWhyThisTestForTopStep(
      intelligence,
      topCategory.id,
      topCategory.label,
      config,
      fields,
      measurementStatuses,
      labels,
      positiveEntries,
    )
    : null;

  const whyThisTest: ReasoningSection = {
    id: 'b4',
    title: 'Why this test?',
    lines: whyThisTestLine
      ? [{
        text: whyThisTestLine.text,
        label: isSheet ? undefined : whyThisTestLine.stepLabel,
      }]
      : [],
    emptyHint: 'Keep walking the wizard — suggested tests appear as evidence builds.',
    defaultOpen: false,
  };

  const unresolvedComponents = getComponentsForCategory(intelligence, topCategory.id)
    .filter((component) => component.state === 'unknown' && component.evidence <= 0);
  const lowCategories = intelligence.categories.filter(
    (category) => category.evidence > 0 && category.id !== topCategory.id,
  );

  const unresolved: ReasoningSection = {
    id: 'b5',
    title: isSheet ? 'Still unresolved' : 'Unresolved',
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
    count: unresolvedComponents.length + lowCategories.length,
  };

  const supporting: ReasoningSection = {
    id: 'b2',
    title: 'Supporting evidence',
    lines: ledgerLinesWithTriggers(positiveEntries, 12),
    emptyHint: 'No supporting evidence recorded yet.',
    defaultOpen: false,
    count: positiveEntries.length,
  };

  const contradicting: ReasoningSection = {
    id: 'c2',
    title: 'Contradicting evidence',
    lines: ledgerLinesWithTriggers(negativeEntries, 12),
    emptyHint: isSheet
      ? 'Nothing is currently pushing against this diagnosis.'
      : 'Nothing is pushing against the leading cause yet.',
    defaultOpen: false,
    count: negativeEntries.length,
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
    title: isSheet ? 'What would change my mind?' : 'What would prove this wrong?',
    lines: proveWrongLines.map((line) => ({
      label: line.label,
      text: line.text,
      triggerText: line.triggerText,
      whyText: line.whyText,
    })),
    emptyHint: 'Complete targeted tests to see what could change this diagnosis.',
    defaultOpen: false,
  };

  const evidenceSummary: ReasoningSection = {
    id: 'b1',
    title: 'Lead cause',
    lines: leadLines,
    emptyHint: 'Answer a few more checks to see competing causes.',
    defaultOpen: !isSheet,
  };

  const nextTestPreview = getNextTestPreview(
    options.wizardDefinition,
    topStepKey,
    labels,
  );

  const diagnosticPath = isSheet && options.wizardSteps?.length
    ? buildDiagnosticPathPresentation({
      wizardSteps: options.wizardSteps,
      wizardDefinition: options.wizardDefinition,
      visitedStepKeys: options.visitedStepKeys || [],
      currentStepKey: options.currentStepKey,
      intelligence,
      stepKeyLabels: labels,
      templateId,
      reviewStepId: options.reviewStepId,
    })
    : null;

  return {
    leadCard,
    leadStrength: strength,
    evidenceSummary,
    whyTop,
    whyThisTest,
    unresolved,
    supporting,
    contradicting,
    proveWrong,
    nextTestPreview,
    diagnosticPath,
  };
}
