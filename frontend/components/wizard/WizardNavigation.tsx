'use client';

import Button from '../ui/Button';
import { useWizard } from './WizardProvider';
import type { WizardNavigationProps } from './types';

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
  } = useWizard();

  const isMobile = variant === 'mobile';
  const showComplete = isLastStep && onComplete && !readOnly;

  const buttonProps = { fullWidth: isMobile, className: isMobile ? '' : 'min-w-[7rem]' };

  return (
    <div
      className={`flex items-center gap-2 ${
        isMobile ? 'flex-col-reverse' : 'justify-between'
      } ${className}`}
    >
      <Button
        type="button"
        variant="secondary"
        onClick={goPrevious}
        disabled={!canGoPrevious}
        {...buttonProps}
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
          {...buttonProps}
        >
          {nextLabel}
        </Button>
      ) : (
        <span className={isMobile ? 'hidden' : 'min-w-[7rem]'} />
      )}
    </div>
  );
}
