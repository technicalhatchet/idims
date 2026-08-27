'use client';

import Link from 'next/link';
import { useMemo } from 'react';
import { FaClock, FaChartLine } from 'react-icons/fa';
import { getWizardDefinition, resolveWizardSteps } from '../diagnostics';
import { DIAGNOSTIC_REVIEW_STEP_ID } from '../diagnostics/shared/createWizardDefinitionFromTemplate';
import { evaluateDiagnosticIntelligence } from '../diagnostics/intelligence/diagnosticIntelligenceEngine';
import { formatDiyLeadCard } from '../diagnostics/intelligence/evidenceDisplay';
import { buildFieldLabelsForTemplate } from '../diagnostics/intelligence/fieldLabels';
import { extractDefaultStepOrder } from '../diagnostics/intelligence/reorderWizardSteps';
import { buildStepKeyLabels } from '../diagnostics/intelligence/stepKeyLabels';
import { buildMeasurementStatusMap } from '../diagnostics/knowledge/measurementContext';
import { getDiagnosticTemplate } from '../../constants/diagnosticTemplates';
import { formatSolomonDateTime } from '../../utils/solomonFormat';
import SolomonCategoryIcon from './categoryIcons';

function equipmentMeta(target) {
  const parts = [
    target.equipment_make?.trim(),
    target.equipment_model?.trim(),
    target.equipment_serial?.trim(),
  ].filter(Boolean);
  return parts.join(' • ');
}

function SegmentedProgress({ stepNumber, totalSteps }) {
  if (!totalSteps) return null;
  return (
    <div className="flex gap-1 mt-2">
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

export default function SolomonActiveSessionCard({ target }) {
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
  const when = formatSolomonDateTime(target.updated_at, 'MMM d, h:mm a');
  const applianceTitle = target.template_label || target.template_id || 'Diagnostic';
  const metaLine = equipmentMeta(target);

  if (!target) return null;

  return (
    <Link
      href={`/solomon/diagnostics/${target.id}?continue=1`}
      className="block rounded-xl border border-cyan-500/20 bg-[#0D1525]/92 backdrop-blur-md px-3 py-2.5 shadow-[0_8px_24px_rgba(0,0,0,0.35)] hover:border-cyan-400/35 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-[9px] uppercase tracking-[0.22em] text-cyan-400/85 font-medium">
          Current session
        </p>
        {lead ? (
          <div className="text-right shrink-0 max-w-[52%]">
            <div className="flex items-center justify-end gap-1.5">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-emerald-500/10 text-emerald-400">
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
            <p className="text-[11px] font-bold text-emerald-400 mt-0.5 tabular-nums">
              {lead.percent}% {lead.strengthWord}
            </p>
            <div className="h-1 rounded-full bg-white/10 mt-1 overflow-hidden w-full max-w-[120px] ml-auto">
              <div
                className="h-full bg-emerald-400"
                style={{ width: `${Math.min(100, lead.percent)}%` }}
              />
            </div>
          </div>
        ) : null}
      </div>

      <p className="text-base font-semibold text-white leading-tight mt-1.5">
        {applianceTitle}
      </p>
      {metaLine ? (
        <p className="text-[11px] text-gray-400 mt-0.5 leading-snug truncate">
          {metaLine}
        </p>
      ) : null}

      <div className="flex items-center justify-between gap-2 mt-2 text-[10px] text-gray-500">
        <span className="flex items-center gap-1 min-w-0 truncate">
          <FaClock size={10} className="shrink-0 text-gray-500" />
          {when ? `Updated ${when}` : 'In progress'}
        </span>
        {totalSteps > 0 ? (
          <span className="flex items-center gap-1 shrink-0 tabular-nums text-gray-400">
            <FaChartLine size={10} className="text-cyan-500/70" />
            Step {stepNumber} of {totalSteps}
          </span>
        ) : null}
      </div>

      <SegmentedProgress stepNumber={stepNumber} totalSteps={totalSteps} />
    </Link>
  );
}
