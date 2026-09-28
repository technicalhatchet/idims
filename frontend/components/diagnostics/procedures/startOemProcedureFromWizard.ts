import { createProcedureRun } from './procedureRunner';
import { getServiceProcedure } from './procedureRegistry';
import type { ProcedureRunState } from './types';

/**
 * Idempotent OEM start: ensures an in_progress run exists before the runner mounts.
 */
export function buildOemProcedureStartPayload(
  payload: {
    procedureRuns?: Record<string, ProcedureRunState>;
    activeProcedureId?: string | null;
  },
  procedureId: string,
): {
  procedureRuns: Record<string, ProcedureRunState>;
  activeProcedureId: string;
} | null {
  const procedure = getServiceProcedure(procedureId);
  if (!procedure) return null;

  const currentRuns = payload.procedureRuns || {};
  const existing = currentRuns[procedureId];

  if (existing?.status === 'completed') {
    return null;
  }

  let nextRun = existing;
  if (!existing || existing.status !== 'in_progress') {
    nextRun = createProcedureRun(procedure);
  }

  return {
    procedureRuns: { ...currentRuns, [procedureId]: nextRun },
    activeProcedureId: procedureId,
  };
}
