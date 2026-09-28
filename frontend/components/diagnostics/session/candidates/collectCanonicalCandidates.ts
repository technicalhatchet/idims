import {
  deriveCanonicalRoutingAdjustments,
} from '../../knowledge/canonical/canonicalGraphRuntime';
import { resolveDiagnosticGraphForSession } from '../../knowledge/canonical/resolveDiagnosticGraph';
import type { DiagnosticSession } from '../types';
import {
  getCanonicalTestAlias,
} from './canonicalTestAliases';
import { createEmptyScoreBreakdown, type NextTestCandidate } from './types';

/**
 * CG-1D / CG-2 — canonical + resolved manufacturer overlay candidates merge via routingFit.
 * Conservative contribution: routingFit weight in diagnosticWeights (0.25).
 */
export function collectCanonicalCandidates(
  session: DiagnosticSession,
): NextTestCandidate[] {
  const resolvedGraph = resolveDiagnosticGraphForSession(session);
  const adjustments = deriveCanonicalRoutingAdjustments(session);
  if (!adjustments.length) return [];

  const candidates: NextTestCandidate[] = [];

  for (const adjustment of adjustments) {
    const alias = getCanonicalTestAlias(adjustment.testAliasId);
    if (!alias) continue;

    const breakdown = createEmptyScoreBreakdown();
    breakdown.routingFit = adjustment.routingFit;

    const binding = resolvedGraph?.procedureBindings.find(
      (item) => item.testTargetId === adjustment.testTargetId,
    );
    const displayLabel = binding?.displayTitle || alias.label;
    const reason = binding
      ? `${adjustment.reason} (${binding.displayTitle || binding.procedureId})`
      : adjustment.reason;

    const procedureIds = adjustment.procedureIds?.length
      ? adjustment.procedureIds
      : (alias.procedureIds || []);

    for (const procedureId of procedureIds) {
      candidates.push({
        id: `canonical.${adjustment.testTargetId}.${procedureId}`,
        type: 'service_procedure',
        target: alias.componentIds?.[0] ?? null,
        source: { system: 'canonical', id: adjustment.testTargetId },
        wizardStepKey: null,
        procedureId,
        score: 0,
        scoreBreakdown: breakdown,
        eligible: true,
        reason,
        label: displayLabel,
      });
    }

    for (const wizardStepKey of alias.wizardStepKeys || []) {
      candidates.push({
        id: `canonical.${adjustment.testTargetId}.${wizardStepKey}`,
        type: 'wizard_step',
        target: alias.componentIds?.[0] ?? null,
        source: { system: 'canonical', id: adjustment.testTargetId },
        wizardStepKey,
        procedureId: null,
        score: 0,
        scoreBreakdown: breakdown,
        eligible: true,
        reason,
        label: displayLabel,
      });
    }
  }

  return candidates;
}
