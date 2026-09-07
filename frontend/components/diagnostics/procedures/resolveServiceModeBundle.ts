import {
  getServiceModeKindsForRefs,
  listServiceModeBundles,
  normalizeServiceModeRefs,
} from './serviceModeCatalog';
import type {
  DecisionBranch,
  ProcedureStep,
  ServiceModeBundle,
  ServiceModeRef,
  ServiceProcedure,
  ServiceProcedureSeed,
} from './types';

export const SERVICE_MODE_CONTINUE_TOKEN = '@continue';

function cloneStep(step: ProcedureStep): ProcedureStep {
  return JSON.parse(JSON.stringify(step)) as ProcedureStep;
}

function resolveContinueToken(
  step: ProcedureStep,
  continueToStepId: string,
): ProcedureStep {
  const resolved = cloneStep(step);

  if (resolved.defaultNextStepId === SERVICE_MODE_CONTINUE_TOKEN) {
    resolved.defaultNextStepId = continueToStepId;
  }

  if (resolved.branches?.length) {
    resolved.branches = resolved.branches.map((branch) =>
      resolveBranchContinueToken(branch, continueToStepId),
    );
  }

  return resolved;
}

function resolveBranchContinueToken(
  branch: DecisionBranch,
  continueToStepId: string,
): DecisionBranch {
  if (branch.nextStepId !== SERVICE_MODE_CONTINUE_TOKEN) {
    return branch;
  }
  return { ...branch, nextStepId: continueToStepId };
}

function renumberSteps(steps: ProcedureStep[]): ProcedureStep[] {
  const sorted = [...steps].sort((a, b) => a.order - b.order);
  return sorted.map((step, index) => ({
    ...step,
    order: index + 1,
  }));
}

function assertBundleMatchesRef(bundle: ServiceModeBundle, ref: ServiceModeRef): void {
  if (ref.modeKind && bundle.modeKind !== ref.modeKind) {
    throw new Error(
      `Bundle '${bundle.id}' modeKind '${bundle.modeKind}' does not match ref modeKind '${ref.modeKind}'`,
    );
  }
}

export function injectServiceModeBundle(
  steps: ProcedureStep[],
  bundle: ServiceModeBundle,
  ref: ServiceModeRef,
): ProcedureStep[] {
  const anchorIndex = steps.findIndex((step) => step.id === ref.attachAfterStepId);
  if (anchorIndex < 0) {
    throw new Error(
      `Procedure serviceMode.attachAfterStepId '${ref.attachAfterStepId}' not found in steps`,
    );
  }

  const continueExists = steps.some((step) => step.id === ref.continueToStepId);
  if (!continueExists) {
    throw new Error(
      `Procedure serviceMode.continueToStepId '${ref.continueToStepId}' not found in steps`,
    );
  }

  assertBundleMatchesRef(bundle, ref);

  const bundleSteps = bundle.steps.map((step) =>
    resolveContinueToken(step, ref.continueToStepId),
  );

  const nextSteps = steps.map((step, index) => {
    if (index !== anchorIndex) return step;
    return {
      ...step,
      defaultNextStepId: bundle.entryStepId,
    };
  });

  const insertAt = anchorIndex + 1;
  const merged = [
    ...nextSteps.slice(0, insertAt),
    ...bundleSteps,
    ...nextSteps.slice(insertAt),
  ];

  return renumberSteps(merged);
}

export function resolveServiceProcedureSeed(
  seed: ServiceProcedureSeed,
  bundleById: Map<string, ServiceModeBundle>,
): ServiceProcedure {
  let steps = [...seed.steps];
  const serviceModeRefs = normalizeServiceModeRefs(seed);

  for (const ref of serviceModeRefs) {
    const bundle = bundleById.get(ref.bundleId);
    if (!bundle) {
      throw new Error(`Unknown serviceMode.bundleId '${ref.bundleId}'`);
    }
    steps = injectServiceModeBundle(steps, bundle, ref);
  }

  const { serviceMode, serviceModes, ...procedure } = seed;
  return {
    ...procedure,
    steps: renumberSteps(steps),
    serviceModePlan: serviceModeRefs.length ? serviceModeRefs : undefined,
  };
}

export { getServiceModeKindsForRefs, normalizeServiceModeRefs };
