import type { ProcedureRunState } from './types';
import { procedureRunRequiresRepairAction } from './procedureWizardRouting';

export const OEM_BEFORE_REPAIR_CHECKS_STEP_KEY = 'commonly_missed';
/** @deprecated Use OEM_BEFORE_REPAIR_CHECKS_STEP_KEY */
export const OEM_REPAIR_VERIFICATION_STEP_KEY = OEM_BEFORE_REPAIR_CHECKS_STEP_KEY;
export const OEM_FAULT_DIAGNOSIS_SUMMARY_STEP_KEY = 'diagnosis';
export const OEM_DIAGNOSTIC_SAVE_STEP_KEY = 'review';

export type OemConfirmedFaultJourneyPhase =
  | 'fault_identified'
  | 'before_repair_checks'
  | 'diagnosis_summary'
  | 'review';

export interface OemJourneyStepKeys {
  oemTest: string;
  beforeRepairChecks: string;
  diagnosisSummary: string;
  diagnosticSave: string;
}

export function isOemConfirmedRepairPathActive(
  payload: {
    oemConfirmedRepairPathActive?: string | null;
    oemRepairDecisionPending?: string | null;
    procedureRuns?: Record<string, ProcedureRunState>;
  } | null | undefined,
): boolean {
  const procedureId = payload?.oemConfirmedRepairPathActive;
  if (!procedureId) return false;
  const run = payload?.procedureRuns?.[procedureId];
  return run?.status === 'completed'
    && procedureRunRequiresRepairAction(procedureId, run);
}

export function isOemRepairDecisionPending(
  payload: {
    oemRepairDecisionPending?: string | null;
    procedureRuns?: Record<string, ProcedureRunState>;
  } | null | undefined,
): boolean {
  const procedureId = payload?.oemRepairDecisionPending;
  if (!procedureId) return false;
  return payload?.procedureRuns?.[procedureId]?.status === 'completed';
}

export function isOemConfirmedFaultJourneyActive(
  payload: {
    oemConfirmedRepairPathActive?: string | null;
    oemRepairDecisionPending?: string | null;
    procedureRuns?: Record<string, ProcedureRunState>;
  } | null | undefined,
): boolean {
  return isOemRepairDecisionPending(payload) || isOemConfirmedRepairPathActive(payload);
}

export function resolveOemConfirmedFaultJourneyPhase(
  payload: {
    oemConfirmedRepairPathActive?: string | null;
    oemRepairDecisionPending?: string | null;
    currentStepKey?: string | null;
    procedureRuns?: Record<string, ProcedureRunState>;
  } | null | undefined,
  stepKeys: OemJourneyStepKeys,
  currentStepKey?: string | null,
): OemConfirmedFaultJourneyPhase | null {
  if (!isOemConfirmedFaultJourneyActive(payload)) return null;
  const stepKey = currentStepKey || payload?.currentStepKey || null;
  if (!stepKey) return 'fault_identified';

  if (isOemRepairDecisionPending(payload) && stepKey === stepKeys.oemTest) {
    return 'fault_identified';
  }
  if (!isOemConfirmedRepairPathActive(payload)) {
    return 'fault_identified';
  }
  if (stepKey === stepKeys.beforeRepairChecks) return 'before_repair_checks';
  if (stepKey === stepKeys.diagnosisSummary) return 'diagnosis_summary';
  if (stepKey === stepKeys.diagnosticSave) return 'review';
  return 'fault_identified';
}

export function expandVisitedKeysForConfirmedFaultJourney(
  priorVisited: string[],
  targetStepKey: string,
  stepKeys: OemJourneyStepKeys,
): string[] {
  const next = new Set(priorVisited);
  next.add('complaint');
  next.add(stepKeys.oemTest);
  next.add(stepKeys.beforeRepairChecks);
  next.add(stepKeys.diagnosisSummary);
  if (targetStepKey === stepKeys.diagnosticSave) {
    next.add(stepKeys.diagnosticSave);
  }
  next.add(targetStepKey);
  return [...next];
}

export function shouldSuppressGenericWizardRecommendation(
  payload: {
    oemConfirmedRepairPathActive?: string | null;
    oemRepairDecisionPending?: string | null;
    oemDiagnosticTreeExhausted?: boolean;
    procedureRuns?: Record<string, ProcedureRunState>;
  } | null | undefined,
  currentStepKey?: string | null,
): boolean {
  if (isOemConfirmedFaultJourneyActive(payload)) {
    return true;
  }
  if (payload?.oemDiagnosticTreeExhausted && currentStepKey === 'oem_test') {
    return true;
  }
  return false;
}

export type OemJourneyNextAction =
  | { type: 'before_repair_checks' }
  | { type: 'diagnosis_summary' }
  | { type: 'diagnostic_save' }
  | { type: 'hold_oem_conclusion' };

export function resolveOemJourneyNextAction(
  payload: {
    oemConfirmedRepairPathActive?: string | null;
    oemRepairDecisionPending?: string | null;
    oemDiagnosticTreeExhausted?: boolean;
    currentStepKey?: string | null;
    procedureRuns?: Record<string, ProcedureRunState>;
  } | null | undefined,
  stepKeys: OemJourneyStepKeys,
  currentStepKey?: string | null,
): OemJourneyNextAction | null {
  const stepKey = currentStepKey || payload?.currentStepKey || null;

  if (isOemRepairDecisionPending(payload) && stepKey === stepKeys.oemTest) {
    return { type: 'before_repair_checks' };
  }

  if (isOemConfirmedRepairPathActive(payload)) {
    if (stepKey === stepKeys.oemTest) {
      return { type: 'before_repair_checks' };
    }
    if (stepKey === stepKeys.beforeRepairChecks) {
      return { type: 'diagnosis_summary' };
    }
    if (stepKey === stepKeys.diagnosisSummary) {
      return { type: 'diagnostic_save' };
    }
  }

  if (payload?.oemDiagnosticTreeExhausted && stepKey === stepKeys.oemTest) {
    return { type: 'hold_oem_conclusion' };
  }

  return null;
}

export function resolveOemJourneyPrimaryButtonLabel(
  phase: OemConfirmedFaultJourneyPhase | null,
): string | null {
  if (!phase) return null;
  if (phase === 'fault_identified') return 'Before repair checks';
  if (phase === 'before_repair_checks') return 'Diagnosis summary';
  if (phase === 'diagnosis_summary') return 'Review & save';
  return null;
}
