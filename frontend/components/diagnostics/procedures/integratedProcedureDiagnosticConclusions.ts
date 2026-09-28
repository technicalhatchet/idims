import { deriveEvidenceSubjectConclusions } from './deriveEvidenceSubjectConclusions';
import {
  deriveProcedureDiagnosticConclusions,
  resolvePrimaryDiagnosticConclusion,
  runHasScopedDiagnosticAssertions,
  type DiagnosticConclusion,
} from './deriveProcedureDiagnosticConclusions';
import { runHasEvidenceSubjectKeys } from './procedureEvidenceSubject';
import type { ProcedureRunState, ServiceProcedure } from './types';

/** Primary scoped/subject conclusion for disposition, presentation, and journey routing. */
export function resolveIntegratedPrimaryDiagnosticConclusion(
  runState: ProcedureRunState,
  procedure: ServiceProcedure,
): DiagnosticConclusion | null {
  if (runHasScopedDiagnosticAssertions(runState)) {
    const primary = resolvePrimaryDiagnosticConclusion(
      deriveProcedureDiagnosticConclusions(runState, procedure),
    );
    if (primary) return primary;
  }

  if (runHasEvidenceSubjectKeys(runState)) {
    return resolvePrimaryDiagnosticConclusion(
      deriveEvidenceSubjectConclusions(runState, procedure),
    );
  }

  return null;
}

export function runUsesIntegratedDiagnosticConclusions(runState: ProcedureRunState): boolean {
  return runHasScopedDiagnosticAssertions(runState) || runHasEvidenceSubjectKeys(runState);
}
