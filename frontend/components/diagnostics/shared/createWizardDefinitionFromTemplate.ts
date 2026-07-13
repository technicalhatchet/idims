import { getDiagnosticTemplate } from '../../../constants/diagnosticTemplates';
import type { DiagnosticWizardStepConfig, WizardDefinition } from '../types';
import { collectsForSection, DEFAULT_STEP_WEIGHT } from './sectionCollects';

export const DIAGNOSTIC_REVIEW_STEP_ID = '__review__';

function stepFromSection(section: { id: string; title: string }, index: number): DiagnosticWizardStepConfig {
  return {
    sectionId: section.id,
    id: section.id,
    title: section.title,
    description: `Complete ${section.title.toLowerCase()} readings and checks.`,
    estimatedMinutes: 2,
    required: false,
    optional: true,
    canSkip: true,
    weight: DEFAULT_STEP_WEIGHT,
    collects: collectsForSection(section.id),
    hidden: false,
    experimental: false,
  };
}

/**
 * Build a WizardDefinition from an existing diagnosticTemplates.js entry.
 * Metadata-only — fields remain in diagnosticTemplates.js.
 */
export function createWizardDefinitionFromTemplate(templateId: string): WizardDefinition | null {
  const template = getDiagnosticTemplate(templateId);
  if (!template) return null;

  const sectionCount = template.sections?.length || 1;
  const estimatedCompletionMinutes = Math.max(8, sectionCount * 2);

  return {
    applianceType: template.id,
    templateId: template.id,
    title: `${template.label} Diagnostic`,
    icon: template.id,
    estimatedCompletionMinutes,
    version: '1.0.0',
    featureFlags: {},
    symptomFlows: [],
    defaultSteps: (template.sections || []).map(stepFromSection),
    reviewStep: {
      id: DIAGNOSTIC_REVIEW_STEP_ID,
      title: 'Review & Save',
      description: 'Confirm diagnostic entries before saving the note.',
      estimatedMinutes: 1,
      weight: 5,
    },
    completionBehavior: { type: 'save_diagnostic_note' },
  };
}
