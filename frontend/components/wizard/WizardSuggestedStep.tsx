'use client';

import { useWizard } from './WizardProvider';
import { resolveStepKeyLabel } from '../diagnostics/intelligence/stepKeyLabels';
import { resolveRecommendedWizardStepIndex } from './resolveRecommendedWizardStepIndex';
import type { WizardIntelContext } from './resolveRecommendedWizardStepIndex';

export default function WizardSuggestedStep({ className = '' }) {
  const {
    visibleSteps,
    currentStepIndex,
    visitedStepIds,
    canJumpToStep,
    goToStep,
    variant,
    context,
  } = useWizard();

  const ctx = context as WizardIntelContext & {
    oemRepairDecisionPending?: boolean;
  };
  const intelligence = ctx?.intelligence;
  const stepKeyLabels = intelligence?.stepKeyLabels || {};

  if (ctx?.oemRepairDecisionPending) {
    return null;
  }

  const jumpIndex = resolveRecommendedWizardStepIndex(
    visibleSteps,
    ctx,
    visitedStepIds,
    currentStepIndex,
  );
  if (jumpIndex < 0 || jumpIndex === currentStepIndex) return null;

  const jumpKey = (visibleSteps[jumpIndex]?.meta as { stepKey?: string } | undefined)?.stepKey;
  if (!jumpKey) return null;

  const recommendedKeys = intelligence?.recommendedStepKeys || [];
  const targetKey = recommendedKeys.find(
    (key) => key && !(ctx?.visitedStepKeys || []).includes(key),
  );
  const isPrerequisiteJump = Boolean(targetKey && jumpKey !== targetKey);

  const label = resolveStepKeyLabel(jumpKey, stepKeyLabels);
  const canJump = canJumpToStep(jumpIndex);
  const isMobile = variant === 'mobile';

  return (
    <div className={className}>
      {canJump ? (
        <button
          type="button"
          onClick={() => goToStep(jumpIndex)}
          className={`w-full text-left text-[11px] rounded-lg border px-2.5 py-1.5 transition-colors ${
            isMobile
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-100 hover:bg-emerald-500/15'
              : 'border-emerald-200 bg-emerald-50/80 text-emerald-900 hover:bg-emerald-100 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-100'
          }`}
        >
          {isPrerequisiteJump && targetKey ? (
            <>
              <span className="opacity-75">Next up: </span>
              <span className="font-medium">{label}</span>
              <span className="opacity-75"> before </span>
              <span className="font-medium">{resolveStepKeyLabel(targetKey, stepKeyLabels)}</span>
            </>
          ) : (
            <>
              <span className="opacity-75">Next: </span>
              <span className="font-medium">{label}</span>
              <span className="opacity-60"> (also advances with Next)</span>
            </>
          )}
        </button>
      ) : (
        <p
          className={`text-[11px] px-1 ${
            isMobile ? 'text-emerald-200/70' : 'text-emerald-700 dark:text-emerald-300/80'
          }`}
        >
          Next: <span className="font-medium">{label}</span>
          <span className="opacity-70"> — complete prerequisites to unlock.</span>
        </p>
      )}
    </div>
  );
}
