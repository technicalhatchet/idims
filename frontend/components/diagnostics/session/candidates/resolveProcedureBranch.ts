import { getProcedureStep } from '../../procedures/procedureRunner';
import { getServiceProcedure } from '../../procedures/procedureRegistry';
import type { DecisionBranch } from '../../procedures/types';
import { resolveBranchExtensionOverride } from '../branchExtensionRegistry';

export function resolveProcedureDecisionBranch(
  procedureId: string,
  stepId: string,
  branchId: string,
): DecisionBranch | null {
  const override = resolveBranchExtensionOverride(procedureId, stepId, branchId);
  const procedure = getServiceProcedure(procedureId);
  const step = procedure ? getProcedureStep(procedure, stepId) : null;
  const seedBranch = step?.branches?.find((branch) => branch.id === branchId) ?? null;

  if (!seedBranch && !override) return null;
  if (!seedBranch) {
    return {
      id: branchId,
      label: branchId,
      when: { kind: 'checkpoint_yes' },
      ...override,
    };
  }
  if (!override) return seedBranch;

  return {
    ...seedBranch,
    ...override,
    nextTestCandidates: override.nextTestCandidates ?? seedBranch.nextTestCandidates,
    deprioritize: override.deprioritize ?? seedBranch.deprioritize,
    deprioritizeDomains: override.deprioritizeDomains ?? seedBranch.deprioritizeDomains,
  };
}
