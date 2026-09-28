import type { DiagnosticForegroundMode, DiagnosticForegroundState } from './diagnosticForegroundState';

export const DIAGNOSTIC_STATUS_EYEBROW: Record<DiagnosticForegroundMode, string> = {
  confirmed_fault: 'Fault identified',
  active_hypothesis: 'Next test',
  continuing_tests: 'Diagnostic in progress',
  oem_path_complete: 'Manufacturer path complete',
  remaining_upstream_path: 'Remaining fault path',
  no_supported_fault: 'No supported fault found',
  insufficient_evidence: 'Diagnostic status',
};

export function diagnosticStatusEyebrow(
  mode: DiagnosticForegroundMode,
): string {
  return DIAGNOSTIC_STATUS_EYEBROW[mode] || 'Diagnostic status';
}

export function shouldShowLeadPercent(foreground: DiagnosticForegroundState | null | undefined): boolean {
  if (!foreground) return false;
  return foreground.showPercent && foreground.mode === 'active_hypothesis';
}

/** Session/list cards — only finite numeric percentages (never null/undefined/NaN). */
export function isDisplayableLeadPercent(
  showPercent: boolean | undefined,
  percent: number | null | undefined,
): boolean {
  return Boolean(showPercent) && typeof percent === 'number' && Number.isFinite(percent);
}

export type LeadConfidencePresentationInput = {
  showPercent?: boolean;
  percent?: number | null;
  strengthWord?: string | null;
};

/** Primary status line for list/session cards (e.g. `72% LIKELY` or `CONFIRMED` without a fake %). */
export function formatLeadConfidencePrimaryLine(
  lead: LeadConfidencePresentationInput | null | undefined,
): string | null {
  if (!lead) return null;
  const word = lead.strengthWord?.trim() || '';
  if (isDisplayableLeadPercent(lead.showPercent, lead.percent)) {
    const pct = lead.percent as number;
    return word ? `${pct}% ${word}` : `${pct}%`;
  }
  return word || null;
}

export function shouldSuppressGenericNextTestPreview(input: {
  oemDiagnosticPathExhausted?: boolean;
  foregroundMode?: DiagnosticForegroundMode | null;
  nextStepKey?: string | null;
  currentStepKey?: string | null;
}): boolean {
  if (!input.oemDiagnosticPathExhausted) return false;
  if (input.currentStepKey === 'oem_test') return true;
  if (input.foregroundMode === 'oem_path_complete' || input.foregroundMode === 'no_supported_fault') {
    return true;
  }
  const key = input.nextStepKey;
  if (!key) return true;
  return key !== 'oem_test' && key !== 'diagnosis' && key !== 'review';
}

export function resolveBeforeRepairChecksPhaseActive(input: {
  oemRepairDecisionPending?: boolean;
  oemConfirmedRepairPathActive?: boolean;
  rootCauseSelected?: boolean;
  recommendedRepairSelected?: boolean;
}): boolean {
  if (input.oemRepairDecisionPending || input.oemConfirmedRepairPathActive) return true;
  return Boolean(input.rootCauseSelected && input.recommendedRepairSelected);
}

/** @deprecated Use resolveBeforeRepairChecksPhaseActive */
export const resolveRepairVerificationPhaseActive = resolveBeforeRepairChecksPhaseActive;

const COMMONLY_MISSED_DIAGNOSTIC_TITLE = 'Initial checks';

export function resolveWizardProgressTitle(input: {
  stepKey?: string | null;
  stepTitle?: string | null;
  oemDiagnosticTreeExhausted?: boolean;
  repairVerificationPhaseActive?: boolean;
  oemFaultIdentifiedPhase?: boolean;
  oemBeforeRepairChecksPhase?: boolean;
  /** @deprecated Use oemBeforeRepairChecksPhase */
  oemRepairVerificationPhase?: boolean;
}): string {
  const stepKey = input.stepKey;
  const fallback = input.stepTitle?.trim() || 'Diagnostic';
  const beforeRepairPhase = input.oemBeforeRepairChecksPhase ?? input.oemRepairVerificationPhase;

  if (stepKey === 'oem_test') {
    if (input.oemFaultIdentifiedPhase) return 'Fault identified';
    return input.oemDiagnosticTreeExhausted ? 'Manufacturer path complete' : 'OEM diagnostic';
  }

  if (stepKey === 'commonly_missed' && beforeRepairPhase) {
    return 'Before repair checks';
  }

  if (stepKey === 'diagnosis' && beforeRepairPhase) {
    return 'Diagnosis';
  }

  if (stepKey === 'commonly_missed' && !input.repairVerificationPhaseActive) {
    return COMMONLY_MISSED_DIAGNOSTIC_TITLE;
  }

  if (
    stepKey === 'commonly_missed'
    && fallback.toLowerCase().includes('repair verification')
    && !input.repairVerificationPhaseActive
  ) {
    return COMMONLY_MISSED_DIAGNOSTIC_TITLE;
  }

  return fallback;
}

export function formatSessionLeadSecondaryLine(
  foreground: DiagnosticForegroundState | null | undefined,
): string | null {
  if (!foreground) return null;
  if (foreground.mode === 'active_hypothesis' || foreground.mode === 'confirmed_fault') {
    return null;
  }
  if (foreground.mode === 'continuing_tests') {
    if (foreground.ruledOutLabels?.length) {
      const last = foreground.ruledOutLabels[foreground.ruledOutLabels.length - 1];
      return `${last} verified`;
    }
    return 'Still narrowing down the cause';
  }
  if (foreground.mode === 'oem_path_complete') {
    return foreground.remainingPathLabel ? 'Control path remains supported' : 'Manufacturer path complete';
  }
  if (foreground.mode === 'remaining_upstream_path') {
    return 'Upstream path remains supported';
  }
  if (foreground.mode === 'no_supported_fault') {
    return 'No failed component identified';
  }
  return foreground.tierLabel;
}
