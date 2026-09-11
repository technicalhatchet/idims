'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { getServiceProcedure } from '../procedureRegistry';
import { useProcedureRun } from '../useProcedureRun';
import { buildProcedureRunReviewById } from '../buildProcedureRunReview';
import type { ProcedureStepTone } from '../procedureRunPresentation';
import { resolveProcedureRunPresentation } from '../procedureRunPresentation';
import type { ProcedureRunState } from '../types';
import ProcedureStepView from './ProcedureStepView';

const STEP_TONE_CLASS: Record<ProcedureStepTone, string> = {
  success: 'text-emerald-600 dark:text-emerald-300',
  failure: 'text-red-600 dark:text-red-300',
  neutral: 'text-[var(--solomon-text-secondary)]',
};

function CompletedProcedureAccordion({
  procedureId,
  runState,
  variant,
}: {
  procedureId: string;
  runState: ProcedureRunState;
  variant: 'mobile' | 'desktop';
}) {
  const [expanded, setExpanded] = useState(false);
  const review = useMemo(
    () => buildProcedureRunReviewById(procedureId, runState),
    [procedureId, runState],
  );
  const isMobile = variant === 'mobile';
  const presentation = resolveProcedureRunPresentation(procedureId, runState);
  const isActionRequired = presentation.disposition === 'action_required';

  const shellClass = isActionRequired
    ? isMobile
      ? 'border-red-500/40 bg-red-500/10'
      : 'border-red-300 bg-red-50/80 dark:border-red-800 dark:bg-red-950/35'
    : isMobile
      ? 'border-emerald-500/30 bg-emerald-500/10'
      : 'border-emerald-200 bg-emerald-50/70 dark:border-emerald-800 dark:bg-emerald-950/30';

  const titleClass = isActionRequired
    ? isMobile ? 'text-red-50' : 'text-red-900 dark:text-red-50'
    : isMobile ? 'text-emerald-50' : 'text-emerald-900 dark:text-emerald-50';

  const iconClass = isActionRequired ? 'text-red-500' : 'text-emerald-400';
  const icon = isActionRequired ? '✕' : '✓';

  return (
    <div
      className={`rounded-lg border ${shellClass}`}
      data-oem-procedure-complete
      data-oem-procedure-disposition={presentation.disposition}
    >
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center gap-2 px-3 py-2 text-left"
      >
        <span className={iconClass} aria-hidden>{icon}</span>
        <span className="min-w-0 flex-1">
          <span className={`block text-sm font-medium ${titleClass}`}>
            {presentation.headline}
          </span>
          {presentation.subline ? (
            <span className="mt-0.5 block text-[11px] text-[var(--solomon-text-secondary)]">
              {presentation.subline}
            </span>
          ) : null}
        </span>
        <span className="shrink-0 text-[10px] text-[var(--solomon-text-muted)]">
          {expanded ? 'Hide' : 'Details'}
        </span>
      </button>
      {expanded && review?.steps.length ? (
        <ol className="border-t border-[color:var(--solomon-border-subtle)] px-3 py-2 space-y-1.5 text-[11px]">
          {review.steps.map((step) => (
            <li
              key={step.stepId}
              className={STEP_TONE_CLASS[step.tone]}
            >
              <span className="font-medium">
                {step.order}. {step.stepTitle}
              </span>
              {step.inputSummary ? ` — ${step.inputSummary}` : ''}
              {step.branchLabel ? ` (${step.branchLabel})` : ''}
              {step.diagnosticEffectSummaries.length ? (
                <span className="block text-[10px] opacity-90">
                  {step.diagnosticEffectSummaries.join(' · ')}
                </span>
              ) : null}
            </li>
          ))}
        </ol>
      ) : null}
    </div>
  );
}

