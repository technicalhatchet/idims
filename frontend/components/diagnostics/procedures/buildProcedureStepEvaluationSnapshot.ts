import { getMeasurementKnowledge } from '../knowledge/knowledgeRegistry';
import { formatRangeLabel } from '../knowledge/measurementRulesEngine';
import type { MeasurementEvaluation } from '../knowledge/types';
import type {
  ProcedureStepEvaluationExpectedRange,
  ProcedureStepEvaluationSnapshot,
} from './types';

function snapshotExpectedRange(
  knowledgeId: string,
  evaluation: MeasurementEvaluation,
): ProcedureStepEvaluationExpectedRange | undefined {
  const definition = getMeasurementKnowledge(knowledgeId);
  const normal = definition?.ranges?.normal;
  if (!normal) return undefined;

  const unit = evaluation.displayUnit || definition?.unit || '';
  const label = evaluation.expectedRangeLabel || formatRangeLabel(normal, unit) || undefined;
  return {
    min: normal.min,
    max: normal.max,
    below: normal.below,
    above: normal.above,
    unit,
    label,
  };
}

export function buildProcedureStepEvaluationSnapshot(
  knowledgeId: string,
  evaluation: MeasurementEvaluation,
  context?: Record<string, unknown>,
): ProcedureStepEvaluationSnapshot {
  const expected = snapshotExpectedRange(knowledgeId, evaluation);
  const snapshot: ProcedureStepEvaluationSnapshot = {
    knowledgeId,
    rawInput: evaluation.rawValue,
    parsedValue: evaluation.parsedValue,
    unit: evaluation.displayUnit,
    evaluation: {
      status: evaluation.status,
      message: evaluation.message,
      diagnosisLabel: evaluation.diagnosisLabel,
      severityLabel: evaluation.severityLabel,
      expectedRangeLabel: evaluation.expectedRangeLabel,
      expected,
    },
    evaluatedAt: new Date().toISOString(),
  };

  if (context && Object.keys(context).length > 0) {
    snapshot.context = context;
  }

  return snapshot;
}

export function measurementEvaluationFromSnapshot(
  snapshot: ProcedureStepEvaluationSnapshot,
): MeasurementEvaluation {
  return {
    knowledgeId: snapshot.knowledgeId,
    status: snapshot.evaluation.status,
    message: snapshot.evaluation.message,
    diagnosisLabel: snapshot.evaluation.diagnosisLabel,
    severityLabel: snapshot.evaluation.severityLabel,
    expectedRangeLabel: snapshot.evaluation.expectedRangeLabel,
    confidence: 'high',
    parsedValue: snapshot.parsedValue,
    rawValue: snapshot.rawInput,
    displayUnit: snapshot.unit,
  };
}
