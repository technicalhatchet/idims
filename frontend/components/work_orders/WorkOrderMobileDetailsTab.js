import WoMobileGlassSection, {
  WO_MOBILE_FIELD_LABEL,
  WO_MOBILE_FIELD_VALUE,
  WO_MOBILE_SECTION_LABEL,
} from './WoMobileGlassSection';
import WoMobileDetailsSummaryCard, {
  WoMobileDetailsSummaryCardGroup,
  WoMobileDetailsSummaryRow,
} from './WoMobileDetailsSummaryCard';
import WorkOrderContactCallButton from './WorkOrderContactCallButton';
import WorkOrderDetailsAppointmentsList from './WorkOrderDetailsAppointmentsList';
import WorkOrderPerformancePanel from './WorkOrderPerformancePanel';
import WorkOrderDebriefing from './WorkOrderDebriefing';
import MapsNavigateButton from '../ui/MapsNavigateButton';
import ApplianceIcon from '../ui/ApplianceIcon';
import {
  WO_DETAILS_SURFACE_CLASS,
  WO_DETAILS_SURFACE_STYLE,
  WO_DETAILS_LABEL_CLASS,
  WO_DETAILS_SECONDARY_CLASS,
} from './woMobileDetailsTokens';

const ICON_STROKE = {
  stroke: 'rgba(34, 211, 238, 0.75)',
  strokeWidth: 1.5,
  fill: 'none',
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

function formatEquipmentTypeLabel(type) {
  if (!type) return null;
  const s = String(type).replace(/_/g, ' ');
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function resolveClientDisplayName(workOrder) {
  return (
    workOrder?.client?.company_name ||
    workOrder?.client_name ||
    `${workOrder?.client?.first_name || ''} ${workOrder?.client?.last_name || ''}`.trim() ||
    'No client assigned'
  );
}

function ClientUserIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" style={ICON_STROKE} aria-hidden>
      <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function LocationPinIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" style={ICON_STROKE} aria-hidden>
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

function ProblemIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-6 h-6" style={ICON_STROKE} aria-hidden>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export default function WorkOrderMobileDetailsTab({
  workOrder,
  resolvedServiceAddress,
  allServices,
  glassSectionsOpen,
  toggleGlassSection,
  detailsTenantSummary,
  detailsServicesSummary,
  appointmentsSummary,
  onOpenEquipmentTab,
}) {
  const clientName = resolveClientDisplayName(workOrder);
  const tenantName = workOrder?.property?.tenant_name?.trim() || '';
  const clientPhone = workOrder?.client?.phone || workOrder?.client?.mobile || '';
  const tenantPhone = workOrder?.property?.tenant_phone || '';

  const equipmentDisplayName =
    formatEquipmentTypeLabel(workOrder?.equipment_type || workOrder?.equipment_subtype) ||
    workOrder?.equipment_make?.trim() ||
    'Unknown appliance';
  const modelLine = [workOrder?.equipment_make, workOrder?.equipment_model].filter(Boolean).join(' ');
  const serialLine = workOrder?.equipment_serial
    ? `Serial ${workOrder.equipment_serial}`
    : '';

  const hasPropertyAccess =
    workOrder?.property &&
    (workOrder.property.tenant_name ||
      workOrder.property.tenant_phone ||
      workOrder.property.unit_number ||
      workOrder.property.gate_code ||
      workOrder.property.access_instructions);

  return (
    <div className="space-y-2 min-w-0">
      <WoMobileDetailsSummaryCardGroup>
        <WoMobileDetailsSummaryRow
          label="Client"
          title={clientName}
          subtitle={tenantName || undefined}
          icon={<ClientUserIcon />}
          compactPadding
          trailing={
            <WorkOrderContactCallButton
              clientPhone={clientPhone}
              clientName={clientName}
              tenantPhone={tenantPhone}
              tenantName={tenantName}
            />
          }
        />
        <WoMobileDetailsSummaryRow
          label="Service location"
          title={resolvedServiceAddress || 'No address on file'}
          icon={<LocationPinIcon />}
          dividerTop
          compactPadding
          trailing={<MapsNavigateButton address={resolvedServiceAddress} variant="minimal" />}
        />
      </WoMobileDetailsSummaryCardGroup>

      <WoMobileDetailsSummaryCard
        label="Appliance"
        title={equipmentDisplayName}
        subtitle={modelLine ? `Model ${modelLine}` : undefined}
        meta={serialLine || undefined}
        icon={
          <ApplianceIcon
            equipmentType={workOrder?.equipment_type}
            equipmentSubtype={workOrder?.equipment_subtype}
            className="w-6 h-6"
          />
        }
        onPress={onOpenEquipmentTab}
        showChevron
      />

      <WoMobileDetailsSummaryCard
        label="Reported problem"
        title={workOrder?.description?.trim() || 'No description provided'}
        titleClassName={`${WO_DETAILS_SECONDARY_CLASS} text-white/[0.65] whitespace-pre-line leading-relaxed`}
        icon={<ProblemIcon />}
      />

      {workOrder?.priority && workOrder.priority !== 'medium' && (
        <div className={WO_DETAILS_SURFACE_CLASS} style={WO_DETAILS_SURFACE_STYLE}>
          <div className="px-5 py-5">
            <p className={WO_DETAILS_LABEL_CLASS}>Priority</p>
            <p className={`mt-2 capitalize text-lg font-semibold text-white/[0.95]`}>{workOrder.priority}</p>
          </div>
        </div>
      )}

      <WoMobileGlassSection
        variant="details"
        title="Appointments"
        summary={appointmentsSummary}
        isOpen={glassSectionsOpen.detailsAppointments}
        onToggle={() => toggleGlassSection('detailsAppointments')}
      >
        <WorkOrderDetailsAppointmentsList appointments={workOrder.appointments} />
      </WoMobileGlassSection>

      {hasPropertyAccess && (
        <WoMobileGlassSection
          variant="details"
          title="Tenant & Property Access"
          summary={detailsTenantSummary}
          isOpen={glassSectionsOpen.detailsTenant}
          onToggle={() => toggleGlassSection('detailsTenant')}
        >
          <div className="grid grid-cols-1 gap-y-4">
            {(workOrder.property.tenant_name || workOrder.property.tenant_phone) && (
              <div>
                <h3 className={`${WO_MOBILE_SECTION_LABEL} mb-3`}>Tenant / Contact at Property</h3>
                <div className="grid grid-cols-1 gap-4">
                  {workOrder.property.tenant_name && (
                    <div>
                      <h4 className={WO_MOBILE_FIELD_LABEL}>Name</h4>
                      <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE} font-medium`}>
                        {workOrder.property.tenant_name}
                      </p>
                    </div>
                  )}
                  {workOrder.property.tenant_phone && (
                    <div>
                      <h4 className={WO_MOBILE_FIELD_LABEL}>Phone</h4>
                      <a
                        href={`tel:${workOrder.property.tenant_phone}`}
                        className="mt-1 text-sm text-cyan-400 hover:underline font-medium inline-block"
                      >
                        {workOrder.property.tenant_phone}
                      </a>
                    </div>
                  )}
                </div>
              </div>
            )}

            {workOrder.property.unit_number && (
              <div className="pt-4 border-t border-white/10">
                <h3 className={WO_MOBILE_FIELD_LABEL}>Unit Number</h3>
                <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE}`}>{workOrder.property.unit_number}</p>
              </div>
            )}

            {workOrder.property.gate_code && (
              <div className="pt-4 border-t border-white/10">
                <h3 className={WO_MOBILE_FIELD_LABEL}>Gate Code</h3>
                <p className={`mt-1 ${WO_MOBILE_FIELD_VALUE} font-mono bg-white/[0.06] px-2 py-1 rounded inline-block`}>
                  {workOrder.property.gate_code}
                </p>
              </div>
            )}

            {workOrder.property.access_instructions && (
              <div className="pt-4 border-t border-white/10">
                <h3 className={WO_MOBILE_FIELD_LABEL}>Access Instructions</h3>
                <p className={`mt-2 ${WO_MOBILE_FIELD_VALUE} border border-cyan-500/20 bg-cyan-500/5 rounded-lg p-3`}>
                  {workOrder.property.access_instructions}
                </p>
              </div>
            )}
          </div>
        </WoMobileGlassSection>
      )}

      {(allServices?.length > 0 || workOrder.parts?.length > 0) && (
        <WoMobileGlassSection
          variant="details"
          title="Services & Items"
          summary={detailsServicesSummary}
          isOpen={glassSectionsOpen.detailsServices}
          onToggle={() => toggleGlassSection('detailsServices')}
        >
          {allServices?.length > 0 && (
            <div className="mb-4">
              <h3 className={`${WO_MOBILE_SECTION_LABEL} mb-3`}>Services</h3>
              <div className="space-y-2">
                {allServices.map((service, index) => (
                  <div
                    key={service.id || index}
                    className="rounded-[14px] p-3.5 text-sm"
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <p className="font-medium text-white/[0.9]">{service.name || 'Unknown Service'}</p>
                    <div className="mt-2 grid grid-cols-3 gap-x-2 gap-y-1 text-xs text-gray-400">
                      <span>Qty</span>
                      <span>Unit</span>
                      <span className="text-right">Total</span>
                      <span className="text-gray-200">{service.quantity}</span>
                      <span className="text-gray-200">
                        ${service.unit_price ? Number(service.unit_price).toFixed(2) : 'N/A'}
                      </span>
                      <span className="text-right text-cyan-300/90 tabular-nums">
                        ${service.price ? Number(service.price).toFixed(2) : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {workOrder.parts?.length > 0 && (
            <div>
              <h3 className={`${WO_MOBILE_SECTION_LABEL} mb-3`}>Parts</h3>
              <div className="space-y-2">
                {workOrder.parts.map((part) => (
                  <div
                    key={part.id}
                    className="rounded-[14px] p-3.5 text-sm"
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px solid rgba(255, 255, 255, 0.05)',
                    }}
                  >
                    <p className="font-medium text-white/[0.9]">{part.description || part.number || 'Part'}</p>
                    <div className="mt-2 grid grid-cols-2 gap-x-2 gap-y-1 text-xs text-gray-400">
                      <span>Cost</span>
                      <span className="text-right">Price</span>
                      <span className="text-gray-200">${part.cost ? part.cost.toFixed(2) : 'N/A'}</span>
                      <span className="text-right text-cyan-300/90 tabular-nums">
                        ${part.price ? part.price.toFixed(2) : 'N/A'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </WoMobileGlassSection>
      )}

      <WoMobileGlassSection
        variant="details"
        title="Performance"
        summary="On-site, travel & outcomes"
        isOpen={glassSectionsOpen.detailsPerformance}
        onToggle={() => toggleGlassSection('detailsPerformance')}
      >
        <WorkOrderPerformancePanel workOrderId={workOrder.id} variant="mobile" embedded />
      </WoMobileGlassSection>

      <WorkOrderDebriefing workOrderId={workOrder.id} variant="mobile" />
    </div>
  );
}
