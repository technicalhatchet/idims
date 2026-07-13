import type { ComponentType } from 'react';
import TemplateSectionStep from './steps/TemplateSectionStep';
import DiagnosticReviewStep from './steps/DiagnosticReviewStep';
import { DIAGNOSTIC_REVIEW_STEP_ID } from './shared/createWizardDefinitionFromTemplate';
import type {
  DiagnosticWizardContext,
  DiagnosticWizardStepConfig,
  ResolvedDiagnosticWizardStep,
  WizardDefinition,
} from './types';
import type { WizardStepComponentProps } from '../wizard/types';

type StepMeta = { section?: { id: string; title: string; fields: unknown[] }; sectionId?: string };
type StepComponent = ComponentType<WizardStepComponentProps<DiagnosticWizardContext, StepMeta>>;

const TemplateSectionStepComponent = TemplateSectionStep as StepComponent;
const DiagnosticReviewStepComponent = DiagnosticReviewStep as StepComponent;

type DiagnosticTemplate = {
  id: string;
  label: string;
  sections: Array<{ id: string; title: string; fields: unknown[] }>;
};

function resolveSection(
  template: DiagnosticTemplate,
  stepConfig: DiagnosticWizardStepConfig,
) {
  const sectionId = stepConfig.sectionId;
  return template.sections.find((s) => s.id === sectionId) || null;
}

function toEngineStep(
  stepConfig: DiagnosticWizardStepConfig,
  section: { id: string; title: string; fields: unknown[] },
): ResolvedDiagnosticWizardStep {
  return {
    id: stepConfig.id || stepConfig.sectionId,
    title: stepConfig.title || section.title,
    description: stepConfig.description,
    component: TemplateSectionStepComponent,
    optional: stepConfig.optional ?? true,
    canSkip: stepConfig.canSkip ?? true,
    hidden: stepConfig.hidden,
    meta: { section, sectionId: section.id },
  };
}

/**
 * Merge WizardDefinition metadata with diagnosticTemplates field sections.
 * Returns engine-ready steps — no appliance logic in the wizard engine.
 */
export function resolveWizardSteps(
  definition: WizardDefinition | null | undefined,
  template: DiagnosticTemplate | null | undefined,
): ResolvedDiagnosticWizardStep[] {
  if (!template?.sections?.length) return [];

  if (!definition) {
    return [
      ...template.sections.map((section) =>
        toEngineStep({ sectionId: section.id }, section),
      ),
      {
        id: DIAGNOSTIC_REVIEW_STEP_ID,
        title: 'Review & Save',
        description: 'Confirm diagnostic entries before saving the note.',
        component: DiagnosticReviewStepComponent,
        optional: true,
        canSkip: false,
      },
    ];
  }

  const sectionById = Object.fromEntries(template.sections.map((s) => [s.id, s]));
  const used = new Set<string>();
  const steps: ResolvedDiagnosticWizardStep[] = [];

  for (const stepConfig of definition.defaultSteps) {
    const section = resolveSection(template, stepConfig);
    if (!section) continue;
    used.add(section.id);
    steps.push(toEngineStep(stepConfig, section));
  }

  for (const section of template.sections) {
    if (used.has(section.id)) continue;
    steps.push(toEngineStep({ sectionId: section.id }, section));
  }

  const review = definition.reviewStep;
  steps.push({
    id: review?.id || DIAGNOSTIC_REVIEW_STEP_ID,
    title: review?.title || 'Review & Save',
    description: review?.description || 'Confirm diagnostic entries before saving the note.',
    component: DiagnosticReviewStepComponent,
    optional: true,
    canSkip: false,
  });

  return steps;
}

/** Sum of step weights for future weighted progress (Phase 5/6). */
export function estimateWizardProgressWeights(definition: WizardDefinition): number {
  const stepWeight = definition.defaultSteps.reduce((sum, s) => sum + (s.weight || 0), 0);
  const reviewWeight = definition.reviewStep?.weight || 0;
  return stepWeight + reviewWeight;
}

/** Domains collected across all steps — for future DMA coverage queries. */
export function collectDomainsFromDefinition(definition: WizardDefinition): string[] {
  const domains = new Set<string>();
  for (const step of definition.defaultSteps) {
    for (const tag of step.collects || []) domains.add(tag);
  }
  return Array.from(domains);
}

export type { DiagnosticWizardContext };
