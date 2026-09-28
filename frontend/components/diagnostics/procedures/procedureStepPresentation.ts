import { getEvidenceConfig } from '../intelligence/evidenceRegistry';
import type { MeasurementEvaluation } from '../knowledge/types';
import type { DiagnosticIntelligenceResult } from '../intelligence/evidenceTypes';
import type { DecisionBranch, ProcedureStep, ServiceProcedure } from './types';

export type ProcedureStepPresentationContext = {
  recommendationReason?: string | null;
  leadingHypothesisLabel?: string | null;
  procedureTitle?: string | null;
  componentLabels?: string[];
};

const INTERNAL_JARGON_PATTERN =
  /\b(canonical routing|canonical domain|canonical id|ontology|overlay|functional realization|\bcandidate\b|\branker\b|\bmatcher\b|platform mapping)\b/i;

export function containsInternalDiagnosticJargon(text: string): boolean {
  return INTERNAL_JARGON_PATTERN.test(text);
}

/** Strip or replace internal architecture wording for homeowner-facing copy. */
export function sanitizeUserFacingExplanation(
  text: string | null | undefined,
): string | null {
  const trimmed = text?.trim();
  if (!trimmed) return null;
  if (!containsInternalDiagnosticJargon(trimmed)) return trimmed;

  const mapsToMatch = trimmed.match(
    /maps to\s+(?:[^:]+:\s*)?(.+?)(?:\.|$)/i,
  );
  if (mapsToMatch?.[1]) {
    const target = mapsToMatch[1].trim().replace(/\s+/g, ' ');
    if (target && !containsInternalDiagnosticJargon(target)) {
      return `This step follows the manufacturer test for ${target}.`;
    }
  }

  const domainCircuit = trimmed.match(
    /(?:door|control)\s+domain[^.]*\.\s*(.+)/i,
  );
  if (domainCircuit?.[1] && !containsInternalDiagnosticJargon(domainCircuit[1])) {
    return domainCircuit[1].trim();
  }

  return null;
}

export type OemContinuationBridgeContext = {
  /** @deprecated Do not use for bridge copy — procedure-level reasons are not continuation targets. */
  recommendationReason?: string | null;
  previousProcedureVerified?: boolean;
  previousProcedureTitle?: string | null;
  nextProcedureTitle?: string | null;
  nextWizardStepLabel?: string | null;
  manufacturerPathComplete?: boolean;
  nextDirectionSummary?: string | null;
};

export function resolveLeadingComponentLabelForProcedure(
  procedureComponentIds: string[],
  intelligence: DiagnosticIntelligenceResult | null | undefined,
): string | null {
  if (!intelligence?.componentsByCategory || !procedureComponentIds.length) return null;
  const all = Object.values(intelligence.componentsByCategory).flat();
  for (const componentId of procedureComponentIds) {
    const match = all.find(
      (item) => item.id === componentId
        && (item.state === 'confirmed' || item.evidence > 0),
    );
    if (match?.label) return match.label;
  }
  return null;
}

export type ProcedurePresentationSource = {
  reason?: string | null;
  procedure: Pick<ServiceProcedure, 'title' | 'componentIds'>;
};

/** Shared OEM step presentation context (wizard + Solomon procedure panel). */
export function buildProcedureStepPresentationContext(
  recommendation: ProcedurePresentationSource | null | undefined,
  options?: {
    intelligence?: DiagnosticIntelligenceResult | null;
    templateId?: string | null;
  },
): ProcedureStepPresentationContext | undefined {
  if (!recommendation?.procedure) return undefined;

  const { procedure, reason } = recommendation;
  const componentIds = procedure.componentIds || [];
  const evidenceConfig = options?.templateId
    ? getEvidenceConfig(options.templateId)
    : null;
  const componentLabels = componentIds
    .map((componentId) => evidenceConfig?.components?.find((item) => item.id === componentId)?.label)
    .filter((label): label is string => Boolean(label));

  const context: ProcedureStepPresentationContext = {
    recommendationReason: reason ?? null,
    leadingHypothesisLabel: resolveLeadingComponentLabelForProcedure(
      componentIds,
      options?.intelligence,
    ),
    procedureTitle: procedure.title,
    componentLabels,
  };

  return resolveWhyWeAreChecking(context) ? context : undefined;
}

/**
 * Per-step "why" — never reuse procedure-level recommendation/canonical-domain copy.
 * Only measurement knowledge purpose is step-trustworthy today.
 */
export function resolveWhyWeAreCheckingForStep(
  step: ProcedureStep,
  measurementPurpose?: string | null,
): string | null {
  if (step.type !== 'measurement') return null;
  const purpose = sanitizeUserFacingExplanation(measurementPurpose);
  return purpose || null;
}

