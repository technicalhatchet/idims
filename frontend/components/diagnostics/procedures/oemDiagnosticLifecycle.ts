import type { NextTestCandidate } from '../session/candidates/types';
import type { ProcedureRecommendation } from './recommendServiceProcedures';
import { isStrongProcedureLead } from './procedureWizardLead';
import { isOemWizardLeadSuppressedForProcedure } from './oemWizardDecisions';
import type { OemWizardLeadDecisions } from './oemWizardDecisions';
import type { ProcedureRunState } from './types';

/**
 * True when no further strong OEM foreground procedure is eligible to run.
 * Does not change ranking — reads candidate eligibility only.
 */
export function isOemStrongLeadPoolExhausted(input: {
  candidates: NextTestCandidate[];
  procedureRecommendations: ProcedureRecommendation[];
  procedureRuns: Record<string, ProcedureRunState>;
  oemWizardLeadDecisions?: OemWizardLeadDecisions;
  oemRunnerEnabled?: boolean;
  readOnly?: boolean;
}): boolean {
  if (!input.oemRunnerEnabled || input.readOnly) return false;

  const eligibleProcedureIds = new Set(
    input.candidates
      .filter((candidate) => candidate.type === 'service_procedure' && candidate.eligible)
      .map((candidate) => candidate.procedureId)
      .filter(Boolean) as string[],
  );

  if (eligibleProcedureIds.size > 0) return false;

  const remainingStrong = input.procedureRecommendations.filter((rec) => {
    if (!isStrongProcedureLead(rec)) return false;
    if (isOemWizardLeadSuppressedForProcedure(rec.procedureId, input.oemWizardLeadDecisions)) {
      return false;
    }
    const run = input.procedureRuns[rec.procedureId];
    if (run?.status === 'completed') return false;
    return true;
  });

  return remainingStrong.length === 0;
}

export function shouldDeferGenericWizardAfterOemComplete(
  planType: string,
  exhausted: boolean,
): boolean {
  if (!exhausted) return false;
  return planType === 'mechanical'
    || planType === 'next_wizard_step';
}
