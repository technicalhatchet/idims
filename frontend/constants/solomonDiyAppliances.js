/**
 * Homeowner-friendly appliance choices → Solomon diagnostic template ids.
 */
export const SOLOMON_DIY_APPLIANCES = [
  { templateId: 'refrigerator', label: 'Refrigerator', hint: 'Not cooling, ice buildup, noise…' },
  { templateId: 'washer', label: 'Washer', hint: 'Not draining, won\'t spin, leaks…' },
  { templateId: 'electric_dryer', label: 'Dryer (electric)', hint: 'No heat, long dry times…' },
  { templateId: 'gas_dryer', label: 'Dryer (gas)', hint: 'No heat, won\'t start…' },
  { templateId: 'dishwasher', label: 'Dishwasher', hint: 'Not draining, poor cleaning…' },
  { templateId: 'microwave', label: 'Microwave', hint: 'No heat, turntable issues…' },
  { templateId: 'electric_range', label: 'Oven / range (electric)', hint: 'Burner or bake problems…' },
  { templateId: 'gas_range', label: 'Oven / range (gas)', hint: 'Ignition or temperature issues…' },
  { templateId: 'standalone_freezer', label: 'Freezer', hint: 'Not freezing, frost buildup…' },
  { templateId: 'aio_laundry', label: 'All-in-one laundry', hint: 'Combo washer-dryer units…' },
  { templateId: 'stacked_laundry', label: 'Stacked laundry', hint: 'Washer + dryer stack units…' },
];

export function getDiyApplianceOption(templateId) {
  return SOLOMON_DIY_APPLIANCES.find((item) => item.templateId === templateId) || null;
}

export function templateIdToDiySubtype(templateId) {
  const map = {
    refrigerator: 'refrigerator',
    washer: 'washing_machine',
    electric_dryer: 'dryer',
    gas_dryer: 'dryer',
    dishwasher: 'dishwasher',
    microwave: 'microwave',
    electric_range: 'oven',
    gas_range: 'oven',
    standalone_freezer: 'freezer',
    aio_laundry: 'aio_laundry',
    stacked_laundry: 'washing_machine',
  };
  return map[templateId] || '';
}
