/**

 * Stable signature for progress autosave deduplication (semantic equality, not reference).

 */

export function buildDiagnosticPayloadPersistSignature(payload: Record<string, unknown> | null | undefined): string {

  if (!payload || typeof payload !== 'object') return '';

  const fields = payload.fields && typeof payload.fields === 'object'

    ? payload.fields as Record<string, unknown>

    : {};

  const sortedFieldEntries = Object.keys(fields)

    .sort()

    .map((key) => [key, fields[key]]);



  return JSON.stringify({

    templateId: payload.templateId ?? null,

    currentStepKey: payload.currentStepKey ?? null,

    visitedStepKeys: Array.isArray(payload.visitedStepKeys) ? [...payload.visitedStepKeys].sort() : [],

    fields: sortedFieldEntries,

    procedureRuns: payload.procedureRuns ?? null,

    activeProcedureId: payload.activeProcedureId ?? null,

    oemRepairDecisionPending: payload.oemRepairDecisionPending ?? null,

    oemRepairDecision: payload.oemRepairDecision ?? null,

    oemConfirmedRepairPathActive: payload.oemConfirmedRepairPathActive ?? null,

    oemContinuationOfferProcedureId: payload.oemContinuationOfferProcedureId ?? null,

    oemDiagnosticTreeExhausted: Boolean(payload.oemDiagnosticTreeExhausted),

    oemWizardLeadDecisions: payload.oemWizardLeadDecisions ?? null,

    skippedOemWizardStep: Boolean(payload.skippedOemWizardStep),

    timeline: payload.timeline ?? null,

    evidenceSnapshot: payload.evidenceSnapshot ?? null,

    autoNoteBullets: payload.autoNoteBullets ?? null,

    autoNoteEdited: Boolean(payload.autoNoteEdited),

    includeAutoNoteInSummary: payload.includeAutoNoteInSummary !== false,

  });

}


