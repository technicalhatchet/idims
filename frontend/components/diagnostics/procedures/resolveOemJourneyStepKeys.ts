import type { WizardDefinition } from '../types';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../shared/createWizardDefinitionFromTemplate';

const BEFORE_REPAIR_SECTION_IDS = new Set(['commonly_missed', 'repair_verification']);

/**
 * Wizard step key for the bounded pre-repair checklist (template-specific).
 */
export function resolveBeforeRepairChecksStepKey(
  definition: WizardDefinition | null | undefined,
): string {
  const fromRouting = definition?.routing?.alwaysOnStepKeys?.find((key) =>
    BEFORE_REPAIR_SECTION_IDS.has(key),
  );
  if (fromRouting) return fromRouting;

  const fromDefault = definition?.defaultSteps?.find((step) =>
    BEFORE_REPAIR_SECTION_IDS.has(step.sectionId)
    || BEFORE_REPAIR_SECTION_IDS.has(step.stepKey || ''),
  );
  if (fromDefault) {
    return fromDefault.stepKey || fromDefault.sectionId;
  }

  return 'commonly_missed';
}

export function resolveDiagnosisSummaryStepKey(
  definition: WizardDefinition | null | undefined,
): string {
  const step = definition?.defaultSteps?.find((item) =>
    item.stepKey === 'diagnosis' || item.sectionId === 'diagnosis',
  );
  return step?.stepKey || step?.sectionId || 'diagnosis';
}

export function resolveDiagnosticSaveStepKey(
  definition: WizardDefinition | null | undefined,
): string {
  return definition?.routing?.reviewStepKey || 'review';
}

export function resolveWizardStepIdForStepKey(
  steps: Array<{ id: string; meta?: { stepKey?: string } }>,
  stepKey: string,
): string | null {
  const byKey = steps.find((step) => step.meta?.stepKey === stepKey);
  if (byKey) return byKey.id;
  if (stepKey === 'review') {
    const review = steps.find((step) => step.id === DIAGNOSTIC_REVIEW_STEP_ID);
    if (review) return review.id;
  }
  return null;
}
