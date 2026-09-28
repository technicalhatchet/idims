import { useMemo } from 'react';
import type { MeasurementEvaluation } from '../../knowledge/types';
import { getMeasurementKnowledge } from '../../knowledge/knowledgeRegistry';
import { formatRangeLabel } from '../../knowledge/measurementRulesEngine';
import {
  formatBranchResultPresentation,
  formatMeasurementResultPresentation,
  formatStepHeadline,
  hasTechnicalDetailsContent,
  resolveWhyWeAreCheckingForStep,
  splitInstructionPresentation,
  type ProcedureStepPresentationContext,
} from '../procedureStepPresentation';
import { formatOemProcedureStepProgressLabel } from '../procedureRunDisplay';
import { getServiceProcedure } from '../procedureRegistry';
import type { DecisionBranch, ProcedureStep, ProcedureStepInput } from '../types';
import ProcedureStepImages from './ProcedureStepImages';
import ProcedureStepSourceReference from './ProcedureStepSourceReference';
import ProcedureStepTechnicalDetails from './ProcedureStepTechnicalDetails';

const STEP_TYPE_LABELS: Record<string, string> = {
  safety: 'Safety',
  instruction: 'Instruction',
  visual_check: 'Check',
  measurement: 'Measurement',
  outcome: 'Outcome',
};

const EVALUATION_HEADLINE_CLASS: Record<string, string> = {
  GOOD: 'text-emerald-400',
  CRITICAL: 'text-red-400',
  'OUT OF RANGE': 'text-amber-400',
  'OPEN / OL': 'text-red-400',
};

interface ProcedureStepViewProps {
  procedureId?: string | null;
  step: ProcedureStep;
  stepIndex: number;
  stepTotal?: number;
  measurementDraft: string;
  onMeasurementDraftChange: (value: string) => void;
  onContinue: () => void;
  onCheckpoint: (value: 'yes' | 'no') => void;
  onSubmitMeasurement: () => void;
  lastEvaluation?: MeasurementEvaluation | null;
  matchedBranch?: DecisionBranch | null;
  disabled?: boolean;
  highlightPrimaryAction?: boolean;
  variant?: 'mobile' | 'desktop';
  presentationContext?: ProcedureStepPresentationContext;
  presentationAudience?: 'diy' | 'tech';
}

function SectionLabel({ children }: { children: string }) {
  return (
    <p className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--solomon-status-reference)]/90">
      {children}
    </p>
  );
}

const PRIMARY_ACTION_NUDGE_CLASS =
  'ring-2 ring-amber-400 ring-offset-2 ring-offset-transparent animate-pulse shadow-lg shadow-amber-500/25';

