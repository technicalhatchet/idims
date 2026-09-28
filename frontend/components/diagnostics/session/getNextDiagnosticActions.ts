import {
  recommendServiceProcedures,
  type RecommendServiceProceduresInput,
} from '../procedures/recommendServiceProcedures';
import { isStrongProcedureLead } from '../procedures/procedureWizardLead';
import type { DiagnosticSession } from './types';
import type { DiagnosticWizardRankContext } from './candidates/candidateContext';
import {
  applyBranchAdjustmentsToCandidates,
  deriveBranchCandidateAdjustments,
} from './candidates/branchEffects';
import { deriveMeasurementCandidateAdjustments } from './candidates/measurementEffects';
import { collectDiagnosticCandidates } from './candidates/collectDiagnosticCandidates';
import { DEFAULT_DIAGNOSTIC_WEIGHTS } from './candidates/diagnosticWeights';
import { filterEligibleDiagnosticCandidates } from './candidates/filterEligibleDiagnosticCandidates';
import { rankDiagnosticCandidates } from './candidates/rankDiagnosticCandidates';
import type { NextTestCandidate } from './candidates/types';

export type { DiagnosticWizardRankContext } from './candidates/candidateContext';
export type {
  NextTestCandidate,
  NextTestCandidateScoreBreakdown,
  NextTestCandidateType,
} from './candidates/types';

export type GetNextDiagnosticActionsInput = {
  session: DiagnosticSession;
  wizardContext: DiagnosticWizardRankContext;
  procedureContext: RecommendServiceProceduresInput;
  limit?: number;
};

export type GetNextDiagnosticActionsResult = {
  candidates: NextTestCandidate[];
  leadHypothesisId: string | null;
  leadComponentId: string | null;
  blockedCandidates: NextTestCandidate[];
  debug?: NextTestCandidate[];
};

const DEBUG_TOP_N = 8;

export function getNextDiagnosticActions(
  input: GetNextDiagnosticActionsInput,
): GetNextDiagnosticActionsResult {
  const { session, wizardContext, procedureContext, limit = 10 } = input;

  const collected = collectDiagnosticCandidates(session, wizardContext, procedureContext);
  const { eligible, blocked } = filterEligibleDiagnosticCandidates(
    collected,
    session,
    wizardContext,
  );
  const branchAdjustments = deriveBranchCandidateAdjustments(session);
  const measurementAdjustments = deriveMeasurementCandidateAdjustments(session);
  const adjusted = applyBranchAdjustmentsToCandidates(
    eligible,
    branchAdjustments,
    session.payload.templateId,
    measurementAdjustments,
  );
  const ranked = rankDiagnosticCandidates(adjusted, DEFAULT_DIAGNOSTIC_WEIGHTS);
  const candidates = ranked.slice(0, limit);

  const result: GetNextDiagnosticActionsResult = {
    candidates,
    leadHypothesisId: session.state.currentHypothesisId,
    leadComponentId: session.state.currentComponentId,
    blockedCandidates: blocked,
  };

  if (process.env.NODE_ENV === 'development') {
    result.debug = ranked.slice(0, DEBUG_TOP_N);
  }

  return result;
}

/** Re-rank after knowledge-changing procedure results — same engine as getNextDiagnosticActions. */
export function replanDiagnosticActions(
  input: GetNextDiagnosticActionsInput,
): GetNextDiagnosticActionsResult {
  return getNextDiagnosticActions(input);
}

/** Parity helper for DS-2 tests — mirrors pre-unified leader selection. */
export function resolveLegacyDiagnosticLeader(
  wizardContext: DiagnosticWizardRankContext,
  procedureContext: RecommendServiceProceduresInput,
  visitedStepKeys: string[],
): { type: 'wizard_step' | 'service_procedure'; id: string } | null {
  const wizardKeys = (wizardContext.intelligence?.recommendedStepKeys || [])
    .filter((key) => key && !visitedStepKeys.includes(key));
  const topOem = recommendServiceProcedures(procedureContext)[0];

  if (topOem && isStrongProcedureLead(topOem)) {
    return { type: 'service_procedure', id: topOem.procedureId };
  }

  if (wizardKeys[0]) {
    return { type: 'wizard_step', id: wizardKeys[0] };
  }

  if (topOem) {
    return { type: 'service_procedure', id: topOem.procedureId };
  }

  return null;
}
