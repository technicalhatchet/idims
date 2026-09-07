import { getMeasurementKnowledge } from '../knowledge/knowledgeRegistry';
import { evaluateMeasurement } from '../knowledge/measurementRulesEngine';
import type { MeasurementEvaluation } from '../knowledge/types';
import type { BranchCondition, BranchConditionKind, DecisionBranch } from './types';

function isOpenCircuitEvaluation(evaluation: MeasurementEvaluation): boolean {
  if (evaluation.status !== 'critical' && evaluation.status !== 'warning') {
    return false;
  }
  const raw = String(evaluation.rawValue ?? '').trim().toUpperCase();
  if (raw === 'OL' || raw === 'O.L.' || raw === 'OPEN') {
    return true;
  }
  return /open/i.test(evaluation.message);
}

export function evaluateProcedureMeasurement(
  measurementKnowledgeId: string | null | undefined,
  rawValue: unknown,
): MeasurementEvaluation | null {
  const definition = getMeasurementKnowledge(measurementKnowledgeId);
  return evaluateMeasurement(definition, rawValue);
}

function matchesBranchCondition(
  condition: BranchCondition,
  evaluation: MeasurementEvaluation | null | undefined,
  checkpointValue?: string,
): boolean {
  switch (condition.kind) {
    case 'measurement_normal':
      return evaluation?.status === 'normal';
    case 'measurement_warning':
      return evaluation?.status === 'warning';
    case 'measurement_critical':
      return evaluation?.status === 'critical' && !isOpenCircuitEvaluation(evaluation);
    case 'measurement_open':
      return Boolean(evaluation && isOpenCircuitEvaluation(evaluation));
    case 'checkpoint_yes':
      return isAffirmativeCheckpoint(checkpointValue);
    case 'checkpoint_no':
      return isNegativeCheckpoint(checkpointValue);
    default:
      return false;
  }
}

function isAffirmativeCheckpoint(value?: string): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['yes', 'y', 'true', 'pass', 'ok', 'free'].includes(normalized);
}

function isNegativeCheckpoint(value?: string): boolean {
  const normalized = String(value ?? '').trim().toLowerCase();
  return ['no', 'n', 'false', 'fail', 'locked', 'stuck'].includes(normalized);
}

export function matchProcedureBranch(
  branches: DecisionBranch[] | undefined,
  evaluation: MeasurementEvaluation | null | undefined,
  checkpointValue?: string,
): DecisionBranch | null {
  if (!branches?.length) return null;

  for (const branch of branches) {
    if (matchesBranchCondition(branch.when, evaluation, checkpointValue)) {
      return branch;
    }
  }

  return null;
}

export function branchConditionKindForEvaluation(
  evaluation: MeasurementEvaluation,
): BranchConditionKind {
  if (isOpenCircuitEvaluation(evaluation)) {
    return 'measurement_open';
  }
  if (evaluation.status === 'normal') return 'measurement_normal';
  if (evaluation.status === 'warning') return 'measurement_warning';
  return 'measurement_critical';
}
