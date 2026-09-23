import { rankNextWizardSteps } from '../../intelligence/rankNextWizardSteps';
import type { DiagnosticIntelligenceResult } from '../../intelligence/evidenceTypes';
import { getEvidenceConfig } from '../../intelligence/evidenceRegistry';
import { resolveWizardStepKeyForProcedure } from '../../procedures/procedureWizardLead';
import type { DiagnosticSession } from '../types';
import type { DiagnosticWizardRankContext } from './candidateContext';
import {
  createEmptyScoreBreakdown,
  type NextTestCandidate,
} from './types';

const WIZARD_TOP_BOOST = 0.9;
const WIZARD_RANK_DECAY = 0.07;
const WIZARD_MIN_BOOST = 0.12;

function wizardPositionBoost(index: number, total: number): number {
  if (total <= 0) return 0;
  const raw = WIZARD_TOP_BOOST - index * WIZARD_RANK_DECAY;
  const floor = Math.max(WIZARD_MIN_BOOST, raw);
  const scale = total === 1 ? 1 : (total - index) / total;
  return Math.min(1, Math.max(floor, scale));
}

function resolveWizardStepKeys(
  session: DiagnosticSession,
  wizardContext: DiagnosticWizardRankContext,
): string[] {
  const intelligence = wizardContext.intelligence;
  const visitedStepKeys = session.navigation.visitedStepKeys;

  if (intelligence?.recommendedStepKeys?.length) {
    return intelligence.recommendedStepKeys.filter(
      (stepKey) => stepKey && !visitedStepKeys.includes(stepKey),
    );
  }

  const templateId = session.payload.templateId;
  const config = getEvidenceConfig(templateId);
  if (!config) return [];

  const topCategories = (intelligence?.topCategories || []).filter((cat) => cat.evidence > 0);

  return rankNextWizardSteps({
    config,
    matchedRules: [],
    topCategories,
    visitedStepKeys,
    defaultStepOrder: wizardContext.defaultStepOrder || [],
  });
}

function resolveWizardTarget(stepKey: string): string | null {
  if (stepKey === 'mechanical') return 'door_lock';
  if (stepKey === 'electrical') return 'control_board';
  return stepKey;
}

export function normalizeWizardCandidates(
  session: DiagnosticSession,
  wizardContext: DiagnosticWizardRankContext,
): NextTestCandidate[] {
  const rankedStepKeys = resolveWizardStepKeys(session, wizardContext);
  if (!rankedStepKeys.length) return [];

  return rankedStepKeys.map((stepKey, index) => {
    const breakdown = createEmptyScoreBreakdown();
    breakdown.existingSystemBoost = wizardPositionBoost(index, rankedStepKeys.length);

    return {
      id: `wizard.${stepKey}`,
      type: 'wizard_step',
      target: resolveWizardTarget(stepKey),
      source: { system: 'wizard', id: stepKey },
      wizardStepKey: stepKey,
      procedureId: null,
      score: 0,
      scoreBreakdown: breakdown,
      eligible: true,
      label: stepKey,
    };
  });
}

/** Maps OEM procedure to a wizard-step candidate when both refer to the same guided step. */
export function normalizeWizardCandidateFromProcedure(
  procedureId: string,
  procedure: { componentIds?: string[]; tags?: string[] },
  existingBoost: number,
): NextTestCandidate | null {
  const stepKey = resolveWizardStepKeyForProcedure(procedure as import('../../procedures/types').ServiceProcedure);
  if (!stepKey) return null;

  const breakdown = createEmptyScoreBreakdown();
  breakdown.existingSystemBoost = existingBoost;

  return {
    id: `wizard.${stepKey}`,
    type: 'wizard_step',
    target: procedure.componentIds?.[0] || stepKey,
    source: { system: 'wizard', id: stepKey },
    wizardStepKey: stepKey,
    procedureId,
    score: 0,
    scoreBreakdown: breakdown,
    eligible: true,
    label: stepKey,
  };
}

export function buildWizardRankContextFromIntelligence(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
): Pick<DiagnosticWizardRankContext, 'intelligence'> {
  return { intelligence };
}
