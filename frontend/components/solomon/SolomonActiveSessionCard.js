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
import { formatSolomonDateTime } from '../../utils/solomonFormat';
import SolomonCategoryIcon from './categoryIcons';

function formatEquipmentLine(target) {
  const label = target.template_label || target.template_id || 'Diagnostic';
  const make = target.equipment_make?.trim();
  const model = target.equipment_model?.trim();
  const serial = target.equipment_serial?.trim();

  const detail = [make, model, serial].filter(Boolean).join(' • ');
  return detail ? `${label} — ${detail}` : label;
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
  const stepNumber = currentIndex >= 0 ? currentIndex + 1 : Math.min(visitedStepKeys.length + 1, totalSteps);
  const progressPct = totalSteps > 0 ? Math.round((stepNumber / totalSteps) * 100) : 0;
  const when = formatSolomonDateTime(target.updated_at, 'MMM d, h:mm a');

  if (!target) return null;

  return (
    <Link
      href={`/solomon/diagnostics/${target.id}?continue=1`}
      className="block rounded-xl border border-white/10 bg-[#0D1525]/95 backdrop-blur-sm px-3 py-3 hover:border-cyan-500/30 transition-colors"
    >
      {lead ? (
        <div className="flex items-start justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-400">
              <SolomonCategoryIcon
                categoryId={lead.categoryId}
                categoryLabel={lead.categoryLabel}
                size={16}
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-white leading-tight truncate">
                {lead.categoryLabel}
              </p>
              <p className="text-xs font-semibold text-emerald-400 mt-0.5">
                {lead.percent}% {lead.strengthWord}
              </p>
            </div>
          </div>
        </div>
      ) : (
        <p className="text-[10px] uppercase tracking-[0.2em] text-cyan-300/90">Current session</p>
      )}

      <p className="text-xs text-gray-400 mt-2 leading-snug line-clamp-2">
        {formatEquipmentLine(target)}
      </p>

      <div className="flex items-center justify-between gap-3 mt-3 text-[11px] text-gray-500">
        <span>{when ? `Updated ${when}` : 'In progress'}</span>
        {totalSteps > 0 ? (
          <span className="tabular-nums text-gray-400">
            Step {stepNumber} of {totalSteps}
          </span>
        ) : null}
      </div>

      {totalSteps > 0 ? (
        <div className="h-1 rounded-full bg-white/10 mt-2 overflow-hidden">
          <div
            className="h-full bg-emerald-400/80 transition-all"
            style={{ width: `${progressPct}%` }}
          />
        </div>
      ) : null}
    </Link>
  );
}
