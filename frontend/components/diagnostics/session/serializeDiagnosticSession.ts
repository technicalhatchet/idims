import type { DiagnosticSession, DiagnosticSessionPayload, LooseDiagnosticPayload } from './types';

/**
 * Flatten DiagnosticSession back to the existing WO diagnostic payload shape.
 * Preserves unknown legacy keys when `originalPayload` is supplied.
 */
export function serializeDiagnosticSession(
  session: DiagnosticSession,
  originalPayload?: LooseDiagnosticPayload | null,
): LooseDiagnosticPayload {
  const base = originalPayload && typeof originalPayload === 'object' ? originalPayload : {};
  const payload: DiagnosticSessionPayload = {
    ...session.payload,
    visitedStepKeys: [...session.navigation.visitedStepKeys],
    currentStepKey: session.navigation.currentStepKey,
    _diagnosticSessionId: session.sessionId,
  };

  return {
    ...base,
    templateId: payload.templateId,
    appointmentId: payload.appointmentId || '',
    fields: payload.fields,
    timeline: payload.timeline,
    evidenceSnapshot: payload.evidenceSnapshot,
    autoNoteBullets: payload.autoNoteBullets ?? [],
    autoNoteEdited: Boolean(payload.autoNoteEdited),
    autoNoteFormat: payload.autoNoteFormat === 'prose' ? 'prose' : 'bullets',
    includeAutoNoteInSummary: payload.includeAutoNoteInSummary !== false,
    visitedStepKeys: payload.visitedStepKeys,
    currentStepKey: payload.currentStepKey,
    procedureRuns: payload.procedureRuns,
    activeProcedureId: payload.activeProcedureId,
    skippedOemWizardStep: Boolean(payload.skippedOemWizardStep),
    oemRepairDecisionPending: payload.oemRepairDecisionPending ?? null,
    oemRepairDecision: payload.oemRepairDecision ?? null,
    _diagnosticSessionId: session.sessionId,
  };
}
