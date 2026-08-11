import { DMA_APPLIANCE_SUBTYPES, DMA_EQUIPMENT_TYPES } from '../constants/dmaEquipmentOptions';

const GENERIC_EQUIPMENT_TYPES = new Set(['', 'appliance']);

function humanizeEquipmentSlug(value) {
  if (!value) return null;
  return String(value)
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * User-facing appliance name for WO UI (Details cards, headers).
 * Prefers `equipment_subtype` when `equipment_type` is generic "appliance".
 */
export function resolveWorkOrderEquipmentDisplayName(workOrder) {
  const subtype = workOrder?.equipment_subtype?.trim();
  if (subtype) {
    const fromCatalog = DMA_APPLIANCE_SUBTYPES.find((o) => o.value === subtype);
    if (fromCatalog?.value && fromCatalog.label) return fromCatalog.label;
    return humanizeEquipmentSlug(subtype);
  }

  const typeRaw = workOrder?.equipment_type?.trim();
  const typeNorm = (typeRaw || '').toLowerCase();
  if (typeRaw && !GENERIC_EQUIPMENT_TYPES.has(typeNorm)) {
    if (typeNorm === 'tv') return 'TV';
    const fromCatalog = DMA_EQUIPMENT_TYPES.find((o) => o.value === typeNorm);
    if (fromCatalog?.value && fromCatalog.label) return fromCatalog.label;
    return humanizeEquipmentSlug(typeRaw);
  }

  const make = workOrder?.equipment_make?.trim();
  if (make) return make;

  return 'Unknown appliance';
}
