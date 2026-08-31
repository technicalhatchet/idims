import type { MeasurementStatus } from '../knowledge/types';

/** A single routing trigger — chip id, keyword, field answer, or measurement status. */
export type RoutingWhenClause =
  | string
  | {
      type: 'chip';
      id: string;
    }
  | {
      type: 'keyword';
      match: string;
    }
  | {
      type: 'field';
      path: string;
      equals: string | boolean;
    }
  | {
      type: 'measurement';
      knowledgeId: string;
      statusIn?: MeasurementStatus[];
      status?: MeasurementStatus;
    };

export interface RoutingRule {
  id: string;
  label?: string;
  /** Any clause match activates this rule (OR). */
  when: RoutingWhenClause[];
  enable?: string[];
  disable?: string[];
}

/** Phase 4c — show a field only when any showWhen clause matches (OR). */
export interface FieldVisibilityRule {
  id?: string;
  /** Full field key: sectionId.fieldId */
  field: string;
  showWhen: RoutingWhenClause[];
}

export interface ComplaintChipDefinition {
  id: string;
  label: string;
  /** Keywords used to pre-select from complaint text, error codes, or WO description */
  keywords?: string[];
}

/** stepKey → stepKeys that must be visited before this step is reachable. */
export type PrerequisiteMap = Record<string, string[]>;

export interface PrerequisiteStatus {
  met: boolean;
  missingStepKeys: string[];
  missingTitles: string[];
}

export interface RoutingConfig {
  /** Steps enabled before any complaint-based rules (enable-list baseline). */
  alwaysOnStepKeys: string[];
  /** Step key for review — always visible at end. */
  reviewStepKey?: string;
  rules: RoutingRule[];
  /** Phase 4b — visit-order gates (config only). */
  prerequisites?: PrerequisiteMap;
  /** Phase 4c — conditional fields within steps (yn/tri/chip answers only). */
  fieldVisibility?: FieldVisibilityRule[];
  /** Phase 4d — static help copy keyed by sectionId.fieldId */
  fieldHelp?: Record<string, string>;
  /** Phase 4d — contextual tips when answers/chips match */
  recommendations?: FieldRecommendationRule[];
}

export type RecommendationTone = 'tip' | 'action' | 'info';

export interface FieldRecommendationRule {
  id: string;
  /** Optional — scope tip to a section field (sectionId.fieldId) */
  field?: string;
  when: RoutingWhenClause[];
  message: string;
  tone?: RecommendationTone;
}

export interface ActiveFieldRecommendation {
  id: string;
  field?: string;
  message: string;
  tone: RecommendationTone;
}

export interface RoutingExplanation {
  ruleId: string;
  ruleLabel: string;
}

export interface RoutingEvaluationResult {
  enabledStepKeys: Set<string>;
  matchedRules: RoutingExplanation[];
  /** Human-readable triggers that fired (chip labels, field answers). */
  triggers: string[];
  addedStepKeys: string[];
  removedStepKeys: string[];
  /** All step keys defined in the wizard (for diff vs previous). */
  allStepKeys: string[];
}

export interface RoutingDiff {
  added: Array<{ stepKey: string; title: string }>;
  removed: Array<{ stepKey: string; title: string }>;
  triggers: string[];
  matchedRules: RoutingExplanation[];
}
