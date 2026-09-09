import { isStepKeyEnabled } from '../diagnostics/routing/routingEngine';
import { buildStepKeyToIdMap } from '../diagnostics/routing/prerequisiteEngine';
import type { RoutingEvaluationResult } from '../diagnostics/routing/types';
import type { WizardDefinition } from '../diagnostics/types';

type StepMeta = { stepKey?: string };

export type WizardStepLike = {
  id?: string;
  meta?: unknown;
};

export type WizardIntelContext = {
  intelligence?: {
    recommendedStepKeys?: string[];
    stepKeyLabels?: Record<string, string>;
  };
  visitedStepKeys?: string[];
  wizardDefinition?: WizardDefinition | null;
  reviewStepId?: string;
  routing?: RoutingEvaluationResult | null;
};

function indexForStepKey(visibleSteps: WizardStepLike[], stepKey: string): number {
  return visibleSteps.findIndex(
    (step) => (step.meta as StepMeta | undefined)?.stepKey === stepKey,
  );
}

function activePrerequisiteKeys(
  definition: WizardDefinition,
  stepKey: string,
  routing: WizardIntelContext['routing'],
): string[] {
  const required = definition.routing?.prerequisites?.[stepKey] || [];
  return required.filter((reqKey) => isStepKeyEnabled(routing, reqKey));
}

/**
 * Resolves intelligence-recommended wizard step to a visible index,
 * honoring routing-disabled prerequisites (same rules as guided Next).
 */
export function resolveRecommendedWizardStepIndex(
  visibleSteps: WizardStepLike[],
  context: WizardIntelContext,
  visitedStepIds: Set<string>,
  currentStepIndex: number,
): number {
  const visitedStepKeys = context?.visitedStepKeys || [];
  const wizardDefinition = context?.wizardDefinition;
  const reviewStepId = context?.reviewStepId || 'diagnostic_review';
  const recommendedKeys = context?.intelligence?.recommendedStepKeys || [];
  const currentKey = (visibleSteps[currentStepIndex]?.meta as StepMeta | undefined)?.stepKey;

  if (!wizardDefinition || !recommendedKeys.length) return -1;

  const stepKeyToId = buildStepKeyToIdMap(wizardDefinition, reviewStepId);

  for (const targetKey of recommendedKeys) {
    if (!targetKey || visitedStepKeys.includes(targetKey)) continue;

    const targetIndex = indexForStepKey(visibleSteps, targetKey);
    if (targetIndex < 0) continue;

    const activeRequired = activePrerequisiteKeys(wizardDefinition, targetKey, context.routing);
    const missingKeys = activeRequired.filter((reqKey) => {
      const stepId = stepKeyToId[reqKey];
      return stepId && !visitedStepIds.has(stepId);
    });

    if (missingKeys.length) {
      const missingIndex = indexForStepKey(visibleSteps, missingKeys[0]);
      if (missingIndex >= 0) return missingIndex;
      continue;
    }

    if (targetKey !== currentKey) return targetIndex;
  }

  return -1;
}
