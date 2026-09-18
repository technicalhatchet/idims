import type { ProcedureRunState } from './types';

export interface WizardNavigationGate {
  blocked: boolean;
  message: string;
  onBlockedAttempt?: () => void;
}

export function isOemProcedureNavigationBlocked(
  activeProcedureId: string | null | undefined,
  procedureRuns: Record<string, ProcedureRunState> = {},
): boolean {
  if (!activeProcedureId) return false;
  const run = procedureRuns[activeProcedureId];
  if (!run) return true;
  return run.status === 'in_progress';
}

export const OEM_PROCEDURE_NAV_BLOCK_MESSAGE =
  'Finish the OEM test above before moving to another wizard step.';

export function buildOemProcedureNavigationGate(
  activeProcedureId: string | null | undefined,
  procedureRuns: Record<string, ProcedureRunState>,
  onBlockedAttempt?: () => void,
): WizardNavigationGate | null {
  if (!isOemProcedureNavigationBlocked(activeProcedureId, procedureRuns)) return null;
  return {
    blocked: true,
    message: OEM_PROCEDURE_NAV_BLOCK_MESSAGE,
    onBlockedAttempt,
  };
}
