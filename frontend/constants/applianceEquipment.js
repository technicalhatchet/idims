/** Shared equipment taxonomy for portal appliances and scheduling. */

export const EQUIPMENT_TYPES = [
  { value: 'appliance', label: 'Appliance' },
  { value: 'tv', label: 'TV' },
];

export const EQUIPMENT_SUBTYPES = {
  appliance: [
    { value: 'refrigerator', label: 'Refrigerator' },
    { value: 'freezer', label: 'Freezer' },
    { value: 'dishwasher', label: 'Dishwasher' },
    { value: 'washing_machine', label: 'Washing Machine' },
    { value: 'dryer', label: 'Dryer' },
    { value: 'aio_laundry', label: 'AIO Laundry' },
    { value: 'oven', label: 'Oven / Range' },
    { value: 'wall_oven', label: 'Wall Oven' },
    { value: 'microwave', label: 'Microwave' },
    { value: 'cooktop', label: 'Cooktop' },
    { value: 'range_hood', label: 'Range Hood' },
    { value: 'other', label: 'Other' },
  ],
  tv: [
    { value: 'under_32', label: 'Under 32"' },
    { value: '32_to_43', label: '32" to 43"' },
    { value: '44_to_55', label: '44" to 55"' },
    { value: '56_to_65', label: '56" to 65"' },
    { value: '66_to_75', label: '66" to 75"' },
    { value: 'over_75', label: 'Over 75"' },
  ],
};

export const MANUFACTURERS = [
  'Samsung', 'LG', 'Sony', 'Whirlpool', 'GE', 'Frigidaire', 'Maytag',
  'KitchenAid', 'Bosch', 'Electrolux', 'Kenmore', 'Haier', 'Miele',
  'Thermador', 'Viking', 'Sub-Zero', 'Wolf', 'Other',
];

export function subtypeLabel(equipmentType, subtype) {
  if (!subtype) return '';
  const list = EQUIPMENT_SUBTYPES[equipmentType] || [];
  return list.find((o) => o.value === subtype)?.label || subtype.replace(/_/g, ' ');
}

export function schedulingMissingLabels(missing) {
  const labels = {
    equipment_type: 'Appliance type',
    equipment_subtype: 'Subtype (e.g. Refrigerator)',
    make: 'Manufacturer',
    service_address: 'Service address',
  };
  return (missing || []).map((key) => labels[key] || key);
}

export function getSchedulingMissing(appliance) {
  if (appliance?.scheduling_missing?.length) {
    return appliance.scheduling_missing;
  }
  const missing = [];
  if (!appliance?.equipment_type) missing.push('equipment_type');
  if (!appliance?.equipment_subtype) missing.push('equipment_subtype');
  if (!appliance?.make) missing.push('make');
  if (!appliance?.property_id && !appliance?.service_address && !appliance?.property?.address) {
    missing.push('service_address');
  }
  return missing;
}

export function isSchedulingReady(appliance) {
  if (appliance?.scheduling_ready != null) return appliance.scheduling_ready;
  return getSchedulingMissing(appliance).length === 0;
}

export function applianceDisplayName(appliance) {
  if (appliance?.nickname) return appliance.nickname;
  const make = appliance?.make || '';
  const sub = subtypeLabel(appliance?.equipment_type || appliance?.type, appliance?.equipment_subtype || appliance?.subtype);
  return [make, sub].filter(Boolean).join(' ') || appliance?.equipment_type || 'Appliance';
}

export const emptyApplianceForm = {
  property_id: '',
  nickname: '',
  equipment_type: 'appliance',
  equipment_subtype: '',
  make: '',
  model: '',
  serial: '',
  equipment_version: '',
  is_wall_mounted: false,
  notes: '',
};
