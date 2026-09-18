import type { DiagnosticSession } from '../types';
import { resolveMeasurementEffectRule } from '../measurementEffectRegistry';
import {
  applyBranchExtensionToAdjustments,
  type BranchCandidateAdjustments,
} from './branchEffects';
import type { DecisionBranch } from '../../procedures/types';

export interface MeasurementCandidateAdjustments extends BranchCandidateAdjustments {
  evaluationCount: number;
}

export function deriveMeasurementCandidateAdjustments(
  session: DiagnosticSession,
): MeasurementCandidateAdjustments {
  const boosts = new Map<string, number>();
  const penalties = new Map<string, number>();
  let evaluationCount = 0;
  const templateId = session.payload.templateId;

  for (const runState of Object.values(session.payload.procedureRuns || {})) {
    if (!runState?.stepEvaluations) continue;

    for (const snapshot of Object.values(runState.stepEvaluations)) {
      const rule = resolveMeasurementEffectRule(
        snapshot.knowledgeId,
        snapshot.evaluation.status,
      );
      if (!rule) continue;

      evaluationCount += 1;
      const pseudoBranch: DecisionBranch = {
        id: `measurement:${snapshot.knowledgeId}:${snapshot.evaluation.status}`,
        label: snapshot.evaluation.message,
        when: { kind: 'measurement_critical' },
        ...rule,
      };
      applyBranchExtensionToAdjustments(pseudoBranch, templateId, boosts, penalties);
    }
  }

  return {
    boosts,
    penalties,
    resolvedBranchCount: 0,
    evaluationCount,
  };
}
