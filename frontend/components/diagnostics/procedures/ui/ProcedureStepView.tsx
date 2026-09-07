import { useMemo } from 'react';
import type { MeasurementEvaluation } from '../../knowledge/types';
import { getMeasurementKnowledge } from '../../knowledge/knowledgeRegistry';
import { formatRangeLabel } from '../../knowledge/measurementRulesEngine';
import type { DecisionBranch, ProcedureStep, ProcedureStepInput } from '../types';
import ProcedureTestPointPanel from './ProcedureTestPointPanel';

const STEP_TYPE_LABELS: Record<string, string> = {
  safety: 'Safety',
  instruction: 'Instruction',
  visual_check: 'Check',
  measurement: 'Measurement',
  outcome: 'Outcome',
};

const STATUS_CLASS: Record<string, string> = {
  normal: 'text-emerald-400',
  warning: 'text-amber-400',
  critical: 'text-red-400',
  unknown: 'text-[var(--solomon-text-secondary)]',
};

interface ProcedureStepViewProps {
  step: ProcedureStep;
  stepIndex: number;
  stepTotal: number;
  measurementDraft: string;
  onMeasurementDraftChange: (value: string) => void;
  onContinue: () => void;
  onCheckpoint: (value: 'yes' | 'no') => void;
  onSubmitMeasurement: () => void;
  lastEvaluation?: MeasurementEvaluation | null;
  matchedBranch?: DecisionBranch | null;
  disabled?: boolean;
}

export default function ProcedureStepView({
  step,
  stepIndex,
  stepTotal,
  measurementDraft,
  onMeasurementDraftChange,
  onContinue,
  onCheckpoint,
  onSubmitMeasurement,
  lastEvaluation,
  matchedBranch,
  disabled = false,
}: ProcedureStepViewProps) {
  const knowledge = useMemo(
    () => getMeasurementKnowledge(step.measurementKnowledgeId),
    [step.measurementKnowledgeId],
  );

  const expectedRange = knowledge?.ranges?.normal
    ? formatRangeLabel(knowledge.ranges.normal, knowledge.unit)
    : null;

  const isMeasurement = step.type === 'measurement';
  const isCheckpoint = step.type === 'visual_check';
  const isPassive = step.type === 'safety' || step.type === 'instruction' || step.type === 'outcome';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--solomon-status-reference)]/90">
          {STEP_TYPE_LABELS[step.type] || step.type}
        </span>
        <span className="text-xs text-[var(--solomon-text-secondary)]">
          Step {stepIndex} of {stepTotal}
        </span>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-[var(--solomon-text-primary)]">{step.title}</h2>
        {step.body ? (
          <p className="mt-2 text-sm leading-relaxed text-[var(--solomon-text-secondary)]">{step.body}</p>
        ) : null}
      </div>

      {step.sourceExcerpt ? (
        <blockquote className="rounded-lg border border-[color:var(--solomon-border-subtle)] border-l-2 border-l-[color:var(--solomon-status-reference)]/50 bg-[var(--solomon-surface-glass)] px-3 py-2 text-xs italic leading-relaxed text-[var(--solomon-text-secondary)]">
          {step.sourceExcerpt}
        </blockquote>
      ) : null}

      {step.testPoint ? <ProcedureTestPointPanel testPoint={step.testPoint} /> : null}

      {isMeasurement && knowledge ? (
        <div className="text-xs text-[var(--solomon-text-secondary)]">
          Expected: <span className="text-[var(--solomon-text-primary)]">{expectedRange || 'See OEM spec'}</span>
          {knowledge.openCircuitCritical ? (
            <span className="ml-2 text-red-400">OL = critical</span>
          ) : null}
        </div>
      ) : null}

      {isMeasurement ? (
        <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={measurementDraft}
            onChange={(event) => onMeasurementDraftChange(event.target.value)}
            placeholder={knowledge?.unit ? `Reading (${knowledge.unit})` : 'Reading'}
            className="flex-1 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2.5 text-sm text-white placeholder:text-[color:var(--solomon-text-placeholder)] focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-[color:var(--solomon-focus-ring)]"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={onSubmitMeasurement}
            disabled={disabled || !measurementDraft.trim()}
            className="rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
          >
            Submit
          </button>
        </div>
      ) : null}

      {isCheckpoint ? (
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onCheckpoint('yes')}
            disabled={disabled}
            className="flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 disabled:opacity-50"
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onCheckpoint('no')}
            disabled={disabled}
            className="flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 disabled:opacity-50"
          >
            No
          </button>
        </div>
      ) : null}

      {isPassive && step.type !== 'outcome' ? (
        <button
          type="button"
          onClick={onContinue}
          disabled={disabled}
          className="w-full rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Continue
        </button>
      ) : null}

      {step.type === 'outcome' && step.oemOutcome ? (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {step.oemOutcome}
        </div>
      ) : null}

      {lastEvaluation ? (
        <div className="rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/50 px-3 py-2 text-xs">
          <p className={STATUS_CLASS[lastEvaluation.status] || STATUS_CLASS.unknown}>
            {lastEvaluation.diagnosisLabel || lastEvaluation.status}: {lastEvaluation.message}
          </p>
        </div>
      ) : null}

      {matchedBranch ? (
        <div className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2 text-xs text-cyan-200">
          Branch: {matchedBranch.label}
          {matchedBranch.oemOutcome ? ` — ${matchedBranch.oemOutcome}` : ''}
        </div>
      ) : null}
    </div>
  );
}

export type { ProcedureStepInput };
