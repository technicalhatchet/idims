import type {
  ProcedureRunState,
  ProcedureStepEvaluationSnapshot,
} from '../procedures/types';

export function appendStepEvaluation(
  runState: ProcedureRunState,
  stepId: string,
  snapshot: ProcedureStepEvaluationSnapshot,
): ProcedureRunState {
  return {
    ...runState,
    stepEvaluations: {
      ...(runState.stepEvaluations || {}),
      [stepId]: snapshot,
    },
  };
}
