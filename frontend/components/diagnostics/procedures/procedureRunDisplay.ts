import type { ProcedureRunState, ServiceProcedure, ProcedureStep } from './types';
import {
  formatProcedureStepProgressLabel,
  resolveProcedureStepPresentationRole,
} from './procedureStepPresentationRole';

/** 1-based position in the path the tech actually walked (not seed `order`). */
export function resolveProcedurePathStepIndex(
  runState: ProcedureRunState | null | undefined,
): number {
  if (!runState) return 0;
  return runState.completedStepIds.length + 1;
}

export function resolveProcedurePathStepLabel(
  procedure: ServiceProcedure | null | undefined,
  runState: ProcedureRunState | null | undefined,
): string | null {
  const index = resolveProcedurePathStepIndex(runState);
  if (!index || !procedure) return null;
  return formatOemProcedureStepProgressLabel(index, resolveProcedureInteractiveStepTotal(procedure));
}

/** Count of non-outcome steps in the seed (upper bound for "of N" labeling). */
export function resolveProcedureInteractiveStepTotal(
  procedure: ServiceProcedure | null | undefined,
): number {
  if (!procedure?.steps?.length) return 0;
  return procedure.steps.filter((step) => step.type !== 'outcome').length;
}

export function formatOemProcedureStepProgressLabel(
  stepIndex: number,
  stepTotal?: number,
  procedure?: ServiceProcedure | null,
  currentStep?: ProcedureStep | null,
): string | null {
  if (stepIndex <= 0) return null;
  const total = stepTotal && stepTotal > 0 ? stepTotal : 0;
  const role = procedure && currentStep
    ? resolveProcedureStepPresentationRole(procedure, currentStep)
    : 'instruction';
  return formatProcedureStepProgressLabel(stepIndex, total, role);
}
