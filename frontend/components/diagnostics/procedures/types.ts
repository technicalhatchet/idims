import type { MeasurementEvaluation } from '../knowledge/types';

export type ProcedureStepType =
  | 'safety'
  | 'instruction'
  | 'visual_check'
  | 'measurement'
  | 'outcome';

/** Traceability back to OEM manual text — no PDF URLs or stored binaries. */
export interface ProcedureSource {
  manualId: string;
  manualTitle: string;
  oemTestNumber: string;
  oemTestTitle: string;
  /** Dev traceability to extracted text file (not served at runtime). */
  extractedTextFile?: string;
  pages: number[];
  verifiedAt?: string;
  verifiedBy?: string;
}

/** Cropped diagram assets only — full manual PDFs are not stored or displayed. */
export interface ProcedureImage {
  id: string;
  caption: string;
  assetPath?: string;
}

export interface DiagnosticEffect {
  type: 'confirm' | 'eliminate' | 'suspect';
  componentId: string;
  evidenceId?: string;
}

export type BranchConditionKind =
  | 'measurement_normal'
  | 'measurement_warning'
  | 'measurement_critical'
  | 'measurement_open'
  | 'checkpoint_yes'
  | 'checkpoint_no';

export interface BranchCondition {
  kind: BranchConditionKind;
}

export interface DecisionBranch {
  id: string;
  label: string;
  when: BranchCondition;
  nextStepId?: string;
  oemOutcome?: string;
  diagnosticEffects?: DiagnosticEffect[];
  /** When true, the run completes after this branch (no further steps). */
  terminal?: boolean;
}

export type WireColorConfidence = 'verified' | 'inferred';

export interface TestPointPin {
  pin: string;
  signal: string;
  /** Harness wire color when verified from OEM pinout or wiring diagram text. */
  wireColor?: string;
  /** Visual swatch shown only when confidence is verified. */
  wireColorConfidence?: WireColorConfidence;
}

export interface TestPoint {
  connector: string;
  pins: string;
  label: string;
  /** Per-pin signal names (and optional wire colors) from OEM pinout tables. */
  pinDetails?: TestPointPin[];
}

export interface ProcedureStep {
  id: string;
  order: number;
  type: ProcedureStepType;
  title: string;
  body?: string;
  /** Inline OEM text recreated from extraction — shown instead of PDF pages. */
  sourceExcerpt?: string;
  measurementKnowledgeId?: string;
  testPoint?: TestPoint;
  requiresInput?: boolean;
  branches?: DecisionBranch[];
  defaultNextStepId?: string;
  oemOutcome?: string;
  diagnosticEffects?: DiagnosticEffect[];
  images?: ProcedureImage[];
}

export interface ServiceProcedure {
  id: string;
  version: string;
  title: string;
  platformId: string;
  componentIds: string[];
  source: ProcedureSource;
  entryStepId: string;
  steps: ProcedureStep[];
  tags?: string[];
}

export type ProcedureStepInputKind = 'measurement' | 'checkpoint';

export interface ProcedureStepInput {
  kind: ProcedureStepInputKind;
  value: string;
}

export type ProcedureRunStatus = 'in_progress' | 'completed' | 'aborted';

export interface ProcedureRunState {
  procedureId: string;
  version: string;
  startedAt: string;
  currentStepId: string;
  completedStepIds: string[];
  stepInputs: Record<string, ProcedureStepInput>;
  oemOutcome?: string;
  status: ProcedureRunStatus;
}

export interface ProcedureStepResult {
  runState: ProcedureRunState;
  stepId: string;
  evaluation?: MeasurementEvaluation | null;
  matchedBranch?: DecisionBranch | null;
  completed: boolean;
}
