import type { DiagnosticIntelligenceResult } from '../../intelligence/evidenceTypes';
import { getComponentVerificationLevel } from '../../intelligence/componentVerification';
import type { ProcedureRunState } from '../../procedures/types';
import type { DiagnosticSession } from '../../session/types';
import { resolveCanonicalRouting } from './resolveCanonicalRouting';
import {
  resolveDiagnosticGraph,
  resolveDiagnosticGraphForSession,
} from './resolveDiagnosticGraph';
import type {
  CanonicalGraphDependencyStatus,
  CanonicalGraphFactStatus,
  CanonicalGraphState,
  CanonicalOntology,
  CanonicalTestTarget,
  ResolvedDiagnosticGraph,
} from './canonicalTypes';

export const CANONICAL_MAX_ROUTING_FIT = 0.22;

function complaintChipIdsFromSession(session: DiagnosticSession): string[] {
  const fields = session.payload.fields || {};
  const tags = fields['customer_complaint.complaint_tags'];
  if (!Array.isArray(tags)) return [];
  return tags.map((tag) => String(tag));
}

function errorCodesFromSession(session: DiagnosticSession): string[] {
  const fields = session.payload.fields || {};
  const raw = fields['customer_complaint.error_codes'] ?? fields['error_codes'];
  if (!Array.isArray(raw)) return [];
  return raw.map((code) => String(code));
}

function complaintTextFromSession(session: DiagnosticSession): string {
  const fields = session.payload.fields || {};
  const text = fields['customer_complaint.complaint_text'] ?? fields['complaint_text'];
  return text ? String(text) : '';
}

function isComponentVerifiedGood(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
  componentId: string,
): boolean {
  if (!intelligence) return false;
  for (const components of Object.values(intelligence.componentsByCategory || {})) {
    const match = components.find((item) => item.id === componentId);
    if (!match) continue;
    const level = getComponentVerificationLevel(match.state);
    return level === 'verified_good';
  }
  return false;
}

function isComponentVerifiedFailed(
  intelligence: DiagnosticIntelligenceResult | null | undefined,
  componentId: string,
): boolean {
  if (!intelligence) return false;
  for (const components of Object.values(intelligence.componentsByCategory || {})) {
    const match = components.find((item) => item.id === componentId);
    if (!match) continue;
    const level = getComponentVerificationLevel(match.state);
    return level === 'verified_failed';
  }
  return false;
}

function collectResolvedBranchIdsFromRun(runState: ProcedureRunState): string[] {
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

  return events.map((event) => event.branchId);
}

function collectResolvedBranchIds(session: DiagnosticSession): Set<string> {
  const branchIds = new Set<string>();
  for (const runState of Object.values(session.payload.procedureRuns || {})) {
    if (!runState) continue;
    for (const branchId of collectResolvedBranchIdsFromRun(runState)) {
      branchIds.add(branchId);
    }
  }
  return branchIds;
}

function collectAbnormalMeasurementFacts(
  session: DiagnosticSession,
  graph: ResolvedDiagnosticGraph | null,
): Set<string> {
  const factIds = new Set<string>();
  const bindings = graph?.measurementBindings || [];

  for (const runState of Object.values(session.payload.procedureRuns || {})) {
    if (!runState?.stepEvaluations) continue;
    for (const [, snapshot] of Object.entries(runState.stepEvaluations)) {
      const isAbnormal = snapshot.evaluation.status === 'critical'
        || snapshot.evaluation.status === 'warning';
      if (!isAbnormal) continue;

      const binding = bindings.find((item) =>
        item.procedureId === runState.procedureId
        && snapshot.knowledgeId === item.measurementKnowledgeId,
      );
      if (binding?.establishesFacts?.length) {
        for (const factId of binding.establishesFacts) {
          factIds.add(factId);
        }
        continue;
      }

      if (snapshot.knowledgeId) {
        const knowledgeBinding = bindings.find((item) =>
          item.measurementKnowledgeId === snapshot.knowledgeId,
        );
        for (const factId of knowledgeBinding?.establishesFacts || []) {
          factIds.add(factId);
        }
      }

      factIds.add('motor_output_abnormal');
    }
  }

  return factIds;
}

