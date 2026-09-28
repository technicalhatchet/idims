import { collectExplicitFailureConfirms } from '../intelligence/componentVerification';
import { resolveIntegratedPrimaryDiagnosticConclusion } from '../procedures/integratedProcedureDiagnosticConclusions';
import { getServiceProcedure } from '../procedures/procedureRegistry';
import type { ProcedureRunState } from '../procedures/types';
import { getRepairProcedure } from './repairRegistry';
import type { RepairProcedure } from './types';

const W8178558_DRAIN_PUMP_REPAIR_ID = 'w8178558-repair-drain-pump';
const W8178558_WASH_HEATER_REPAIR_ID = 'w8178558-repair-wash-heater';

function explicitComponentFailureConfirm(
  diagnosticProcedureId: string,
  runState: ProcedureRunState,
  componentId: string,
): boolean {
  const procedure = getServiceProcedure(diagnosticProcedureId);
  if (!procedure) return false;
  return collectExplicitFailureConfirms(procedure, runState).some(
    (effect) => effect.componentId === componentId,
  );
}

/**
 * Maps a completed diagnostic OEM run to a physical repair procedure.
 * Does not reinterpret diagnostic evidence — only reads integrated primary conclusion
 * and explicit OEM failure confirms already used for repair headlines.
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

  if (diagnosticProcedureId === 'w8178558-drain-pump') {
    if (!primary || primary.anchorComponentId !== 'drain_pump') {
      return null;
    }
    if (primary.kind === 'external_path_fault' || primary.kind === 'component_failed') {
      return getRepairProcedure(W8178558_DRAIN_PUMP_REPAIR_ID);
    }
    return null;
  }

  if (diagnosticProcedureId === 'w8178558-wash-heater') {
    if (primary?.kind === 'external_path_fault' && primary.anchorComponentId === 'wash_heater') {
      return null;
    }
    const componentFailed =
      primary?.anchorComponentId === 'wash_heater' && primary.kind === 'component_failed';
    const explicitFailed = explicitComponentFailureConfirm(
      diagnosticProcedureId,
      runState,
      'wash_heater',
    );
    if (componentFailed || explicitFailed) {
      return getRepairProcedure(W8178558_WASH_HEATER_REPAIR_ID);
    }
    return null;
  }

  return null;
}

export function resolveRepairProcedureIdForDiagnosticRun(
  diagnosticProcedureId: string,
  runState: ProcedureRunState,
): string | null {
  return resolveRepairProcedureForDiagnosticRun(diagnosticProcedureId, runState)?.id ?? null;
}
