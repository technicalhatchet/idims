import type { DiagnosticWizardStepConfig, WizardDefinition } from '../types';
import type { PrerequisiteMap, PrerequisiteStatus } from './types';

function stepKeyForConfig(step: DiagnosticWizardStepConfig): string {
  return step.stepKey || step.sectionId;
}

/** Map routing stepKey → wizard step id (section id or review id). */
export function buildStepKeyToIdMap(
  definition: WizardDefinition,
  reviewStepId: string,
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const step of definition.defaultSteps) {
    map[stepKeyForConfig(step)] = step.id || step.sectionId;
  }
  const reviewKey = definition.routing?.reviewStepKey || 'review';
  map[reviewKey] = reviewStepId;
  return map;
}

function titleForStepKey(definition: WizardDefinition, stepKey: string): string {
  const reviewKey = definition.routing?.reviewStepKey || 'review';
  if (stepKey === reviewKey) {
    return definition.reviewStep?.title || 'Review & Save';
  }
  const step = definition.defaultSteps.find((s) => stepKeyForConfig(s) === stepKey);
  return step?.title || stepKey;
}

export function evaluatePrerequisites(
  definition: WizardDefinition | null | undefined,
  visitedStepIds: Set<string>,
  reviewStepId: string,
): Record<string, PrerequisiteStatus> {
  const prerequisites = definition?.routing?.prerequisites;
  if (!definition || !prerequisites) return {};

  const stepKeyToId = buildStepKeyToIdMap(definition, reviewStepId);
  const result: Record<string, PrerequisiteStatus> = {};

  for (const [stepKey, requiredKeys] of Object.entries(prerequisites)) {
    const missingStepKeys = (requiredKeys || []).filter((reqKey) => {
      const stepId = stepKeyToId[reqKey];
      return stepId && !visitedStepIds.has(stepId);
    });
    result[stepKey] = {
      met: missingStepKeys.length === 0,
      missingStepKeys,
      missingTitles: missingStepKeys.map((k) => titleForStepKey(definition, k)),
    };
  }

  return result;
}

export function getPrerequisiteStatus(
  stepKey: string,
  definition: WizardDefinition,
  visitedStepIds: Set<string>,
  reviewStepId: string,
): PrerequisiteStatus {
  const prerequisites = definition.routing?.prerequisites;
  if (!prerequisites?.[stepKey]?.length) {
    return { met: true, missingStepKeys: [], missingTitles: [] };
  }

  const stepKeyToId = buildStepKeyToIdMap(definition, reviewStepId);
  const missingStepKeys = prerequisites[stepKey].filter((reqKey) => {
    const stepId = stepKeyToId[reqKey];
    return stepId && !visitedStepIds.has(stepId);
  });

  return {
    met: missingStepKeys.length === 0,
    missingStepKeys,
    missingTitles: missingStepKeys.map((k) => titleForStepKey(definition, k)),
  };
}

export function arePrerequisitesMet(
  stepKey: string,
  prerequisites: PrerequisiteMap | undefined,
  visitedStepIds: Set<string>,
  stepKeyToId: Record<string, string>,
): PrerequisiteStatus {
  const required = prerequisites?.[stepKey];
  if (!required?.length) {
    return { met: true, missingStepKeys: [], missingTitles: [] };
  }

  const missingStepKeys = required.filter((reqKey) => {
    const stepId = stepKeyToId[reqKey];
    return stepId && !visitedStepIds.has(stepId);
  });

  return {
    met: missingStepKeys.length === 0,
    missingStepKeys,
    missingTitles: [],
  };
}

export function formatPrerequisiteLockMessage(missingTitles: string[]): string {
  if (!missingTitles.length) return 'Complete earlier steps first.';
  if (missingTitles.length === 1) {
    return `Complete "${missingTitles[0]}" first.`;
  }
  return `Complete these steps first: ${missingTitles.join(', ')}.`;
}
