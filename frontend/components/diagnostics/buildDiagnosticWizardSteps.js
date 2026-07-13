import { resolveWizardSteps } from './resolveWizardSteps';

/** @deprecated Use resolveWizardSteps(getWizardDefinition(templateId), template) */
export function buildDiagnosticWizardSteps(template) {
  return resolveWizardSteps(null, template);
}

export { DIAGNOSTIC_REVIEW_STEP_ID } from './shared/createWizardDefinitionFromTemplate';
