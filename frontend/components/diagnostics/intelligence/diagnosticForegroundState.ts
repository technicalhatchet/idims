import type { ComponentEvidenceScore, DiagnosticIntelligenceResult } from './evidenceTypes';
import type { ProcedureRunState } from '../procedures/types';
import { getServiceProcedure } from '../procedures/procedureRegistry';
import { procedureRunRequiresRepairAction } from '../procedures/procedureWizardRouting';
import { resolveProcedureRepairHeadline } from '../procedures/procedureRunPresentation';
import { getComponentVerificationLevel } from './componentVerification';

export type DiagnosticForegroundMode =
  | 'confirmed_fault'
  | 'active_hypothesis'
  | 'continuing_tests'
  | 'oem_path_complete'
  | 'remaining_upstream_path'
  | 'no_supported_fault'
  | 'insufficient_evidence';

export interface DiagnosticForegroundState {
  mode: DiagnosticForegroundMode;
  categoryId: string | null;
  categoryLabel: string | null;
  headline: string;
  detail: string;
  /** Technician-facing tier label — not a calibrated probability. */
  tierLabel: string;
  showPercent: boolean;
  percent: number | null;
  strengthWord: string | null;
  ruledOutLabels: string[];
  confirmedLabels: string[];
  /** When OEM path is complete but evidence still supports an upstream control path. */
  remainingPathLabel?: string | null;
  remainingPathDetail?: string | null;
}

function flattenComponents(
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
  return list;
}

function primaryComponentForCategory(
  components: ComponentEvidenceScore[],
  categoryId: string,
): ComponentEvidenceScore | null {
  const inCategory = components
    .filter((item) => item.categoryId === categoryId)
    .sort((a, b) => b.evidence - a.evidence);
  return inCategory[0] || null;
}

function isCategoryActiveAsHypothesis(
  category: { id: string; evidence: number },
  components: ComponentEvidenceScore[],
): boolean {
  if (category.evidence <= 0) return false;
  const primary = primaryComponentForCategory(components, category.id);
  if (!primary) return true;
  if (primary.state === 'eliminated') return false;
  if (primary.state === 'confirmed') return true;
  const inCategory = components.filter((item) => item.categoryId === category.id);
  if (inCategory.length > 0 && inCategory.every((item) => item.state === 'eliminated')) {
    return false;
  }
  return true;
}

const UPSTREAM_CATEGORY_IDS = ['control_board', 'control_hmi'] as const;

function buildUpstreamRemaining(
  intelligence: DiagnosticIntelligenceResult,
  components: ComponentEvidenceScore[],
  ruledOut: ComponentEvidenceScore[],
): Pick<DiagnosticForegroundState, 'categoryId' | 'categoryLabel' | 'headline' | 'detail' | 'remainingPathLabel' | 'remainingPathDetail'> | null {
  const upstream = intelligence.topCategories?.find((category) =>
    UPSTREAM_CATEGORY_IDS.includes(category.id as typeof UPSTREAM_CATEGORY_IDS[number])
    && category.evidence > 0
    && isCategoryActiveAsHypothesis(category, components),
  ) || intelligence.categories.find((category) =>
    UPSTREAM_CATEGORY_IDS.includes(category.id as typeof UPSTREAM_CATEGORY_IDS[number])
    && category.evidence > 0
    && isCategoryActiveAsHypothesis(category, components),
  );

  if (!upstream) return null;

  const primary = primaryComponentForCategory(components, upstream.id);
  const label = primary?.label || upstream.label;
  const ruledOutSummary = ruledOut.map((item) => item.label).join(', ');

  return {
    categoryId: upstream.id,
    categoryLabel: label,
    headline: label,
    detail: ruledOutSummary
      ? `Tested downstream components passed (${ruledOutSummary}). Remaining supported path: ${upstream.label}.`
      : `Remaining supported path: ${upstream.label} (wiring, inputs, or control).`,
    remainingPathLabel: upstream.label,
    remainingPathDetail: 'The tested downstream components have passed. The remaining supported path is upstream in the control system.',
  };
}

function buildOemManufacturerInProgressForeground(
  ruledOutLabels: string[],
  oemCurrentTestFocus?: string | null,
): DiagnosticForegroundState {
  const focus = oemCurrentTestFocus?.trim() || null;
  const ruledSummary = ruledOutLabels.length
    ? `${ruledOutLabels.join(', ')} verified. `
    : '';
  return {
    mode: 'continuing_tests',
    categoryId: null,
    categoryLabel: focus,
    headline: focus || 'Diagnostic in progress',
    detail: focus
      ? `${ruledSummary}This test checks the next manufacturer path before moving deeper into the complaint.`
      : `${ruledSummary}We're continuing through the manufacturer diagnostic path.`,
    tierLabel: focus ? 'Next test' : 'Diagnostic in progress',
    showPercent: false,
    percent: null,
    strengthWord: null,
    ruledOutLabels,
    confirmedLabels: [],
  };
}

