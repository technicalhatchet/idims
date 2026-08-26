'use client';

import { useWizard } from './WizardProvider';
import type { WizardProgressProps } from './types';
import { resolveStepKeyLabel } from '../diagnostics/intelligence/stepKeyLabels';

export default function WizardProgress({ className = '' }: WizardProgressProps) {
  const {
    visibleSteps,
    currentStepIndex,
    currentStep,
    navigation,
    canJumpToStep,
    isStepLockedAtIndex,
    getStepLockMessageAtIndex,
    goToStep,
    variant,
    context,
  } = useWizard();

  const isMobile = variant === 'mobile';

  if (!visibleSteps.length) return null;

  return (
    <div
      className={`space-y-3 ${className} ${
        isMobile
          ? 'sticky top-0 z-20 -mx-3 px-3 py-2 mb-2 border-b border-white/10 bg-[#0f172a]/95 backdrop-blur-md'
          : ''
      }`}
    >
      <div className="flex items-center justify-between gap-3 text-xs">
        <span className={isMobile ? 'text-gray-400' : 'text-gray-500 dark:text-gray-400'}>
          Step {currentStepIndex + 1} of {visibleSteps.length}
        </span>
        <span
          className={`font-medium truncate text-right ${
            isMobile ? 'text-cyan-300' : 'text-gray-900 dark:text-white'
          }`}
        >
          {currentStep?.title}
        </span>
      </div>
      <div
        className={`h-1.5 rounded-full overflow-hidden ${
          isMobile ? 'bg-white/10' : 'bg-gray-200 dark:bg-gray-700'
        }`}
        role="progressbar"
        aria-valuenow={navigation.progressPercent}
        aria-valuemin={0}
        aria-valuemax={100}
      >
        <div
          className={`h-full transition-all duration-300 ${
            isMobile ? 'bg-cyan-500' : 'bg-cyan-600 dark:bg-cyan-500'
          }`}
          style={{ width: `${navigation.progressPercent}%` }}
        />
      </div>
      <div className="flex flex-wrap gap-1.5">
        {visibleSteps.map((step, index) => {
          const isCurrent = index === currentStepIndex;
          const isLocked = isStepLockedAtIndex(index);
          const canJump = canJumpToStep(index) && index !== currentStepIndex;
          const lockMessage = isLocked ? getStepLockMessageAtIndex(index) : null;
          const stepKey = (step.meta as { stepKey?: string } | undefined)?.stepKey;
          const recommendedKeys =
            (context as { intelligence?: { recommendedStepKeys?: string[] } })?.intelligence
              ?.recommendedStepKeys || [];
          const isRecommended = stepKey && recommendedKeys.includes(stepKey);
          const isTopRecommended = stepKey && recommendedKeys[0] === stepKey;
          const stepLabel = resolveStepKeyLabel(
            stepKey,
            (context as { intelligence?: { stepKeyLabels?: Record<string, string> } })?.intelligence
              ?.stepKeyLabels,
          );
          const dotTitle = isTopRecommended && stepLabel
            ? `${lockMessage || step.title} — Suggested next`
            : lockMessage || step.title;
          return (
            <button
              key={step.id}
              type="button"
              disabled={(!canJump && !isCurrent) || isLocked}
              onClick={() => canJump && goToStep(index)}
              title={dotTitle}
              className={`h-2 rounded-full transition-all ${
                isCurrent
                  ? isMobile
                    ? 'w-6 bg-cyan-400'
                    : 'w-6 bg-cyan-600 dark:bg-cyan-400'
                  : isLocked
                    ? isMobile
                      ? 'w-2 bg-amber-500/30 cursor-not-allowed'
                      : 'w-2 bg-amber-300/60 dark:bg-amber-700/40 cursor-not-allowed'
                  : isTopRecommended
                    ? isMobile
                      ? 'w-3 ring-2 ring-emerald-400/80 bg-emerald-400/70'
                      : 'w-3 ring-2 ring-emerald-500 bg-emerald-400 dark:ring-emerald-400'
                  : isRecommended
                    ? isMobile
                      ? 'w-2.5 bg-emerald-400/60'
                      : 'w-2.5 bg-emerald-400 dark:bg-emerald-600'
                  : canJump
                    ? isMobile
                      ? 'w-2 bg-cyan-500/40 hover:bg-cyan-500/60'
                      : 'w-2 bg-cyan-300 dark:bg-cyan-700 hover:bg-cyan-400'
                    : isMobile
                      ? 'w-2 bg-white/10'
                      : 'w-2 bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={isLocked ? `Locked: ${dotTitle}` : step.title}
              aria-current={isCurrent ? 'step' : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
