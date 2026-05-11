import React from 'react';
import { getEquipmentIconKey } from '../../utils/equipment-icon-key';

const APPLIANCE_ICONS = {
  refrigerator:   { color: 'cyan',   svg: (<><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/></>) },
  fridge:         { color: 'cyan',   svg: (<><rect x="6" y="2" width="12" height="20" rx="2"/><line x1="6" y1="10" x2="18" y2="10"/><line x1="10" y1="5" x2="10" y2="8"/><line x1="10" y1="13" x2="10" y2="16"/></>) },
  washingmachine: { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/></>) },
  washer:         { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="12" cy="13" r="2"/><circle cx="8" cy="6" r="1"/></>) },
  dryer:          { color: 'orange', svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><circle cx="12" cy="13" r="5"/><path d="M10 11a2 2 0 0 0 4 0"/><circle cx="8" cy="6" r="1"/></>) },
  dishwasher:     { color: 'cyan',   svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><line x1="4" y1="8" x2="20" y2="8"/><line x1="9" y1="5" x2="15" y2="5"/></>) },
  oven:           { color: 'orange', svg: (<><rect x="4" y="2" width="16" height="20" rx="2"/><rect x="6" y="10" width="12" height="9" rx="1"/><line x1="7" y1="6" x2="7" y2="6"/><line x1="10" y1="6" x2="10" y2="6"/><line x1="13" y1="6" x2="13" y2="6"/><line x1="16" y1="6" x2="16" y2="6"/></>) },
  microwave:      { color: 'orange', svg: (<><rect x="2" y="6" width="20" height="12" rx="2"/><rect x="4" y="8" width="12" height="8"/><line x1="18" y1="10" x2="18" y2="10"/><line x1="18" y1="12" x2="18" y2="12"/><line x1="18" y1="14" x2="18" y2="14"/></>) },
  freezer:        { color: 'cyan',   svg: (<><rect x="3" y="6" width="18" height="14" rx="2"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="12" y1="6" x2="12" y2="10"/></>) },
  cooktop:        { color: 'orange', svg: (<><rect x="2" y="4" width="20" height="16" rx="2"/><circle cx="8" cy="10" r="2"/><circle cx="16" cy="10" r="2"/><circle cx="8" cy="16" r="2"/><circle cx="16" cy="16" r="2"/></>) },
  rangehood:      { color: 'orange', svg: (<><path d="M6 3h12l2 7H4L6 3z"/><rect x="4" y="10" width="16" height="4" rx="1"/><line x1="8" y1="14" x2="8" y2="21"/><line x1="16" y1="14" x2="16" y2="21"/></>) },
  tv:             { color: 'orange', svg: (<><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="18" x2="12" y2="21"/></>) },
  default:        { color: 'cyan',   svg: (<><path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/></>) },
};

/**
 * Neon-stroke appliance / TV icon for tech dashboard cards (matches work order test styling).
 */
export default function ApplianceIcon({ equipmentType, equipmentSubtype, className = 'w-11 h-11' }) {
  const key = getEquipmentIconKey(equipmentType, equipmentSubtype);
  const match = APPLIANCE_ICONS[key] || APPLIANCE_ICONS.default;
  const isCyan = match.color === 'cyan';
  return (
    <svg viewBox="0 0 24 24" className={className} style={{
      stroke: isCyan ? '#00D4FF' : '#FF7A00', strokeWidth: 1.5, fill: 'none',
      strokeLinecap: 'round', strokeLinejoin: 'round',
      filter: isCyan ? 'drop-shadow(0 0 6px rgba(0,212,255,0.6))' : 'drop-shadow(0 0 6px rgba(255,122,0,0.6))'
    }}>{match.svg}</svg>
  );
}
