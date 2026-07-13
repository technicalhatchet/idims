'use client';

import { useWizard } from './WizardProvider';
import type { WizardHeaderProps } from './types';

export default function WizardHeader({ title, description, className = '' }: WizardHeaderProps) {
  const { currentStep, variant } = useWizard();
  const isMobile = variant === 'mobile';
  const heading = title ?? currentStep?.title;
  const subheading = description ?? currentStep?.description;

  if (!heading && !subheading) return null;

  return (
    <div className={className}>
      {heading && (
        <h3
          className={`text-sm font-semibold ${
            isMobile ? 'text-cyan-300' : 'text-gray-900 dark:text-white'
          }`}
        >
          {heading}
        </h3>
      )}
      {subheading && (
        <p className={`text-xs mt-0.5 ${isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'}`}>
          {subheading}
        </p>
      )}
    </div>
  );
}
