import type {
  ComponentEvidenceState,
  EvidenceConfig,
  EvidenceLedgerEntry,
  EvidenceRule,
} from '../intelligence/evidenceTypes';
import {
  evaluateProcedureMeasurement,
  matchProcedureBranch,
} from './evaluateProcedureMeasurement';
import { getServiceProcedure } from './procedureRegistry';
import { getProcedureStep } from './procedureRunner';
import type {
  AppliedDiagnosticEffectEntry,
  DiagnosticEffect,
  ProcedureRunState,
} from './types';

const SUSPECT_EVIDENCE_BOOST = 28;

function clampScore(value: number): number {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export interface ProcedureDiagnosticEffectResult {
  applied: DiagnosticEffect[];
  notes: string[];
}

/** Legacy helper — returns human-readable notes for dev logging. */
export function applyProcedureDiagnosticEffects(
  effects: DiagnosticEffect[] | undefined,
): ProcedureDiagnosticEffectResult {
  if (!effects?.length) {
    return { applied: [], notes: [] };
  }

  const notes = effects.map((effect) => {
    const verb =
      effect.type === 'confirm'
        ? 'confirm'
        : effect.type === 'eliminate'
          ? 'eliminate'
          : 'suspect';
    const evidence = effect.evidenceId ? ` (${effect.evidenceId})` : '';
    return `${verb} ${effect.componentId}${evidence}`;
  });

  return { applied: effects, notes };
}

function resolveStepEffects(
  step: ReturnType<typeof getProcedureStep>,
  input?: { kind: string; value: string },
): { effects: DiagnosticEffect[]; branchId?: string } {
  if (!step) return { effects: [] };

  let matchedBranch = null;
  if (step.type === 'measurement' && input?.kind === 'measurement') {
    const evaluation = evaluateProcedureMeasurement(step.measurementKnowledgeId, input.value);
    matchedBranch = matchProcedureBranch(step.branches, evaluation);
  } else if (step.branches?.length) {
    matchedBranch = matchProcedureBranch(step.branches, null, input?.value);
  }

  const effects =
    matchedBranch?.diagnosticEffects
    ?? (matchedBranch ? undefined : step.diagnosticEffects)
    ?? [];

  return { effects, branchId: matchedBranch?.id };
}

export function collectDiagnosticEffectsFromRun(
  procedureId: string,
  runState: ProcedureRunState,
): AppliedDiagnosticEffectEntry[] {
  if (runState.appliedDiagnosticEffects?.length) {
    return runState.appliedDiagnosticEffects;
  }

  const procedure = getServiceProcedure(procedureId);
  if (!procedure) return [];

  const entries: AppliedDiagnosticEffectEntry[] = [];
  for (const stepId of runState.completedStepIds) {
    const step = getProcedureStep(procedure, stepId);
    const input = runState.stepInputs[stepId];
    const { effects, branchId } = resolveStepEffects(step, input);
    if (!effects.length) continue;
    entries.push({
      stepId,
      branchId,
      effects,
      at: runState.startedAt,
    });
  }
  return entries;
}

function applyEvidenceRuleToScores(
  rule: EvidenceRule,
  categoryScores: Map<string, number>,
  componentScores: Map<string, { evidence: number; state: ComponentEvidenceState }>,
  ledger: EvidenceLedgerEntry[],
  meta: {
    ruleId: string;
    explanation: string;
    procedureId: string;
    stepId: string;
  },
): void {
  const { effect } = rule;
  let delta = 0;

  if (rule.targetLayer === 'category') {
    const current = categoryScores.get(rule.target) ?? 0;
    if (effect.effect === 'increase') {
      delta = effect.value;
      categoryScores.set(rule.target, clampScore(current + effect.value));
    } else if (effect.effect === 'decrease' || effect.effect === 'unlikely') {
      delta = -effect.value;
      categoryScores.set(rule.target, clampScore(current - effect.value));
    }
  } else {
    const current = componentScores.get(rule.target) ?? {
      evidence: 0,
      state: 'unknown' as ComponentEvidenceState,
    };
    if (effect.effect === 'increase') {
      delta = effect.value;
      componentScores.set(rule.target, {
        ...current,
        evidence: clampScore(current.evidence + effect.value),
      });
    } else if (effect.effect === 'decrease' || effect.effect === 'unlikely') {
      delta = -effect.value;
      componentScores.set(rule.target, {
        ...current,
        evidence: clampScore(current.evidence - effect.value),
      });
    } else if (effect.effect === 'confirm') {
      delta = 100 - current.evidence;
      componentScores.set(rule.target, { evidence: 100, state: 'confirmed' });
    } else if (effect.effect === 'eliminate') {
      if (current.state === 'confirmed') return;
      delta = -current.evidence;
      componentScores.set(rule.target, { evidence: 0, state: 'eliminated' });
    }
  }

  ledger.push({
    ruleId: meta.ruleId,
    target: rule.target,
    targetLayer: rule.targetLayer,
    delta,
    explanation: meta.explanation,
    effect: effect.effect,
    source: 'procedure',
    trigger: {
      type: 'field',
      label: `OEM procedure ${meta.procedureId}`,
      value: meta.stepId,
    },
  });
}

function applyDirectProcedureEffect(
  effect: DiagnosticEffect,
  config: EvidenceConfig,
  categoryScores: Map<string, number>,
  componentScores: Map<string, { evidence: number; state: ComponentEvidenceState }>,
  ledger: EvidenceLedgerEntry[],
  meta: {
    procedureId: string;
    procedureTitle: string;
    stepId: string;
    branchId?: string;
  },
): void {
  const component = config.components?.find((item) => item.id === effect.componentId);
  const componentLabel = component?.label || effect.componentId;
  let delta = 0;
  const current = componentScores.get(effect.componentId) ?? {
    evidence: 0,
    state: 'unknown' as ComponentEvidenceState,
  };

  let evidenceEffect: EvidenceLedgerEntry['effect'] = 'increase';
  if (effect.type === 'confirm') {
    delta = 100 - current.evidence;
    componentScores.set(effect.componentId, { evidence: 100, state: 'confirmed' });
    evidenceEffect = 'confirm';
  } else if (effect.type === 'eliminate') {
    if (current.state !== 'confirmed') {
      delta = -current.evidence;
      componentScores.set(effect.componentId, { evidence: 0, state: 'eliminated' });
    }
    evidenceEffect = 'eliminate';
  } else {
    delta = SUSPECT_EVIDENCE_BOOST;
    componentScores.set(effect.componentId, {
      ...current,
      evidence: clampScore(current.evidence + SUSPECT_EVIDENCE_BOOST),
    });
    evidenceEffect = 'increase';
  }

  const evidenceRule = effect.evidenceId
    ? config.rules.find((rule) => rule.id === effect.evidenceId)
    : null;
  const explanation = evidenceRule
    ? `OEM procedure (${meta.procedureTitle}): ${evidenceRule.explanation}`
    : `OEM procedure (${meta.procedureTitle}): ${effect.type} ${componentLabel}.`;

  ledger.push({
    ruleId: effect.evidenceId || `procedure:${meta.procedureId}:${meta.stepId}:${effect.type}:${effect.componentId}`,
    target: effect.componentId,
    targetLayer: 'component',
    delta,
    explanation,
    effect: evidenceEffect,
    source: 'procedure',
    trigger: {
      type: 'field',
      label: meta.procedureTitle,
      value: meta.branchId ? `${meta.stepId} (${meta.branchId})` : meta.stepId,
    },
  });

  if (effect.type === 'confirm' && effect.evidenceId?.startsWith('confirm_')) {
    const categoryRuleId = `cat_up_${effect.evidenceId.slice('confirm_'.length)}`;
    const categoryRule = config.rules.find((rule) => rule.id === categoryRuleId);
    if (categoryRule) {
      applyEvidenceRuleToScores(categoryRule, categoryScores, componentScores, ledger, {
        ruleId: categoryRule.id,
        explanation: `OEM procedure (${meta.procedureTitle}): ${categoryRule.explanation}`,
        procedureId: meta.procedureId,
        stepId: meta.stepId,
      });
    }
  }
}

export function applyProcedureRunsToIntelligence(
  config: EvidenceConfig,
  procedureRuns: Record<string, ProcedureRunState> | null | undefined,
  categoryScores: Map<string, number>,
  componentScores: Map<string, { evidence: number; state: ComponentEvidenceState }>,
  ledger: EvidenceLedgerEntry[],
): number {
  if (!procedureRuns || !Object.keys(procedureRuns).length) return 0;

  let appliedCount = 0;

  for (const [procedureId, runState] of Object.entries(procedureRuns)) {
    if (!runState || runState.status === 'aborted') continue;

    const procedure = getServiceProcedure(procedureId);
    if (!procedure) continue;

    const entries = collectDiagnosticEffectsFromRun(procedureId, runState);
    for (const entry of entries) {
      for (const effect of entry.effects) {
        applyDirectProcedureEffect(effect, config, categoryScores, componentScores, ledger, {
          procedureId,
          procedureTitle: procedure.title,
          stepId: entry.stepId,
          branchId: entry.branchId,
        });
        appliedCount += 1;
      }
    }
  }

  return appliedCount;
}

export function appendAppliedDiagnosticEffects(
  runState: ProcedureRunState,
  stepId: string,
  effects: DiagnosticEffect[] | undefined,
  branchId?: string,
): ProcedureRunState {
  if (!effects?.length) return runState;

  const entry: AppliedDiagnosticEffectEntry = {
    stepId,
    branchId,
    effects,
    at: new Date().toISOString(),
  };

  return {
    ...runState,
    appliedDiagnosticEffects: [...(runState.appliedDiagnosticEffects || []), entry],
  };
}
