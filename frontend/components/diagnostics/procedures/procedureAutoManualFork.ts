import { getServiceProcedure } from './procedureRegistry';
import type { ProcedureStep, ServiceProcedure } from './types';

export type ProcedureAutoManualFork = {
  choiceStepId: string;
  automatedBranchId: string;
  manualBranchId: string;
  automatedLabel: string;
  manualLabel: string;
};

const AUTOMATED_PATTERN = /\bautomated\b/i;
const MANUAL_PATTERN = /\bmanual\b/i;

/**
 * Detects a structured auto vs manual fork only when the seed exposes an explicit
 * decision step with two branches clearly labeled automated vs manual.
 * Sequential "electrical then manual test" flows do not qualify.
 */
export function detectProcedureAutoManualFork(
  procedure: ServiceProcedure | null | undefined,
): ProcedureAutoManualFork | null {
  if (!procedure?.steps?.length) return null;

  for (const step of procedure.steps) {
    if (!step.branches || step.branches.length !== 2) continue;

    const automated = step.branches.find(
      (branch) => AUTOMATED_PATTERN.test(branch.label || '')
        || AUTOMATED_PATTERN.test(branch.nextStepId || ''),
    );
    const manual = step.branches.find(
      (branch) => MANUAL_PATTERN.test(branch.label || '')
        || MANUAL_PATTERN.test(branch.nextStepId || ''),
    );

    if (automated && manual && automated.id !== manual.id) {
      return {
        choiceStepId: step.id,
        automatedBranchId: automated.id,
        manualBranchId: manual.id,
        automatedLabel: automated.label || 'Run automated diagnostic',
        manualLabel: manual.label || 'Run manual component test',
      };
    }
  }

  return null;
}

export function detectProcedureAutoManualForkById(
  procedureId: string | null | undefined,
): ProcedureAutoManualFork | null {
  if (!procedureId) return null;
  return detectProcedureAutoManualFork(getServiceProcedure(procedureId));
}

export function filterProcedureStepsForAutoManualPath(
  procedure: ServiceProcedure,
  selected: 'automated' | 'manual',
  fork: ProcedureAutoManualFork,
): ProcedureStep[] {
  const branchId = selected === 'automated'
    ? fork.automatedBranchId
    : fork.manualBranchId;
  const branch = procedure.steps
    .find((step) => step.id === fork.choiceStepId)
    ?.branches?.find((item) => item.id === branchId);
  if (!branch?.nextStepId) return procedure.steps;

  const reachable = new Set<string>();
  const walk = (stepId: string) => {
    if (!stepId || reachable.has(stepId)) return;
    reachable.add(stepId);
    const step = procedure.steps.find((item) => item.id === stepId);
    if (!step) return;
    if (step.defaultNextStepId) walk(step.defaultNextStepId);
    step.branches?.forEach((item) => {
      if (item.nextStepId) walk(item.nextStepId);
    });
  };

  procedure.steps.forEach((step) => {
    if (step.order < (procedure.steps.find((s) => s.id === fork.choiceStepId)?.order ?? 0)) {
      reachable.add(step.id);
    }
  });
  walk(branch.nextStepId);

  return procedure.steps.filter((step) => reachable.has(step.id));
}
