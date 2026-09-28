import { getServiceProcedure } from './procedureRegistry';
import type { DecisionBranch, ProcedureRunState, ServiceProcedure } from './types';

function resolveVerifiedOutcomeStepId(procedure: ServiceProcedure): string {
  const verifiedOutcome = procedure.steps.find(
    (step) => step.type === 'outcome' && /verified/i.test(step.title),
  );
  if (verifiedOutcome) return verifiedOutcome.id;

  const neutralOutcome = procedure.steps.find(
    (step) => step.type === 'outcome' && !/^replace_|^suspect_/i.test(step.id),
  );
  return neutralOutcome?.id || 'user_verified_outcome';
}

function findVerifiedSuccessPath(procedure: ServiceProcedure): {
  interactiveStepId: string;
  branch: DecisionBranch;
  outcomeStepId: string;
} | null {
  for (const step of procedure.steps) {
    if (!step.branches?.length) continue;
    for (const branch of step.branches) {
      if (!branch.nextStepId) continue;
      const outcome = procedure.steps.find((item) => item.id === branch.nextStepId);
      if (outcome?.type !== 'outcome') continue;
      if (!/verified/i.test(outcome.title) && !/verified$/i.test(outcome.id)) continue;
      if (/^replace_|^suspect_/i.test(outcome.id)) continue;
      if (branch.when?.kind === 'checkpoint_no') continue;
      return {
        interactiveStepId: step.id,
        branch,
        outcomeStepId: outcome.id,
      };
    }
  }
  return null;
}

/** Marks an OEM procedure as successfully completed when the tech/DIY user already verified it. */
export function buildUserVerifiedProcedureRunState(procedureId: string): ProcedureRunState | null {
  const procedure = getServiceProcedure(procedureId);
  if (!procedure) return null;

  const now = new Date().toISOString();
  const successPath = findVerifiedSuccessPath(procedure);

  if (successPath) {
    const { interactiveStepId, branch, outcomeStepId } = successPath;
    const effects = branch.diagnosticEffects || [];
    return {
      procedureId,
      version: procedure.version,
      startedAt: now,
      currentStepId: outcomeStepId,
      completedStepIds: [interactiveStepId, outcomeStepId],
      stepInputs: {
        [interactiveStepId]: { kind: 'checkpoint', value: 'yes' },
      },
      status: 'completed',
      appliedDiagnosticEffects: effects.length
        ? [{
          stepId: interactiveStepId,
          branchId: branch.id,
          at: now,
          effects,
        }]
        : undefined,
      resolvedBranchEvents: [{
        stepId: interactiveStepId,
        branchId: branch.id,
        at: now,
      }],
    };
  }

  const outcomeStepId = resolveVerifiedOutcomeStepId(procedure);
  return {
    procedureId,
    version: procedure.version,
    startedAt: now,
    currentStepId: outcomeStepId,
    completedStepIds: [outcomeStepId],
    stepInputs: {},
    status: 'completed',
  };
}