export function resolveActiveGoals(
  ontology: CanonicalOntology,
  entryPointIds: string[],
): string[] {
  const goals = new Set<string>();
  for (const entryId of entryPointIds) {
    const entry = ontology.diagnosticEntryPoints.find((item) => item.id === entryId);
    for (const goalId of entry?.activeGoals || []) {
      goals.add(goalId);
    }
  }
  return [...goals];
}

export function evaluateEstablishedFacts(
  ontology: CanonicalOntology,
  session: DiagnosticSession,
  intelligence: DiagnosticIntelligenceResult | null | undefined,
  resolvedGraph?: ResolvedDiagnosticGraph | null,
): CanonicalGraphFactStatus[] {
  const branchIds = collectResolvedBranchIds(session);
  for (const factId of collectAbnormalMeasurementFacts(session, resolvedGraph || null)) {
    if (factId === 'motor_output_abnormal') {
      branchIds.add('motor_voltage_abnormal');
    }
  }

  const abnormalMeasurementFacts = collectAbnormalMeasurementFacts(
    session,
    resolvedGraph || null,
  );

  return (ontology.establishedFactSources || []).map((source) => {
    const sources: string[] = [];

    const componentGood = (source.fromComponents || []).some((componentId) => {
      const good = isComponentVerifiedGood(intelligence, componentId);
      if (good) sources.push(`component:${componentId}`);
      return good;
    });

    const branchHit = (source.fromBranches || []).some((branchId) => {
      const hit = branchIds.has(branchId);
      if (hit) sources.push(`branch:${branchId}`);
      return hit;
    });

    const measurementHit = abnormalMeasurementFacts.has(source.factId);
    if (measurementHit) {
      sources.push('measurement:abnormal');
    }

    const componentFailed = (source.fromComponents || []).some((componentId) =>
      isComponentVerifiedFailed(intelligence, componentId),
    );

    const established = componentGood || branchHit || measurementHit;

    return {
      factId: source.factId,
      label: source.label || source.factId,
      state: componentFailed ? 'contradicted' : (established ? 'established' : 'unknown'),
      sources,
    };
  });
}

function evaluateDependencyStatus(
  ontology: CanonicalOntology,
  dependencyId: string,
  intelligence: DiagnosticIntelligenceResult | null | undefined,
): CanonicalGraphDependencyStatus {
  const dependency = ontology.functionalDependencies.find((item) => item.id === dependencyId);
  if (!dependency) {
    return {
      dependencyId,
      satisfied: false,
      unknownRequired: [],
      failedRequired: [],
    };
  }

  const unknownRequired: string[] = [];
  const failedRequired: string[] = [];

  for (const componentId of dependency.requires || []) {
    if (isComponentVerifiedGood(intelligence, componentId)) continue;
    if (isComponentVerifiedFailed(intelligence, componentId)) {
      failedRequired.push(componentId);
      continue;
    }
    unknownRequired.push(componentId);
  }

  return {
    dependencyId,
    satisfied: unknownRequired.length === 0 && failedRequired.length === 0,
    unknownRequired,
    failedRequired,
  };
}

export function evaluateCanonicalGraphState(session: DiagnosticSession): CanonicalGraphState | null {
  const resolvedGraph = resolveDiagnosticGraphForSession(session);
  if (!resolvedGraph) return null;

  const routing = resolveCanonicalRouting({
    templateId: session.payload.templateId,
    platformId: session.appliance.platform,
    complaintChipIds: complaintChipIdsFromSession(session),
    errorCodes: errorCodesFromSession(session),
    complaintText: complaintTextFromSession(session),
  });

  const entryPointIds = routing?.matchedEntryPoints.map((item) => item.entryPointId) || [];
  const activeGoals = resolveActiveGoals(resolvedGraph, entryPointIds);
  const intelligence = session.derived?.intelligence ?? null;

  const facts = evaluateEstablishedFacts(resolvedGraph, session, intelligence, resolvedGraph);
  const establishedFactIds = new Set(
    facts.filter((fact) => fact.state === 'established').map((fact) => fact.factId),
  );

  const dependencyIds = new Set<string>(activeGoals);
  for (const target of resolvedGraph.testTargets || []) {
    for (const depId of target.requires?.dependencies || []) {
      dependencyIds.add(depId);
    }
  }

  const dependencies = [...dependencyIds].map((dependencyId) =>
    evaluateDependencyStatus(resolvedGraph, dependencyId, intelligence),
  );

  return {
    ontologyId: resolvedGraph.ontology.id,
    activeGoals,
    activeDomains: routing?.activeDomains || [],
    facts,
    dependencies,
    establishedFactIds,
    resolutionLayers: resolvedGraph.resolution.layers,
  };
}

