import { applyProcedureDiagnosticEffects } from './applyProcedureDiagnosticEffects';
import {
  evaluateProcedureMeasurement,
  matchProcedureBranch,
} from './evaluateProcedureMeasurement';
import type {
  DecisionBranch,
  ProcedureRunState,
  ProcedureStep,
  ProcedureStepInput,
  ProcedureStepResult,
  ServiceProcedure,
} from './types';

function nowIso(): string {
  return new Date().toISOString();
}

export function getProcedureStep(
  procedure: ServiceProcedure,
  stepId: string,
): ProcedureStep | null {
  return procedure.steps.find((step) => step.id === stepId) ?? null;
}

export function createProcedureRun(procedure: ServiceProcedure): ProcedureRunState {
  const entryStep = getProcedureStep(procedure, procedure.entryStepId);
  if (!entryStep) {
    throw new Error(`Procedure ${procedure.id} missing entry step ${procedure.entryStepId}`);
  }

  return {
    procedureId: procedure.id,
    version: procedure.version,
    startedAt: nowIso(),
    currentStepId: entryStep.id,
    completedStepIds: [],
    stepInputs: {},
    status: 'in_progress',
  };
}

export function getCurrentStep(
  procedure: ServiceProcedure,
  runState: ProcedureRunState,
): ProcedureStep | null {
  return getProcedureStep(procedure, runState.currentStepId);
}

function completeRun(
  runState: ProcedureRunState,
  stepId: string,
  oemOutcome?: string,
): ProcedureRunState {
  const completedStepIds = runState.completedStepIds.includes(stepId)
    ? runState.completedStepIds
    : [...runState.completedStepIds, stepId];

  return {
    ...runState,
    completedStepIds,
    currentStepId: stepId,
    oemOutcome: oemOutcome ?? runState.oemOutcome,
    status: 'completed',
  };
}

function advanceRun(
  runState: ProcedureRunState,
  completedStepId: string,
  nextStepId: string,
  oemOutcome?: string,
): ProcedureRunState {
  const completedStepIds = runState.completedStepIds.includes(completedStepId)
    ? runState.completedStepIds
    : [...runState.completedStepIds, completedStepId];

  return {
    ...runState,
    completedStepIds,
    currentStepId: nextStepId,
    oemOutcome: oemOutcome ?? runState.oemOutcome,
    status: 'in_progress',
  };
}

function resolveStepInput(
  step: ProcedureStep,
  rawInput?: ProcedureStepInput,
): ProcedureStepInput | undefined {
  if (rawInput) return rawInput;
  if (step.requiresInput === false) {
    return { kind: 'checkpoint', value: 'ok' };
  }
  return undefined;
}

function resolveNextStepId(
  step: ProcedureStep,
  matchedBranch: DecisionBranch | null,
): { nextStepId: string | null; terminal: boolean; oemOutcome?: string } {
  if (matchedBranch) {
    if (matchedBranch.terminal || !matchedBranch.nextStepId) {
      return {
        nextStepId: null,
        terminal: true,
        oemOutcome: matchedBranch.oemOutcome,
      };
    }
    return {
      nextStepId: matchedBranch.nextStepId,
      terminal: false,
      oemOutcome: matchedBranch.oemOutcome,
    };
  }

  if (step.defaultNextStepId) {
    return { nextStepId: step.defaultNextStepId, terminal: false };
  }

  if (step.type === 'outcome') {
    return { nextStepId: null, terminal: true, oemOutcome: step.oemOutcome };
  }

  return { nextStepId: null, terminal: true };
}

export function submitProcedureStep(
  procedure: ServiceProcedure,
  runState: ProcedureRunState,
  input?: ProcedureStepInput,
): ProcedureStepResult {
  if (runState.status !== 'in_progress') {
    throw new Error(`Procedure run ${runState.procedureId} is not in progress`);
  }

  const step = getCurrentStep(procedure, runState);
  if (!step) {
    throw new Error(`Current step ${runState.currentStepId} not found in ${procedure.id}`);
  }

  const stepInput = resolveStepInput(step, input);
  if (step.requiresInput !== false && !stepInput) {
    throw new Error(`Step ${step.id} requires input`);
  }

  let evaluation = null;
  let matchedBranch: DecisionBranch | null = null;

  if (step.type === 'measurement') {
    if (!stepInput || stepInput.kind !== 'measurement') {
      throw new Error(`Step ${step.id} expects a measurement input`);
    }
    evaluation = evaluateProcedureMeasurement(step.measurementKnowledgeId, stepInput.value);
    matchedBranch = matchProcedureBranch(step.branches, evaluation);
  } else if (step.branches?.length) {
    matchedBranch = matchProcedureBranch(step.branches, null, stepInput?.value);
  }

  const effects =
    matchedBranch?.diagnosticEffects ??
    (matchedBranch ? undefined : step.diagnosticEffects);
  applyProcedureDiagnosticEffects(effects);

  const storedInputs = stepInput
    ? { ...runState.stepInputs, [step.id]: stepInput }
    : runState.stepInputs;

  const { nextStepId, terminal, oemOutcome } = resolveNextStepId(step, matchedBranch);

  if (terminal || !nextStepId) {
    const finalOutcome = oemOutcome ?? step.oemOutcome;
    return {
      stepId: step.id,
      evaluation,
      matchedBranch,
      completed: true,
      runState: completeRun(
        { ...runState, stepInputs: storedInputs },
        step.id,
        finalOutcome,
      ),
    };
  }

  const nextStep = getProcedureStep(procedure, nextStepId);
  if (!nextStep) {
    throw new Error(`Next step ${nextStepId} not found in ${procedure.id}`);
  }

  return {
    stepId: step.id,
    evaluation,
    matchedBranch,
    completed: false,
    runState: advanceRun(
      { ...runState, stepInputs: storedInputs },
      step.id,
      nextStepId,
      oemOutcome,
    ),
  };
}

export function abortProcedureRun(runState: ProcedureRunState): ProcedureRunState {
  return { ...runState, status: 'aborted' };
}
