import ApplianceAgeTile from '../../appliances/ApplianceAgeTile';
import { subtypeLabel } from '../../../constants/applianceEquipment';

export function ApplianceDetailTile({ label, children, className = '' }) {
  return (
    <div
      className={`h-full min-h-[4.5rem] rounded-lg bg-white/[0.04] px-3 py-2 flex flex-col ${className}`}
    >
      <span className="text-xs text-gray-500 block leading-tight">{label}</span>
      <div className="text-sm text-gray-300 flex-1 mt-0.5 break-words">{children}</div>
    </div>
  );
}

export default function ApplianceDetailSpecGrid({ appliance, locationLine }) {
  const typeLabel = subtypeLabel(appliance.equipment_type, appliance.equipment_subtype) || '—';
  const locationText = locationLine
    ? `${locationLine}${appliance.property?.unit_number ? ` Unit ${appliance.property.unit_number}` : ''}`
    : 'Not set — edit to add';
  const locationTone = locationLine ? 'text-gray-300' : 'text-amber-400';

  return (
    <div
      className="mt-4 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 items-stretch"
    >
      <ApplianceDetailTile label="Type">{typeLabel}</ApplianceDetailTile>
      <ApplianceDetailTile label="Make">{appliance.make || '—'}</ApplianceDetailTile>
      <ApplianceDetailTile label="Serial Number">
        <span className="font-mono font-semibold text-gray-200">{appliance.serial || '—'}</span>
      </ApplianceDetailTile>
      {appliance.appliance_age ? (
        <div className="h-full min-h-[4.5rem]">
          <ApplianceAgeTile applianceAge={appliance.appliance_age} variant="portal" gridTile />
        </div>
      ) : null}
      <ApplianceDetailTile label="Times Serviced">
        <span className="text-cyan-400 font-bold text-lg leading-tight">{appliance.service_count}</span>
      </ApplianceDetailTile>
      <ApplianceDetailTile label="Service Location" className="col-span-2 md:col-span-3 lg:col-span-4">
        <span className={locationTone}>{locationText}</span>
      </ApplianceDetailTile>
    </div>
  );
}