function ActiveProcedureRunner({
  procedureId,
  savedRunState,
  onRunStateChange,
  autoStart = false,
  variant,
}: {
  procedureId: string;
  savedRunState: ProcedureRunState | null;
  onRunStateChange: (procedureId: string, runState: ProcedureRunState) => void;
  autoStart?: boolean;
  variant: 'mobile' | 'desktop';
}) {
  const procedure = getServiceProcedure(procedureId);
  const isMobile = variant === 'mobile';

  const handleRunStateChange = useCallback(
    (nextRunState: ProcedureRunState | null) => {
      if (!nextRunState) return;
      onRunStateChange(procedureId, nextRunState);
    },
    [onRunStateChange, procedureId],
  );

  const {
    runState,
    currentStep,
    lastResult,
    measurementDraft,
    setMeasurementDraft,
    stepIndex,
    stepTotal,
    isRunning,
    continueStep,
    submitCheckpoint,
    submitMeasurement,
    start,
  } = useProcedureRun(procedureId, {
    initialRunState: savedRunState,
    onRunStateChange: handleRunStateChange,
  });

  const autoStartedRef = useRef(false);
  const outcomeHandledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!autoStart || autoStartedRef.current || isRunning) return;
    autoStartedRef.current = true;
    start();
  }, [autoStart, isRunning, start]);

  useEffect(() => {
    if (!isRunning || !currentStep || currentStep.type !== 'outcome') return;
    if (outcomeHandledRef.current === currentStep.id) return;
    outcomeHandledRef.current = currentStep.id;
    continueStep();
  }, [isRunning, currentStep, continueStep]);

  if (!procedure) return null;

  const shellClass = isMobile
    ? 'border-cyan-500/30 bg-cyan-500/10'
    : 'border-cyan-200 bg-cyan-50/80 dark:border-cyan-800 dark:bg-cyan-950/40';

  if (!isRunning || !currentStep || currentStep.type === 'outcome') {
    return (
      <div
        className={`rounded-lg border px-3 py-3 ${shellClass}`}
        data-oem-procedure-inline
      >
        <p className={`text-sm font-medium ${isMobile ? 'text-cyan-50' : 'text-cyan-950 dark:text-cyan-50'}`}>
          {procedure.title}
        </p>
        {!isRunning ? (
          <button
            type="button"
            onClick={start}
            className="mt-3 w-full rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white"
          >
            {savedRunState ? 'Resume OEM test' : 'Start OEM test'}
          </button>
        ) : (
          <p className="mt-2 text-[11px] text-[var(--solomon-text-secondary)]">
            Finishing test…
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border ${shellClass}`}
      data-oem-procedure-inline
    >
      <div className="px-3 py-2.5 border-b border-[color:var(--solomon-border-subtle)]">
        <p className={`text-sm font-medium ${isMobile ? 'text-cyan-50' : 'text-cyan-950 dark:text-cyan-50'}`}>
          {procedure.title}
        </p>
        <p className="mt-1 text-[11px] text-[var(--solomon-text-secondary)]">
          Step {stepIndex} of {stepTotal}
        </p>
      </div>

      <div className="px-3 py-3">
        <ProcedureStepView
          step={currentStep}
          stepIndex={stepIndex}
          stepTotal={stepTotal}
          measurementDraft={measurementDraft}
          onMeasurementDraftChange={setMeasurementDraft}
          onCheckpoint={submitCheckpoint}
          onSubmitMeasurement={submitMeasurement}
          onContinue={continueStep}
          lastEvaluation={lastResult?.evaluation}
          matchedBranch={lastResult?.matchedBranch}
        />
      </div>
    </div>
  );
}

interface OemProcedureWizardSlotProps {
  procedureRuns: Record<string, ProcedureRunState>;
  activeProcedureId: string | null;
  autoStartProcedureId: string | null;
  onRunStateChange: (procedureId: string, runState: ProcedureRunState) => void;
  onDismissActiveProcedure: () => void;
  variant?: 'mobile' | 'desktop';
}

/** Floating OEM runner above the wizard — launched from the OEM wizard step. */
export default function OemProcedureWizardSlot({
  procedureRuns,
  activeProcedureId,
  autoStartProcedureId,
  onRunStateChange,
  variant = 'desktop',
}: OemProcedureWizardSlotProps) {
  const completedIds = useMemo(
    () => Object.entries(procedureRuns)
      .filter(([, run]) => run?.status === 'completed')
      .map(([id]) => id),
    [procedureRuns],
  );

  const activeRun = activeProcedureId ? procedureRuns[activeProcedureId] : null;
  const showActiveRunner = Boolean(
    activeProcedureId
    && (!activeRun || activeRun.status === 'in_progress'),
  );

  if (!showActiveRunner && !completedIds.length) return null;

  return (
    <div className="space-y-2">
      {completedIds.map((procedureId) => (
        <CompletedProcedureAccordion
          key={procedureId}
          procedureId={procedureId}
          runState={procedureRuns[procedureId]}
          variant={variant}
        />
      ))}

      {showActiveRunner && activeProcedureId ? (
        <ActiveProcedureRunner
          procedureId={activeProcedureId}
          savedRunState={procedureRuns[activeProcedureId] || null}
          onRunStateChange={onRunStateChange}
          autoStart={autoStartProcedureId === activeProcedureId}
          variant={variant}
        />
      ) : null}
    </div>
  );
}
