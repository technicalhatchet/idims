import type { RecommendServiceProceduresInput } from '../../procedures/recommendServiceProcedures';
import type { DiagnosticSession } from '../types';
import type { DiagnosticWizardRankContext } from './candidateContext';
import { collectBranchCandidates } from './collectBranchCandidates';
import { collectCanonicalCandidates } from './collectCanonicalCandidates';
import { createEmptyScoreBreakdown, type NextTestCandidate } from './types';
import { normalizeOEMProcedureCandidates } from './normalizeOEMProcedureCandidates';
import { normalizeWizardCandidates } from './normalizeWizardCandidates';

function mergeScoreBreakdown(
  left: NextTestCandidate['scoreBreakdown'],
  right: NextTestCandidate['scoreBreakdown'],
): NextTestCandidate['scoreBreakdown'] {
  return {
    existingSystemBoost: Math.max(left.existingSystemBoost, right.existingSystemBoost),
    hypothesisAlignment: Math.max(left.hypothesisAlignment, right.hypothesisAlignment),
    routingFit: Math.max(left.routingFit, right.routingFit),
    branchBoost: Math.max(left.branchBoost, right.branchBoost),
    measurementBoost: Math.max(left.measurementBoost, right.measurementBoost),
    deprioritizationPenalty: Math.max(left.deprioritizationPenalty, right.deprioritizationPenalty),
    repeatPenalty: Math.max(left.repeatPenalty, right.repeatPenalty),
  };
}

function mergeCandidates(existing: NextTestCandidate, incoming: NextTestCandidate): NextTestCandidate {
  const scoreBreakdown = mergeScoreBreakdown(existing.scoreBreakdown, incoming.scoreBreakdown);
  return {
    ...existing,
    scoreBreakdown,
    reason: existing.reason || incoming.reason,
    label: existing.label || incoming.label,
    procedureId: existing.procedureId || incoming.procedureId,
    target: existing.target || incoming.target,
    source: existing.scoreBreakdown.existingSystemBoost >= incoming.scoreBreakdown.existingSystemBoost
      ? existing.source
      : incoming.source,
  };
}

function candidateDedupeKey(candidate: NextTestCandidate): string {
  if (candidate.procedureId) return `procedure:${candidate.procedureId}`;
  if (candidate.wizardStepKey) return `wizard:${candidate.wizardStepKey}`;
  return candidate.id;
}

export function mergeDiagnosticCandidateList(
  candidates: NextTestCandidate[],
): NextTestCandidate[] {
  const merged = new Map<string, NextTestCandidate>();

  for (const candidate of candidates) {
    const key = candidateDedupeKey(candidate);
    const existing = merged.get(key);
    if (!existing) {
      merged.set(key, candidate);
      continue;
    }
    merged.set(key, mergeCandidates(existing, candidate));
  }

  return [...merged.values()];
}

export function collectDiagnosticCandidates(
  session: DiagnosticSession,
  wizardContext: DiagnosticWizardRankContext,
  procedureContext: RecommendServiceProceduresInput,
): NextTestCandidate[] {
  const wizardCandidates = normalizeWizardCandidates(session, wizardContext);
  const oemCandidates = normalizeOEMProcedureCandidates(procedureContext);
  const canonicalCandidates = collectCanonicalCandidates(session);
  const branchCandidates = collectBranchCandidates(session);

  return mergeDiagnosticCandidateList([
    ...wizardCandidates,
    ...oemCandidates,
    ...canonicalCandidates,
    ...branchCandidates,
  ]);
}

export function createCandidateFromSources(
  sources: NextTestCandidate[],
): NextTestCandidate {
  const base = sources[0];
  const breakdown = createEmptyScoreBreakdown();
  for (const source of sources) {
    breakdown.existingSystemBoost = Math.max(
      breakdown.existingSystemBoost,
      source.scoreBreakdown.existingSystemBoost,
    );
  }
  return {
    ...base,
    scoreBreakdown: breakdown,
  };
}
