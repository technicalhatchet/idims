import type { RoutingWhenClause } from '../routing/types';

export type EvidenceTargetLayer = 'category' | 'component';

export type EvidenceEffect =
  | { effect: 'increase'; value: number }
  | { effect: 'decrease'; value: number }
  | { effect: 'confirm' }
  | { effect: 'unlikely'; value: number }
  | { effect: 'eliminate' };

export type EvidenceWhenClause =
  | RoutingWhenClause
  | { type: 'test'; testId: string; filled?: boolean };

export interface EvidenceLedgerTrigger {
  type: 'measurement' | 'field' | 'chip' | 'complaint';
  label: string;
  value?: string;
  expectedRange?: string;
}

export interface EvidenceCategoryDefinition {
  id: string;
  label: string;
  dmaTags?: string[];
}

export interface EvidenceComponentDefinition {
  id: string;
  label: string;
  categoryId: string;
  dmaTags?: string[];
}

export interface EvidenceRule {
  id: string;
  when: EvidenceWhenClause[];
  target: string;
  targetLayer: EvidenceTargetLayer;
  effect: EvidenceEffect;
  explanation: string;
  dmaTags?: string[];
  recommendStepKey?: string;
}

export interface EvidenceConfig {
  templateId: string;
  categories: EvidenceCategoryDefinition[];
  components?: EvidenceComponentDefinition[];
  rules: EvidenceRule[];
}

export interface EvidenceLedgerEntry {
  ruleId: string;
  target: string;
  targetLayer: EvidenceTargetLayer;
  delta: number;
  explanation: string;
  effect: EvidenceEffect['effect'];
  source?: 'rule' | 'dma';
  trigger?: EvidenceLedgerTrigger;
}

export interface DmaEvidenceNudge {
  tag: string;
  label: string;
  caseCount: number;
}

export type ComponentEvidenceState = 'unknown' | 'confirmed' | 'unlikely' | 'eliminated';

export interface ComponentEvidenceScore {
  id: string;
  label: string;
  categoryId: string;
  evidence: number;
  state: ComponentEvidenceState;
}

export interface CategoryEvidenceScore {
  id: string;
  label: string;
  evidence: number;
  rank: number;
}

export interface DiagnosticIntelligenceResult {
  categories: CategoryEvidenceScore[];
  /** Top 3 categories for primary UI */
  topCategories: CategoryEvidenceScore[];
  ledger: EvidenceLedgerEntry[];
  componentsByCategory: Record<string, ComponentEvidenceScore[]>;
  matchedRuleCount: number;
  recommendedStepKeys: string[];
  autoNoteBullets: string[];
  activeDmaTags: string[];
  dmaNudgeCount: number;
}

export interface DiagnosticTestDefinition {
  testId: string;
  label: string;
  templateId: string;
  fieldKey?: string;
  knowledgeId?: string;
  wizardStepKey?: string;
}
