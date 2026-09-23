import { extractDiagnosticSessionFields } from './diagnosticSessionPayload.js';
import type { DiagnosticSessionPayload, LooseDiagnosticPayload } from './types';
import type { DiagnosticTimelineEvent } from '../intelligence/timeline';
import type { ProcedureRunState } from '../procedures/types';

function asTimeline(value: unknown): DiagnosticTimelineEvent[] {
  return Array.isArray(value) ? (value as DiagnosticTimelineEvent[]) : [];
}

function asFields(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function asProcedureRuns(value: unknown): Record<string, ProcedureRunState> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};
  return value as Record<string, ProcedureRunState>;
}

/** Normalize loose WO payload into the session payload contract. */
export function normalizeDiagnosticSessionPayload(
  loose: LooseDiagnosticPayload | null | undefined,
  fallbackTemplateId = 'refrigerator',
): DiagnosticSessionPayload {
  const data = loose && typeof loose === 'object' ? loose : {};
  const sessionFields = extractDiagnosticSessionFields(data);

  return {
    templateId: typeof data.templateId === 'string' && data.templateId
      ? data.templateId
      : fallbackTemplateId,
    appointmentId: typeof data.appointmentId === 'string' ? data.appointmentId : '',
    fields: asFields(data.fields),
    visitedStepKeys: sessionFields.visitedStepKeys,
    currentStepKey: sessionFields.currentStepKey,
    procedureRuns: asProcedureRuns(sessionFields.procedureRuns),
    activeProcedureId: sessionFields.activeProcedureId,
    timeline: asTimeline(data.timeline),
    evidenceSnapshot: data.evidenceSnapshot ?? null,
    skippedOemWizardStep: sessionFields.skippedOemWizardStep,
    oemRepairDecisionPending: sessionFields.oemRepairDecisionPending,
    oemRepairDecision: sessionFields.oemRepairDecision,
    autoNoteBullets: Array.isArray(data.autoNoteBullets) ? data.autoNoteBullets.map(String) : [],
    autoNoteEdited: Boolean(data.autoNoteEdited),
    autoNoteFormat: data.autoNoteFormat === 'prose' ? 'prose' : 'bullets',
    includeAutoNoteInSummary: data.includeAutoNoteInSummary !== false,
    _diagnosticSessionId: sessionFields._diagnosticSessionId,
  };
}
