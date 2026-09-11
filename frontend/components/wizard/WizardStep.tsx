'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useScrollAnchorIntoView } from '../../hooks/useScrollAnchorIntoView';
import { useWizard } from './WizardProvider';
import { wizardStepTransition, wizardStepTransitionDuration } from './animations';

export default function WizardStep() {
  const { currentStep, context, readOnly, variant, navigation } = useWizard();
  const stepAnchorRef = useScrollAnchorIntoView(navigation.currentStepId, {
    delayMs: 120,
  });

  if (!currentStep) return null;

  const StepComponent = currentStep.component;

  return (
    <div
      ref={stepAnchorRef}
      className={`relative min-h-[12rem] ${variant === 'mobile' ? 'scroll-mt-20' : 'scroll-mt-4'}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.div
          key={navigation.currentStepId}
          initial={wizardStepTransition.initial}
          animate={wizardStepTransition.animate}
          exit={wizardStepTransition.exit}
          transition={{ duration: wizardStepTransitionDuration, ease: 'easeOut' }}
        >
          <StepComponent
            context={context}
            meta={currentStep.meta}
            stepId={currentStep.id}
            readOnly={readOnly}
            variant={variant}
          />
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
