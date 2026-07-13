import type { WizardStepDefinition } from '../wizard/types';

/** Placeholder for Phase 4 conditional routing. */
export interface SymptomFlowPlaceholder {
  id: string;
  description?: string;
  /** Future: symptom pattern → step ids to insert or skip */
  insertStepIds?: string[];
  skipStepIds?: string[];
}

export interface WizardFeatureFlags {
  [flag: string]: boolean | undefined;
}

export interface WizardCompletionBehavior {
  type: 'save_diagnostic_note';
  /** Future: redirect, create follow-up WO, etc. */
  options?: Record<string, unknown>;
}

/** Diagnostic-only step metadata. Stripped before passing to the wizard engine. */
export interface DiagnosticWizardStepConfig {
  /** Maps to diagnosticTemplates section id */
  sectionId: string;
  id?: string;
  title?: string;
  description?: string;
  icon?: string;
  estimatedMinutes?: number;
  required?: boolean;
  weight?: number;
  optional?: boolean;
  canSkip?: boolean;
  /** Data domains this step contributes — for future DMA coverage checks */
  collects?: string[];
  /** Phase 4+ */
  hidden?: boolean;
  experimental?: boolean;
  featureFlags?: WizardFeatureFlags;
}

export interface DiagnosticReviewStepConfig {
  id: string;
  title: string;
  description?: string;
  estimatedMinutes?: number;
  weight?: number;
}

export interface WizardDefinition {
  applianceType: string;
  /** Must match diagnosticTemplates.js template id */
  templateId: string;
  title: string;
  icon?: string;
  estimatedCompletionMinutes?: number;
  version: string;
  featureFlags?: WizardFeatureFlags;
  /** Phase 4 — structure only in Phase 3 */
  symptomFlows?: SymptomFlowPlaceholder[];
  defaultSteps: DiagnosticWizardStepConfig[];
  reviewStep: DiagnosticReviewStepConfig;
  completionBehavior: WizardCompletionBehavior;
}

export interface DiagnosticWizardContext {
  payload: {
    templateId?: string;
    appointmentId?: string;
    fields?: Record<string, unknown>;
  };
  workOrder?: Record<string, unknown> | null;
  onFieldChange: (key: string, value: unknown) => void;
}

export type ResolvedDiagnosticWizardStep = WizardStepDefinition<
  DiagnosticWizardContext,
  { section?: { id: string; title: string; fields: unknown[] }; sectionId?: string }
>;
