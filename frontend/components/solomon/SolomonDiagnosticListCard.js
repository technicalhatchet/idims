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
  SolomonListCardFooter,
  SolomonListLifecycleHeadline,
  solomonLifecycleListSurfaceClass,
} from './solomonListPageUi';
import { getEquipmentTypeForTemplate } from './solomonTemplateEquipment';
import { useSolomonDiagnosticLead } from './useSolomonDiagnosticLead';
import { getDiagnosticStepProgress } from './solomonDiagnosticStepProgress';
import SolomonApplianceLabel from './solomonApplianceLabel';

const CYAN_STEP_PROGRESS_ACTIVE = 'bg-cyan-400 shadow-[0_0_3px_rgba(34,211,238,0.45)]';

function StepProgressBar({ stepNumber, totalSteps }) {
  if (!totalSteps) return null;
  return (
    <div className="mt-2.5">
      <p className="text-[10px] uppercase tracking-[0.08em] font-medium text-cyan-400/85 mb-1">
        Step {stepNumber} of {totalSteps}
      </p>
      <div className="flex gap-[2px]">
        {Array.from({ length: totalSteps }).map((_, index) => (
          <div
            key={index}
            className={`h-1 flex-1 rounded-full ${
              index < stepNumber
                ? CYAN_STEP_PROGRESS_ACTIVE
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
  const templateId = item.template_id || item.payload?.templateId;
  const equipment = [item.equipment_make, item.equipment_model].filter(Boolean).join(' • ');
  const when = formatSolomonDateTime(item.updated_at);
  const status = resolveSolomonDiagnosticStatus(item);
  const equipmentType = getEquipmentTypeForTemplate(templateId);
  const iconShell = SOLOMON_ICON_SHELL_BY_LIFECYCLE[status.lifecycleKey]
    || SOLOMON_ICON_SHELL_BY_LIFECYCLE[SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress];
  const stepProgress = getDiagnosticStepProgress(item);
  const showStepProgress = status.lifecycleKey === SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress && stepProgress;
  const lead = useSolomonDiagnosticLead(item);

  return (
    <Link
      href={`/solomon/diagnostics/${item.id}`}
      className={solomonLifecycleListSurfaceClass(status)}
    >
      <div className={SOLOMON_LIST_CARD_PADDING_CLASS}>
        <div className="flex gap-3">
          <div className={`${SOLOMON_LIST_ICON_BOX_CLASS} ${iconShell}`}>
            <SolomonApplianceIcon
              equipmentType={equipmentType}
              className="w-6 h-6"
            />
          </div>
          <div className="min-w-0 flex-1">
            <div className="flex items-start justify-between gap-2">
              <SolomonApplianceLabel
                templateId={templateId}
                templateLabel={item.template_label}
                truncate
                className="font-semibold text-[15px] leading-tight text-white min-w-0 flex-1"
                suffixClassName="font-semibold text-white/55"
              />
              <SolomonListLifecycleHeadline status={status} lead={lead} />
            </div>
            {equipment ? (
              <p className="text-[11px] text-gray-400 mt-0.5 truncate">{equipment}</p>
            ) : null}
            {item.customer_complaint ? (
              <p className="text-xs text-gray-400/95 mt-1.5 line-clamp-2 leading-snug">{item.customer_complaint}</p>
            ) : null}
            {showStepProgress ? (
              <StepProgressBar
                stepNumber={stepProgress.stepNumber}
                totalSteps={stepProgress.totalSteps}
              />
            ) : null}
            <SolomonListCardFooter when={when} status={status} showClock />
          </div>
        </div>
      </div>
    </Link>
  );
}
