/** Map diagnostic template id → IDIMS ApplianceIcon equipment type. */
const TEMPLATE_EQUIPMENT_TYPE = {
  refrigerator: 'refrigerator',
  standalone_freezer: 'freezer',
  washer: 'washer',
  dishwasher: 'dishwasher',
  electric_dryer: 'dryer',
  gas_dryer: 'dryer',
  electric_range: 'range',
  gas_range: 'range',
  microwave: 'microwave',
  stacked_laundry: 'aiolaundry',
  aio_laundry: 'aiolaundry',
};

export function getEquipmentTypeForTemplate(templateId) {
  if (!templateId) return null;
  return TEMPLATE_EQUIPMENT_TYPE[templateId] || templateId.replace(/_/g, '');
}

/** DMA equipment_subtype → ApplianceIcon equipment type. */
export function getEquipmentTypeForSubtype(subtype) {
  if (!subtype) return null;
  const map = {
    refrigerator: 'refrigerator',
    freezer: 'freezer',
    washing_machine: 'washer',
    electric_dryer: 'dryer',
    gas_dryer: 'dryer',
    dryer: 'dryer',
    aio_laundry: 'aiolaundry',
    dishwasher: 'dishwasher',
    electric_range: 'range',
    gas_range: 'range',
    oven: 'range',
  };
  return map[subtype] || subtype.replace(/_/g, '');
}
