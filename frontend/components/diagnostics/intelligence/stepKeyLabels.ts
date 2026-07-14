import type { WizardDefinition } from '../types';

/** Map routing step keys to human-readable wizard step titles. */
export function buildStepKeyLabels(
  definition: WizardDefinition | null | undefined,
): Record<string, string> {
  if (!definition) return {};

  const labels: Record<string, string> = {};
  for (const step of definition.defaultSteps || []) {
    const key = step.stepKey || step.sectionId;
    if (key) labels[key] = step.title || key;
  }

  const reviewKey = definition.routing?.reviewStepKey || 'review';
  if (definition.reviewStep?.title) {
    labels[reviewKey] = definition.reviewStep.title;
  }

  return labels;
}

export function resolveStepKeyLabel(
  stepKey: string | undefined,
  labels: Record<string, string> | undefined,
): string {
  if (!stepKey) return '';
  return labels?.[stepKey] || stepKey;
}
