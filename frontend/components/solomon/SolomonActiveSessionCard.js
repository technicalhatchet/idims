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

function equipmentMeta(target) {
  const parts = [
    target.equipment_make?.trim(),
    target.equipment_model?.trim(),
    target.equipment_serial?.trim(),
  ].filter(Boolean);
  return parts.join(' • ');
}

function SegmentedProgress({ stepNumber, totalSteps, compact = false }) {
  if (!totalSteps) return null;
  return (
    <div className={`flex gap-1 ${compact ? 'mt-1' : 'mt-2'}`}>
      {Array.from({ length: totalSteps }).map((_, index) => (
        <div
          key={index}
          className={`h-1 flex-1 rounded-full ${
            index < stepNumber ? 'bg-cyan-400' : 'bg-white/10'
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
  const diagnosticSteps = wizardSteps.filter((step) => step.id !== DIAGNOSTIC_REVIEW_STEP_ID);
  const totalSteps = diagnosticSteps.length;
  const currentIndex = target?.payload?.currentStepKey
    ? diagnosticSteps.findIndex(
      (step) => step.meta?.stepKey === target.payload.currentStepKey,
    )
    : visitedStepKeys.length;
  const stepNumber = currentIndex >= 0
    ? currentIndex + 1
    : Math.min(visitedStepKeys.length + 1, totalSteps);
  const applianceTitle = target.template_label || target.template_id || 'Diagnostic';
  const metaLine = equipmentMeta(target);

  if (!target) return null;

  const surfaceClass = variant === 'heroOverlay'
    ? 'border-cyan-400/35 bg-[#060a12]/82 backdrop-blur-lg shadow-[0_8px_28px_rgba(0,0,0,0.55),0_0_0_1px_rgba(34,211,238,0.15),inset_0_1px_0_rgba(255,255,255,0.06)]'
    : 'border-cyan-500/25 bg-[#060a12]/80 backdrop-blur-md shadow-[0_8px_24px_rgba(0,0,0,0.4),inset_0_1px_0_rgba(255,255,255,0.05)]';
  const isCompact = variant === 'heroOverlay';
  const padClass = isCompact ? 'px-2.5 py-1.5' : 'px-3 py-2.5';

  if (isCompact) {
    return (
      <Link
        href={`/solomon/diagnostics/${target.id}?continue=1`}
        className={`flex h-full flex-col overflow-hidden rounded-xl border hover:border-cyan-400/40 transition-colors ${padClass} ${surfaceClass}`}
      >
        <div className="flex min-h-0 flex-1 gap-2">
          <div className="flex min-w-0 flex-1 flex-col">
            <p className="shrink-0 whitespace-nowrap text-[9px] uppercase tracking-[0.14em] text-cyan-400/85 font-medium leading-none">
              Current session
            </p>
            <p className="mt-0 h-[17px] shrink-0 truncate text-sm font-semibold leading-[17px] text-white">
              {applianceTitle}
            </p>
            <p className="mt-0 h-[12px] shrink-0 truncate text-[10px] leading-[12px] text-gray-400">
              {metaLine || '\u00A0'}
            </p>
          </div>
          <div className="flex w-[48%] shrink-0 flex-col items-end justify-start">
            {lead ? (
              <>
                <div className="flex h-[18px] w-full items-center justify-end gap-1">
                  <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
                    <SolomonCategoryIcon
                      categoryId={lead.categoryId}
                      categoryLabel={lead.categoryLabel}
                      size={12}
                    />
                  </span>
                  <span className="min-w-0 truncate text-[11px] font-medium leading-[18px] text-white/90">
                    {lead.categoryLabel}
                  </span>
                </div>
                <p className="h-[12px] shrink-0 truncate text-[10px] font-bold leading-[12px] text-emerald-400 tabular-nums">
                  {lead.percent}% {lead.strengthWord}
                </p>
                <div className="mt-0.5 h-1 w-full max-w-[120px] shrink-0 overflow-hidden rounded-full bg-white/10">
                  <div
                    className="h-full bg-emerald-400"
                    style={{ width: `${Math.min(100, lead.percent)}%` }}
                  />
                </div>
              </>
            ) : (
              <div className="h-[34px] w-full shrink-0" aria-hidden />
            )}
          </div>
        </div>

        <div className="mt-1 shrink-0">
          <p className="h-[12px] shrink-0 text-[9px] leading-[12px] text-gray-400 tabular-nums">
            {totalSteps > 0 ? `Step ${stepNumber} of ${totalSteps}` : '\u00A0'}
          </p>
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
          <p className="text-[9px] uppercase tracking-[0.22em] text-cyan-400/85 font-medium">
            Current session
          </p>
          <p className={`font-semibold text-white leading-tight ${isCompact ? 'text-sm mt-0' : 'text-base mt-0.5'}`}>
            {applianceTitle}
          </p>
          {metaLine ? (
            <p className={`text-gray-400 leading-snug truncate ${isCompact ? 'text-[10px] mt-0' : 'text-[11px] mt-0.5'}`}>
              {metaLine}
            </p>
          ) : null}
        </div>
        {lead ? (
          <div className="text-right shrink-0 max-w-[52%]">
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
            <div className={`h-1 rounded-full bg-white/10 overflow-hidden w-full max-w-[120px] ml-auto ${isCompact ? 'mt-0.5' : 'mt-1'}`}>
              <div
                className="h-full bg-emerald-400"
                style={{ width: `${Math.min(100, lead.percent)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      {totalSteps > 0 ? (
        <p className={`text-gray-400 tabular-nums ${isCompact ? 'mt-1 text-[9px]' : 'mt-2 text-[10px]'}`}>
          Step {stepNumber} of {totalSteps}
        </p>
      ) : null}

      <SegmentedProgress stepNumber={stepNumber} totalSteps={totalSteps} compact={isCompact} />
    </Link>
  );
}
