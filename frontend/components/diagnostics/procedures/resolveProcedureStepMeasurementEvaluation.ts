import { evaluateProcedureMeasurement } from './evaluateProcedureMeasurement';
import { measurementEvaluationFromSnapshot } from './buildProcedureStepEvaluationSnapshot';
import type { MeasurementEvaluation } from '../knowledge/types';
import type { ProcedureRunState, ProcedureStep } from './types';

/** Prefer frozen step evaluation; fall back to live re-evaluation from raw input. */
export function resolveProcedureStepMeasurementEvaluation(
  runState: ProcedureRunState,
  step: ProcedureStep,
  stepId?: string,
): MeasurementEvaluation | null {
  const resolvedStepId = stepId || step.id;
  const stored = runState.stepEvaluations?.[resolvedStepId];
  if (stored) {
    return measurementEvaluationFromSnapshot(stored);
  }

  const input = runState.stepInputs[resolvedStepId];
  if (step.type !== 'measurement' || input?.kind !== 'measurement') {
    return null;
  }

  return evaluateProcedureMeasurement(step.measurementKnowledgeId, input.value);
}
