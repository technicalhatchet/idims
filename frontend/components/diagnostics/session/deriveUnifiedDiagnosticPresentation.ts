import type { ProcedureRecommendation } from '../procedures/recommendServiceProcedures';
import type { GetNextDiagnosticActionsResult } from './getNextDiagnosticActions';
import type { NextTestCandidate } from './candidates/types';

export function extractUnifiedWizardStepKeys(candidates: NextTestCandidate[]): string[] {
  const seen = new Set<string>();
  const keys: string[] = [];
  for (const candidate of candidates) {
    if (candidate.type !== 'wizard_step' || !candidate.wizardStepKey) continue;
    if (seen.has(candidate.wizardStepKey)) continue;
    seen.add(candidate.wizardStepKey);
    keys.push(candidate.wizardStepKey);
  }
  return keys;
}

export function extractUnifiedTopProcedureId(candidates: NextTestCandidate[]): string | null {
  const top = candidates.find(
    (candidate) => candidate.type === 'service_procedure' && candidate.procedureId,
  );
  return top?.procedureId ?? null;
}

export function resolveUnifiedOemLeadRecommendation(
  procedureRecommendations: ProcedureRecommendation[],
  unifiedTopProcedureId: string | null | undefined,
): ProcedureRecommendation | null {
  if (!procedureRecommendations.length) return null;
  if (unifiedTopProcedureId) {
    return procedureRecommendations.find(
      (item) => item.procedureId === unifiedTopProcedureId,
    ) ?? procedureRecommendations[0];
  }
  return procedureRecommendations[0];
}

export function resolveUnifiedTopWizardStepKey(
  actions: GetNextDiagnosticActionsResult,
): string | null {
  return extractUnifiedWizardStepKeys(actions.candidates)[0] ?? null;
}
