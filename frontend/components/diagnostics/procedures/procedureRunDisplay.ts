import type { ProcedureRunState, ServiceProcedure } from './types';

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
  return `Step ${index}`;
}
