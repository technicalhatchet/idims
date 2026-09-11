import { getEvidenceConfig } from '../intelligence/evidenceRegistry';
import { getPlatformRule } from '../knowledge/platformRegistry';
import type { MeasurementEvaluation } from '../knowledge/types';
import {
  evaluateProcedureMeasurement,
  matchProcedureBranch,
} from './evaluateProcedureMeasurement';
import { getServiceProcedure } from './procedureRegistry';
import { getProcedureStep } from './procedureRunner';
import { resolveProcedureStepTone, type ProcedureStepTone } from './procedureRunPresentation';
import type {
  DiagnosticEffect,
  ProcedureRunState,
  ProcedureStepInput,
  ServiceProcedure,
} from './types';

export interface ProcedureRunReviewEntry {
  stepId: string;
  order: number;
  stepTitle: string;
  stepType: string;
  inputSummary?: string;
  evaluationStatus?: string;
  evaluationMessage?: string;
  branchLabel?: string;
  branchOutcome?: string;
  diagnosticEffectSummaries: string[];
  tone: ProcedureStepTone;
}

export interface ProcedureRunReview {
  procedureId: string;
  procedureTitle: string;
  manualId: string;
  oemTestNumber: string;
  startedAt: string;
  status: ProcedureRunState['status'];
  oemOutcome?: string;
  steps: ProcedureRunReviewEntry[];
}

function formatCheckpointInput(value?: string): string | undefined {
  const normalized = String(value ?? '').trim().toLowerCase();
  if (!normalized || normalized === 'ok') return undefined;
  if (normalized === 'yes' || normalized === 'y') return 'Yes';
  if (normalized === 'no' || normalized === 'n') return 'No';
  if (normalized === 'pass') return 'Pass';
  if (normalized === 'fail') return 'Fail';
  return value;
}

function formatInputSummary(input?: ProcedureStepInput): string | undefined {
  if (!input) return undefined;
  if (input.kind === 'measurement') {
    return input.value.trim();
  }
  return formatCheckpointInput(input.value);
}

function formatDiagnosticEffect(
  effect: DiagnosticEffect,
  componentLabel: (componentId: string) => string,
): string {
  const label = componentLabel(effect.componentId);
  if (effect.type === 'confirm') return `Confirmed ${label}`;
  if (effect.type === 'eliminate') return `Eliminated ${label}`;
  return `Suspect ${label}`;
}

function resolveStepEffects(
  step: ReturnType<typeof getProcedureStep>,
  input?: ProcedureStepInput,
): { effects: DiagnosticEffect[]; branchId?: string; branchLabel?: string; branchOutcome?: string } {
  if (!step) return { effects: [] };

  let evaluation: MeasurementEvaluation | null = null;
  let matchedBranch = null;

  if (step.type === 'measurement' && input?.kind === 'measurement') {
    evaluation = evaluateProcedureMeasurement(step.measurementKnowledgeId, input.value);
    matchedBranch = matchProcedureBranch(step.branches, evaluation);
  } else if (step.branches?.length) {
    matchedBranch = matchProcedureBranch(step.branches, null, input?.value);
  }

  const effects =
    matchedBranch?.diagnosticEffects
    ?? (matchedBranch ? undefined : step.diagnosticEffects)
    ?? [];

  return {
    effects,
    branchId: matchedBranch?.id,
    branchLabel: matchedBranch?.label,
    branchOutcome: matchedBranch?.oemOutcome,
  };
}

export function buildProcedureRunReview(
  procedure: ServiceProcedure,
  runState: ProcedureRunState,
): ProcedureRunReview {
  const platformRule = getPlatformRule(procedure.platformId);
  const evidenceConfig = getEvidenceConfig(platformRule?.templateId);
  const componentLabel = (componentId: string) =>
    evidenceConfig?.components?.find((item) => item.id === componentId)?.label || componentId;

  const effectsByStep = new Map(
    (runState.appliedDiagnosticEffects || []).map((entry) => [entry.stepId, entry]),
  );

  const steps: ProcedureRunReviewEntry[] = [];

  for (const stepId of runState.completedStepIds) {
    const step = getProcedureStep(procedure, stepId);
    if (!step) continue;

    const input = runState.stepInputs[stepId];
    const appliedEntry = effectsByStep.get(stepId);
    const resolved = resolveStepEffects(step, input);

    let evaluation: MeasurementEvaluation | null = null;
    if (step.type === 'measurement' && input?.kind === 'measurement') {
      evaluation = evaluateProcedureMeasurement(step.measurementKnowledgeId, input.value);
    }

    const effects = appliedEntry?.effects?.length
      ? appliedEntry.effects
      : resolved.effects;

    const branchLabel = appliedEntry?.branchId
      ? step.branches?.find((branch) => branch.id === appliedEntry.branchId)?.label
      : resolved.branchLabel;

    steps.push({
      stepId,
      order: step.order,
      stepTitle: step.title,
      stepType: step.type,
      inputSummary: formatInputSummary(input),
      evaluationStatus: evaluation?.status,
      evaluationMessage: evaluation?.message,
      branchLabel,
      branchOutcome: resolved.branchOutcome,
      diagnosticEffectSummaries: effects.map((effect) =>
        formatDiagnosticEffect(effect, componentLabel),
      ),
      tone: resolveProcedureStepTone(
        stepId,
        step.type,
        input?.value,
        evaluation?.status,
        effects,
      ),
    });
  }

  const outcomeStep = procedure.steps.find((step) => step.id === runState.currentStepId);
  if (
    runState.status === 'completed'
    && outcomeStep?.type === 'outcome'
    && !steps.some((entry) => entry.stepId === outcomeStep.id)
  ) {
    steps.push({
      stepId: outcomeStep.id,
      order: outcomeStep.order,
      stepTitle: outcomeStep.title,
      stepType: outcomeStep.type,
      diagnosticEffectSummaries: [],
      tone: resolveProcedureStepTone(outcomeStep.id, outcomeStep.type),
    });
  }

  return {
    procedureId: procedure.id,
    procedureTitle: procedure.title,
    manualId: procedure.source.manualId,
    oemTestNumber: procedure.source.oemTestNumber,
    startedAt: runState.startedAt,
    status: runState.status,
    oemOutcome: runState.oemOutcome,
    steps,
  };
}

export function buildProcedureRunReviewById(
  procedureId: string,
  runState: ProcedureRunState,
): ProcedureRunReview | null {
  const procedure = getServiceProcedure(procedureId);
  if (!procedure) return null;
  return buildProcedureRunReview(procedure, runState);
}

export function listCompletedProcedureRunReviews(
  procedureRuns: Record<string, ProcedureRunState> | null | undefined,
): ProcedureRunReview[] {
  if (!procedureRuns) return [];

  return Object.entries(procedureRuns)
    .filter(([, runState]) => runState?.status === 'completed')
    .map(([procedureId, runState]) => buildProcedureRunReviewById(procedureId, runState))
    .filter((review): review is ProcedureRunReview => Boolean(review))
    .sort((a, b) => compareOemTestNumber(a.oemTestNumber, b.oemTestNumber));
}

function compareOemTestNumber(a: string, b: string): number {
  const parse = (value: string) => {
    const match = value.match(/^(\d+)([a-z]*)$/i);
    if (!match) return { num: 999, suffix: value.toLowerCase() };
    return { num: Number.parseInt(match[1], 10), suffix: (match[2] || '').toLowerCase() };
  };
  const left = parse(a);
  const right = parse(b);
  if (left.num !== right.num) return left.num - right.num;
  return left.suffix.localeCompare(right.suffix);
}