function shouldPreferOemInProgressForeground(
  options: {
    oemManufacturerPathActive?: boolean;
    oemDiagnosticPathExhausted?: boolean;
    oemConfirmedRepairProcedureId?: string | null;
  },
): boolean {
  return Boolean(
    options.oemManufacturerPathActive
    && !options.oemDiagnosticPathExhausted
    && !options.oemConfirmedRepairProcedureId,
  );
}

export function resolveDiagnosticForegroundState(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
  options: {
    procedureRuns?: Record<string, ProcedureRunState>;
    oemDiagnosticPathExhausted?: boolean;
    oemManufacturerPathActive?: boolean;
    oemConfirmedRepairProcedureId?: string | null;
    /** Next OEM procedure title — presentation only, does not affect ranking. */
    oemCurrentTestFocus?: string | null;
  } = {},
): DiagnosticForegroundState | null {
  if (!intelligence) return null;

  const procedureRuns = options.procedureRuns || {};
  const confirmedRepairProcedureId = options.oemConfirmedRepairProcedureId;
  if (confirmedRepairProcedureId) {
    const repairRun = procedureRuns[confirmedRepairProcedureId];
    if (
      repairRun
      && procedureRunRequiresRepairAction(confirmedRepairProcedureId, repairRun)
    ) {
      const procedure = getServiceProcedure(confirmedRepairProcedureId);
      const headline = resolveProcedureRepairHeadline(procedure, repairRun)
        || 'Repair action identified';
      return {
        mode: 'confirmed_fault',
        categoryId: null,
        categoryLabel: headline,
        headline,
        detail: 'Manufacturer diagnostic test identified a component fault that can explain the complaint.',
        tierLabel: 'Fault identified',
        showPercent: false,
        percent: null,
        strengthWord: null,
        ruledOutLabels: [],
        confirmedLabels: [headline],
      };
    }
  }

  const components = flattenComponents(intelligence.componentsByCategory);
  const confirmed = components.filter((item) => item.state === 'confirmed');
  const ruledOut = components.filter((item) => item.state === 'eliminated');
  const hasProcedureActivity = Object.values(procedureRuns).some((run) => Boolean(run));

  if (confirmed.length > 0) {
    const lead = confirmed[0];
    const category = intelligence.categories.find((item) => item.id === lead.categoryId);
    return {
      mode: 'confirmed_fault',
      categoryId: category?.id || lead.categoryId,
      categoryLabel: lead.label,
      headline: lead.label,
      detail: `Confirmed fault path from diagnostic evidence.${ruledOut.length ? ` ${ruledOut.length} other component${ruledOut.length === 1 ? '' : 's'} ruled out.` : ''}`,
      tierLabel: 'Confirmed fault path',
      showPercent: false,
      percent: null,
      strengthWord: 'CONFIRMED',
      ruledOutLabels: ruledOut.map((item) => item.label),
      confirmedLabels: confirmed.map((item) => item.label),
    };
  }

  const activeCategories = (intelligence.topCategories || []).filter((category) =>
    isCategoryActiveAsHypothesis(category, components),
  );

  const ruledOutLabels = ruledOut.map((item) => item.label);
  if (shouldPreferOemInProgressForeground(options)) {
    return buildOemManufacturerInProgressForeground(
      ruledOutLabels,
      options.oemCurrentTestFocus,
    );
  }

  if (activeCategories.length > 0) {
    const top = activeCategories[0];
    const second = activeCategories[1];
    const margin = top.evidence - (second?.evidence || 0);
    const primary = primaryComponentForCategory(components, top.id);
    const label = primary?.label || top.label;

    return {
      mode: 'active_hypothesis',
      categoryId: top.id,
      categoryLabel: label,
      headline: label,
      detail: margin >= 15
        ? `${top.label} leads competing categories, but no component is confirmed yet — continue targeted testing.`
        : `${top.label} is trending, but evidence is still close — more measurements will sharpen the picture.`,
      tierLabel: margin >= 15 ? 'Strong lead' : margin >= 8 ? 'Trending lead' : 'Early lead',
      showPercent: false,
      percent: null,
      strengthWord: margin >= 15 ? 'LIKELY' : 'EARLY',
      ruledOutLabels: ruledOut.map((item) => item.label),
      confirmedLabels: [],
    };
  }

  const verifiedGoodCount = ruledOut.length;
  const hasNegativeEvidence = verifiedGoodCount > 0 || hasProcedureActivity;

  const upstreamRemaining = buildUpstreamRemaining(intelligence, components, ruledOut);

  if (hasNegativeEvidence) {
    if (options.oemDiagnosticPathExhausted) {
      const base = {
        mode: 'oem_path_complete' as const,
        categoryId: null,
        categoryLabel: null,
        headline: 'No failed component identified',
        detail: 'The available manufacturer tests did not identify a failed component.',
        tierLabel: 'Manufacturer path complete',
        showPercent: false,
        percent: null,
        strengthWord: null,
        ruledOutLabels,
        confirmedLabels: [] as string[],
        remainingPathLabel: upstreamRemaining?.remainingPathLabel ?? null,
        remainingPathDetail: upstreamRemaining?.remainingPathDetail ?? null,
      };
      if (upstreamRemaining) {
        return {
          ...base,
          categoryId: upstreamRemaining.categoryId,
          categoryLabel: upstreamRemaining.categoryLabel,
        };
      }
      return base;
    }

    if (upstreamRemaining) {
      return {
        mode: 'remaining_upstream_path',
        categoryId: upstreamRemaining.categoryId,
        categoryLabel: upstreamRemaining.categoryLabel,
        headline: upstreamRemaining.headline,
        detail: upstreamRemaining.detail,
        tierLabel: 'Remaining supported path',
        showPercent: false,
        percent: null,
        strengthWord: null,
        ruledOutLabels,
        confirmedLabels: [],
        remainingPathLabel: upstreamRemaining.remainingPathLabel,
        remainingPathDetail: upstreamRemaining.remainingPathDetail,
      };
    }

    if (options.oemManufacturerPathActive && !options.oemDiagnosticPathExhausted) {
      return buildOemManufacturerInProgressForeground(
        ruledOutLabels,
        options.oemCurrentTestFocus,
      );
    }

    return {
      mode: 'no_supported_fault',
      categoryId: null,
      categoryLabel: null,
      headline: 'No failed component identified',
      detail: verifiedGoodCount
        ? 'The available diagnostic information does not isolate the failure to a specific component.'
        : 'Solomon is continuing through the remaining supported tests.',
      tierLabel: 'No supported fault',
      showPercent: false,
      percent: null,
      strengthWord: null,
      ruledOutLabels,
      confirmedLabels: [],
    };
  }

  if (intelligence.matchedRuleCount > 0 || (intelligence.topCategories?.some((c) => c.evidence > 0))) {
    const onOemPath = options.oemManufacturerPathActive && !options.oemDiagnosticPathExhausted;
    if (onOemPath) {
      return buildOemManufacturerInProgressForeground(
        [],
        options.oemCurrentTestFocus,
      );
    }
    return {
      mode: 'continuing_tests',
      categoryId: intelligence.topCategories?.[0]?.id || null,
      categoryLabel: intelligence.topCategories?.[0]?.label || null,
      headline: 'Gathering evidence',
      detail: 'Early evidence only — complaint and initial observations recorded; key tests still needed.',
      tierLabel: 'Early evidence',
      showPercent: false,
      percent: null,
      strengthWord: null,
      ruledOutLabels: [],
      confirmedLabels: [],
    };
  }

  return {
    mode: 'insufficient_evidence',
    categoryId: null,
    categoryLabel: null,
    headline: 'Not enough evidence yet',
    detail: 'Complete complaint context and initial checks before a lead hypothesis is shown.',
    tierLabel: 'Insufficient evidence',
    showPercent: false,
    percent: null,
    strengthWord: null,
    ruledOutLabels: [],
    confirmedLabels: [],
  };
}

