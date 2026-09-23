import type { DiagnosticSessionPayload, DiagnosticSessionStatus } from './types';

export function resolveDiagnosticSessionStatus(
  payload: DiagnosticSessionPayload,
): DiagnosticSessionStatus {
  if (payload.oemRepairDecisionPending) {
    return 'repair_outcome_pending';
  }
  if (payload.oemRepairDecision === 'repaired' || payload.oemRepairDecision === 'success') {
    return 'repair_successful';
  }
  if (payload.oemRepairDecision === 'unresolved') {
    return 'unresolved';
  }
  const hasNavigation = payload.visitedStepKeys.length > 0 || Boolean(payload.currentStepKey);
  const hasProcedureActivity = Object.keys(payload.procedureRuns || {}).length > 0;
  const hasFieldData = Object.values(payload.fields || {}).some((value) => {
    if (value === null || value === undefined || value === '') return false;
    if (Array.isArray(value)) return value.length > 0;
    return true;
  });
  if (hasNavigation || hasProcedureActivity || hasFieldData) {
    return 'in_progress';
  }
  return 'not_started';
}
