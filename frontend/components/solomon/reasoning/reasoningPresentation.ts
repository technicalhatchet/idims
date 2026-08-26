import {
  getComponentsForCategory,
  getEvidenceLedgerForCategory,
} from '../../diagnostics/intelligence/diagnosticIntelligenceEngine';
import { normalizeEvidenceShares } from '../../diagnostics/intelligence/evidenceDisplay';
import { resolveStepKeyLabel } from '../../diagnostics/intelligence/stepKeyLabels';
import type {
  DiagnosticIntelligenceResult,
  EvidenceLedgerEntry,
} from '../../diagnostics/intelligence/evidenceTypes';

export interface ReasoningLine {
  text: string;
  delta?: number;
  label?: string;
}

export interface ReasoningSection {
  id: string;
  title: string;
  lines: ReasoningLine[];
  emptyHint?: string;
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

function ledgerLines(entries: EvidenceLedgerEntry[], limit = 6): ReasoningLine[] {
  return entries.slice(0, limit).map((entry) => ({
    text: entry.explanation,
    delta: entry.delta,
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
): ReasoningPresentation | null {
  if (!intelligence?.topCategories?.length) return null;

  const topCategory = intelligence.topCategories[0];
  const categoryLedger = getEvidenceLedgerForCategory(intelligence, topCategory.id);
  const shares = normalizeEvidenceShares(intelligence.topCategories);

  const evidenceSummary: ReasoningSection = {
    id: 'b1',
    title: 'Evidence summary',
    lines: shares
      .filter((item) => item.sharePercent > 0)
      .map((item) => ({
        label: item.label,
        text: `${item.sharePercent}% of active evidence`,
        delta: item.evidence,
      })),
    emptyHint: 'Answer a few more checks to see competing causes.',
  };

  const whyTop: ReasoningSection = {
    id: 'b3',
    title: 'Why?',
    lines: ledgerLines(positiveLedger(categoryLedger)),
    emptyHint: `No supporting rules fired yet for ${topCategory.label}.`,
  };

  const recommended = intelligence.recommendedStepKeys || [];
  const whyThisTest: ReasoningSection = {
    id: 'b4',
    title: 'Why this test?',
    lines: recommended.slice(0, 4).map((stepKey) => {
      const label = resolveStepKeyLabel(stepKey, stepKeyLabels) || stepKey;
      const related = categoryLedger.find((entry) => entry.explanation && stepKey);
      return {
        label,
        text: related?.explanation || `Next guided step to sharpen ${topCategory.label}.`,
      };
    }),
    emptyHint: 'Keep walking the wizard — suggested tests appear as evidence builds.',
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
  };

  const supporting: ReasoningSection = {
    id: 'b2',
    title: 'Supporting evidence',
    lines: ledgerLines(positiveLedger(categoryLedger), 8),
    emptyHint: 'No supporting evidence recorded yet.',
  };

  const contradicting: ReasoningSection = {
    id: 'c2',
    title: 'Contradicting evidence',
    lines: ledgerLines(negativeLedger(categoryLedger), 8),
    emptyHint: 'Nothing is pushing against the leading cause yet.',
  };

  const ruledOut = Object.values(intelligence.componentsByCategory || {})
    .flat()
    .filter((component) => component.state === 'eliminated' || component.state === 'unlikely');

  const proveWrong: ReasoningSection = {
    id: 'c3',
    title: 'What would prove this wrong?',
    lines: [
      ...ruledOut.slice(0, 4).map((component) => ({
        label: component.label,
        text:
          component.state === 'eliminated'
            ? 'Already ruled out — reversing would challenge the lead.'
            : 'Marked less likely — a positive test here would shift the lead.',
      })),
      ...recommended.slice(0, 2).map((stepKey) => ({
        label: resolveStepKeyLabel(stepKey, stepKeyLabels) || stepKey,
        text: `If this step contradicts ${topCategory.label}, reconsider the lead.`,
      })),
    ],
    emptyHint: 'Complete targeted tests to falsify the leading hypothesis.',
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
