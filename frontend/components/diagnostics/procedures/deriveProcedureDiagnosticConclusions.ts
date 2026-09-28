import { getProcedureStep } from './procedureRunner';
import {
  buildTestPointKey,
  isScopedDiagnosticEffect,
  resolveEffectMeasurementScope,
} from './scopedDiagnosticEffect';
import type {
  DiagnosticEffect,
  EffectAssertion,
  MeasurementScope,
  PathFaultRef,
  ProcedureMeasurementContext,
  ProcedureRunState,
  ServiceProcedure,
  TestPoint,
} from './types';

export type DiagnosticConclusionKind =
  | 'component_failed'
  | 'component_verified'
  | 'external_path_fault'
  | 'contradicted'
  | 'inconclusive'
  | 'no_repair_target';

export interface DiagnosticConclusionOemNarrative {
  outcomeStepId?: string;
  title?: string;
  oemOutcome?: string;
}

export interface DiagnosticConclusion {
  kind: DiagnosticConclusionKind;
  anchorComponentId: string;
  loadInstanceKey?: string;
  evidenceSubjectKey?: string;
  componentState?: 'verified_good' | 'verified_failed' | 'unknown';
  pathRefs?: PathFaultRef[];
  repairTargetHint?: string;
  oemNarrative?: DiagnosticConclusionOemNarrative;
}

export interface ScopedEvidenceRecord {
  componentId: string;
  loadInstanceKey?: string;
  assertion: EffectAssertion;
  measurementScope?: MeasurementScope;
  testPointKey: string;
  stepId: string;
  branchId?: string;
  testPoint?: TestPoint;
  measurementContext?: ProcedureMeasurementContext;
}

function scopedInstanceKey(componentId: string, loadInstanceKey?: string): string {
  return loadInstanceKey ? `${componentId}\0${loadInstanceKey}` : componentId;
}

function snapshotContext(
  runState: ProcedureRunState,
  stepId: string,
): { testPoint?: TestPoint; measurementContext?: ProcedureMeasurementContext } {
  const snapshot = runState.stepEvaluations?.[stepId];
  const ctx = snapshot?.context;
  if (!ctx) return {};
  return {
    testPoint: ctx.testPoint as TestPoint | undefined,
    measurementContext: ctx.measurementContext as ProcedureMeasurementContext | undefined,
  };
}

export function runHasScopedDiagnosticAssertions(runState: ProcedureRunState): boolean {
  for (const entry of runState.appliedDiagnosticEffects || []) {
    if (entry.effects.some((effect) => isScopedDiagnosticEffect(effect))) {
      return true;
    }
  }
  return false;
}

export function collectScopedEvidenceFromRun(
  procedure: ServiceProcedure,
  runState: ProcedureRunState,
): ScopedEvidenceRecord[] {
  const records: ScopedEvidenceRecord[] = [];

  for (const entry of runState.appliedDiagnosticEffects || []) {
    const step = getProcedureStep(procedure, entry.stepId);
    const frozen = snapshotContext(runState, entry.stepId);

    for (const effect of entry.effects) {
      if (!effect.assertion) continue;

      const measurementScope = resolveEffectMeasurementScope(
        effect,
        step?.measurementContext?.scope ?? frozen.measurementContext?.scope,
      );
      const testPoint = frozen.testPoint ?? step?.testPoint;
      const measurementContext = frozen.measurementContext ?? step?.measurementContext;

      records.push({
        componentId: effect.componentId,
        loadInstanceKey: effect.loadInstanceKey,
        assertion: effect.assertion,
        measurementScope,
        testPointKey: buildTestPointKey(
          entry.stepId,
          testPoint?.connector,
          testPoint?.pins,
          effect.testPointKey,
        ),
        stepId: entry.stepId,
        branchId: entry.branchId,
        testPoint,
        measurementContext,
      });
    }
  }

  return records;
}

function isPathMeasurementScope(scope?: MeasurementScope): boolean {
  return scope === 'through_path' || scope === 'at_control_connector';
}

function pathOpenIsConfigurationValid(record: ScopedEvidenceRecord): boolean {
  if (record.assertion !== 'path_open') return true;
  if (!isPathMeasurementScope(record.measurementScope)) return false;
  return record.measurementContext?.loadInCircuit === true;
}

function resolveOutcomeNarrative(
  procedure: ServiceProcedure,
  runState: ProcedureRunState,
): DiagnosticConclusionOemNarrative | undefined {
  const outcomeStep = procedure.steps.find((step) => step.id === runState.currentStepId);
  if (!outcomeStep || outcomeStep.type !== 'outcome') {
    return runState.oemOutcome
      ? { oemOutcome: runState.oemOutcome }
      : undefined;
  }
  return {
    outcomeStepId: outcomeStep.id,
    title: outcomeStep.title,
    oemOutcome: outcomeStep.oemOutcome ?? runState.oemOutcome,
  };
}