/** Conservative "why" copy — never asserts fault, only diagnostic purpose. */
export function resolveWhyWeAreChecking(
  context: ProcedureStepPresentationContext | null | undefined,
  measurementPurpose?: string | null,
): string | null {
  const sanitizedReason = sanitizeUserFacingExplanation(context?.recommendationReason);
  if (sanitizedReason) return sanitizedReason;

  const lead = context?.leadingHypothesisLabel?.trim();
  if (lead) {
    const procedureTitle = context?.procedureTitle?.trim();
    if (procedureTitle && /door\s*lock/i.test(procedureTitle)) {
      return 'The appliance must confirm the door is locked before it can run certain parts of the cycle. We\'re checking this before moving farther down the diagnostic path.';
    }
    return `Your current diagnostic lead includes ${lead}. This step helps verify that part of the system using the manufacturer test.`;
  }

  const purpose = sanitizeUserFacingExplanation(measurementPurpose);
  if (purpose) return purpose;

  const components = context?.componentLabels?.filter(Boolean) ?? [];
  if (components.length) {
    const label = components.join(' / ');
    return `This step checks the ${label} using the service procedure on this unit.`;
  }

  const procedureTitle = context?.procedureTitle?.trim();
  if (procedureTitle) {
    return `This step is part of the manufacturer’s ${procedureTitle} procedure for this appliance.`;
  }

  return null;
}

export function formatStepHeadline(step: ProcedureStep): string {
  const title = step.title.trim();
  if (!title) return 'DIAGNOSTIC STEP';
  if (/^(check|verify|inspect)\b/i.test(title)) {
    return title.toUpperCase();
  }
  if (step.type === 'measurement' || step.type === 'visual_check') {
    return `CHECK ${title}`.toUpperCase();
  }
  if (step.type === 'safety') {
    return title.toUpperCase();
  }
  return title;
}

export type InstructionPresentation = {
  whatToDo: string;
  whatToDoItems?: string[];
  testSequenceItems?: string[];
  trailingInstruction?: string;
  includeBodyInTechnical: boolean;
  meterRangeRef?: string;
};

const NUMBERED_LINE = /^\s*\d+\.\s+(.+)$/;

export function parseStructuredInstructionLists(
  body: string,
): {
  introText?: string;
  numberedItems?: string[];
  testSequenceItems?: string[];
  trailingText?: string;
} | null {
  const normalized = body.trim();
  if (!normalized) return null;

  const sequenceHeaderMatch = normalized.match(/\n\s*((?:Step sequence|TEST SEQUENCE)[^:\n]*)/i);
  if (sequenceHeaderMatch && sequenceHeaderMatch.index !== undefined) {
    const headerStart = sequenceHeaderMatch.index;
    const afterHeaderStart = headerStart + sequenceHeaderMatch[0].length;
    const introText = normalized.slice(0, headerStart).trim();
    const remainder = normalized.slice(afterHeaderStart).replace(/^[:\s]+/, '').trim();
    const parsed = splitNumberedBlock(remainder);
    if (!parsed || parsed.items.length < 2) return null;
    return {
      introText: introText || undefined,
      testSequenceItems: parsed.items,
      trailingText: parsed.trailingText,
    };
  }

  const paragraphs = normalized.split(/\n\n+/);
  const lastParagraph = paragraphs[paragraphs.length - 1] || '';
  const lines = lastParagraph.split('\n').map((line) => line.trim()).filter(Boolean);
  if (lines.length >= 3 && lines.every((line) => NUMBERED_LINE.test(line))) {
    const numberedItems = lines.map((line) => line.replace(NUMBERED_LINE, '$1').trim());
    const introText = paragraphs.slice(0, -1).join('\n\n').trim();
    return {
      introText: introText || undefined,
      numberedItems,
    };
  }

  return null;
}

function splitNumberedBlock(text: string): { items: string[]; trailingText?: string } | null {
  const lines = text.split('\n');
  const items: string[] = [];
  const trailing: string[] = [];
  let seenNumbered = false;
  let leftNumberedRun = false;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const numbered = trimmed.match(NUMBERED_LINE);
    if (numbered) {
      seenNumbered = true;
      leftNumberedRun = false;
      items.push(numbered[1].trim());
      continue;
    }
    if (seenNumbered) {
      leftNumberedRun = true;
      trailing.push(trimmed);
    }
  }

  if (!seenNumbered || items.length < 2) return null;
  if (!leftNumberedRun && trailing.length) return null;

  return {
    items,
    trailingText: trailing.join(' ').trim() || undefined,
  };
}

const RX1_PATTERN = /\bR\s*[×xX]\s*1\b/;

