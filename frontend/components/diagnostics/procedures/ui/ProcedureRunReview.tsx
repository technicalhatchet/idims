import { useMemo, useState } from 'react';
import type { ProcedureRunReview } from '../buildProcedureRunReview';
import type { ProcedureRunState } from '../types';
import { buildProcedureRunReviewById } from '../buildProcedureRunReview';

const EVALUATION_CLASS: Record<string, string> = {
  normal: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
  unknown: 'text-[var(--solomon-text-secondary)]',
};

const STEP_TYPE_LABELS: Record<string, string> = {
  safety: 'Safety',
  instruction: 'Instruction',
  visual_check: 'Check',
  measurement: 'Measurement',
  outcome: 'Outcome',
};

interface ProcedureRunReviewProps {
  procedureId: string;
  runState: ProcedureRunState;
  /** Pre-built review avoids duplicate work when listing multiple runs. */
  review?: ProcedureRunReview | null;
  defaultExpanded?: boolean;
  compact?: boolean;
}

export default function ProcedureRunReview({
  procedureId,
  runState,
  review: reviewProp = null,
  defaultExpanded = true,
  compact = false,
}: ProcedureRunReviewProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  const review = useMemo(() => {
    if (reviewProp) return reviewProp;
    return buildProcedureRunReviewById(procedureId, runState);
  }, [procedureId, reviewProp, runState]);

  if (!review || runState.status !== 'completed' || !review.steps.length) {
    return null;
  }

  const meaningfulSteps = review.steps.filter(
    (step) =>
      step.inputSummary
      || step.branchLabel
      || step.diagnosticEffectSummaries.length
      || step.stepType === 'measurement'
      || step.stepType === 'outcome',
  );

  const stepsToShow = meaningfulSteps.length ? meaningfulSteps : review.steps;

  return (
    <div className="rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/40">
      <button
        type="button"
        onClick={() => setExpanded((current) => !current)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <div className="min-w-0">
          <p className="text-[10px] uppercase tracking-[0.14em] text-[var(--solomon-text-muted)]">
            Run summary
          </p>
          <p className="mt-0.5 text-xs text-[var(--solomon-text-secondary)]">
            {stepsToShow.length} step{stepsToShow.length === 1 ? '' : 's'} recorded
          </p>
        </div>
        <span className="shrink-0 text-[10px] text-[var(--solomon-text-muted)]">
          {expanded ? 'Hide' : 'Show'}
        </span>
      </button>

      {expanded ? (
        <div className="border-t border-[color:var(--solomon-border-subtle)] px-3 py-3 space-y-2">
          <ol className={`space-y-2 ${compact ? 'text-[11px]' : 'text-xs'}`}>
            {stepsToShow.map((step, index) => (
              <li
                key={`${step.stepId}-${index}`}
                className="rounded-md border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/50 px-3 py-2"
              >
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-[var(--solomon-text-primary)]">
                    {step.order}. {step.stepTitle}
                  </p>
                  <span className="shrink-0 text-[10px] uppercase tracking-wide text-[var(--solomon-text-muted)]">
                    {STEP_TYPE_LABELS[step.stepType] || step.stepType}
                  </span>
                </div>

                {step.inputSummary ? (
                  <p className="mt-1 text-[var(--solomon-text-secondary)]">
                    Recorded: <span className="text-[var(--solomon-text-primary)]">{step.inputSummary}</span>
                    {step.evaluationStatus ? (
                      <span className={` ml-1 ${EVALUATION_CLASS[step.evaluationStatus] || ''}`}>
                        ({step.evaluationStatus})
                      </span>
                    ) : null}
                  </p>
                ) : null}

                {step.evaluationMessage && step.inputSummary ? (
                  <p className="mt-0.5 text-[var(--solomon-text-muted)]">{step.evaluationMessage}</p>
                ) : null}

                {step.branchLabel ? (
                  <p className="mt-1 text-[var(--solomon-text-secondary)]">
                    Branch: <span className="text-[var(--solomon-text-primary)]">{step.branchLabel}</span>
                    {step.branchOutcome ? ` — ${step.branchOutcome}` : ''}
                  </p>
                ) : null}

                {step.diagnosticEffectSummaries.length ? (
                  <ul className="mt-1.5 space-y-0.5 text-cyan-200/90">
                    {step.diagnosticEffectSummaries.map((summary) => (
                      <li key={summary}>{summary}</li>
                    ))}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>

          {review.oemOutcome ? (
            <div className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2">
              <p className="text-[10px] uppercase tracking-[0.14em] text-emerald-300/90">OEM outcome</p>
              <p className="mt-1 text-sm text-emerald-100">{review.oemOutcome}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
