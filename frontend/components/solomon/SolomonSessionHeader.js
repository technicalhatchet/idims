'use client';

import SolomonApplianceIcon from './SolomonApplianceIcon';
import { resolveSolomonDiagnosticStatus } from './solomonDiagnosticStatus';
import { SolomonLifecycleStatusBadge } from './solomonListPageUi';
import { getEquipmentTypeForTemplate } from './solomonTemplateEquipment';

function equipmentLine(target) {
  const parts = [
    target?.equipment_make?.trim(),
    target?.equipment_model?.trim(),
    target?.equipment_serial?.trim() || target?.payload?.equipmentSerial?.trim(),
  ].filter(Boolean);
  return parts.join(' • ');
}

export default function SolomonSessionHeader({
  diagnostic,
  templateLabel,
  templateId,
  className = '',
}) {
  if (!diagnostic && !templateId) return null;

  const resolvedTemplateId = templateId
    || diagnostic?.template_id
    || diagnostic?.payload?.templateId;
  const label = templateLabel
    || diagnostic?.template_label
    || resolvedTemplateId
    || 'Diagnostic';
  const status = resolveSolomonDiagnosticStatus(diagnostic || { payload: { templateId: resolvedTemplateId } });
  const equipmentType = getEquipmentTypeForTemplate(resolvedTemplateId);
  const equipment = equipmentLine(diagnostic);
  const workOrderRef = diagnostic?.imported_work_order_id
    || diagnostic?.payload?.importedWorkOrderId
    || diagnostic?.payload?.workOrderId;
  const orderNumber = diagnostic?.imported_order_number
    || diagnostic?.payload?.importedOrderNumber;

  return (
    <header
      className={`rounded-[var(--solomon-radius-card)] border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface)] px-3 py-2.5 ${className}`}
    >
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[color:var(--solomon-border-subtle)] bg-[var(--solomon-surface-elevated)] text-[var(--solomon-status-diagnostic)]">
          <SolomonApplianceIcon equipmentType={equipmentType} className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h2 className="text-base font-semibold leading-tight text-[var(--solomon-text-primary)] truncate">
              {label}
            </h2>
            <SolomonLifecycleStatusBadge status={status} />
          </div>
          {equipment ? (
            <p className="mt-0.5 text-[11px] text-[var(--solomon-text-secondary)] truncate">{equipment}</p>
          ) : null}
          {workOrderRef ? (
            <p className="mt-1 text-[10px] text-[var(--solomon-text-muted)]">
              WO {orderNumber ? `#${orderNumber}` : workOrderRef}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}