export function formatInstructionLead(body: string): {
  primary: string;
  changed: boolean;
  meterRangeRef?: string;
} {
  const trimmed = body.trim();
  if (!trimmed) {
    return { primary: '', changed: false };
  }

  let meterRangeRef: string | undefined;
  const rx1Match = trimmed.match(RX1_PATTERN);
  if (rx1Match) {
    meterRangeRef = rx1Match[0];
  }

  const lower = trimmed.toLowerCase();
  if (rx1Match || /\bohmmeter\b/.test(lower) || /\bresistance\b/.test(lower)) {
    const primary = meterRangeRef
      ? 'Set your meter to resistance (Ω).'
      : 'Measure resistance (Ω) as described below.';
    const changed = primary !== trimmed;
    return { primary, changed, meterRangeRef };
  }

  return { primary: trimmed, changed: false, meterRangeRef };
}

export function splitInstructionPresentation(body: string): InstructionPresentation {
  const lead = formatInstructionLead(body);
  if (!body.trim()) {
    return { whatToDo: '', includeBodyInTechnical: false };
  }
  if (lead.changed) {
    return {
      whatToDo: lead.primary,
      includeBodyInTechnical: true,
      meterRangeRef: lead.meterRangeRef,
    };
  }

  const structured = parseStructuredInstructionLists(body);
  if (structured) {
    return {
      whatToDo: structured.introText || '',
      whatToDoItems: structured.numberedItems,
      testSequenceItems: structured.testSequenceItems,
      trailingInstruction: structured.trailingText,
      includeBodyInTechnical: true,
      meterRangeRef: lead.meterRangeRef,
    };
  }

  return {
    whatToDo: body.trim(),
    includeBodyInTechnical: false,
    meterRangeRef: lead.meterRangeRef,
  };
}

export type MeasurementResultPresentation = {
  headline: string;
  detail: string;
};

export function formatMeasurementResultPresentation(
  evaluation: MeasurementEvaluation,
): MeasurementResultPresentation {
  const baseMessage = evaluation.message?.trim() || '';
  const label = evaluation.diagnosisLabel?.trim();

  switch (evaluation.status) {
    case 'normal':
      return {
        headline: 'GOOD',
        detail: baseMessage || 'Your reading is within the expected range.',
      };
    case 'critical':
      return {
        headline: label || 'CRITICAL',
        detail: baseMessage || 'This reading indicates a serious fault.',
      };
    case 'warning':
      return {
        headline: label || 'OUT OF RANGE',
        detail: baseMessage || 'Your reading is outside the expected range.',
      };
    case 'unknown':
    default:
      if (/open|\bol\b/i.test(baseMessage) || /open/i.test(label || '')) {
        return {
          headline: label || 'OPEN / OL',
          detail: baseMessage || 'An open circuit was detected.',
        };
      }
      return {
        headline: label || 'RESULT',
        detail: baseMessage || 'Review the reading against the expected range.',
      };
  }
}

export function formatBranchResultPresentation(
  branch: DecisionBranch,
): { headline: string; detail: string } | null {
  const label = branch.label?.trim();
  if (!label) return null;
  const outcome = branch.oemOutcome?.trim();
  return {
    headline: 'WHAT THIS MEANS',
    detail: outcome ? `${label} — ${outcome}` : label,
  };
}

export function formatOemContinuationBridgeMessage(
  context: OemContinuationBridgeContext | null | undefined,
): string | null {
  const nextProcedure = context?.nextProcedureTitle?.trim();
  if (nextProcedure) {
    return `Next, we'll test ${nextProcedure}.`;
  }

  if (context?.manufacturerPathComplete) {
    const direction = context.nextDirectionSummary?.trim();
    if (direction) {
      return `Manufacturer diagnostic path complete. ${direction}`;
    }
    return 'Manufacturer diagnostic path complete.';
  }

  const nextWizard = context?.nextWizardStepLabel?.trim();
  if (nextWizard) {
    return `Next, we'll continue with ${nextWizard}.`;
  }

  return null;
}

/** Procedure-level recommendation reasons mention circuits/domains — not valid per-step copy. */
export function isProcedureLevelRecommendationReason(text: string | null | undefined): boolean {
  const trimmed = text?.trim();
  if (!trimmed) return false;
  return /this test checks the .+ circuit before going deeper/i.test(trimmed)
    || /maps to .+ on this platform/i.test(trimmed)
    || /complaint pattern matches/i.test(trimmed);
}

export function formatOemWizardSkipAcknowledgement(): string {
  return 'Skipped — continuing to the next diagnostic check.';
}

export function hasTechnicalDetailsContent(input: {
  step: ProcedureStep;
  testingTipsCount?: number;
  includeBodyInTechnical: boolean;
  meterRangeRef?: string;
  sourceInTechnicalAccordion?: boolean;
}): boolean {
  const {
    step,
    testingTipsCount = 0,
    includeBodyInTechnical,
    meterRangeRef,
    sourceInTechnicalAccordion = true,
  } = input;
  if (includeBodyInTechnical && step.body?.trim()) return true;
  if (sourceInTechnicalAccordion && step.sourceExcerpt?.trim()) return true;
  if (step.testPoint) return true;
  if (meterRangeRef) return true;
  if (testingTipsCount > 0) return true;
  return false;
}
