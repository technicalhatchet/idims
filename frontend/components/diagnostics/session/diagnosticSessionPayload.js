/**
 * Shared WO diagnostic session fields (JS) — used by diagnosticTemplates parse/serialize
 * and by TypeScript hydrate/serialize. Keep in sync with session/types.ts.
 */

export function extractDiagnosticSessionFields(source = {}) {
  const data = source && typeof source === 'object' ? source : {};
  return {
    visitedStepKeys: Array.isArray(data.visitedStepKeys) ? data.visitedStepKeys : [],
    currentStepKey: data.currentStepKey || null,
    procedureRuns:
      data.procedureRuns && typeof data.procedureRuns === 'object' && !Array.isArray(data.procedureRuns)
        ? data.procedureRuns
        : {},
    activeProcedureId: data.activeProcedureId || null,
    skippedOemWizardStep: Boolean(data.skippedOemWizardStep),
    oemRepairDecisionPending: data.oemRepairDecisionPending || null,
    oemRepairDecision: data.oemRepairDecision || null,
    _diagnosticSessionId: data._diagnosticSessionId || null,
  };
}
