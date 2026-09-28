import type { DiagnosticIntelligenceResult } from '../../intelligence/evidenceTypes';
import type { RoutingEvaluationResult } from '../../routing/types';
import type { WizardDefinition } from '../../types';

/** Minimal wizard context for DS-2 rankers — no UI callbacks required. */
export interface DiagnosticWizardRankContext {
  intelligence?: DiagnosticIntelligenceResult | null;
  routing?: RoutingEvaluationResult | null;
  wizardDefinition?: WizardDefinition | null;
  defaultStepOrder?: string[];
  reviewStepId?: string;
}
