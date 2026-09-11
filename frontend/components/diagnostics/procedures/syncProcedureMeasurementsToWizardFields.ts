import { findWizardFieldForKnowledgeId } from '../knowledge/resolveFieldKnowledge';
import type { MeasurementContext } from '../knowledge/types';
import { getServiceProcedure } from './procedureRegistry';
import { getProcedureStep } from './procedureRunner';
import type { ProcedureRunState } from './types';

/**
 * Copy completed OEM procedure measurements into matching wizard fields
 * (e.g. door lock solenoid Ω → mechanical_controls.door_lock_ohms).
 */
export function syncProcedureMeasurementsToWizardFields(
  templateId: string | null | undefined,
  procedureId: string,
  runState: ProcedureRunState | null | undefined,
  fields: Record<string, unknown> = {},
  measurementContext?: MeasurementContext | null,
): Record<string, unknown> {
  if (!templateId || !runState?.completedStepIds?.length) return fields;

  const procedure = getServiceProcedure(procedureId);
  if (!procedure) return fields;

  const next = { ...fields };
  let changed = false;

  for (const stepId of runState.completedStepIds) {
    const step = getProcedureStep(procedure, stepId);
    const input = runState.stepInputs?.[stepId];
    if (step?.type !== 'measurement' || !step.measurementKnowledgeId || !input?.value) {
      continue;
    }

    const fieldKey = findWizardFieldForKnowledgeId(
      templateId,
      step.measurementKnowledgeId,
      measurementContext,
    );
    if (!fieldKey) continue;

    const existing = next[fieldKey];
    if (existing !== undefined && existing !== null && existing !== '') {
      continue;
    }

    next[fieldKey] = input.value;
    changed = true;
  }

  return changed ? next : fields;
}
