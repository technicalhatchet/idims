import { getWizardDefinition, resolveWizardSteps } from '../diagnostics';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../diagnostics/shared/createWizardDefinitionFromTemplate';
import { getDiagnosticTemplate } from '../../constants/diagnosticTemplates';

export function getDiagnosticWizardSteps(item) {
  const payload = item?.payload || item || {};
  const templateId = payload.templateId || item?.template_id;
  if (!templateId) return { diagnosticSteps: [], totalSteps: 0 };

  const wizardDefinition = getWizardDefinition(templateId);
  const template = getDiagnosticTemplate(templateId);
  const wizardSteps = resolveWizardSteps(wizardDefinition, template);
  const reviewStepKey = wizardDefinition?.routing?.reviewStepKey || 'review';
  const diagnosticSteps = wizardSteps.filter(
    (step) => step.id !== DIAGNOSTIC_REVIEW_STEP_ID && step.meta?.stepKey !== reviewStepKey,
  );

  return { diagnosticSteps, totalSteps: diagnosticSteps.length, reviewStepKey };
}

export function getDiagnosticStepProgress(item) {
  const payload = item?.payload || item || {};
  const { diagnosticSteps, totalSteps } = getDiagnosticWizardSteps(item);
  if (!totalSteps) return null;

  const visitedStepKeys = payload.visitedStepKeys || [];
  const currentIndex = payload.currentStepKey
    ? diagnosticSteps.findIndex((step) => step.meta?.stepKey === payload.currentStepKey)
    : -1;
  const stepNumber = currentIndex >= 0
    ? currentIndex + 1
    : Math.min(
      visitedStepKeys.filter((key) => diagnosticSteps.some((step) => step.meta?.stepKey === key)).length + 1,
      totalSteps,
    );

  return { stepNumber, totalSteps, currentStepKey: payload.currentStepKey || null };
}

export function resolveDiagnosticPhaseLabel(stepNumber, totalSteps) {
  if (!totalSteps || !stepNumber) return null;
  const ratio = (stepNumber - 1) / totalSteps;
  if (ratio < 0.25) return 'Collect';
  if (ratio < 0.5) return 'Analyze';
  if (ratio < 0.75) return 'Test';
  return 'Review';
}
