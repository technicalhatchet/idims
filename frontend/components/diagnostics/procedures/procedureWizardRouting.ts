import { getServiceProcedure } from './procedureRegistry';
import {
  resolveOutcomeStepFromRun,
  resolveProcedureRepairHeadline,
  resolveProcedureRunDisposition,
} from './procedureRunPresentation';
import type { ProcedureRunState } from './types';

/** Wizard stepKey to open after an OEM procedure run finishes (success / continue paths only). */
export function resolveWizardStepAfterProcedureComplete(
  procedureId: string,
  runState: ProcedureRunState,
): string | null {
  if (procedureRunRequiresRepairAction(procedureId, runState)) {
    return null;
  }

  const procedure = getServiceProcedure(procedureId);
  const outcomeStepId = runState.currentStepId;
  const outcomeStep = procedure?.steps.find((step) => step.id === outcomeStepId);

  if (procedureId === 'w8178558-door-lock') {
    if (
      outcomeStepId === 'door_lock_path_verified'
      || outcomeStepId === 'door_lock_verified'
    ) {
      return 'mechanical';
    }
  }

  if (outcomeStep?.title?.toLowerCase().includes('verified')) {
    return 'mechanical';
  }

  return 'mechanical';
}

export function procedureRunRequiresRepairAction(
  procedureId: string,
  runState: ProcedureRunState,
): boolean {
  const procedure = getServiceProcedure(procedureId);
  return resolveProcedureRunDisposition(runState, procedure) === 'action_required';
}

export function shouldPrefillRootCauseFromProcedureComplete(
  procedureId: string,
  runState: ProcedureRunState,
): boolean {
  return procedureRunRequiresRepairAction(procedureId, runState);
}

export function buildDiagnosisPrefillFromProcedureComplete(
  procedureId: string,
  runState: ProcedureRunState,
): { rootCause: string; recommendedRepair: string } | null {
  const procedure = getServiceProcedure(procedureId);
  if (!procedure || !procedureRunRequiresRepairAction(procedureId, runState)) {
    return null;
  }

  const recommendedRepair = resolveProcedureRepairHeadline(procedure, runState)
    || 'Repair per OEM test results';
  const outcomeStep = resolveOutcomeStepFromRun(procedure, runState);
  const rootCause = runState.oemOutcome
    || outcomeStep?.oemOutcome
    || outcomeStep?.title
    || recommendedRepair;

  return { rootCause, recommendedRepair };
}

export function buildRootCauseFromProcedureComplete(
  procedureId: string,
  runState: ProcedureRunState,
  topCategoryLabel: string | undefined,
): string | null {
  const prefill = buildDiagnosisPrefillFromProcedureComplete(procedureId, runState);
  if (prefill?.rootCause) {
    return prefill.rootCause;
  }

  const procedure = getServiceProcedure(procedureId);
  const outcomeStep = procedure?.steps.find((step) => step.id === runState.currentStepId);
  const outcomeText = runState.oemOutcome || outcomeStep?.oemOutcome || outcomeStep?.title;

  if (outcomeText) {
    return outcomeText;
  }

  if (topCategoryLabel) {
    const procedureLabel = procedure?.title ? ` — ${procedure.title}` : '';
    return `${topCategoryLabel}${procedureLabel}`;
  }

  return null;
}
