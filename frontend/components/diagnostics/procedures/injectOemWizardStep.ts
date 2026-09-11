import OemProcedureStep from '../steps/OemProcedureStep';
import type { ResolvedDiagnosticWizardStep } from '../types';
import type { ProcedureRecommendation } from './recommendServiceProcedures';
import {
  OEM_WIZARD_STEP_ID,
  OEM_WIZARD_STEP_KEY,
  shouldInsertOemWizardStep,
} from './procedureWizardLead';

export function injectOemWizardStep(
  baseSteps: ResolvedDiagnosticWizardStep[],
  recommendation: ProcedureRecommendation | null | undefined,
  options: {
    complaintChipIds: string[];
    skippedOemWizardStep?: boolean;
  },
): ResolvedDiagnosticWizardStep[] {
  if (!shouldInsertOemWizardStep(
    options.complaintChipIds,
    recommendation,
    options.skippedOemWizardStep,
  )) {
    return baseSteps;
  }

  if (baseSteps.some((step) => step.meta?.stepKey === OEM_WIZARD_STEP_KEY)) {
    return baseSteps;
  }

  const complaintIndex = baseSteps.findIndex((step) => step.meta?.stepKey === 'complaint');
  const insertAt = complaintIndex >= 0 ? complaintIndex + 1 : 0;

  const oemStep: ResolvedDiagnosticWizardStep = {
    id: OEM_WIZARD_STEP_ID,
    title: 'OEM Component Test',
    description: recommendation?.procedure.title || 'Run the matching OEM procedure.',
    component: OemProcedureStep,
    optional: true,
    canSkip: true,
    meta: {
      stepKey: OEM_WIZARD_STEP_KEY,
    },
  };

  const steps = [...baseSteps];
  steps.splice(insertAt, 0, oemStep);
  return steps;
}
