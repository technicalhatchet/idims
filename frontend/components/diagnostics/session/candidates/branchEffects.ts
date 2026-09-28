import type {
  BranchDeprioritizeRef,
  BranchNextTestCandidateRef,
  DecisionBranch,
  ProcedureRunState,
  ResolvedProcedureBranchEvent,
} from '../../procedures/types';
import { getCanonicalOntologyForTemplate } from '../../knowledge/canonical/canonicalRegistry';
import type { DiagnosticSession } from '../types';
import {
  CANONICAL_TEST_ALIASES,
  getCanonicalTestAlias,
  type CanonicalTestAlias,
} from './canonicalTestAliases';
import { resolveProcedureDecisionBranch } from './resolveProcedureBranch';
import type { NextTestCandidate } from './types';

const DEFAULT_BOOST = 0.35;
const DEFAULT_PENALTY = 0.3;

export interface BranchCandidateAdjustments {
  boosts: Map<string, number>;
  penalties: Map<string, number>;
  resolvedBranchCount: number;
}

function normalizeBoostRef(ref: BranchNextTestCandidateRef): { testId: string; amount: number } {
  if (typeof ref === 'string') {
    return { testId: ref, amount: DEFAULT_BOOST };
  }
  return {
    testId: ref.testId,
    amount: ref.priorityAdjustment ?? DEFAULT_BOOST,
  };
}

function normalizePenaltyRef(ref: BranchDeprioritizeRef): { target: string; amount: number } {
  if (typeof ref === 'string') {
    return { target: ref, amount: DEFAULT_PENALTY };
  }
  return {
    target: ref.target,
    amount: ref.amount ?? DEFAULT_PENALTY,
  };
}

export function collectResolvedBranchEvents(
  runState: ProcedureRunState,
): ResolvedProcedureBranchEvent[] {
  const events = [...(runState.resolvedBranchEvents || [])];
  const seen = new Set(events.map((event) => `${event.stepId}:${event.branchId}`));

  for (const entry of runState.appliedDiagnosticEffects || []) {
    if (!entry.branchId) continue;
    const key = `${entry.stepId}:${entry.branchId}`;
    if (seen.has(key)) continue;
    seen.add(key);
    events.push({
      stepId: entry.stepId,
      branchId: entry.branchId,
      at: entry.at,
    });
  }

  return events;
}

function addBoostForAlias(
  boosts: Map<string, number>,
  alias: CanonicalTestAlias,
  amount: number,
): void {
  for (const procedureId of alias.procedureIds || []) {
    boosts.set(`procedure:${procedureId}`, Math.max(boosts.get(`procedure:${procedureId}`) ?? 0, amount));
  }
  for (const stepKey of alias.wizardStepKeys || []) {
    boosts.set(`wizard:${stepKey}`, Math.max(boosts.get(`wizard:${stepKey}`) ?? 0, amount));
  }
  for (const componentId of alias.componentIds || []) {
    boosts.set(`component:${componentId}`, Math.max(boosts.get(`component:${componentId}`) ?? 0, amount));
  }
}

function addPenaltyForAlias(
  penalties: Map<string, number>,
  alias: CanonicalTestAlias,
  amount: number,
): void {
  addBoostForAlias(penalties, alias, amount);
}

function resolveDomainComponentIds(
  templateId: string,
  domainIds: string[],
): string[] {
  const ontology = getCanonicalOntologyForTemplate(templateId);
  if (!ontology?.failureDomains) return [];

  const components = new Set<string>();
  for (const domainId of domainIds) {
    const domain = ontology.failureDomains.find((item) => item.id === domainId);
    for (const componentId of domain?.components || []) {
      components.add(componentId);
    }
  }
  return [...components];
}

export function applyBranchExtensionToAdjustments(
  branch: DecisionBranch,
  templateId: string,
  boosts: Map<string, number>,
  penalties: Map<string, number>,
): void {
  for (const ref of branch.nextTestCandidates || []) {
    const { testId, amount } = normalizeBoostRef(ref);
    const alias = getCanonicalTestAlias(testId);
    if (alias) {
      addBoostForAlias(boosts, alias, amount);
      continue;
    }
    boosts.set(`test:${testId}`, Math.max(boosts.get(`test:${testId}`) ?? 0, amount));
  }

  for (const ref of branch.deprioritize || []) {
    const { target, amount } = normalizePenaltyRef(ref);
    const alias = getCanonicalTestAlias(target);
    if (alias) {
      addPenaltyForAlias(penalties, alias, amount);
      continue;
    }
    penalties.set(`test:${target}`, Math.max(penalties.get(`test:${target}`) ?? 0, amount));
    penalties.set(`domain:${target}`, Math.max(penalties.get(`domain:${target}`) ?? 0, amount));
  }

  const domainComponents = resolveDomainComponentIds(
    templateId,
    branch.deprioritizeDomains || [],
  );
  for (const componentId of domainComponents) {
    penalties.set(
      `component:${componentId}`,
      Math.max(penalties.get(`component:${componentId}`) ?? 0, DEFAULT_PENALTY),
    );
  }
  for (const domainId of branch.deprioritizeDomains || []) {
    penalties.set(
      `domain:${domainId}`,
      Math.max(penalties.get(`domain:${domainId}`) ?? 0, DEFAULT_PENALTY),
    );
  }
}