function targetMatchesActiveGoals(
  target: CanonicalTestTarget,
  activeGoals: string[],
): boolean {
  if (!target.forGoals?.length) return true;
  if (!activeGoals.length) return true;
  return target.forGoals.some((goalId) => activeGoals.includes(goalId));
}

function readinessForTarget(
  target: CanonicalTestTarget,
  establishedFactIds: Set<string>,
): number {
  const requiredFacts = target.requires?.facts || [];
  if (!requiredFacts.length) return 1;
  const established = requiredFacts.filter((factId) => establishedFactIds.has(factId)).length;
  return established / requiredFacts.length;
}

export function scoreTestTargetRoutingFit(
  target: CanonicalTestTarget,
  graphState: CanonicalGraphState,
): { routingFit: number; reason: string } {
  if (!targetMatchesActiveGoals(target, graphState.activeGoals)) {
    return { routingFit: 0, reason: 'inactive goal' };
  }

  const establishesFacts = target.establishesFacts || [];

  if (target.role === 'prerequisite') {
    const unresolved = establishesFacts.filter(
      (factId) => !graphState.establishedFactIds.has(factId),
    );
    if (!unresolved.length) {
      return {
        routingFit: 0.04,
        reason: `${target.label || target.id}: prerequisite already established`,
      };
    }
    const weight = unresolved.length / Math.max(establishesFacts.length, 1);
    return {
      routingFit: CANONICAL_MAX_ROUTING_FIT * weight,
      reason: `${target.label || target.id}: resolves upstream prerequisite`,
    };
  }

  const readiness = readinessForTarget(target, graphState.establishedFactIds);
  if (readiness < 1) {
    return {
      routingFit: CANONICAL_MAX_ROUTING_FIT * readiness * 0.35,
      reason: `${target.label || target.id}: downstream blocked (${Math.round(readiness * 100)}% prerequisites)`,
    };
  }

  let fit = CANONICAL_MAX_ROUTING_FIT * readiness;

  if (graphState.establishedFactIds.has('motor_output_abnormal')) {
    if (target.id === 'motor_output_test' || target.id === 'motor_winding_test') {
      fit = Math.min(CANONICAL_MAX_ROUTING_FIT * 1.1, fit + 0.06);
    }
  }

  if (
    graphState.establishedFactIds.has('motor_command_present')
    && (target.id === 'motor_output_test' || target.id === 'motor_winding_test' || target.id === 'mechanical_path_test')
  ) {
    fit = Math.min(CANONICAL_MAX_ROUTING_FIT * 1.15, fit + 0.05);
  }

  return {
    routingFit: fit,
    reason: `${target.label || target.id}: discriminates remaining drive path uncertainty`,
  };
}

export interface CanonicalRoutingAdjustment {
  testTargetId: string;
  testAliasId: string;
  routingFit: number;
  reason: string;
  procedureIds?: string[];
}

export function deriveCanonicalRoutingAdjustments(
  session: DiagnosticSession,
): CanonicalRoutingAdjustment[] {
  const graphState = evaluateCanonicalGraphState(session);
  if (!graphState) return [];

  const resolvedGraph = resolveDiagnosticGraphForSession(session);
  if (!resolvedGraph?.testTargets?.length) return [];

  return resolvedGraph.testTargets
    .map((target) => {
      const { routingFit, reason } = scoreTestTargetRoutingFit(target, graphState);
      const bindingProcedureIds = resolvedGraph.procedureBindings
        .filter((binding) => binding.testTargetId === target.id)
        .map((binding) => binding.procedureId);
      return {
        testTargetId: target.id,
        testAliasId: target.testAliasId,
        routingFit,
        reason,
        procedureIds: bindingProcedureIds.length ? bindingProcedureIds : undefined,
      };
    })
    .filter((item) => item.routingFit > 0);
}

export { resolveDiagnosticGraph, resolveDiagnosticGraphForSession };
