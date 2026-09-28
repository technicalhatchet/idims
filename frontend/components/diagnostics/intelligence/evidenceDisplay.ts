import type { ComponentEvidenceScore, DiagnosticIntelligenceResult } from './evidenceTypes';
import type { ProcedureRunState } from '../procedures/types';
import {
  resolveDiagnosticForegroundState,
  shouldShowDiagnosticForegroundCard,
} from './diagnosticForegroundState';

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
    const foreground = resolveDiagnosticForegroundState(intelligence);
    if (foreground?.mode === 'remaining_upstream_path') {
      return {
        tier: 'low',
        percent: clampPercent(0),
        explanation: foreground.detail,
        stars: 2,
      };
    }
    if (foreground?.mode === 'no_supported_fault') {
      return {
        tier: 'low',
        percent: clampPercent(0),
        explanation: foreground.detail,
        stars: 1,
      };
    }
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
export interface DiagnosticLeadPresentationOptions {
  procedureRuns?: Record<string, ProcedureRunState>;
  oemDiagnosticPathExhausted?: boolean;
  oemManufacturerPathActive?: boolean;
  oemConfirmedRepairProcedureId?: string | null;
  oemCurrentTestFocus?: string | null;
}

export function formatLeadCauseStrength(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
  options: DiagnosticLeadPresentationOptions = {},
): LeadCauseStrengthPresentation | null {
  const foreground = resolveDiagnosticForegroundState(intelligence, options);
  if (!foreground) return null;
  if (foreground.mode === 'insufficient_evidence') return null;

  const components = flattenComponents(intelligence?.componentsByCategory);
  const top = intelligence?.topCategories?.find((item) => item.id === foreground.categoryId)
    || intelligence?.topCategories?.[0];
  const second = intelligence?.topCategories?.find((item) => item.id !== foreground.categoryId);

  const tier: DiagnosisConfidenceTier | 'confirmed' = foreground.mode === 'confirmed_fault'
    ? 'confirmed'
    : foreground.mode === 'active_hypothesis'
      ? 'medium'
      : 'low';

  const categoryLabel = foreground.categoryLabel || foreground.headline;

  return {
    categoryLabel,
    tier,
    tierLabel: foreground.tierLabel,
    summary: foreground.detail,
    evidenceScore: top?.evidence || 0,
    marginOverNext: (top?.evidence || 0) - (second?.evidence || 0),
    alternateLabels: components
      .filter((item) => item.state === 'eliminated')
      .map((item) => item.label),
  };
}

export interface DiyLeadCardPresentation {
  categoryId: string;
  categoryLabel: string;
  percent: number | null;
  strengthWord: string | null;
  tierLabel: string;
  subtitle: string;
  evidenceScore: number;
  marginOverNext: number;
  stars: number;
  tier: DiagnosisConfidenceTier | 'confirmed';
  foregroundMode: import('./diagnosticForegroundState').DiagnosticForegroundMode;
  headline: string;
  showPercent: boolean;
  ruledOutLabels: string[];
  remainingPathLabel: string | null;
  remainingPathDetail: string | null;
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
  if (shouldShowDiagnosticForegroundCard(intelligence, options)) {
    return true;
  }
  if (!intelligence?.topCategories?.some((category) => category.evidence > 0)) {
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
  options: DiagnosticLeadPresentationOptions = {},
): DiyLeadCardPresentation | null {
  const leadOptions = {
    procedureRuns: options.procedureRuns,
    oemDiagnosticPathExhausted: options.oemDiagnosticPathExhausted,
    oemManufacturerPathActive: options.oemManufacturerPathActive,
    oemConfirmedRepairProcedureId: options.oemConfirmedRepairProcedureId,
    oemCurrentTestFocus: options.oemCurrentTestFocus,
  };
  const foreground = resolveDiagnosticForegroundState(intelligence, leadOptions);
  if (!foreground || foreground.mode === 'insufficient_evidence') return null;

  const strength = formatLeadCauseStrength(intelligence, leadOptions);
  const confidence = computeDiagnosisConfidence(intelligence);
  const tier = strength?.tier || 'low';

  const categoryId = foreground.categoryId
    || intelligence?.topCategories?.[0]?.id
    || 'unknown';

  const showPercent = foreground.mode === 'active_hypothesis'
    && foreground.showPercent
    && (confidence?.percent ?? 0) > 0;

  return {
    categoryId,
    categoryLabel: foreground.headline,
    percent: showPercent ? confidence?.percent ?? null : null,
    strengthWord: foreground.strengthWord || (tier === 'confirmed' ? DIY_STRENGTH_WORD.confirmed : null),
    tierLabel: foreground.tierLabel,
    subtitle: foreground.detail,
    evidenceScore: strength?.evidenceScore || 0,
    marginOverNext: strength?.marginOverNext || 0,
    stars: confidence?.stars || (tier === 'confirmed' ? 5 : 2),
    tier,
    foregroundMode: foreground.mode,
    headline: foreground.headline,
    showPercent,
    ruledOutLabels: foreground.ruledOutLabels,
    remainingPathLabel: foreground.remainingPathLabel ?? null,
    remainingPathDetail: foreground.remainingPathDetail ?? null,
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
