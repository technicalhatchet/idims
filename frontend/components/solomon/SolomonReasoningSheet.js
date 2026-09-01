'use client';

import { useEffect, useRef, useState } from 'react';
import { buildReasoningPresentation } from './reasoning/reasoningPresentation';
import SolomonCategoryIcon from './categoryIcons';
import SolomonDiagnosticPath from './SolomonDiagnosticPath';
import EliminationBanner from '../diagnostics/EliminationBanner';
import { SOLOMON_INTERFACE } from './solomonThemeTokens';
import useFocusTrap from '../../hooks/useFocusTrap';

function ReasoningAccordion({ section, variant, defaultOpen = false, interfaceStyle = SOLOMON_INTERFACE.SIGNATURE }) {
  const [open, setOpen] = useState(defaultOpen);
  const isMobile = variant === 'mobile';
  const isProfessional = interfaceStyle === SOLOMON_INTERFACE.PROFESSIONAL;
  const hasLines = section.lines?.length > 0;
  const countLabel = section.count != null ? ` (${section.count})` : '';

  return (
    <div
      className={`rounded-lg border ${
        isProfessional
          ? 'border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]'
          : isMobile
            ? 'border-white/10 bg-[#0a101c]'
            : 'border-gray-200 dark:border-gray-700'
      }`}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="solomon-focus-ring w-full flex items-center justify-between gap-2 px-3 py-2.5 text-left rounded-lg"
      >
        <span className={`text-xs font-medium ${isProfessional ? 'text-[var(--solomon-text-secondary)]' : 'text-gray-300'}`}>
          {section.title}{countLabel}
        </span>
        <span className="text-[10px] text-gray-500">{open ? '▾' : '▸'}</span>
      </button>
      {open ? (
        <div className="px-3 pb-3 border-t border-white/5">
          {hasLines ? (
            <ul className="space-y-2 mt-2">
              {section.lines.map((line, index) => (
                <li key={`${section.id}-${index}`} className="text-sm leading-snug">
                  {line.label ? (
                    <span className="font-medium text-white/90">{line.label}: </span>
                  ) : null}
                  <span className="text-gray-300">{line.text}</span>
                  {typeof line.delta === 'number' ? (
                    <span className="ml-1 tabular-nums text-[11px] text-emerald-400/90">
                      ({line.delta >= 0 ? '+' : ''}{line.delta})
                    </span>
                  ) : null}
                  {line.whyText ? (
                    <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">
                      Why: {line.whyText}
                    </p>
                  ) : null}
                  {line.triggerText ? (
                    <p className="mt-0.5 text-[11px] text-gray-500 leading-snug">{line.triggerText}</p>
                  ) : null}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-gray-500 mt-2">{section.emptyHint}</p>
          )}
        </div>
      ) : null}
    </div>
  );
}

function ConfidenceBar({ percent, variant }) {
  const isMobile = variant === 'mobile';
  const width = Math.max(0, Math.min(100, percent));
  return (
    <div className={`h-1.5 rounded-full overflow-hidden mt-2 ${isMobile ? 'bg-white/10' : 'bg-gray-200'}`}>
      <div
        className="h-full bg-emerald-400 transition-all"
        style={{ width: `${width}%` }}
      />
    </div>
  );
}

export default function SolomonReasoningSheet({
  open,
  onClose,
  intelligence,
  stepKeyLabels = {},
  templateId,
  fields = {},
  measurementStatuses,
  wizardDefinition,
  wizardSteps,
  visitedStepKeys = [],
  currentStepKey,
  reviewStepId = 'diagnostic_review',
  variant = 'mobile',
  interfaceStyle = SOLOMON_INTERFACE.SIGNATURE,
  eliminationResult = null,
}) {
  const panelRef = useRef(null);
  const closeButtonRef = useRef(null);

  const presentation = buildReasoningPresentation(intelligence, stepKeyLabels, {
    templateId,
    fields,
    measurementStatuses,
    stepKeyLabels,
    wizardDefinition,
    layout: 'sheet',
    wizardSteps,
    visitedStepKeys,
    currentStepKey,
    reviewStepId,
  });

  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [open, onClose]);

  useFocusTrap(open, panelRef, { initialFocusRef: closeButtonRef });

  if (!open || !presentation) return null;

  const lead = presentation.leadCard;
  const strength = presentation.leadStrength;
  const isMobile = variant === 'mobile';
  const isProfessional = interfaceStyle === SOLOMON_INTERFACE.PROFESSIONAL;

  const accordionSections = [
    presentation.supporting,
    presentation.contradicting,
    presentation.unresolved,
    presentation.whyThisTest,
    presentation.proveWrong,
  ];

  const preview = presentation.nextTestPreview;

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <button
        type="button"
        className="absolute inset-0 bg-black/60 backdrop-blur-sm solomon-focus-ring"
        onClick={onClose}
        aria-label="Close diagnostic reasoning"
        tabIndex={-1}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="solomon-reasoning-title"
        className={`solomon-reasoning-sheet-panel relative mx-auto w-full max-w-lg max-h-[92vh] flex flex-col rounded-t-2xl border-t shadow-2xl ${
          isProfessional
            ? 'border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-bg-shell)]'
            : isMobile
              ? 'border-white/10 bg-[#0A0F1E]'
              : 'border-gray-200 bg-white dark:bg-gray-900'
        }`}
        style={{ marginTop: 'auto', marginBottom: 0 }}
      >
        <div className={`flex items-center justify-between gap-3 px-4 py-3 border-b shrink-0 ${
          isProfessional ? 'border-[color:var(--solomon-border-muted)]' : 'border-white/10'
        }`}
        >
          <p
            id="solomon-reasoning-title"
            className={`text-[10px] uppercase tracking-[0.2em] font-medium ${
            isProfessional ? 'text-[var(--solomon-text-muted)]' : 'text-cyan-400/90'
          }`}
          >
            Diagnostic reasoning
          </p>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="solomon-focus-ring text-gray-400 hover:text-white text-sm px-2 py-1 rounded-md"
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className={`flex-1 overflow-y-auto px-4 py-4 space-y-3 pb-[max(1rem,env(safe-area-inset-bottom))] ${isProfessional ? 'space-y-3' : 'space-y-4'}`}>
          {lead ? (
            <div className={`rounded-xl border px-3 py-3 ${
              isProfessional
                ? 'border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]'
                : 'border-emerald-500/20 bg-emerald-500/[0.06]'
            }`}
            >
              <p className={`text-[10px] uppercase tracking-wide ${isProfessional ? 'text-[var(--solomon-text-muted)]' : 'text-gray-500'}`}>
                Current leading hypothesis
              </p>
              <div className="flex items-start gap-3 mt-2">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
                  <SolomonCategoryIcon
                    categoryId={lead.categoryId}
                    categoryLabel={lead.categoryLabel}
                    size={22}
                  />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-lg font-semibold text-white">{lead.categoryLabel}</p>
                  <div className="flex items-baseline gap-2 mt-1">
                    <span className="text-3xl font-bold tabular-nums text-emerald-400">{lead.percent}%</span>
                    <span className="text-xs font-semibold uppercase tracking-wide text-emerald-300/90">
                      {lead.strengthWord}
                    </span>
                  </div>
                </div>
              </div>
              <ConfidenceBar percent={lead.percent} variant={variant} />
              {strength ? (
                <p className="text-[11px] text-gray-500 mt-2 tabular-nums">
                  Evidence score {strength.evidenceScore}
                  {strength.marginOverNext > 0
                    ? ` · ${strength.marginOverNext} points ahead of next cause`
                    : ''}
                  {' · '}{strength.tierLabel}
                </p>
              ) : null}
            </div>
          ) : null}

          <div>
            <p className={`text-[10px] uppercase tracking-wide mb-2 ${
              isProfessional ? 'text-[var(--solomon-text-muted)]' : 'text-cyan-400/80'
            }`}
            >
              Why we believe this
            </p>
            <p className={`text-sm leading-relaxed ${isProfessional ? 'text-[var(--solomon-text-secondary)]' : 'text-gray-300'}`}>
              {presentation.whyTop.lines[0]?.text || presentation.whyTop.emptyHint}
            </p>
          </div>

          {isProfessional && eliminationResult ? (
            <div className="rounded-lg border border-violet-500/20 bg-[var(--solomon-surface)] px-1 py-1">
              <EliminationBanner result={eliminationResult} variant={variant} />
            </div>
          ) : null}

          <div className="space-y-2">
            {accordionSections.map((section) => (
              <ReasoningAccordion
                key={section.id}
                section={section}
                variant={variant}
                interfaceStyle={interfaceStyle}
              />
            ))}
          </div>

          {preview ? (
            <div className={`rounded-xl border px-3 py-3 ${
              isProfessional
                ? 'border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)]'
                : 'border-cyan-500/20 bg-cyan-500/[0.05]'
            }`}
            >
              <p className={`text-[10px] uppercase tracking-wide ${
                isProfessional ? 'text-[var(--solomon-text-muted)]' : 'text-cyan-400/80'
              }`}
              >
                Next test preview
              </p>
              <p className="text-sm font-semibold text-white mt-1">
                {preview.stepNumber ? `${preview.stepNumber}. ` : ''}{preview.title}
              </p>
              {preview.description ? (
                <p className="text-xs text-gray-400 mt-1 leading-snug">{preview.description}</p>
              ) : null}
              {typeof preview.estimatedMinutes === 'number' ? (
                <p className="text-[11px] text-gray-500 mt-2">
                  Estimated time: {preview.estimatedMinutes} min
                </p>
              ) : null}
            </div>
          ) : null}

          {presentation.diagnosticPath?.length ? (
            <SolomonDiagnosticPath steps={presentation.diagnosticPath} variant={variant} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
