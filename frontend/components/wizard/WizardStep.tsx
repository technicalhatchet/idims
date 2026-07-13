'use client';

import { AnimatePresence, motion } from 'framer-motion';
import { useWizard } from './WizardProvider';
import { wizardStepTransition, wizardStepTransitionDuration } from './animations';

export default function WizardStep() {
  const { currentStep, context, readOnly, variant, navigation } = useWizard();

  if (!currentStep) return null;

  const StepComponent = currentStep.component;

  return (
    <div className="relative min-h-[12rem]">
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
