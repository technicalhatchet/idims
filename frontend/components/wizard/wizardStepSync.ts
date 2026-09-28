import type { WizardStepDefinition } from './types';

/**
 * Keep the wizard on the active step id when the visible route changes (OEM inject, rerank).
 * Does not fall back to payload currentStepKey — that caused index/header desync on back navigation.
 */
export function resolveStepIndexForActiveId<TContext>(
  visibleSteps: WizardStepDefinition<TContext>[],
  activeStepId: string | undefined,
  currentIndex: number,
): number {
  if (!visibleSteps.length) return 0;
  if (activeStepId) {
    const nextIndex = visibleSteps.findIndex((step) => step.id === activeStepId);
    if (nextIndex >= 0) return nextIndex;
  }
  return Math.min(Math.max(0, currentIndex), visibleSteps.length - 1);
}
