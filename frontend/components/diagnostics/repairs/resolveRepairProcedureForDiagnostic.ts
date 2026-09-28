import { resolveIntegratedPrimaryDiagnosticConclusion } from '../procedures/integratedProcedureDiagnosticConclusions';
import { getServiceProcedure } from '../procedures/procedureRegistry';
import type { ProcedureRunState } from '../procedures/types';
import { getRepairProcedure } from './repairRegistry';
import type { RepairProcedure } from './types';

const W8178558_DRAIN_PUMP_REPAIR_ID = 'w8178558-repair-drain-pump';

/**
 * Maps a completed diagnostic OEM run to a physical repair procedure.
 * Does not reinterpret diagnostic evidence — only reads integrated primary conclusion.
 */
export function resolveRepairProcedureForDiagnosticRun(
  diagnosticProcedureId: string,
  runState: ProcedureRunState,
): RepairProcedure | null {
  const diagnosticProcedure = getServiceProcedure(diagnosticProcedureId);
  if (!diagnosticProcedure || runState.status !== 'completed') {
    return null;
  }

  const primary = resolveIntegratedPrimaryDiagnosticConclusion(runState, diagnosticProcedure);
  if (!primary || primary.anchorComponentId !== 'drain_pump') {
    return null;
  }

  if (diagnosticProcedureId !== 'w8178558-drain-pump') {
    return null;
  }

  if (primary.kind === 'external_path_fault' || primary.kind === 'component_failed') {
    return getRepairProcedure(W8178558_DRAIN_PUMP_REPAIR_ID);
  }

  return null;
}

export function resolveRepairProcedureIdForDiagnosticRun(
  diagnosticProcedureId: string,
  runState: ProcedureRunState,
): string | null {
  return resolveRepairProcedureForDiagnosticRun(diagnosticProcedureId, runState)?.id ?? null;
}