export function isComponentVerifiedGoodForHypothesis(
  componentId: string,
  intelligence: DiagnosticIntelligenceResult | null | undefined,
): boolean {
  if (!intelligence) return false;
  const components = flattenComponents(intelligence.componentsByCategory);
  const match = components.find((item) => item.id === componentId);
  if (!match) return false;
  return getComponentVerificationLevel(match.state) === 'verified_good';
}

export function shouldShowDiagnosticForegroundCard(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
  options: {
    visitedStepKeys?: string[];
    procedureRuns?: Record<string, ProcedureRunState>;
    fields?: Record<string, unknown>;
    currentStepKey?: string | null;
  } = {},
): boolean {
  const foreground = resolveDiagnosticForegroundState(intelligence, {
    procedureRuns: options.procedureRuns,
  });
  if (!foreground) return false;

  if (foreground.mode === 'insufficient_evidence') return false;

  const currentStepKey = options.currentStepKey;
  if (!currentStepKey || currentStepKey === 'complaint') {
    return false;
  }

  const visited = options.visitedStepKeys || [];
  const beyondComplaint = visited.some((key) => key !== 'complaint');
  const hasProcedureActivity = Object.values(options.procedureRuns || {}).some((run) => Boolean(run));

  return beyondComplaint || hasProcedureActivity || foreground.mode !== 'continuing_tests';
}
