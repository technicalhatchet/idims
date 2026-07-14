/** Map diagnostic template id → DMA equipment_subtype slug. */
const TEMPLATE_TO_DMA_SUBTYPE: Record<string, string> = {
  refrigerator: 'refrigerator',
  standalone_freezer: 'freezer',
  washer: 'washing_machine',
  electric_dryer: 'dryer',
  gas_dryer: 'dryer',
  stacked_laundry: 'dryer',
  aio_laundry: 'aio_laundry',
  dishwasher: 'dishwasher',
  microwave: 'microwave',
  electric_range: 'oven',
  gas_range: 'oven',
};

export function resolveDmaEquipmentSubtype(
  templateId: string | null | undefined,
  workOrder?: { equipment_subtype?: string | null } | null,
): string | null {
  const fromWorkOrder = (workOrder?.equipment_subtype || '').trim();
  if (fromWorkOrder) return fromWorkOrder;
  if (!templateId) return null;
  return TEMPLATE_TO_DMA_SUBTYPE[templateId] || templateId;
}
