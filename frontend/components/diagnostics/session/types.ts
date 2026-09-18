import type { DiagnosticTimelineEvent } from '../intelligence/timeline';
import type { EliminationEvaluationResult } from '../knowledge/types';
import type { DiagnosticIntelligenceResult } from '../intelligence/evidenceTypes';
import type { ProcedureRunState } from '../procedures/types';

export type DiagnosticSessionStatus =
  | 'not_started'
  | 'in_progress'
  | 'repair_outcome_pending'
  | 'repair_successful'
  | 'unresolved'
  | 'abandoned';

export type DiagnosticSymptomSource =
  | 'customer_report'
  | 'technician_observation'
  | 'wizard_selection'
  | 'error_code';

export interface DiagnosticSymptom {
  id: string;
  source: DiagnosticSymptomSource;
  value?: string | number | boolean | null;
}

export type DiagnosticWizardMode = 'linear' | 'guided';

/** Round-trip compatible with existing WO diagnostic payload shape. */
export interface DiagnosticSessionPayload {
  templateId: string;
  appointmentId?: string;
  fields: Record<string, unknown>;
  visitedStepKeys: string[];
  currentStepKey: string | null;
  procedureRuns: Record<string, ProcedureRunState>;
  activeProcedureId: string | null;
  timeline: DiagnosticTimelineEvent[];
  evidenceSnapshot: unknown | null;
  skippedOemWizardStep?: boolean;
  oemRepairDecisionPending?: string | null;
  oemRepairDecision?: string | null;
  autoNoteBullets?: string[];
  autoNoteEdited?: boolean;
  autoNoteFormat?: string;
  includeAutoNoteInSummary?: boolean;
  /** Stable session id stored on WO payload for traceability. */
  _diagnosticSessionId?: string | null;
}

export interface DiagnosticSessionDerived {
  intelligence?: DiagnosticIntelligenceResult | null;
  elimination?: EliminationEvaluationResult | null;
  hydratedAt: string;
}

export interface DiagnosticSession {
  sessionId: string;
  appliance: {
    ontology: string;
    manufacturer: string | null;
    model: string | null;
    platform: string | null;
  };
  symptoms: DiagnosticSymptom[];
  state: {
    status: DiagnosticSessionStatus;
    currentHypothesisId: string | null;
    currentComponentId: string | null;
  };
  navigation: {
    currentStepKey: string | null;
    visitedStepKeys: string[];
    wizardMode: DiagnosticWizardMode;
  };
  /** Facts persisted on WO — not intelligence output. */
  payload: DiagnosticSessionPayload;
  /** Populated at hydrate when callers pass eval results — not source of truth. */
  derived?: DiagnosticSessionDerived;
}

export type LooseDiagnosticPayload = Record<string, unknown> & Partial<DiagnosticSessionPayload>;
