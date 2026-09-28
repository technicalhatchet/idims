import { getServiceProcedure } from './procedureRegistry';
import type { ProcedureRecommendation } from './recommendServiceProcedures';

export function resolveOemContinuationOfferProcedureId(
  payload: {
    oemContinuationOfferProcedureId?: string | null;
    oemConfirmedRepairPathActive?: string | null;
    oemRepairDecisionPending?: string | null;
    procedureRuns?: Record<string, { status?: string }>;
  } | null | undefined,
  bridgeTargetProcedureId?: string | null,
): string | null {
  if (payload?.oemConfirmedRepairPathActive || payload?.oemRepairDecisionPending) {
    return null;
  }
  const offerId = payload?.oemContinuationOfferProcedureId || bridgeTargetProcedureId || null;
  if (!offerId) return null;
  const run = payload?.procedureRuns?.[offerId];
  if (run?.status === 'in_progress' || run?.status === 'completed') {
    return null;
  }
  return offerId;
}

export function buildProcedureRecommendationForOffer(
  procedureId: string,
  procedureRecommendations: ProcedureRecommendation[] = [],
): ProcedureRecommendation | null {
  const existing = procedureRecommendations.find((item) => item.procedureId === procedureId);
  if (existing) return existing;
  const procedure = getServiceProcedure(procedureId);
  if (!procedure) return null;
  return {
    procedureId,
    procedure,
    reason: 'Next manufacturer diagnostic test',
    priority: 100,
  };
}

export function resolveOemNextTestOfferTitle(
  offerProcedureId: string | null | undefined,
  fallbackRecommendation: ProcedureRecommendation | null | undefined,
): string | null {
  if (offerProcedureId) {
    const procedure = getServiceProcedure(offerProcedureId);
    if (procedure?.title) return procedure.title;
  }
  return fallbackRecommendation?.procedure?.title ?? null;
}
