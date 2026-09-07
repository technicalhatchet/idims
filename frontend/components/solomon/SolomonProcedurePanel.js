'use client';

import { useCallback, useMemo, useState } from 'react';
import {
  formatServiceModeRequirements,
} from '../diagnostics/procedures/recommendServiceProcedures';
import { useProcedureRun } from '../diagnostics/procedures/useProcedureRun';
import ProcedureStepView from '../diagnostics/procedures/ui/ProcedureStepView';
import {
  SOLOMON_GLASS_PANEL_CLASS,
  SOLOMON_REFERENCE_EYEBROW_CLASS,
} from './solomonListPageUi';

function ProcedureRunCard({
  recommendation,
  savedRunState,
  isExpanded,
  onToggle,
  onRunStateChange,
  variant,
}) {
  const { procedure, reason } = recommendation;
  const serviceModeBadges = useMemo(
    () => formatServiceModeRequirements(procedure),
    [procedure],
  );

  const handleRunStateChange = useCallback(
    (nextRunState) => {
      onRunStateChange(procedure.id, nextRunState);
    },
    [onRunStateChange, procedure.id],
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
    isComplete,
    start,
    reset,
    continueStep,
    submitCheckpoint,
    submitMeasurement,
  } = useProcedureRun(procedure.id, {
    initialRunState: savedRunState,
    onRunStateChange: handleRunStateChange,
  });

  const statusLabel = isComplete
    ? 'Complete'
    : isRunning
      ? `Step ${stepIndex} of ${stepTotal}`
      : savedRunState
        ? 'Paused'
        : 'Not started';

  const isMobile = variant === 'mobile';

  return (
    <div className="rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/60 overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="flex w-full items-start gap-3 px-3 py-3 text-left hover:bg-[var(--solomon-surface-elevated)]/60"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-[var(--solomon-text-primary)]">{procedure.title}</p>
          <p className="mt-0.5 text-xs text-[var(--solomon-text-secondary)]">
            {procedure.source.manualId} · TEST #{procedure.source.oemTestNumber}
          </p>
          <p className="mt-1 text-xs leading-relaxed text-[var(--solomon-text-secondary)]">{reason}</p>
          {serviceModeBadges.length ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {serviceModeBadges.map((badge) => (
                <span
                  key={badge}
                  className="rounded-full border border-cyan-500/25 bg-cyan-500/10 px-2 py-0.5 text-[10px] font-medium text-cyan-200"
                >
                  {badge}
                </span>
              ))}
            </div>
          ) : null}
        </div>
        <span className="shrink-0 rounded-full border border-[color:var(--solomon-border-subtle)] px-2 py-0.5 text-[10px] text-[var(--solomon-text-muted)]">
          {statusLabel}
        </span>
      </button>

      {isExpanded ? (
        <div className="border-t border-[color:var(--solomon-border-subtle)] px-3 py-3 space-y-3">
          {!isRunning && !isComplete ? (
            <button
              type="button"
              onClick={start}
              className="w-full rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white"
            >
              {savedRunState ? 'Resume procedure' : 'Start OEM procedure'}
            </button>
          ) : (
            <button
              type="button"
              onClick={reset}
              className="w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-4 py-2 text-sm font-medium text-[var(--solomon-text-primary)]"
            >
              Reset procedure
            </button>
          )}

          {isComplete && runState?.oemOutcome ? (
            <div className="rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/90">OEM outcome</p>
              <p className="mt-1 text-sm text-emerald-100">{runState.oemOutcome}</p>
            </div>
          ) : null}

          {isRunning && currentStep ? (
            <div className={isMobile ? '' : SOLOMON_GLASS_PANEL_CLASS}>
              <ProcedureStepView
                step={currentStep}
                stepIndex={stepIndex}
                stepTotal={stepTotal}
                measurementDraft={measurementDraft}
                onMeasurementDraftChange={setMeasurementDraft}
                onContinue={continueStep}
                onCheckpoint={submitCheckpoint}
                onSubmitMeasurement={submitMeasurement}
                lastEvaluation={lastResult?.evaluation}
                matchedBranch={lastResult?.matchedBranch}
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function SolomonProcedurePanel({
  recommendations = [],
  procedureRuns = {},
  activeProcedureId = null,
  onProcedureRunChange,
  onActiveProcedureChange,
  variant = 'mobile',
  density = 'default',
}) {
  const [expandedId, setExpandedId] = useState(activeProcedureId || recommendations[0]?.procedureId || null);
  const isCompact = density === 'compact';

  const handleToggle = useCallback(
    (procedureId) => {
      setExpandedId((current) => {
        const next = current === procedureId ? null : procedureId;
        onActiveProcedureChange?.(next);
        return next;
      });
    },
    [onActiveProcedureChange],
  );

  const handleRunStateChange = useCallback(
    (procedureId, nextRunState) => {
      onProcedureRunChange?.(procedureId, nextRunState);
      if (nextRunState?.status === 'in_progress') {
        onActiveProcedureChange?.(procedureId);
      }
    },
    [onActiveProcedureChange, onProcedureRunChange],
  );

  if (!recommendations.length) return null;

  return (
    <section className={SOLOMON_GLASS_PANEL_CLASS}>
      <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>OEM service procedures</p>
      <p className={`text-[var(--solomon-text-secondary)] ${isCompact ? 'mt-1 text-xs' : 'mt-1.5 text-sm'}`}>
        Platform-matched tests from the service manual — step through with wire colors and service mode entry.
      </p>
      <div className={`space-y-2 ${isCompact ? 'mt-2' : 'mt-3'}`}>
        {recommendations.map((recommendation) => (
          <ProcedureRunCard
            key={recommendation.procedureId}
            recommendation={recommendation}
            savedRunState={procedureRuns[recommendation.procedureId] || null}
            isExpanded={expandedId === recommendation.procedureId}
            onToggle={() => handleToggle(recommendation.procedureId)}
            onRunStateChange={handleRunStateChange}
            variant={variant}
          />
        ))}
      </div>
    </section>
  );
}
