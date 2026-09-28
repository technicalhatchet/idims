import type { DiagnosticCandidateWeights } from './types';
import { DEFAULT_DIAGNOSTIC_WEIGHTS } from './diagnosticWeights';
import type { NextTestCandidate } from './types';

function computeWeightedScore(
  candidate: NextTestCandidate,
  weights: DiagnosticCandidateWeights,
): number {
  const breakdown = candidate.scoreBreakdown;
  return (
    breakdown.existingSystemBoost * weights.existingSystemBoost
    + breakdown.hypothesisAlignment * weights.hypothesisAlignment
    + breakdown.routingFit * weights.routingFit
    + breakdown.branchBoost * weights.branchBoost
    + breakdown.measurementBoost * weights.measurementBoost
    - breakdown.deprioritizationPenalty * weights.deprioritizationPenalty
    - breakdown.repeatPenalty * weights.repeatPenalty
  );
}

export function rankDiagnosticCandidates(
  candidates: NextTestCandidate[],
  weights: DiagnosticCandidateWeights = DEFAULT_DIAGNOSTIC_WEIGHTS,
): NextTestCandidate[] {
  return candidates
    .map((candidate) => ({
      ...candidate,
      score: computeWeightedScore(candidate, weights),
    }))
    .sort((left, right) => {
      if (right.score !== left.score) return right.score - left.score;
      if (left.type !== right.type) {
        return left.type === 'service_procedure' ? -1 : 1;
      }
      return left.id.localeCompare(right.id);
    });
}
