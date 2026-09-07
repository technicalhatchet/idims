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
  /** Resolved plan of injected service/test-mode bundles (for UI hints). */
  serviceModePlan?: ServiceModeRef[];
}

/** OEM UI / test-mode taxonomy — bundles declare one or more kinds. */
export type ServiceModeKind =
  | 'service_diagnostic_entry'
  | 'quick_service_cycle'
  | 'combined_qsc'
  | 'component_activation'
  | 'load_test'
  | 'fault_codes'
  | 'hmi_test'
  | 'voltage_check';

export type ServiceModeUiVariant = 'console' | 'lcd_in_door' | 'any';

/** Links a parent procedure to a reusable service-mode step bundle. */
export interface ServiceModeRef {
  bundleId: string;
  /** Expected bundle kind — validated against bundle metadata at resolve time. */
  modeKind: ServiceModeKind;
  /** Parent step after which the bundle is inserted. */
  attachAfterStepId: string;
  /** Parent step to resume after the bundle completes (@continue target). */
  continueToStepId: string;
}

export interface ServiceModeBundle {
  id: string;
  version: string;
  platformId: string;
  manualId: string;
  title: string;
  modeKind: ServiceModeKind;
  /** UI paths this bundle covers (console membrane vs LCD-in-door, etc.). */
  uiVariants: ServiceModeUiVariant[];
  description?: string;
  tags?: string[];
  entryStepId: string;
  steps: ProcedureStep[];
  source?: Record<string, unknown>;
}

export interface ServiceProcedureSeed extends Omit<ServiceProcedure, 'serviceModePlan'> {
  /** @deprecated Prefer serviceModes — kept for single-bundle seeds. */
  serviceMode?: ServiceModeRef;
  /** Ordered bundles to splice into the procedure (e.g. entry then activation). */
  serviceModes?: ServiceModeRef[];
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
