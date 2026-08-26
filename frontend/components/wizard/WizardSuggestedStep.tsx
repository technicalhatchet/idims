'use client';

import { useWizard } from './WizardProvider';
import { resolveStepKeyLabel } from '../diagnostics/intelligence/stepKeyLabels';
import {
  getPrerequisiteStatus,
} from '../diagnostics/routing/prerequisiteEngine';
import type { WizardDefinition } from '../diagnostics/types';

type WizardIntelContext = {
  intelligence?: {
    recommendedStepKeys?: string[];
    stepKeyLabels?: Record<string, string>;
  };
  visitedStepKeys?: string[];
  wizardDefinition?: WizardDefinition | null;
  reviewStepId?: string;
};

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

  const ctx = context as WizardIntelContext;
  const intelligence = ctx?.intelligence;
  const visitedStepKeys = ctx?.visitedStepKeys || [];
  const wizardDefinition = ctx?.wizardDefinition;
  const reviewStepId = ctx?.reviewStepId || 'diagnostic_review';

  const recommendedKeys = intelligence?.recommendedStepKeys || [];
  const stepKeyLabels = intelligence?.stepKeyLabels || {};
  const currentKey = (visibleSteps[currentStepIndex]?.meta as { stepKey?: string } | undefined)?.stepKey;

  const indexForStepKey = (stepKey: string) =>
    visibleSteps.findIndex(
      (step) => (step.meta as { stepKey?: string } | undefined)?.stepKey === stepKey,
    );

  let targetKey: string | null = null;
  for (const key of recommendedKeys) {
    if (!key || key === currentKey) continue;
    const idx = indexForStepKey(key);
    if (idx < 0) continue;
    if (visitedStepKeys.includes(key) && idx < currentStepIndex) continue;
    targetKey = key;
    break;
  }

  if (!targetKey) return null;

  const targetIndex = indexForStepKey(targetKey);
  if (targetIndex < 0) return null;

  let jumpIndex = targetIndex;
  let jumpKey = targetKey;
  let prerequisiteNote: string | null = null;

  if (wizardDefinition) {
    const status = getPrerequisiteStatus(
      targetKey,
      wizardDefinition,
      visitedStepIds,
      reviewStepId,
    );

    if (!status.met && status.missingStepKeys.length) {
      const missingKey = status.missingStepKeys[0];
      const missingIndex = indexForStepKey(missingKey);
      if (missingIndex >= 0) {
        jumpIndex = missingIndex;
        jumpKey = missingKey;
        prerequisiteNote = status.missingTitles[0] || missingKey;
      }
    }
  }

  const label = resolveStepKeyLabel(jumpKey, stepKeyLabels);
  const canJump = canJumpToStep(jumpIndex);
  const isMobile = variant === 'mobile';
  const isPrerequisiteJump = jumpKey !== targetKey;

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
          {isPrerequisiteJump ? (
            <>
              <span className="opacity-75">Complete </span>
              <span className="font-medium">{prerequisiteNote || label}</span>
              <span className="opacity-75"> to unlock </span>
              <span className="font-medium">{resolveStepKeyLabel(targetKey, stepKeyLabels)}</span>
              <span className="opacity-60"> → go to step</span>
            </>
          ) : (
            <>
              <span className="opacity-75">Suggested next: </span>
              <span className="font-medium">{label}</span>
              <span className="opacity-60"> → jump to step</span>
            </>
          )}
        </button>
      ) : (
        <p
          className={`text-[11px] px-1 ${
            isMobile ? 'text-emerald-200/70' : 'text-emerald-700 dark:text-emerald-300/80'
          }`}
        >
          Suggested next: <span className="font-medium">{label}</span>
          <span className="opacity-70"> — complete prerequisites to unlock this step.</span>
        </p>
      )}
    </div>
  );
}
