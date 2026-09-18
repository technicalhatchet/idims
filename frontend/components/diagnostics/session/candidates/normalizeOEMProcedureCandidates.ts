import {
  recommendServiceProcedures,
  type ProcedureRecommendation,
  type RecommendServiceProceduresInput,
} from '../../procedures/recommendServiceProcedures';
import { isStrongProcedureLead } from '../../procedures/procedureWizardLead';
import { createEmptyScoreBreakdown, type NextTestCandidate } from './types';

const OEM_PRIORITY_SCALE = 100;
const STRONG_OEM_FLOOR_BOOST = 0.78;

function oemPriorityBoost(recommendation: ProcedureRecommendation): number {
  const scaled = Math.min(1, recommendation.priority / OEM_PRIORITY_SCALE);
  if (isStrongProcedureLead(recommendation)) {
    return Math.max(scaled, STRONG_OEM_FLOOR_BOOST);
  }
  return scaled;
}

export function normalizeOEMProcedureCandidates(
  procedureContext: RecommendServiceProceduresInput,
): NextTestCandidate[] {
  const recommendations = recommendServiceProcedures(procedureContext);

  return recommendations.map((recommendation) => {
    const breakdown = createEmptyScoreBreakdown();
    breakdown.existingSystemBoost = oemPriorityBoost(recommendation);

    const primaryComponent = recommendation.procedure.componentIds?.[0] || null;

    return {
      id: `oem.${recommendation.procedureId}`,
      type: 'service_procedure',
      target: primaryComponent,
      source: { system: 'oem', id: recommendation.procedureId },
      wizardStepKey: null,
      procedureId: recommendation.procedureId,
      score: 0,
      scoreBreakdown: breakdown,
      eligible: true,
      reason: recommendation.reason,
      label: recommendation.procedure.title,
    };
  });
}
