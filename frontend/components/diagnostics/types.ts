import type { WizardStepDefinition } from '../wizard/types';
import type { ComplaintChipDefinition, FieldVisibilityRule, RoutingConfig, RoutingEvaluationResult, ActiveFieldRecommendation } from './routing/types';

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
  /** Short routing key — aliases sectionId in routing rules (e.g. temperature → temperature_checks). */
  stepKey?: string;
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
  symptomFlows?: SymptomFlowPlaceholder[];
  /** Phase 4a — complaint chip definitions for routing pre-fill and ComplaintStep UI. */
  complaintChips?: ComplaintChipDefinition[];
  /** Phase 4a — enable-list routing rules (appliance-specific config). */
  routing?: RoutingConfig;
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
  /** Live routing evaluation — null when appliance has no routing config. */
  routing?: RoutingEvaluationResult | null;
  complaintChips?: ComplaintChipDefinition[];
  /** Phase 4c — conditional field rules for the active appliance. */
  fieldVisibilityRules?: FieldVisibilityRule[];
  /** Phase 4d */
  fieldHelp?: Record<string, string>;
  activeRecommendations?: ActiveFieldRecommendation[];
}

export type ResolvedDiagnosticWizardStep = WizardStepDefinition<
  DiagnosticWizardContext,
  { section?: { id: string; title: string; fields: unknown[] }; sectionId?: string; stepKey?: string }
>;
