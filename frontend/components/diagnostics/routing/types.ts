/** A single routing trigger — chip id, keyword, or field answer. */
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
    };

export interface RoutingRule {
  id: string;
  label?: string;
  /** Any clause match activates this rule (OR). */
  when: RoutingWhenClause[];
  enable?: string[];
  disable?: string[];
}

export interface ComplaintChipDefinition {
  id: string;
  label: string;
  /** Keywords used to pre-select from free-text complaint / WO description */
  keywords?: string[];
}

export interface RoutingConfig {
  /** Steps enabled before any complaint-based rules (enable-list baseline). */
  alwaysOnStepKeys: string[];
  /** Step key for review — always visible at end. */
  reviewStepKey?: string;
  rules: RoutingRule[];
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
