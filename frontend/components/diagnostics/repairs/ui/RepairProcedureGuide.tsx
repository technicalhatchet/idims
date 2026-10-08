'use client';

import type { RepairProcedure } from '../types';

type Variant = 'desktop' | 'mobile';

function sectionClass(variant: Variant, tone: 'default' | 'warn' = 'default') {
  if (variant === 'mobile') {
    return tone === 'warn'
      ? 'border-amber-500/35 bg-amber-500/10 text-amber-50'
      : 'border-white/10 bg-white/[0.03] text-gray-200';
  }
  return tone === 'warn'
    ? 'border-amber-200 bg-amber-50 text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-50'
    : 'border-gray-200 bg-gray-50 text-gray-800 dark:border-gray-700 dark:bg-gray-900/40 dark:text-gray-100';
}

function eyebrowClass(variant: Variant) {
  return variant === 'mobile'
    ? 'text-[10px] font-semibold uppercase tracking-wide text-gray-400'
    : 'text-[10px] font-semibold uppercase tracking-wide text-gray-500 dark:text-gray-400';
}

export default function RepairProcedureGuide({
  procedure,
  confirmedProblemHeadline,
  variant = 'mobile',
}: {
  procedure: RepairProcedure;
  confirmedProblemHeadline: string;
  variant?: Variant;
}) {
  const isMobile = variant === 'mobile';

  return (
    <div className="space-y-3" data-repair-procedure-id={procedure.id}>
      <div className={`rounded-lg border px-3 py-3 ${sectionClass(variant)}`}>
        <p className={eyebrowClass(variant)}>1. Confirmed problem</p>
        <p className={`mt-1 text-sm font-medium ${isMobile ? 'text-gray-100' : ''}`}>
          {confirmedProblemHeadline}
        </p>
        <p className={`mt-1 text-xs ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
          Physical procedure: {procedure.title}
        </p>
      </div>

      {procedure.safety.length > 0 || procedure.beforeRepairChecks.length > 0 ? (
        <div className={`rounded-lg border px-3 py-3 ${sectionClass(variant, 'warn')}`}>
          <p className={eyebrowClass(variant)}>2. Before you start</p>
          <ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-relaxed">
            {procedure.safety.map((item) => (
              <li key={item.id}>
                {item.safetyWarning ? (
                  <span className="font-medium">{item.safetyWarning} </span>
                ) : null}
                {item.instruction}
              </li>
            ))}
            {procedure.beforeRepairChecks.map((item) => (
              <li key={item.id}>{item.instruction}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {procedure.tools.length > 0 || procedure.parts.length > 0 ? (
        <div className={`rounded-lg border px-3 py-3 ${sectionClass(variant)}`}>
          <p className={eyebrowClass(variant)}>3. Tools / parts</p>
          {procedure.tools.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
              {procedure.tools.map((tool) => (
                <li key={tool.id}>{tool.label}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm opacity-80">No tools listed in the source section.</p>
          )}
          {procedure.parts.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-sm">
              {procedure.parts.map((part) => (
                <li key={part.id}>{part.label}</li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-xs opacity-70">
              Part numbers are not specified in the removal section — use the manufacturer parts lookup if needed.
            </p>
          )}
        </div>
      ) : null}

      <div className={`rounded-lg border px-3 py-3 ${sectionClass(variant)}`}>
        <p className={eyebrowClass(variant)}>4. Repair steps</p>
        <ol className="mt-2 list-decimal space-y-3 pl-4 text-sm leading-relaxed">
          {procedure.steps
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((step) => (
              <li key={step.id}>
                <span>{step.instruction}</span>
                {step.expectedResult ? (
                  <p className={`mt-1 text-xs ${isMobile ? 'text-gray-400' : 'text-gray-500'}`}>
                    {step.expectedResult}
                  </p>
                ) : null}
              </li>
            ))}
        </ol>
      </div>

      {procedure.finalChecks.length > 0 ? (
        <div className={`rounded-lg border px-3 py-3 ${sectionClass(variant)}`}>
          <p className={eyebrowClass(variant)}>5. Final check</p>
          <ul className="mt-2 list-disc space-y-2 pl-4 text-sm leading-relaxed">
            {procedure.finalChecks.map((item) => (
              <li key={item.id}>{item.instruction}</li>
            ))}
          </ul>
        </div>
      ) : null}

      <div
        className={`rounded-lg border px-3 py-2.5 text-xs leading-relaxed ${
          isMobile
            ? 'border-white/10 bg-white/[0.02] text-gray-400'
            : 'border-gray-200 bg-white text-gray-600 dark:border-gray-700 dark:bg-gray-950 dark:text-gray-400'
        }`}
        data-repair-outcome-boundary
      >
        <p className="font-semibold uppercase tracking-wide opacity-90">6. Repair outcome</p>
        <p className="mt-1">
          Record whether the repair resolved the complaint in work order notes (Repair Outcome). Solomon does not
          change the diagnostic conclusion based on repair completion.
        </p>
        <p className="mt-1 opacity-80">
          Source: {procedure.source.manualId} — {procedure.source.sectionTitle} (extracted pages{' '}
          {procedure.source.pages.join(', ')}).
        </p>
      </div>
    </div>
  );
}
