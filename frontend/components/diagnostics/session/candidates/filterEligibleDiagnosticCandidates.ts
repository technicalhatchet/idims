import { isStepKeyEnabled } from '../../routing/routingEngine';
import { buildStepKeyToIdMap } from '../../routing/prerequisiteEngine';
import type { DiagnosticSession } from '../types';
import type { DiagnosticWizardRankContext } from './candidateContext';
import type { NextTestCandidate } from './types';

export type EligibilitySplit = {
  eligible: NextTestCandidate[];
  blocked: NextTestCandidate[];
};

function isWizardStepRoutingEligible(
  stepKey: string,
  wizardContext: DiagnosticWizardRankContext,
): string | null {
  if (!isStepKeyEnabled(wizardContext.routing, stepKey)) {
    return 'routing_disabled';
  }
  return null;
}

function isWizardStepPrerequisiteEligible(
  stepKey: string,
  session: DiagnosticSession,
  wizardContext: DiagnosticWizardRankContext,
): string | null {
  const definition = wizardContext.wizardDefinition;
  if (!definition) return null;

  const required = definition.routing?.prerequisites?.[stepKey] || [];
  const activeRequired = required.filter((reqKey) => isStepKeyEnabled(wizardContext.routing, reqKey));
  if (!activeRequired.length) return null;

  const visitedKeys = new Set(session.navigation.visitedStepKeys);
  const missing = activeRequired.filter((reqKey) => !visitedKeys.has(reqKey));
  if (missing.length) return 'prerequisites_missing';

  return null;
}

function isProcedureEligible(
  procedureId: string,
  session: DiagnosticSession,
): string | null {
  const run = session.payload.procedureRuns[procedureId];
  if (run?.status === 'completed') {
    return 'procedure_completed';
  }
  return null;
}

function applyEligibility(
  candidate: NextTestCandidate,
  session: DiagnosticSession,
  wizardContext: DiagnosticWizardRankContext,
): NextTestCandidate {
  if (candidate.type === 'wizard_step' && candidate.wizardStepKey) {
    const stepKey = candidate.wizardStepKey;
    if (session.navigation.visitedStepKeys.includes(stepKey)) {
      return {
        ...candidate,
        eligible: false,
        blockedReason: 'already_visited',
      };
    }

    const routingBlock = isWizardStepRoutingEligible(stepKey, wizardContext);
    if (routingBlock) {
      return { ...candidate, eligible: false, blockedReason: routingBlock };
    }

    const prerequisiteBlock = isWizardStepPrerequisiteEligible(stepKey, session, wizardContext);
    if (prerequisiteBlock) {
      return { ...candidate, eligible: false, blockedReason: prerequisiteBlock };
    }
  }

  if (candidate.type === 'service_procedure' && candidate.procedureId) {
    const procedureBlock = isProcedureEligible(candidate.procedureId, session);
    if (procedureBlock) {
      return { ...candidate, eligible: false, blockedReason: procedureBlock };
    }
  }

  return { ...candidate, eligible: true, blockedReason: null };
}

export function filterEligibleDiagnosticCandidates(
  candidates: NextTestCandidate[],
  session: DiagnosticSession,
  wizardContext: DiagnosticWizardRankContext,
): EligibilitySplit {
  const evaluated = candidates.map((candidate) =>
    applyEligibility(candidate, session, wizardContext),
  );

  const eligible = evaluated.filter((candidate) => candidate.eligible);
  const blocked = evaluated.filter((candidate) => !candidate.eligible);
  return { eligible, blocked };
}

export function isWizardStepUnlocked(
  stepKey: string,
  session: DiagnosticSession,
  wizardContext: DiagnosticWizardRankContext,
): boolean {
  const candidate: NextTestCandidate = {
    id: `wizard.${stepKey}`,
    type: 'wizard_step',
    target: stepKey,
    source: { system: 'wizard', id: stepKey },
    wizardStepKey: stepKey,
    procedureId: null,
    score: 0,
    scoreBreakdown: {
      existingSystemBoost: 0,
      hypothesisAlignment: 0,
      routingFit: 0,
      branchBoost: 0,
      measurementBoost: 0,
      deprioritizationPenalty: 0,
      repeatPenalty: 0,
    },
    eligible: true,
  };
  return applyEligibility(candidate, session, wizardContext).eligible;
}

export function buildVisitedStepIdSet(
  wizardContext: DiagnosticWizardRankContext,
  visitedStepKeys: string[],
): Set<string> {
  const definition = wizardContext.wizardDefinition;
  if (!definition) return new Set();

  const reviewStepId = wizardContext.reviewStepId || definition.reviewStep?.id || 'diagnostic_review';
  const stepKeyToId = buildStepKeyToIdMap(definition, reviewStepId);
  const ids = new Set<string>();
  for (const stepKey of visitedStepKeys) {
    const stepId = stepKeyToId[stepKey];
    if (stepId) ids.add(stepId);
  }
  return ids;
}