export default function ProcedureStepView({
  procedureId = null,
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
  highlightPrimaryAction = false,
  variant = 'mobile',
  presentationContext,
  presentationAudience = 'tech',
}: ProcedureStepViewProps) {
  const primaryActionClass = highlightPrimaryAction ? PRIMARY_ACTION_NUDGE_CLASS : '';
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
  const isSafety = step.type === 'safety';

  const whyText = useMemo(
    () => resolveWhyWeAreCheckingForStep(step, knowledge?.purpose),
    [step, knowledge?.purpose],
  );

  const instruction = useMemo(() => {
    const split = splitInstructionPresentation(step.body || '');
    if (!isMeasurement || !knowledge || !split.includeBodyInTechnical) {
      return split;
    }
    const rest = (step.body || '').replace(/^[^.!?]+[.!?]\s*/, '').trim();
    const actionText = rest.replace(/\s*expected[^.]*\.?\s*/gi, '').trim();
    if (!actionText) return split;
    return {
      ...split,
      whatToDo: `${split.whatToDo} ${actionText}`,
    };
  }, [step.body, isMeasurement, knowledge]);

  const headline = useMemo(() => formatStepHeadline(step), [step]);

  const evaluationPresentation = lastEvaluation
    ? formatMeasurementResultPresentation(lastEvaluation)
    : null;

  const branchPresentation = matchedBranch
    ? formatBranchResultPresentation(matchedBranch)
    : null;

  const procedure = useMemo(
    () => (procedureId ? getServiceProcedure(procedureId) : null),
    [procedureId],
  );
  const stepProgressLabel = formatOemProcedureStepProgressLabel(
    stepIndex,
    stepTotal,
    procedure,
    step,
  );

  const technicalDefaultExpanded = variant === 'desktop' && presentationAudience !== 'diy';
  const sourceInTechnicalAccordion = hasTechnicalDetailsContent({
    step,
    testingTipsCount: knowledge?.testingTips?.length || 0,
    includeBodyInTechnical: instruction.includeBodyInTechnical,
    meterRangeRef: instruction.meterRangeRef,
    sourceInTechnicalAccordion: true,
  });

  if (isSafety) {
    return (
      <div className="space-y-4" data-procedure-step-type="safety">
        <div className="flex items-center justify-between gap-3">
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-200">
            {STEP_TYPE_LABELS.safety}
          </span>
          {stepProgressLabel ? (
            <span className="text-xs text-[var(--solomon-text-secondary)]">
              {stepProgressLabel}
            </span>
          ) : null}
        </div>

        <div
          className="rounded-xl border-2 border-amber-400/70 bg-amber-500/15 px-3 py-4 shadow-[0_0_0_1px_rgba(251,191,36,0.15)]"
          role="alert"
          aria-label="Safety warning"
          data-procedure-safety-warning
        >
          <div className="flex items-start gap-3">
            <span className="text-xl leading-none text-amber-300" aria-hidden>⚠</span>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-xs font-bold uppercase tracking-[0.14em] text-amber-100">
                Safety — read before continuing
              </p>
              <h2 className="text-lg font-semibold text-[var(--solomon-text-primary)]">
                {headline}
              </h2>
              {step.body ? (
                <p className="text-sm leading-relaxed text-[var(--solomon-text-primary)]">
                  {step.body}
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onContinue}
          disabled={disabled}
          className="w-full rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50"
        >
          Continue
        </button>

        {step.sourceExcerpt ? (
          <ProcedureStepSourceReference sourceExcerpt={step.sourceExcerpt} />
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-4" data-procedure-step-type={step.type}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] uppercase tracking-[0.14em] text-[color:var(--solomon-status-reference)]/90">
          {STEP_TYPE_LABELS[step.type] || step.type}
        </span>
        {stepProgressLabel ? (
          <span className="text-xs text-[var(--solomon-text-secondary)]">
            {stepProgressLabel}
          </span>
        ) : null}
      </div>

      <section className="space-y-1">
        <SectionLabel>What we are checking</SectionLabel>
        <h2 className="text-lg font-semibold leading-snug text-[var(--solomon-text-primary)]">
          {headline}
        </h2>
      </section>

      {whyText ? (
        <section className="space-y-1">
          <SectionLabel>Why we are checking it</SectionLabel>
          <p className="text-sm leading-relaxed text-[var(--solomon-text-secondary)]">
            {whyText}
          </p>
        </section>
      ) : null}

      {(instruction.whatToDo
        || instruction.whatToDoItems?.length
        || instruction.testSequenceItems?.length) ? (
        <section className="space-y-2">
          <SectionLabel>What to do</SectionLabel>
          {instruction.whatToDo ? (
            <p className="text-sm leading-relaxed text-[var(--solomon-text-primary)] whitespace-pre-line">
              {instruction.whatToDo}
            </p>
          ) : null}
          {instruction.whatToDoItems?.length ? (
            <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-[var(--solomon-text-primary)]">
              {instruction.whatToDoItems.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ol>
          ) : null}
          {instruction.testSequenceItems?.length ? (
            <div className="space-y-1">
              <SectionLabel>Test sequence</SectionLabel>
              <ol className="list-decimal space-y-1 pl-5 text-sm leading-relaxed text-[var(--solomon-text-primary)]">
                {instruction.testSequenceItems.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ol>
            </div>
          ) : null}
          {instruction.trailingInstruction ? (
            <p className="text-sm leading-relaxed text-[var(--solomon-text-primary)]">
              {instruction.trailingInstruction}
            </p>
          ) : null}
          {instruction.meterRangeRef ? (
            <p className="text-xs text-[var(--solomon-text-secondary)]">
              Technical reference: {instruction.meterRangeRef}
            </p>
          ) : null}
        </section>
      ) : null}

      {isMeasurement && knowledge ? (
        <section
          className="rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-glass)] px-3 py-2.5"
          data-procedure-expected-range
        >
          <SectionLabel>Expected result</SectionLabel>
          <p className="mt-1 text-xl font-semibold tracking-tight text-[var(--solomon-text-primary)]">
            {expectedRange || 'See OEM spec'}
          </p>
          {knowledge.openCircuitCritical ? (
            <p className="mt-1 text-xs text-red-400">Open circuit (OL) is a critical fault for this test.</p>
          ) : null}
        </section>
      ) : null}

      {isMeasurement ? (
        <section className="space-y-2">
          <SectionLabel>Your reading</SectionLabel>
          <div className="flex gap-2">
          <input
            type="text"
            inputMode="decimal"
            value={measurementDraft}
            onChange={(event) => onMeasurementDraftChange(event.target.value)}
            placeholder={knowledge?.unit ? `Reading (${knowledge.unit})` : 'Reading'}
            className="flex-1 rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2.5 text-base text-white placeholder:text-[color:var(--solomon-text-placeholder)] focus:border-cyan-400/40 focus:outline-none focus:ring-1 focus:ring-[color:var(--solomon-focus-ring)]"
            disabled={disabled}
          />
          <button
            type="button"
            onClick={onSubmitMeasurement}
            disabled={disabled || !measurementDraft.trim()}
            className={`rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${primaryActionClass}`}
            data-oem-procedure-primary-action
          >
            Submit
          </button>
        </div>
        </section>
      ) : null}

      {isCheckpoint ? (
        <section className="space-y-2">
          <SectionLabel>Your answer</SectionLabel>
          <div className="flex gap-2">
          <button
            type="button"
            onClick={() => onCheckpoint('yes')}
            disabled={disabled}
            className={`flex-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-4 py-2.5 text-sm font-medium text-emerald-300 disabled:opacity-50 ${primaryActionClass}`}
            data-oem-procedure-primary-action
          >
            Yes
          </button>
          <button
            type="button"
            onClick={() => onCheckpoint('no')}
            disabled={disabled}
            className={`flex-1 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm font-medium text-red-300 disabled:opacity-50 ${primaryActionClass}`}
            data-oem-procedure-primary-action
          >
            No
          </button>
        </div>
        </section>
      ) : null}

      {isPassive && step.type !== 'outcome' ? (
        <button
          type="button"
          onClick={onContinue}
          disabled={disabled}
          className={`w-full rounded-lg border border-[color:var(--solomon-primary-border)] bg-gradient-to-br from-[var(--solomon-primary-from)] to-[var(--solomon-primary-to)] px-4 py-2.5 text-sm font-medium text-white disabled:opacity-50 ${primaryActionClass}`}
          data-oem-procedure-primary-action
        >
          Continue
        </button>
      ) : null}

      {step.type === 'outcome' && step.oemOutcome ? (
        <div className="rounded-lg border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-200">
          {step.oemOutcome}
        </div>
      ) : null}

      {evaluationPresentation ? (
        <section className="rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/50 px-3 py-2.5">
          <SectionLabel>What result means</SectionLabel>
          <p
            className={`mt-1 text-sm font-semibold ${
              EVALUATION_HEADLINE_CLASS[evaluationPresentation.headline]
              || 'text-[var(--solomon-text-primary)]'
            }`}
          >
            {evaluationPresentation.headline}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-[var(--solomon-text-secondary)]">
            {evaluationPresentation.detail}
          </p>
        </section>
      ) : null}

      {branchPresentation ? (
        <section className="rounded-lg border border-cyan-500/25 bg-cyan-500/10 px-3 py-2.5">
          <p className="text-[10px] uppercase tracking-[0.12em] text-cyan-200/90">
            {branchPresentation.headline}
          </p>
          <p className="mt-1 text-sm leading-relaxed text-cyan-100">
            {branchPresentation.detail}
          </p>
        </section>
      ) : null}

      <ProcedureStepTechnicalDetails
        step={step}
        knowledge={knowledge}
        includeBodyInTechnical={instruction.includeBodyInTechnical}
        meterRangeRef={instruction.meterRangeRef}
        defaultExpanded={technicalDefaultExpanded}
      />

      {(step.images?.length || (!sourceInTechnicalAccordion && step.sourceExcerpt)) ? (
        <section className="space-y-2">
          <SectionLabel>Reference</SectionLabel>
          {step.images?.length ? <ProcedureStepImages images={step.images} /> : null}
          {!sourceInTechnicalAccordion ? (
            <ProcedureStepSourceReference sourceExcerpt={step.sourceExcerpt} />
          ) : null}
        </section>
      ) : null}
    </div>
  );
}

export type { ProcedureStepInput, ProcedureStepPresentationContext };
