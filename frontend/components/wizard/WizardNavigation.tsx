'use client';

import Button from '../ui/Button';
import { useWizard } from './WizardProvider';
import type { WizardNavigationProps } from './types';
import { readWizardNavigationGate } from './navigationGate';

export default function WizardNavigation({
  onComplete,
  completeLabel = 'Save',
  isCompleting = false,
  previousLabel = 'Previous',
  nextLabel = 'Next',
  className = '',
}: WizardNavigationProps) {
  const {
    canGoPrevious,
    isLastStep,
    goPrevious,
    goNext,
    readOnly,
    variant,
    context,
    navigationBlockHint,
    clearNavigationBlockHint,
  } = useWizard();

  const isMobile = variant === 'mobile';
  const showComplete = isLastStep && onComplete && !readOnly;
  const navigationGate = readWizardNavigationGate(context);
  const wizardNavBlocked = Boolean(navigationGate?.blocked);

  const buttonProps = { fullWidth: isMobile, className: isMobile ? '' : 'min-w-[7rem]' };

  return (
    <div className={`space-y-2 ${className}`}>
      {navigationBlockHint ? (
        <div
          role="status"
          className={`rounded-lg border px-3 py-2 text-xs leading-relaxed ${
            isMobile
              ? 'border-amber-500/35 bg-amber-500/10 text-amber-100'
              : 'border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-700 dark:bg-amber-950/40 dark:text-amber-100'
          }`}
        >
          <p>{navigationBlockHint}</p>
          <button
            type="button"
            onClick={clearNavigationBlockHint}
            className={`mt-1 text-[10px] underline underline-offset-2 ${
              isMobile ? 'text-amber-200/80' : 'text-amber-800/80 dark:text-amber-200/80'
            }`}
          >
            Dismiss
          </button>
        </div>
      ) : null}

      <div
        className={`flex items-center gap-2 ${
          isMobile ? 'flex-col-reverse' : 'justify-between'
        }`}
      >
        <Button
          type="button"
          variant="secondary"
          onClick={goPrevious}
          disabled={!canGoPrevious && !wizardNavBlocked}
          aria-disabled={wizardNavBlocked && canGoPrevious}
          className={`${buttonProps.className} ${
            wizardNavBlocked && canGoPrevious
              ? 'opacity-70 ring-1 ring-amber-400/40'
              : ''
          }`}
          fullWidth={buttonProps.fullWidth}
        >
          {previousLabel}
        </Button>

        {showComplete ? (
          <Button
            type="button"
            variant="primary"
            onClick={onComplete}
            isLoading={isCompleting}
            disabled={isCompleting}
            {...buttonProps}
          >
            {completeLabel}
          </Button>
        ) : !isLastStep ? (
          <Button
            type="button"
            variant="primary"
            onClick={() => void goNext()}
            aria-disabled={wizardNavBlocked}
            className={`${buttonProps.className} ${
              wizardNavBlocked ? 'opacity-70 ring-1 ring-amber-400/40' : ''
            }`}
            fullWidth={buttonProps.fullWidth}
          >
            {nextLabel}
          </Button>
        ) : (
          <span className={isMobile ? 'hidden' : 'min-w-[7rem]'} />
        )}
      </div>
    </div>
  );
}