function deriveForComponent(
  componentId: string,
  loadInstanceKey: string | undefined,
  records: ScopedEvidenceRecord[],
  procedure: ServiceProcedure,
  runState: ProcedureRunState,
): DiagnosticConclusion {
  const forComponent = records.filter(
    (item) =>
      item.componentId === componentId
      && (item.loadInstanceKey ?? undefined) === (loadInstanceKey ?? undefined),
  );
  const oemNarrative = resolveOutcomeNarrative(procedure, runState);

  const loadVerified = forComponent.some(
    (item) => item.assertion === 'component_verified' && item.measurementScope === 'at_load',
  );
  const loadFailed = forComponent.some(
    (item) => item.assertion === 'component_failed' && item.measurementScope === 'at_load',
  );

  const pathOpenRecords = forComponent.filter((item) => item.assertion === 'path_open');
  const validPathOpens = pathOpenRecords.filter(pathOpenIsConfigurationValid);
  const invalidPathOpens = pathOpenRecords.filter((item) => !pathOpenIsConfigurationValid(item));

  if (loadFailed && loadVerified) {
    return {
      kind: 'contradicted',
      anchorComponentId: componentId,
      loadInstanceKey,
      componentState: 'unknown',
      oemNarrative,
    };
  }

  if (invalidPathOpens.length > 0 && validPathOpens.length === 0 && !loadFailed) {
    return {
      kind: 'inconclusive',
      anchorComponentId: componentId,
      loadInstanceKey,
      componentState: loadVerified ? 'verified_good' : 'unknown',
      oemNarrative,
    };
  }

  if (loadFailed) {
    return {
      kind: 'component_failed',
      anchorComponentId: componentId,
      loadInstanceKey,
      componentState: 'verified_failed',
      oemNarrative,
    };
  }

  if (loadVerified && validPathOpens.length > 0) {
    const pathRefs: PathFaultRef[] = validPathOpens.map((item) => ({
      anchorComponentId: componentId,
      loadInstanceKey: item.loadInstanceKey,
      testPointKey: item.testPointKey,
      connector: item.testPoint?.connector,
      pins: item.testPoint?.pins,
      procedureId: procedure.id,
      stepId: item.stepId,
    }));
    return {
      kind: 'external_path_fault',
      anchorComponentId: componentId,
      loadInstanceKey,
      componentState: 'verified_good',
      pathRefs,
      repairTargetHint: 'inspect_external_circuit',
      oemNarrative,
    };
  }

  if (pathOpenRecords.length > 0 && !loadVerified) {
    return {
      kind: 'inconclusive',
      anchorComponentId: componentId,
      loadInstanceKey,
      componentState: 'unknown',
      oemNarrative,
    };
  }

  if (loadVerified) {
    return {
      kind: 'no_repair_target',
      anchorComponentId: componentId,
      loadInstanceKey,
      componentState: 'verified_good',
      oemNarrative,
    };
  }

  return {
    kind: 'inconclusive',
    anchorComponentId: componentId,
    loadInstanceKey,
    componentState: 'unknown',
    oemNarrative,
  };
}

/**
 * Pure derivation from completed run scoped evidence (and frozen step context).
 * Legacy unscoped effects do not participate — use legacy repair helpers when no scoped assertions exist.
 */
export function deriveProcedureDiagnosticConclusions(
  runState: ProcedureRunState,
  procedure: ServiceProcedure,
): DiagnosticConclusion[] {
  if (!runHasScopedDiagnosticAssertions(runState)) {
    return [];
  }

  const records = collectScopedEvidenceFromRun(procedure, runState);
  const instanceKeys = [
    ...new Set(records.map((item) => scopedInstanceKey(item.componentId, item.loadInstanceKey))),
  ];

  return instanceKeys.map((key) => {
    const [componentId, loadInstanceKey] = key.includes('\0')
      ? key.split('\0', 2)
      : [key, undefined];
    return deriveForComponent(componentId, loadInstanceKey, records, procedure, runState);
  });
}

export function resolvePrimaryDiagnosticConclusion(
  conclusions: DiagnosticConclusion[],
): DiagnosticConclusion | null {
  if (!conclusions.length) return null;

  const rank: Record<DiagnosticConclusionKind, number> = {
    contradicted: 0,
    inconclusive: 1,
    component_failed: 2,
    external_path_fault: 3,
    component_verified: 4,
    no_repair_target: 5,
  };

  const hintedFailure = conclusions.find(
    (item) => item.kind === 'component_failed' && item.repairTargetHint,
  );
  if (hintedFailure) return hintedFailure;

  return [...conclusions].sort((a, b) => rank[a.kind] - rank[b.kind])[0];
}
