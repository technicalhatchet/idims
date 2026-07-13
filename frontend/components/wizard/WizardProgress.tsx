'use client';

import { useWizard } from './WizardProvider';
import type { WizardProgressProps } from './types';

export default function WizardProgress({ className = '' }: WizardProgressProps) {
  const {
    visibleSteps,
    currentStepIndex,
    currentStep,
    navigation,
    canJumpToStep,
    goToStep,
    variant,
  } = useWizard();

  const isMobile = variant === 'mobile';

  if (!visibleSteps.length) return null;

  return (
    <div className={`space-y-3 ${className}`}>
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
          const canJump = canJumpToStep(index) && index !== currentStepIndex;
          return (
            <button
              key={step.id}
              type="button"
              disabled={!canJump && !isCurrent}
              onClick={() => canJump && goToStep(index)}
              title={step.title}
              className={`h-2 rounded-full transition-all ${
                isCurrent
                  ? isMobile
                    ? 'w-6 bg-cyan-400'
                    : 'w-6 bg-cyan-600 dark:bg-cyan-400'
                  : canJump
                    ? isMobile
                      ? 'w-2 bg-cyan-500/40 hover:bg-cyan-500/60'
                      : 'w-2 bg-cyan-300 dark:bg-cyan-700 hover:bg-cyan-400'
                    : isMobile
                      ? 'w-2 bg-white/10'
                      : 'w-2 bg-gray-300 dark:bg-gray-600'
              }`}
              aria-label={step.title}
              aria-current={isCurrent ? 'step' : undefined}
            />
          );
        })}
      </div>
    </div>
  );
}
