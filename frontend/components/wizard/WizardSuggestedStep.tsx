'use client';

import { useWizard } from './WizardProvider';
import { resolveStepKeyLabel } from '../diagnostics/intelligence/stepKeyLabels';

export default function WizardSuggestedStep({ className = '' }) {
  const {
    visibleSteps,
    currentStepIndex,
    canJumpToStep,
    goToStep,
    variant,
    context,
  } = useWizard();

  const intelligence = (context as { intelligence?: {
    recommendedStepKeys?: string[];
    stepKeyLabels?: Record<string, string>;
  } })?.intelligence;

  const recommendedKeys = intelligence?.recommendedStepKeys || [];
  const stepKeyLabels = intelligence?.stepKeyLabels || {};
  const topKey = recommendedKeys[0];
  if (!topKey) return null;

  const targetIndex = visibleSteps.findIndex(
    (step) => (step.meta as { stepKey?: string } | undefined)?.stepKey === topKey,
  );
  if (targetIndex < 0) return null;

  const currentKey = (visibleSteps[currentStepIndex]?.meta as { stepKey?: string } | undefined)?.stepKey;
  if (currentKey === topKey) return null;

  const label = resolveStepKeyLabel(topKey, stepKeyLabels);
  const canJump = canJumpToStep(targetIndex);
  const isMobile = variant === 'mobile';

  return (
    <div className={className}>
      {canJump ? (
        <button
          type="button"
          onClick={() => goToStep(targetIndex)}
          className={`w-full text-left text-[11px] rounded-lg border px-2.5 py-1.5 transition-colors ${
            isMobile
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15'
              : 'border-emerald-200 bg-emerald-50/80 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
          }`}
        >
          <span className="opacity-75">Suggested next: </span>
          <span className="font-medium">{label}</span>
          <span className="opacity-60"> → jump to step</span>
        </button>
      ) : (
        <p
          className={`text-[11px] px-1 ${
            isMobile ? 'text-emerald-200/70' : 'text-emerald-700 dark:text-emerald-300/80'
          }`}
        >
          Suggested next: <span className="font-medium">{label}</span>
          <span className="opacity-70"> (complete prerequisites to unlock)</span>
        </p>
      )}
    </div>
  );
}