export function deriveBranchCandidateAdjustments(
  session: DiagnosticSession,
): BranchCandidateAdjustments {
  const boosts = new Map<string, number>();
  const penalties = new Map<string, number>();
  let resolvedBranchCount = 0;
  const templateId = session.payload.templateId;

  for (const [procedureId, runState] of Object.entries(session.payload.procedureRuns || {})) {
    if (!runState) continue;
    const events = collectResolvedBranchEvents(runState);
    for (const event of events) {
      const branch = resolveProcedureDecisionBranch(
        procedureId,
        event.stepId,
        event.branchId,
      );
      if (!branch) continue;
      resolvedBranchCount += 1;
      applyBranchExtensionToAdjustments(branch, templateId, boosts, penalties);
    }
  }

  return { boosts, penalties, resolvedBranchCount };
}

function candidateMatchesAlias(
  candidate: NextTestCandidate,
  alias: CanonicalTestAlias,
): boolean {
  if (candidate.procedureId && alias.procedureIds?.includes(candidate.procedureId)) {
    return true;
  }
  if (candidate.wizardStepKey && alias.wizardStepKeys?.includes(candidate.wizardStepKey)) {
    return true;
  }
  if (candidate.target && alias.componentIds?.includes(candidate.target)) {
    return true;
  }
  return false;
}

function lookupAliasByTarget(target: string): CanonicalTestAlias | null {
  return CANONICAL_TEST_ALIASES.find((alias) => alias.testId === target) ?? null;
}

function resolveCandidateBoostAmount(
  candidate: NextTestCandidate,
  boosts: Map<string, number>,
): number {
  let boost = 0;
  for (const [key, amount] of boosts.entries()) {
    if (key.startsWith('procedure:') && candidate.procedureId === key.slice('procedure:'.length)) {
      boost = Math.max(boost, amount);
    }
    if (key.startsWith('wizard:') && candidate.wizardStepKey === key.slice('wizard:'.length)) {
      boost = Math.max(boost, amount);
    }
    if (key.startsWith('component:') && candidate.target === key.slice('component:'.length)) {
      boost = Math.max(boost, amount);
    }
    if (key.startsWith('test:')) {
      const alias = lookupAliasByTarget(key.slice('test:'.length));
      if (alias && candidateMatchesAlias(candidate, alias)) {
        boost = Math.max(boost, amount);
      }
    }
  }
  return boost;
}

function resolveCandidatePenaltyAmount(
  candidate: NextTestCandidate,
  penalties: Map<string, number>,
  domainComponents: Map<string, Set<string>>,
): number {
  let penalty = 0;
  for (const [key, amount] of penalties.entries()) {
    if (key.startsWith('procedure:') && candidate.procedureId === key.slice('procedure:'.length)) {
      penalty = Math.max(penalty, amount);
    }
    if (key.startsWith('wizard:') && candidate.wizardStepKey === key.slice('wizard:'.length)) {
      penalty = Math.max(penalty, amount);
    }
    if (key.startsWith('component:') && candidate.target === key.slice('component:'.length)) {
      penalty = Math.max(penalty, amount);
    }
    if (key.startsWith('domain:')) {
      const domainId = key.slice('domain:'.length);
      const components = domainComponents.get(domainId);
      if (candidate.target && components?.has(candidate.target)) {
        penalty = Math.max(penalty, amount);
      }
      const alias = CANONICAL_TEST_ALIASES.find((item) =>
        item.failureDomainIds?.includes(domainId),
      );
      if (alias && candidateMatchesAlias(candidate, alias)) {
        penalty = Math.max(penalty, amount);
      }
    }
    if (key.startsWith('test:')) {
      const alias = lookupAliasByTarget(key.slice('test:'.length));
      if (alias && candidateMatchesAlias(candidate, alias)) {
        penalty = Math.max(penalty, amount);
      }
    }
  }
  return penalty;
}

function buildDomainComponentMap(
  penalties: Map<string, number>,
  templateId: string,
): Map<string, Set<string>> {
  const domainComponents = new Map<string, Set<string>>();
  for (const key of penalties.keys()) {
    if (!key.startsWith('domain:')) continue;
    const domainId = key.slice('domain:'.length);
    domainComponents.set(
      domainId,
      new Set(resolveDomainComponentIds(templateId, [domainId])),
    );
  }
  return domainComponents;
}

export function applyBranchAdjustmentsToCandidates(
  candidates: NextTestCandidate[],
  adjustments: BranchCandidateAdjustments,
  templateId: string,
  measurementAdjustments?: BranchCandidateAdjustments,
): NextTestCandidate[] {
  const branchDomainComponents = buildDomainComponentMap(adjustments.penalties, templateId);
  const measurementDomainComponents = measurementAdjustments
    ? buildDomainComponentMap(measurementAdjustments.penalties, templateId)
    : new Map<string, Set<string>>();

  return candidates.map((candidate) => {
    const branchBoost = resolveCandidateBoostAmount(candidate, adjustments.boosts);
    const measurementBoost = measurementAdjustments
      ? resolveCandidateBoostAmount(candidate, measurementAdjustments.boosts)
      : 0;
    const branchPenalty = resolveCandidatePenaltyAmount(
      candidate,
      adjustments.penalties,
      branchDomainComponents,
    );
    const measurementPenalty = measurementAdjustments
      ? resolveCandidatePenaltyAmount(
        candidate,
        measurementAdjustments.penalties,
        measurementDomainComponents,
      )
      : 0;
    const deprioritizationPenalty = Math.max(branchPenalty, measurementPenalty);

    if (!branchBoost && !measurementBoost && !deprioritizationPenalty) return candidate;

    return {
      ...candidate,
      scoreBreakdown: {
        ...candidate.scoreBreakdown,
        branchBoost: Math.max(candidate.scoreBreakdown.branchBoost, branchBoost),
        measurementBoost: Math.max(candidate.scoreBreakdown.measurementBoost, measurementBoost),
        deprioritizationPenalty: Math.max(
          candidate.scoreBreakdown.deprioritizationPenalty,
          deprioritizationPenalty,
        ),
      },
    };
  });
}
