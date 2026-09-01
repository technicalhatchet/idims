export type MeasurementInputKind =
  | 'voltage'
  | 'current'
  | 'resistance'
  | 'temperature'
  | 'pressure'
  | 'capacitance'
  | 'frequency'
  | 'generic'
  | 'continuity'
  | 'diodeCheck';

export type MeasurementStatus =
  | 'normal'
  | 'warning'
  | 'critical'
  | 'unknown'
  | 'not_tested';

export interface NumericRange {
  min?: number;
  max?: number;
  below?: number;
  above?: number;
}

export interface MeasurementRangeSet {
  normal?: NumericRange;
  warning?: NumericRange;
  critical?: NumericRange;
}

export interface MeasurementKnowledgeDefinition {
  id: string;
  name: string;
  unit: string;
  inputKind: MeasurementInputKind;
  ranges?: MeasurementRangeSet;
  typical?: NumericRange;
  openCircuitCritical?: boolean;
  purpose?: string;
  failureModes?: string[];
  testingTips?: string[];
  notes?: string;
  appliesTo?: {
    equipmentSubtypes?: string[];
    templates?: string[];
    manufacturers?: string[];
    platformId?: string;
  };
  dmaTags?: string[];
}

/** Context for brand/platform-aware measurement resolution. */
export interface MeasurementContext {
  templateId: string;
  equipmentMake?: string | null;
  equipmentModel?: string | null;
}

export interface MeasurementEvaluation {
  knowledgeId: string;
  status: MeasurementStatus;
  message: string;
  /** Primary technician-facing label, e.g. "Open igniter" */
  diagnosisLabel?: string;
  /** Secondary severity hint, e.g. "Critical", "OK" */
  severityLabel?: string;
  /** Expected normal range for display, e.g. "40–400 Ω" */
  expectedRangeLabel?: string;
  confidence: 'high' | 'medium' | 'low';
  parsedValue: number | null;
  rawValue: string;
  displayUnit: string;
}

export interface LastMeasurementReading {
  fieldKey: string;
  knowledgeId: string;
  value: string;
  unit: string;
  recordedAt: string;
  workOrderId?: string;
}

export interface EliminationHypothesis {
  id: string;
  category: string;
  label: string;
  /** Paired opposite hypothesis — used to suppress redundant ruled-out mirror labels. */
  oppositeId?: string;
}

export interface EliminationCategory {
  id: string;
  label: string;
  dmaTags?: string[];
}

export type EliminationWhenClause =
  | { type: 'measurement'; knowledgeId: string; statusIn: MeasurementStatus[] }
  | { type: 'field'; path: string; equals: string | boolean }
  | { type: 'chip'; id: string };

export interface EliminationRule {
  id: string;
  when: EliminationWhenClause | EliminationWhenClause[];
  eliminate?: string[];
  /** Measurement or functional-test proof — shown as Confirmed. */
  confirm?: string[];
  /** Symptom-based leads — shown as Likely causes (not proof). */
  suspect?: string[];
}

export interface EliminationConfig {
  templateId: string;
  categories: EliminationCategory[];
  hypotheses: EliminationHypothesis[];
  rules: EliminationRule[];
}

export interface EliminationEvaluationResult {
  eliminated: Array<{ id: string; label: string; category: string }>;
  confirmed: Array<{ id: string; label: string; category: string }>;
  suspected: Array<{ id: string; label: string; category: string }>;
  matchedRuleIds: string[];
}
