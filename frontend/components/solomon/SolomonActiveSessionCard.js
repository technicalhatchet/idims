'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { getWizardDefinition, resolveWizardSteps } from '../diagnostics';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../diagnostics/shared/createWizardDefinitionFromTemplate';
import { evaluateDiagnosticIntelligence } from '../diagnostics/intelligence/diagnosticIntelligenceEngine';
import { formatDiyLeadCard } from '../diagnostics/intelligence/evidenceDisplay';
import { buildFieldLabelsForTemplate } from '../diagnostics/intelligence/fieldLabels';
import { extractDefaultStepOrder } from '../diagnostics/intelligence/reorderWizardSteps';
import { buildStepKeyLabels } from '../diagnostics/intelligence/stepKeyLabels';
import { buildMeasurementStatusMap } from '../diagnostics/knowledge/measurementContext';
import { getDiagnosticTemplate } from '../../constants/diagnosticTemplates';
import SolomonCategoryIcon from './categoryIcons';

function equipmentMakeModel(target) {
  const parts = [
    target.equipment_make?.trim(),
    target.equipment_model?.trim(),
  ].filter(Boolean);
  return parts.join(' • ');
}

function SegmentedProgress({ stepNumber, totalSteps, compact = false }) {
  if (!totalSteps) return null;
  const inactiveClass = compact
    ? 'bg-white/55 ring-1 ring-inset ring-white/20'
    : 'bg-white/40';
  return (
    <div className={`flex gap-[0.2em] ${compact ? '' : 'mt-2'}`}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={`flex-1 rounded-full ${compact ? 'h-[0.5em]' : 'h-1'} ${
            index < stepNumber
              ? 'bg-cyan-400 shadow-[0_0_3px_rgba(34,211,238,0.45)]'
              : inactiveClass
          }`}
        />
      ))}
    </div>
  );
}

