import type { ComponentEvidenceScore, DiagnosticIntelligenceResult } from './evidenceTypes';
import type { ProcedureRunState } from '../procedures/types';

const COMPLAINT_ONLY_FIELD_PREFIXES = [
  'customer_complaint.',
];

export interface EvidenceShareItem {
  id: string;
  label: string;
  evidence: number;
  sharePercent: number;
}

/** Relative evidence share among competing categories (sums to 100% across active items). */
export function normalizeEvidenceShares(
  items: Array<{ id: string; label: string; evidence: number }>,
): EvidenceShareItem[] {
  const active = items.filter((item) => item.evidence > 0);
  const total = active.reduce((sum, item) => sum + item.evidence, 0);

  if (!total) {
    return items.map((item) => ({ ...item, sharePercent: 0 }));
  }

  const withShares = items.map((item) => ({
    ...item,
    sharePercent: item.evidence > 0 ? Math.round((item.evidence / total) * 100) : 0,
  }));

  const activeShares = withShares.filter((item) => item.sharePercent > 0);
  const shareSum = activeShares.reduce((sum, item) => sum + item.sharePercent, 0);
  if (shareSum !== 100 && activeShares.length > 0) {
    const lead = activeShares.reduce((best, item) => (item.evidence > best.evidence ? item : best));
    const leadIndex = withShares.findIndex((item) => item.id === lead.id);
    if (leadIndex >= 0) {
      withShares[leadIndex] = {
        ...withShares[leadIndex],
        sharePercent: withShares[leadIndex].sharePercent + (100 - shareSum),
      };
    }
  }

  return withShares;
}

export type DiagnosisConfidenceTier = 'low' | 'medium' | 'high';

export interface DiagnosisConfidenceResult {
  tier: DiagnosisConfidenceTier;
  percent: number;
  explanation: string;
  stars: number;
}

