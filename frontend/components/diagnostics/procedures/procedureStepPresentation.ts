import type { MeasurementEvaluation } from '../knowledge/types';
import type { DiagnosticIntelligenceResult } from '../intelligence/evidenceTypes';
import type { DecisionBranch, ProcedureStep } from './types';

export type ProcedureStepPresentationContext = {
  recommendationReason?: string | null;
  leadingHypothesisLabel?: string | null;
  procedureTitle?: string | null;
  componentLabels?: string[];
};

export type OemContinuationBridgeContext = {
  recommendationReason?: string | null;
  /** Prior procedure completed without a repair action (verified path). */
  previousProcedureVerified?: boolean;
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

/** Conservative "why" copy — never asserts fault, only diagnostic purpose. */
export function resolveWhyWeAreChecking(
  context: ProcedureStepPresentationContext | null | undefined,
  measurementPurpose?: string | null,
): string | null {
  const reason = context?.recommendationReason?.trim();
  if (reason) return reason;

  const lead = context?.leadingHypothesisLabel?.trim();
  if (lead) {
    return `Your current diagnostic lead includes ${lead}. This step helps verify that part of the system using the manufacturer test.`;
  }

  const purpose = measurementPurpose?.trim();
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
  includeBodyInTechnical: boolean;
  meterRangeRef?: string;
};

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
): string {
  const reason = context?.recommendationReason?.trim();
  if (reason) return reason;

  if (context?.previousProcedureVerified) {
    return 'Your previous result was in the normal range, so Solomon is moving to the next likely check.';
  }

  return 'Solomon is continuing with the next diagnostic check.';
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
