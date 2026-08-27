'use client';

import { useState } from 'react';
import { buildReasoningPresentation } from './reasoningPresentation';

function ReasoningSectionCard({ section, variant, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  const isMobile = variant === 'mobile';
  const hasLines = section.lines?.length > 0;

  return (
    <div
      className={`rounded-xl border ${
        isMobile ? 'border-white/10 bg-[#0D1525]' : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-900'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left"
      >
        <span className="text-xs font-semibold uppercase tracking-wide text-cyan-400/90">
          {section.title}
        </span>
        <span className="text-[10px] text-gray-500">{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className="px-3 pb-3 space-y-2">
          {hasLines ? (
            <ul className="space-y-2">
              {section.lines.map((line, index) => (
                <li key={`${section.id}-${index}`} className="text-sm leading-snug">
                  {line.label ? (
                    <span className="font-medium text-white/90">{line.label}: </span>
                  ) : null}
                  <span className={isMobile ? 'text-gray-300' : 'text-gray-700 dark:text-gray-300'}>
                    {line.text}
                  </span>
                  {typeof line.delta === 'number' && (section.id === 'b2' || section.id === 'c2') ? (
                    <span className="ml-1 tabular-nums text-[11px] text-emerald-400/90">
                      ({line.delta >= 0 ? '+' : ''}{line.delta})
                    </span>
                  ) : null}
                  {line.triggerText ? (
                    <p
                      className={`mt-0.5 text-[11px] leading-snug ${
                        isMobile ? 'text-gray-500' : 'text-gray-500 dark:text-gray-400'
                      }`}
                    >
                      {line.triggerText}
                    </p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500">{section.emptyHint || 'Nothing to show yet.'}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

/** Inline reasoning panel — read-only detail views and non-Solomon-mobile contexts. */
export default function SolomonReasoningPanel({
  intelligence,
  stepKeyLabels = {},
  templateId,
  fields = {},
  measurementStatuses,
  wizardDefinition,
  variant = 'mobile',
}) {
  const presentation = buildReasoningPresentation(intelligence, stepKeyLabels, {
    templateId,
    fields,
    measurementStatuses,
    stepKeyLabels,
    wizardDefinition,
    layout: 'inline',
  });
  if (!presentation) return null;

  const sections = [
    presentation.evidenceSummary,
    presentation.whyTop,
    presentation.whyThisTest,
    presentation.unresolved,
    presentation.supporting,
    presentation.contradicting,
    presentation.proveWrong,
  ];

  return (
    <div className="space-y-2">
      <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-400/80 px-0.5">
        Diagnostic reasoning
      </p>
      {sections.map((section) => (
        <ReasoningSectionCard
          key={section.id}
          section={section}
          variant={variant}
          defaultOpen={section.defaultOpen ?? (variant !== 'mobile')}
        />
      ))}
    </div>
  );
}
