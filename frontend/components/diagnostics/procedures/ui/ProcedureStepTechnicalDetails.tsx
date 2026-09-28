'use client';

import { useState } from 'react';
import type { MeasurementKnowledgeDefinition } from '../../knowledge/types';
import type { ProcedureStep } from '../types';
import ProcedureTestPointPanel from './ProcedureTestPointPanel';

interface ProcedureStepTechnicalDetailsProps {
  step: ProcedureStep;
  knowledge?: MeasurementKnowledgeDefinition | null;
  includeBodyInTechnical?: boolean;
  meterRangeRef?: string;
  defaultExpanded?: boolean;
}

export default function ProcedureStepTechnicalDetails({
  step,
  knowledge,
  includeBodyInTechnical = false,
  meterRangeRef,
  defaultExpanded = false,
}: ProcedureStepTechnicalDetailsProps) {
  const [open, setOpen] = useState(defaultExpanded);

  const hasBody = includeBodyInTechnical && Boolean(step.body?.trim());
  const hasSource = Boolean(step.sourceExcerpt?.trim());
  const hasTestPoint = Boolean(step.testPoint);
  const hasTips = Boolean(knowledge?.testingTips?.length);
  const hasMeterMeta = Boolean(meterRangeRef);

  if (!hasBody && !hasSource && !hasTestPoint && !hasTips && !hasMeterMeta) {
    return null;
  }

  return (
    <section
      className="rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]/40"
      data-procedure-technical-details
      data-procedure-technical-expanded={open ? 'true' : 'false'}
    >
      <button
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2.5 text-left"
        aria-expanded={open}
      >
        <span className="text-sm font-medium text-[var(--solomon-text-primary)]">
          Technical details
        </span>
        <span className="text-[10px] text-[var(--solomon-text-muted)]">
          {open ? 'Hide' : 'Show'}
        </span>
      </button>

      {open ? (
        <div className="space-y-3 border-t border-[color:var(--solomon-border-subtle)] px-3 py-3 text-xs leading-relaxed text-[var(--solomon-text-secondary)]">
          {hasBody ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--solomon-status-reference)]/90">
                OEM instructions
              </p>
              <p className="mt-1 whitespace-pre-wrap text-[var(--solomon-text-secondary)]">
                {step.body}
              </p>
            </div>
          ) : null}

          {meterRangeRef ? (
            <p>
              <span className="font-medium text-[var(--solomon-text-primary)]">Meter range: </span>
              {meterRangeRef} — manual meter range used by the source procedure
            </p>
          ) : null}

          {hasTestPoint && step.testPoint ? (
            <ProcedureTestPointPanel testPoint={step.testPoint} />
          ) : null}

          {hasTips && knowledge?.testingTips ? (
            <div>
              <p className="text-[10px] uppercase tracking-[0.12em] text-[color:var(--solomon-status-reference)]/90">
                Testing tips
              </p>
              <ul className="mt-1.5 list-disc space-y-1 pl-4">
                {knowledge.testingTips.map((tip) => (
                  <li key={tip}>{tip}</li>
                ))}
              </ul>
            </div>
          ) : null}

          {hasSource ? (
            <blockquote className="rounded-md border border-[color:var(--solomon-border-subtle)] border-l-2 border-l-[color:var(--solomon-status-reference)]/50 bg-[var(--solomon-surface-glass)] px-3 py-2 italic">
              {step.sourceExcerpt}
            </blockquote>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
