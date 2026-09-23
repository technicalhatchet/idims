import type { ComponentEvidenceState } from './evidenceTypes';
import type { DiagnosticEffect, ProcedureRunState, ServiceProcedure } from '../procedures/types';
import { getProcedureStep } from '../procedures/procedureRunner';

export type ComponentVerificationLevel =
  | 'unknown'
  | 'supported'
  | 'verified_good'
  | 'verified_failed';

export const SOFT_CONFIRM_EVIDENCE_BOOST = 72;

export interface ProcedureConfirmContext {
  runState: ProcedureRunState;
  stepId: string;
  branchId?: string;
  procedure?: ServiceProcedure | null;
}

export function isExplicitFailureEvidenceId(evidenceId?: string | null): boolean {
  if (!evidenceId) return false;
  return /_(failed|fault|open)(_|$)/i.test(evidenceId);
}

function isNegativeCheckpointValue(value?: string): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['no', 'n', 'false', 'fail', 'locked', 'stuck'].includes(normalized);
}

function isAbnormalMeasurementSnapshot(
  runState: ProcedureRunState,
  stepId: string,
): boolean {
  const snapshot = runState.stepEvaluations?.[stepId];
  if (!snapshot) return false;
  return snapshot.evaluation.status === 'critical' || snapshot.evaluation.status === 'warning';
}

/**
 * Procedure `confirm` is only treated as verified_failed when an explicit failure rule applies.
 * Otherwise confirm means supported / under investigation — not auto-condemnation.
 */
export function isExplicitProcedureFailureConfirm(
  effect: DiagnosticEffect,
  context?: ProcedureConfirmContext,
): boolean {
  if (effect.type !== 'confirm') return false;

  if (isExplicitFailureEvidenceId(effect.evidenceId)) {
    return true;
  }

  if (!context) return false;

  if (isAbnormalMeasurementSnapshot(context.runState, context.stepId)) {
    return true;
  }

  const input = context.runState.stepInputs[context.stepId];
  if (isNegativeCheckpointValue(input?.value)) {
    const step = context.procedure
      ? getProcedureStep(context.procedure, context.stepId)
      : null;
    const branch = step?.branches?.find((item) => item.id === context.branchId);
    if (branch?.when?.kind === 'checkpoint_no') {
      return true;
    }
  }

  return false;
}

export function getComponentVerificationLevel(
  state: ComponentEvidenceState,
): ComponentVerificationLevel {
  switch (state) {
    case 'eliminated':
      return 'verified_good';
    case 'confirmed':
      return 'verified_failed';
    case 'unlikely':
      return 'supported';
    default:
      return 'unknown';
  }
}

export function isVerifiedFailedState(state: ComponentEvidenceState): boolean {
  return getComponentVerificationLevel(state) === 'verified_failed';
}

export function collectExplicitFailureConfirms(
  procedure: ServiceProcedure | null | undefined,
  runState: ProcedureRunState,
): DiagnosticEffect[] {
  const confirms: DiagnosticEffect[] = [];
  for (const entry of runState.appliedDiagnosticEffects || []) {
    for (const effect of entry.effects) {
      if (effect.type !== 'confirm') continue;
      if (isExplicitProcedureFailureConfirm(effect, {
        runState,
        stepId: entry.stepId,
        branchId: entry.branchId,
        procedure,
      })) {
        confirms.push(effect);
      }
    }
  }
  return confirms;
}