export default function SolomonActiveSessionCard({ target, variant = 'default' }) {
  const templateId = target?.payload?.templateId;
  const wizardDefinition = getWizardDefinition(templateId);
  const template = getDiagnosticTemplate(templateId);

  const wizardSteps = useMemo(
    () => resolveWizardSteps(wizardDefinition, template),
    [wizardDefinition, template],
  );

  const stepKeyLabels = useMemo(
    () => buildStepKeyLabels(wizardDefinition),
    [wizardDefinition],
  );

  const fieldLabels = useMemo(
    () => buildFieldLabelsForTemplate(templateId),
    [templateId],
  );

  const visitedStepKeys = target?.payload?.visitedStepKeys || [];
  const defaultStepOrder = useMemo(
    () => extractDefaultStepOrder(wizardSteps),
    [wizardSteps],
  );

  const measurementStatuses = useMemo(
    () => buildMeasurementStatusMap(templateId, target?.payload?.fields || {}),
    [templateId, target?.payload?.fields],
  );

  const intelligence = useMemo(
    () =>
      templateId
        ? evaluateDiagnosticIntelligence(
          templateId,
          target?.payload?.fields || {},
          measurementStatuses,
          {
            visitedStepKeys,
            defaultStepOrder,
            complaintChips: wizardDefinition?.complaintChips || [],
            dmaNudges: null,
            fieldLabels,
            stepKeyLabels,
          },
        )
        : null,
    [
      templateId,
      target?.payload?.fields,
      measurementStatuses,
      visitedStepKeys,
      defaultStepOrder,
      wizardDefinition?.complaintChips,
      fieldLabels,
      stepKeyLabels,
    ],
  );

  const lead = formatDiyLeadCard(intelligence);
  const reviewStepKey = wizardDefinition?.routing?.reviewStepKey || 'review';
  const diagnosticSteps = wizardSteps.filter(
    (step) => step.id !== DIAGNOSTIC_REVIEW_STEP_ID && step.meta?.stepKey !== reviewStepKey,
  );
  const totalSteps = diagnosticSteps.length;
  const currentIndex = target?.payload?.currentStepKey
    ? diagnosticSteps.findIndex(
      (step) => step.meta?.stepKey === target.payload.currentStepKey,
    )
    : visitedStepKeys.filter((key) => diagnosticSteps.some(
      (step) => step.meta?.stepKey === key,
    )).length;
  const stepNumber = currentIndex >= 0
    ? currentIndex + 1
    : Math.min(
      visitedStepKeys.filter((key) => diagnosticSteps.some(
        (step) => step.meta?.stepKey === key,
      )).length + 1,
      totalSteps,
    );
  const applianceTitle = target.template_label || target.template_id || 'Diagnostic';
  const makeModelLine = equipmentMakeModel(target);

  if (!target) return null;

  const surfaceClass = variant === 'heroOverlay'
    ? 'border-cyan-400/35 bg-[#060a12]/82 backdrop-blur-lg shadow-[0_8px_28px_rgba(0,0,0,0.55),0_0_0_1px_rgba(34,211,238,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]'
    : 'border-cyan-500/25 bg-[#060a12]/80 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]';
  const isCompact = variant === 'heroOverlay';
  const padClass = isCompact ? 'px-[0.55em] py-[0.35em]' : 'px-3 py-2.5';

  if (isCompact) {
    return (
      <Link
        href={`/solomon/diagnostics/${target.id}?continue=1`}
        aria-label={totalSteps > 0 ? `Last session, step ${stepNumber} of ${totalSteps}` : 'Last session'}
        className={`flex h-full min-h-0 flex-col justify-between overflow-hidden rounded-xl border hover:border-cyan-400/40 transition-colors ${padClass} ${surfaceClass}`}
      >
        <div className="shrink-0">
          <p className="shrink-0 overflow-hidden whitespace-nowrap text-[0.79em] uppercase tracking-[0.06em] text-cyan-400/90 font-medium leading-[1.1em]">
            Last Session
          </p>

          <div className="mt-[0.12em] flex items-start gap-[0.35em]">
            <p className="min-w-0 flex-[0.85] shrink-0 truncate text-[1.23em] font-semibold leading-[1.2em] text-white">
              {applianceTitle}
            </p>
            {lead ? (
              <div className="flex min-w-0 flex-1 flex-col items-end">
                <div className="flex max-w-full items-start justify-end gap-[0.2em]">
                  <span className="mt-[0.05em] flex h-[1.15em] w-[1.15em] shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                    <SolomonCategoryIcon
                      categoryId={lead.categoryId}
                      categoryLabel={lead.categoryLabel}
                      size={12}
                    />
                  </span>
                  <span className="min-w-0 truncate text-right text-[0.96em] font-medium leading-[1.2em] text-white/90">
                    {lead.categoryLabel}
                  </span>
                </div>
                <p className="mt-[0.08em] w-full truncate text-right text-[0.88em] font-bold leading-[1.05em] text-emerald-400 tabular-nums">
                  {lead.percent}% {lead.strengthWord}
                </p>
                <div className="mt-[0.1em] flex w-full justify-end gap-[0.2em]">
                  <span className="w-[1.15em] shrink-0" aria-hidden />
                  <div className="h-[0.45em] min-w-0 flex-1 overflow-hidden rounded-full bg-white/55 ring-1 ring-inset ring-white/15">
                    <div
                      className="h-full bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.5)]"
                      style={{ width: `${Math.min(100, lead.percent)}%` }}
                    />
                  </div>
                </div>
              </div>
            ) : null}
          </div>

          {!lead ? <div className="h-[1.6em]" aria-hidden /> : null}
        </div>

        <div className="shrink-0 pb-px">
          {makeModelLine ? (
            <p className="mb-1 min-w-0 [overflow-x:clip] [text-overflow:ellipsis] whitespace-nowrap text-left text-[0.82em] leading-[1.2em] text-gray-400">
              {makeModelLine}
            </p>
          ) : null}
          <SegmentedProgress stepNumber={stepNumber} totalSteps={totalSteps} compact />
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/solomon/diagnostics/${target.id}?continue=1`}
      className={`block rounded-xl border hover:border-cyan-400/40 transition-colors ${padClass} ${surfaceClass}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[9px] uppercase tracking-[0.08em] text-cyan-400/90 font-medium">
            Last Session
          </p>
          <p className={`font-semibold text-white leading-tight ${isCompact ? 'text-sm mt-0' : 'text-base mt-0.5'}`}>
            {applianceTitle}
          </p>
        </div>
        {lead ? (
          <div className="text-right shrink-0 min-w-0 max-w-[58%]">
            <div className="flex items-center justify-end gap-1">
              <span className={`flex items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400 ${isCompact ? 'h-5 w-5' : 'h-6 w-6'}`}>
                <SolomonCategoryIcon
                  categoryId={lead.categoryId}
                  categoryLabel={lead.categoryLabel}
                  size={12}
                />
              </span>
              <span className="text-[11px] font-medium text-white/90 leading-tight truncate">
                {lead.categoryLabel}
              </span>
            </div>
            <p className={`font-bold text-emerald-400 tabular-nums ${isCompact ? 'text-[10px] mt-0' : 'text-[11px] mt-0.5'}`}>
              {lead.percent}% {lead.strengthWord}
            </p>
            <div className={`h-1 rounded-full bg-white/55 ring-1 ring-inset ring-white/15 overflow-hidden w-full max-w-[120px] ml-auto ${isCompact ? 'mt-0.5' : 'mt-1'}`}>
              <div
                className="h-full bg-emerald-400 shadow-[0_0_3px_rgba(52,211,153,0.5)]"
                style={{ width: `${Math.min(100, lead.percent)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {totalSteps > 0 ? (
        <div className={isCompact ? 'mt-1' : 'mt-2'}>
          {makeModelLine ? (
            <p className={`mb-1 truncate text-left text-gray-400 ${isCompact ? 'text-[10px]' : 'text-[11px]'}`}>
              {makeModelLine}
            </p>
          ) : null}
          <SegmentedProgress stepNumber={stepNumber} totalSteps={totalSteps} compact={isCompact} />
        </div>
      ) : makeModelLine ? (
        <p className={`mt-2 truncate text-left text-gray-400 ${isCompact ? 'text-[10px]' : 'text-[11px]'}`}>
          {makeModelLine}
        </p>
      ) : null}
    </Link>
  );
}
