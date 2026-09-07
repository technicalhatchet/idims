import { useCallback, useMemo, useState } from 'react';
import { getServiceProcedure } from './procedureRegistry';
import {
  createProcedureRun,
  getCurrentStep,
  submitProcedureStep,
} from './procedureRunner';
import type {
  ProcedureRunState,
  ProcedureStepInput,
  ProcedureStepResult,
  ServiceProcedure,
} from './types';

export interface ProcedureRunLogEntry {
  stepId: string;
  stepTitle: string;
  input?: ProcedureStepInput;
  evaluationStatus?: string;
  branchId?: string;
  oemOutcome?: string;
  at: string;
}

export interface UseProcedureRunOptions {
  initialRunState?: ProcedureRunState | null;
  onRunStateChange?: (runState: ProcedureRunState | null) => void;
}

export function useProcedureRun(
  procedureId: string | null | undefined,
  options: UseProcedureRunOptions = {},
) {
  const { initialRunState = null, onRunStateChange } = options;

  const procedure = useMemo(
    () => getServiceProcedure(procedureId),
    [procedureId],
  );

  const [runState, setRunState] = useState<ProcedureRunState | null>(() => initialRunState);
  const [lastResult, setLastResult] = useState<ProcedureStepResult | null>(null);
  const [log, setLog] = useState<ProcedureRunLogEntry[]>([]);
  const [measurementDraft, setMeasurementDraft] = useState('');

  const currentStep = useMemo(() => {
    if (!procedure || !runState) return null;
    return getCurrentStep(procedure, runState);
  }, [procedure, runState]);

  const commitRunState = useCallback(
    (nextRunState: ProcedureRunState | null) => {
      setRunState(nextRunState);
      onRunStateChange?.(nextRunState);
    },
    [onRunStateChange],
  );

  const appendLog = useCallback((proc: ServiceProcedure, result: ProcedureStepResult) => {
    const step = proc.steps.find((item) => item.id === result.stepId);
    setLog((prev) => [
      ...prev,
      {
        stepId: result.stepId,
        stepTitle: step?.title || result.stepId,
        input: result.runState.stepInputs[result.stepId],
        evaluationStatus: result.evaluation?.status,
        branchId: result.matchedBranch?.id,
        oemOutcome: result.matchedBranch?.oemOutcome || result.runState.oemOutcome,
        at: new Date().toISOString(),
      },
    ]);
  }, []);

  const start = useCallback(() => {
    if (!procedure) return;
    const nextRun = createProcedureRun(procedure);
    commitRunState(nextRun);
    setLastResult(null);
    setLog([]);
    setMeasurementDraft('');
  }, [commitRunState, procedure]);

  const reset = useCallback(() => {
    commitRunState(null);
    setLastResult(null);
    setLog([]);
    setMeasurementDraft('');
  }, [commitRunState]);

  const submit = useCallback(
    (input?: ProcedureStepInput) => {
      if (!procedure || !runState) return null;
      const result = submitProcedureStep(procedure, runState, input);
      commitRunState(result.runState);
      setLastResult(result);
      appendLog(procedure, result);
      setMeasurementDraft('');
      return result;
    },
    [appendLog, commitRunState, procedure, runState],
  );

  const continueStep = useCallback(() => {
    return submit();
  }, [submit]);

  const submitCheckpoint = useCallback(
    (value: 'yes' | 'no') => {
      return submit({ kind: 'checkpoint', value });
    },
    [submit],
  );

  const submitMeasurement = useCallback(() => {
    const trimmed = measurementDraft.trim();
    if (!trimmed) return null;
    return submit({ kind: 'measurement', value: trimmed });
  }, [measurementDraft, submit]);

  const stepIndex = currentStep?.order ?? 0;
  const stepTotal = procedure?.steps.length ?? 0;

  return {
    procedure,
    runState,
    currentStep,
    lastResult,
    log,
    measurementDraft,
    setMeasurementDraft,
    stepIndex,
    stepTotal,
    isRunning: Boolean(runState && runState.status === 'in_progress'),
    isComplete: runState?.status === 'completed',
    start,
    reset,
    continueStep,
    submitCheckpoint,
    submitMeasurement,
  };
}
