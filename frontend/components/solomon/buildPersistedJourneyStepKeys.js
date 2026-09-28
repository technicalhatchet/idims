import { OEM_WIZARD_STEP_KEY } from '../diagnostics/procedures/procedureWizardLead';

/**
 * Ordered step keys for persisted progress (Last Session / My Diagnostics).
 * Mirrors template wizard order and inserts oem_test after complaint when used.
 */
export function buildPersistedJourneyStepKeys(wizardSteps, payload) {
  const keys = wizardSteps
    .map((step) => step.meta?.stepKey)
    .filter(Boolean);

  const visited = payload?.visitedStepKeys || [];
  const usesOem = visited.includes(OEM_WIZARD_STEP_KEY)
    || payload?.currentStepKey === OEM_WIZARD_STEP_KEY
    || Object.keys(payload?.procedureRuns || {}).length > 0;

  if (!usesOem || keys.includes(OEM_WIZARD_STEP_KEY)) {
    return keys;
  }

  const complaintIndex = keys.indexOf('complaint');
  const insertAt = complaintIndex >= 0 ? complaintIndex + 1 : 0;
  const next = [...keys];
  next.splice(insertAt, 0, OEM_WIZARD_STEP_KEY);
  return next;
}

export function resolvePersistedJourneyStepNumber(journeyStepKeys, currentStepKey, visitedStepKeys) {
  if (!journeyStepKeys.length) return { stepNumber: 0, totalSteps: 0 };

  if (currentStepKey) {
    const index = journeyStepKeys.indexOf(currentStepKey);
    if (index >= 0) {
      return { stepNumber: index + 1, totalSteps: journeyStepKeys.length };
    }
  }

  const visitedCount = visitedStepKeys.filter((key) => journeyStepKeys.includes(key)).length;
  const stepNumber = Math.min(Math.max(visitedCount, 1), journeyStepKeys.length);
  return { stepNumber, totalSteps: journeyStepKeys.length };
}
