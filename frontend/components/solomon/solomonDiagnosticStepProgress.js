import { getWizardDefinition, resolveWizardSteps } from '../diagnostics';
import { getDiagnosticTemplate } from '../../constants/diagnosticTemplates';
import { resolveWizardProgressTitle } from '../diagnostics/intelligence/diagnosticJourneyPresentation';
import {
  buildPersistedJourneyStepKeys,
  resolvePersistedJourneyStepNumber,
} from './buildPersistedJourneyStepKeys';

export function getDiagnosticWizardSteps(item) {
  const payload = item?.payload || item || {};
  const templateId = payload.templateId || item?.template_id;
  if (!templateId) return { diagnosticSteps: [], totalSteps: 0, wizardSteps: [] };

  const wizardDefinition = getWizardDefinition(templateId);
  const template = getDiagnosticTemplate(templateId);
  const wizardSteps = resolveWizardSteps(wizardDefinition, template);
  const reviewStepKey = wizardDefinition?.routing?.reviewStepKey || 'review';
  const diagnosticSteps = wizardSteps.filter(
    (step) => step.meta?.stepKey !== reviewStepKey,
  );

  return { diagnosticSteps, totalSteps: diagnosticSteps.length, reviewStepKey, wizardSteps };
}

export function getDiagnosticStepProgress(item) {
  const payload = item?.payload || item || {};
  const currentStepKey = payload.currentStepKey || null;
  const visitedStepKeys = payload.visitedStepKeys || [];

  const { wizardSteps } = getDiagnosticWizardSteps(item);
  if (!wizardSteps.length) return null;

  const journeyStepKeys = buildPersistedJourneyStepKeys(wizardSteps, payload);
  const { stepNumber, totalSteps } = resolvePersistedJourneyStepNumber(
    journeyStepKeys,
    currentStepKey,
    visitedStepKeys,
  );

  if (!totalSteps) return null;

  const currentStep = wizardSteps.find((step) => step.meta?.stepKey === currentStepKey);
  const phaseTitle = resolveWizardProgressTitle({
    stepKey: currentStepKey,
    stepTitle: currentStep?.title,
    oemDiagnosticTreeExhausted: payload.oemDiagnosticTreeExhausted,
    oemBeforeRepairChecksPhase: currentStepKey === 'commonly_missed'
      && Boolean(payload.oemConfirmedRepairPathActive),
    oemFaultIdentifiedPhase: currentStepKey === 'oem_test'
      && Boolean(payload.oemRepairDecisionPending || payload.oemConfirmedRepairPathActive),
    oemRepairVerificationPhase: currentStepKey === 'commonly_missed'
      && Boolean(payload.oemConfirmedRepairPathActive),
    repairVerificationPhaseActive: currentStepKey === 'commonly_missed'
      && Boolean(payload.oemConfirmedRepairPathActive),
  });

  return {
    stepNumber,
    totalSteps,
    currentStepKey,
    phaseTitle,
  };
}

export function resolveDiagnosticPhaseLabel(stepNumber, totalSteps, phaseTitle) {
  if (phaseTitle) return phaseTitle;
  if (!totalSteps || !stepNumber) return null;
  const ratio = (stepNumber - 1) / totalSteps;
  if (ratio < 0.25) return 'Collect';
  if (ratio < 0.5) return 'Analyze';
  if (ratio < 0.75) return 'Test';
  return 'Review';
}