function clampPercent(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function flattenComponents(
  componentsByCategory: Record<string, ComponentEvidenceScore[]> = {},
): ComponentEvidenceScore[] {
  return Object.values(componentsByCategory).flat();
}

export function computeDiagnosisConfidence(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
): DiagnosisConfidenceResult | null {
  if (!intelligence) return null;

  const top = intelligence.topCategories?.[0];
  const second = intelligence.topCategories?.[1];
  const components = flattenComponents(intelligence.componentsByCategory);
  const confirmedFailures = components.filter((component) => component.state === 'confirmed');
  const ruledOut = components.filter((component) => component.state === 'eliminated');
  const testedCount = components.filter(
    (component) => component.state !== 'unknown' || component.evidence > 0,
  ).length;

  if (confirmedFailures.length > 0) {
    const lead = confirmedFailures[0];
    const ruledOutCount = ruledOut.length;
    let percent = 78 + Math.min(18, confirmedFailures.length * 8 + ruledOutCount * 2);
    percent = clampPercent(percent);

    const names = confirmedFailures.map((component) => component.label).join(', ');
    const support =
      ruledOutCount > 0
        ? ` ${ruledOutCount} other component${ruledOutCount === 1 ? '' : 's'} ruled out.`
        : '';

    return {
      tier: percent >= 85 ? 'high' : 'medium',
      percent,
      explanation: `Confirmed fault path: ${names}.${support}`,
      stars: percent >= 85 ? 5 : percent >= 70 ? 4 : 3,
    };
  }

  const topCategoryId = top?.id;
  const leadCategoryComponent = topCategoryId
    ? components.find((component) => component.categoryId === topCategoryId)
    : undefined;
  if (top && leadCategoryComponent?.state === 'eliminated') {
    const alternate = intelligence.topCategories?.find(
      (category) => category.id !== top.id && category.evidence > 0,
    );
    const percent = clampPercent(Math.max(22, Math.min(48, (alternate?.evidence || 0) * 0.55 + 18)));
    const label = alternate?.label || 'harness / control board';
    return {
      tier: 'low',
      percent,
      explanation: `${top.label} assembly tested good — follow ${label} path (harness, switch, CCU inputs).`,
      stars: 2,
    };
  }

  if (top && top.evidence > 0) {
    const margin = top.evidence - (second?.evidence || 0);
    let percent = top.evidence * 0.45 + margin * 0.35 + Math.min(15, testedCount * 3);
    percent = clampPercent(percent);

    const tier: DiagnosisConfidenceTier =
      percent >= 75 && margin >= 15 ? 'high' : percent >= 45 ? 'medium' : 'low';

    const explanation =
      margin >= 15
        ? `${top.label} leads competing categories, but no component is confirmed yet — continue targeted testing.`
        : `${top.label} is trending, but evidence is still close — more measurements will sharpen the picture.`;

    return {
      tier,
      percent,
      explanation,
      stars: tier === 'high' ? 4 : tier === 'medium' ? 3 : 2,
    };
  }

  if (intelligence.matchedRuleCount > 0) {
    return {
      tier: 'low',
      percent: clampPercent(20 + intelligence.matchedRuleCount * 2),
      explanation: 'Early evidence only — complaint and initial observations recorded; key tests still needed.',
      stars: 1,
    };
  }

  return null;
}

export interface LeadCauseStrengthPresentation {
  categoryLabel: string;
  tier: DiagnosisConfidenceTier | 'confirmed';
  tierLabel: string;
  summary: string;
  evidenceScore: number;
  marginOverNext: number;
  alternateLabels: string[];
}

const TIER_LABELS: Record<DiagnosisConfidenceTier | 'confirmed', string> = {
  low: 'Early lead',
  medium: 'Trending lead',
  high: 'Strong lead',
  confirmed: 'Confirmed fault path',
};

/**
 * Technician-facing lead-cause readout — uses existing scores/tiers, not calibrated probability.
 */
export function formatLeadCauseStrength(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
): LeadCauseStrengthPresentation | null {
  if (!intelligence?.topCategories?.length) return null;

  const components = flattenComponents(intelligence.componentsByCategory);
  const hasConfirmed = components.some((component) => component.state === 'confirmed');
  const leadCategoryComponent = components.find(
    (component) => component.categoryId === intelligence.topCategories[0]?.id,
  );
  const leadCategoryCleared = leadCategoryComponent?.state === 'eliminated';
  const rankedCategories = leadCategoryCleared
    ? intelligence.topCategories.filter((category) => {
        const component = components.find((item) => item.categoryId === category.id);
        return component?.state !== 'eliminated';
      })
    : intelligence.topCategories;
  const top = rankedCategories[0] || intelligence.topCategories[0];
  const second = rankedCategories[1] || intelligence.topCategories[1];
  const confidence = computeDiagnosisConfidence(intelligence);

  const tier: DiagnosisConfidenceTier | 'confirmed' = hasConfirmed
    ? 'confirmed'
    : confidence?.tier || 'low';

  const alternateLabels = rankedCategories
    .slice(1)
    .filter((category) => category.evidence > 0)
    .map((category) => category.label);

  return {
    categoryLabel: top.label,
    tier,
    tierLabel: TIER_LABELS[tier],
    summary: confidence?.explanation || `Working hypothesis: ${top.label}.`,
    evidenceScore: top.evidence,
    marginOverNext: top.evidence - (second?.evidence || 0),
    alternateLabels,
  };
}

export interface DiyLeadCardPresentation {
  categoryId: string;
  categoryLabel: string;
  percent: number;
  strengthWord: string;
  tierLabel: string;
  subtitle: string;
  evidenceScore: number;
  marginOverNext: number;
  stars: number;
  tier: DiagnosisConfidenceTier | 'confirmed';
}

const DIY_STRENGTH_WORD: Record<DiagnosisConfidenceTier | 'confirmed', string> = {
  low: 'EARLY',
  medium: 'LIKELY',
  high: 'LIKELY',
  confirmed: 'CONFIRMED',
};

/**
 * Compact DIY mobile card — uses existing computeDiagnosisConfidence percent (not evidence share %).
 */
function hasUserGatheredEvidence(
  fields: Record<string, unknown> = {},
): boolean {
  return Object.entries(fields).some(([key, value]) => {
    if (COMPLAINT_ONLY_FIELD_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      return false;
    }
    if (value === undefined || value === null || value === '' || value === false) {
      return false;
    }
    return true;
  });
}

/**
 * Leading hypothesis card waits for real diagnostic input — not complaint chips alone.
 */
export function shouldShowLeadingHypothesis(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
  options: {
    visitedStepKeys?: string[];
    procedureRuns?: Record<string, ProcedureRunState>;
    fields?: Record<string, unknown>;
    currentStepKey?: string | null;
  } = {},
): boolean {
  if (!intelligence?.topCategories?.some((category) => category.evidence > 0)) {
    return false;
  }

  const currentStepKey = options.currentStepKey;
  if (!currentStepKey || currentStepKey === 'complaint') {
    return false;
  }

  const visited = options.visitedStepKeys || [];
  const beyondComplaint = visited.some((key) => key !== 'complaint');
  const procedureRuns = options.procedureRuns || {};
  const hasProcedureActivity = Object.values(procedureRuns).some((run) => Boolean(run));

  return beyondComplaint || hasProcedureActivity || hasUserGatheredEvidence(options.fields);
}

export function formatDiyLeadCard(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
): DiyLeadCardPresentation | null {
  const strength = formatLeadCauseStrength(intelligence);
  const confidence = computeDiagnosisConfidence(intelligence);
  if (!strength || !confidence || !intelligence?.topCategories?.length) return null;

  const leadCategoryId =
    intelligence.topCategories.find((category) => category.label === strength.categoryLabel)?.id
    ?? intelligence.topCategories[0].id;

  return {
    categoryId: leadCategoryId,
    categoryLabel: strength.categoryLabel,
    percent: confidence.percent,
    strengthWord: DIY_STRENGTH_WORD[strength.tier],
    tierLabel: strength.tierLabel,
    subtitle: confidence.explanation,
    evidenceScore: strength.evidenceScore,
    marginOverNext: strength.marginOverNext,
    stars: confidence.stars,
    tier: strength.tier,
  };
}

export function listAllComponents(
  componentsByCategory: Record<string, ComponentEvidenceScore[]> = {},
): ComponentEvidenceScore[] {
  const seen = new Set<string>();
  const list: ComponentEvidenceScore[] = [];

  for (const components of Object.values(componentsByCategory)) {
    for (const component of components) {
      if (seen.has(component.id)) continue;
      seen.add(component.id);
      list.push(component);
    }
  }

  return list.sort((a, b) => {
    if (a.categoryId !== b.categoryId) return a.categoryId.localeCompare(b.categoryId);
    return a.label.localeCompare(b.label);
  });
}
