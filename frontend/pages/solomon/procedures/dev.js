import { useEffect, useMemo, useState } from 'react';
import SolomonListPage from '../../../components/solomon/SolomonListPage';
import {
  SOLOMON_GLASS_PANEL_CLASS,
  SOLOMON_REFERENCE_EYEBROW_CLASS,
} from '../../../components/solomon/solomonListPageUi';
import { useSolomonAuth } from '../../../hooks/useSolomonAuth';
import { getAllServiceProcedures } from '../../../components/diagnostics/procedures/procedureRegistry';
import { useProcedureRun } from '../../../components/diagnostics/procedures/useProcedureRun';
import ProcedureStepView from '../../../components/diagnostics/procedures/ui/ProcedureStepView';

const PROCEDURE_OPTIONS = getAllServiceProcedures();

export default function SolomonProcedureDevPage() {
  const { canUseSolomon, isStaff, rolesLoading, rolesResolved } = useSolomonAuth();
  const [selectedId, setSelectedId] = useState(PROCEDURE_OPTIONS[0]?.id || '');
  const {
    procedure,
    runState,
    currentStep,
    lastResult,
    log,
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
  } = useProcedureRun(selectedId);

  useEffect(() => {
    reset();
  }, [selectedId, reset]);

  const staffReady = rolesResolved && canUseSolomon && isStaff;

  const headerDescription = useMemo(() => {
    if (!procedure) return 'Internal OEM procedure runner harness.';
    return `${procedure.source.manualId} · TEST #${procedure.source.oemTestNumber} · ${procedure.platformId}`;
  }, [procedure]);

  return (
    <SolomonListPage
      headTitle="Procedure Dev"
      title="Procedure harness"
      description={headerDescription}
      backHref="/solomon/more"
      backLabel="More"
      accessGuard
      accessGuardTitle="Sign in to use procedure dev tools"
      loading={rolesLoading}
      loadingFallback={null}
    >
      {!staffReady ? (
        <div className={SOLOMON_GLASS_PANEL_CLASS}>
          <p className="text-sm text-amber-200">Staff access required for procedure dev tools.</p>
          <p className="mt-2 text-xs text-[var(--solomon-text-secondary)]">
            Sign in with a technician, manager, or admin account to run OEM procedure seeds.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          <div className={SOLOMON_GLASS_PANEL_CLASS}>
            <p className={SOLOMON_REFERENCE_EYEBROW_CLASS}>Dev tooling</p>
            <label className="mt-2 block text-xs text-[var(--solomon-text-secondary)]" htmlFor="procedure-select">
              Procedure seed
            </label>
            <select
              id="procedure-select"
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
              className="mt-1 w-full rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2 text-sm text-white"
              disabled={isRunning}
            >
              {PROCEDURE_OPTIONS.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.title} ({item.id})
                </option>
              ))}
            </select>

            <div className="mt-3 flex gap-2">
              {!isRunning && !isComplete ? (
                <button
                  type="button"
                  onClick={start}
                  disabled={!procedure}
                  className="flex-1 rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
                >
                  Start run
                </button>
              ) : (
                <button
                  type="button"
                  onClick={reset}
                  className="flex-1 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-4 py-2.5 text-sm font-medium text-[var(--solomon-text-primary)]"
                >
                  Reset
                </button>
              )}
            </div>
          </div>

          {isComplete && runState?.oemOutcome ? (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
              <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/90">OEM outcome</p>
              <p className="mt-1 text-sm text-emerald-100">{runState.oemOutcome}</p>
            </div>
          ) : null}

          {isRunning && currentStep ? (
            <div className={SOLOMON_GLASS_PANEL_CLASS}>
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

          {log.length > 0 ? (
            <div className={SOLOMON_GLASS_PANEL_CLASS}>
              <p className="text-sm font-semibold text-[var(--solomon-text-primary)]">Run log</p>
              <ol className="mt-3 space-y-2 text-xs text-[var(--solomon-text-secondary)]">
                {log.map((entry, index) => (
                  <li
                    key={`${entry.stepId}-${index}`}
                    className="rounded-md border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/40 px-3 py-2"
                  >
                    <p className="font-medium text-[var(--solomon-text-primary)]">{entry.stepTitle}</p>
                    {entry.input ? (
                      <p className="mt-0.5">
                        Input: {entry.input.kind} = {entry.input.value}
                      </p>
                    ) : null}
                    {entry.evaluationStatus ? (
                      <p className="mt-0.5">Evaluation: {entry.evaluationStatus}</p>
                    ) : null}
                    {entry.branchId ? <p className="mt-0.5">Branch: {entry.branchId}</p> : null}
                    {entry.oemOutcome ? (
                      <p className="mt-0.5 text-emerald-300">{entry.oemOutcome}</p>
                    ) : null}
                  </li>
                ))}
              </ol>
            </div>
          ) : null}
        </div>
      )}
    </SolomonListPage>
  );
}
