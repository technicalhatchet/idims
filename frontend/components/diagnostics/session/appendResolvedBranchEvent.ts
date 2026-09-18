import type { ProcedureRunState, ResolvedProcedureBranchEvent } from '../procedures/types';

export function appendResolvedBranchEvent(
  runState: ProcedureRunState,
  stepId: string,
  branchId: string,
): ProcedureRunState {
  const events = runState.resolvedBranchEvents || [];
  const exists = events.some(
    (event) => event.stepId === stepId && event.branchId === branchId,
  );
  if (exists) return runState;

  const entry: ResolvedProcedureBranchEvent = {
    stepId,
    branchId,
    at: new Date().toISOString(),
  };

  return {
    ...runState,
    resolvedBranchEvents: [...events, entry],
  };
}
