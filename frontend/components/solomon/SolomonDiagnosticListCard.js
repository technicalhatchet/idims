'use client';

import Link from 'next/link';
import SolomonApplianceIcon from './SolomonApplianceIcon';
import { formatSolomonDateTime } from '../../utils/solomonFormat';
import {
  SOLOMON_DIAGNOSTIC_STATUS,
  resolveSolomonDiagnosticStatus,
} from './solomonDiagnosticStatus';
import {
  SOLOMON_ICON_SHELL_BY_LIFECYCLE,
  SOLOMON_LIST_CARD_PADDING_CLASS,
  SOLOMON_LIST_ICON_BOX_CLASS,
  SOLOMON_PRO_ICON_SHELL_BY_LIFECYCLE,
  SOLOMON_PRO_LIST_CARD_PADDING_CLASS,
  SOLOMON_PRO_LIST_ICON_BOX_CLASS,
  SolomonListCardFooter,
  SolomonListLifecycleHeadline,
  solomonLifecycleListSurfaceClass,
} from './solomonListPageUi';
import { getEquipmentTypeForTemplate } from './solomonTemplateEquipment';
import { useSolomonDiagnosticLead } from './useSolomonDiagnosticLead';
import { getDiagnosticStepProgress } from './solomonDiagnosticStepProgress';
import SolomonApplianceLabel from './solomonApplianceLabel';
import useSolomonTheme from '../../hooks/useSolomonTheme';

const CYAN_STEP_PROGRESS_ACTIVE = 'bg-cyan-400 shadow-[0_0_3px_rgba(34,211,238,0.45)]';
const PRO_STEP_PROGRESS_ACTIVE = 'bg-[var(--solomon-status-diagnostic)]';

function StepProgressBar({ stepNumber, totalSteps, compact = false }) {
  if (!totalSteps) return null;
  const activeClass = compact ? PRO_STEP_PROGRESS_ACTIVE : CYAN_STEP_PROGRESS_ACTIVE;
  return (
    <div className={compact ? 'mt-1.5' : 'mt-2.5'}>
      <p className={`uppercase tracking-[0.08em] font-medium text-cyan-400/85 mb-0.5 ${compact ? 'text-[9px]' : 'text-[10px]'}`}>
        Step {stepNumber} of {totalSteps}
      </p>
      <div className="flex gap-[2px]">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full ${
              index < stepNumber
                ? activeClass
                : 'bg-white/55 ring-1 ring-inset ring-white/20'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

export default function SolomonDiagnosticListCard({ item }) {
  if (!item?.id) return null;
  const { isProfessional } = useSolomonTheme();
  const templateId = item.template_id || item.payload?.templateId;
  const equipment = [item.equipment_make, item.equipment_model].filter(Boolean).join(' • ');
  const when = formatSolomonDateTime(item.updated_at);
  const status = resolveSolomonDiagnosticStatus(item);
  const equipmentType = getEquipmentTypeForTemplate(templateId);
  const iconShellMap = isProfessional ? SOLOMON_PRO_ICON_SHELL_BY_LIFECYCLE : SOLOMON_ICON_SHELL_BY_LIFECYCLE;
  const iconShell = iconShellMap[status.lifecycleKey]
    || iconShellMap[SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress];
  const stepProgress = getDiagnosticStepProgress(item);
  const showStepProgress = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress && stepProgress;
  const lead = useSolomonDiagnosticLead(item);
  const paddingClass = isProfessional ? SOLOMON_PRO_LIST_CARD_PADDING_CLASS : SOLOMON_LIST_CARD_PADDING_CLASS;
  const iconBoxClass = isProfessional ? SOLOMON_PRO_LIST_ICON_BOX_CLASS : SOLOMON_LIST_ICON_BOX_CLASS;

  return (
    <Link
      href={`/solomon/diagnostics/${item.id}`}
      className={solomonLifecycleListSurfaceClass(status, { isProfessional })}
    >
      <div className={paddingClass}>
        <div className={`flex ${isProfessional ? 'gap-2.5' : 'gap-3'}`}>
          <div className={`${iconBoxClass} ${iconShell}`}>
            <SolomonApplianceIcon
              equipmentType={equipmentType}
              className={isProfessional ? 'w-5 h-5' : 'w-6 h-6'}
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <SolomonApplianceLabel
                templateId={templateId}
                templateLabel={item.template_label}
                truncate
                className={`font-semibold leading-tight text-white min-w-0 flex-1 ${isProfessional ? 'text-[14px]' : 'text-[15px]'}`}
                suffixClassName="font-semibold text-white/55"
              />
              <SolomonListLifecycleHeadline status={status} lead={lead} isProfessional={isProfessional} />
            </div>
            {equipment ? (
              <p className={`truncate ${isProfessional ? 'text-[10px] text-[var(--solomon-text-muted)] mt-0' : 'text-[11px] text-gray-400 mt-0.5'}`}>
                {equipment}
              </p>
            ) : null}
            {item.customer_complaint ? (
              <p className={`text-gray-400/95 line-clamp-2 leading-snug ${isProfessional ? 'text-[11px] mt-1' : 'text-xs mt-1.5'}`}>
                {item.customer_complaint}
              </p>
            ) : null}
            {showStepProgress ? (
              <StepProgressBar
                stepNumber={stepProgress.stepNumber}
                totalSteps={stepProgress.totalSteps}
                compact={isProfessional}
              />
            ) : null}
            <SolomonListCardFooter when={when} status={status} showClock isProfessional={isProfessional} />
          </div>
        </div>
      </div>
    </Link>
  );
}
