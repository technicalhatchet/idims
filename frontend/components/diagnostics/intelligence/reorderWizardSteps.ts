import type { ResolvedDiagnosticWizardStep } from '../types';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../shared/createWizardDefinitionFromTemplate';

/**
 * Boost recommended wizard steps among unvisited steps only.
 * Visited steps keep their original position so typing does not shuffle completed work.
 *
 * Not used in live wizard navigation — physical reorder scrambled visible step order
 * when routing hides steps and broke Previous. Recommendations use progress highlights
 * and WizardSuggestedStep jump instead.
 */
export function reorderWizardStepsForIntelligence(
  steps: ResolvedDiagnosticWizardStep[],
  recommendedStepKeys: string[] | undefined,
  visitedStepKeys: string[] = [],
): ResolvedDiagnosticWizardStep[] {
  if (!recommendedStepKeys?.length) return steps;

  const visited = new Set(visitedStepKeys);
  const reviewIndex = steps.findIndex((s) => s.id === DIAGNOSTIC_REVIEW_STEP_ID);
  const review = reviewIndex >= 0 ? steps[reviewIndex] : null;
  const body = steps.filter((s) => s.id !== DIAGNOSTIC_REVIEW_STEP_ID);

  const pinned = body.filter((s) => {
    const key = s.meta?.stepKey || '';
    return key === 'complaint' || key === 'commonly_missed';
  });
  const movable = body.filter((s) => {
    const key = s.meta?.stepKey || '';
    return key !== 'complaint' && key !== 'commonly_missed';
  });

  const priority = new Map(recommendedStepKeys.map((key, index) => [key, index]));

  const unvisited = movable.filter((s) => !visited.has(s.meta?.stepKey || ''));
  const sortedUnvisited = [...unvisited].sort((a, b) => {
    const ka = a.meta?.stepKey || '';
    const kb = b.meta?.stepKey || '';
    const pa = priority.has(ka) ? priority.get(ka)! : 999;
    const pb = priority.has(kb) ? priority.get(kb)! : 999;
    if (pa !== pb) return pa - pb;
    return movable.indexOf(a) - movable.indexOf(b);
  });

  let unvisitedIndex = 0;
  const merged = movable.map((step) => {
    const key = step.meta?.stepKey || '';
    if (visited.has(key)) return step;
    const next = sortedUnvisited[unvisitedIndex];
    unvisitedIndex += 1;
    return next;
  });

  const result = [...pinned, ...merged];
  return review ? [...result, review] : result;
}

export function extractDefaultStepOrder(steps: ResolvedDiagnosticWizardStep[]): string[] {
  return steps
    .map((s) => s.meta?.stepKey)
    .filter((key): key is string => Boolean(key));
}
