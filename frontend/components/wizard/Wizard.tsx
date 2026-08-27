'use client';

import { WizardProvider } from './WizardProvider';
import WizardFooter from './WizardFooter';
import WizardHeader from './WizardHeader';
import WizardNavigation from './WizardNavigation';
import WizardProgress from './WizardProgress';
import WizardSuggestedStep from './WizardSuggestedStep';
import WizardStep from './WizardStep';
import type { WizardProps } from './types';

export default function Wizard<TContext>({
  steps,
  context,
  readOnly,
  variant,
  initialStepId,
  initialVisitedStepIds,
  resetKey,
  keyboardNavigation,
  onStepChange,
  onAutoSave,
  onComplete,
  completeLabel,
  isCompleting,
  previousLabel,
  nextLabel,
  headerTitle,
  headerDescription,
  footerExtra,
  className = '',
}: WizardProps<TContext>) {
  return (
    <WizardProvider
      steps={steps}
      context={context}
      readOnly={readOnly}
      variant={variant}
      initialStepId={initialStepId}
      initialVisitedStepIds={initialVisitedStepIds}
      resetKey={resetKey}
      keyboardNavigation={keyboardNavigation}
      onStepChange={onStepChange}
      onAutoSave={onAutoSave}
    >
      <div className={`space-y-4 ${className}`} data-mobile-form={variant === 'mobile' ? true : undefined}>
        {(headerTitle || headerDescription) && (
          <WizardHeader title={headerTitle} description={headerDescription} />
        )}
        <WizardProgress />
        <WizardSuggestedStep />
        <WizardStep />
        <WizardFooter>
          <WizardNavigation
            onComplete={onComplete}
            completeLabel={completeLabel}
            isCompleting={isCompleting}
            previousLabel={previousLabel}
            nextLabel={nextLabel}
          />
          {footerExtra}
        </WizardFooter>
      </div>
    </WizardProvider>
  );
}
