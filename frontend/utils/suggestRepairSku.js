import { getEquipmentIconKey } from './equipment-icon-key';
import { resolveWorkOrderEquipmentDisplayName } from './workOrderEquipmentDisplay';

/** Map icon-registry keys → SKU `equipment_type` values (may be multiple). */
const ICON_KEY_TO_SKU_EQUIPMENT_TYPES = {
  tv: ['tv'],
  washer: ['washer'],
  dryer: ['dryer'],
  aio_laundry: ['aio_laundry', 'stacked_laundry'],
  dishwasher: ['dishwasher'],
  refrigerator: ['refrigerator'],
  freezer: ['refrigerator'],
  oven: ['range', 'wall_oven'],
  microwave: ['range', 'other'],
  cooktop: ['range', 'wall_oven'],
  rangehood: ['range', 'other'],
  network: ['network'],
};

function norm(value) {
  return String(value || '').trim().toLowerCase();
}

function parseSkuEquipmentType(sku) {
  const raw = sku?.equipment_type;
  if (!raw) return null;
  if (typeof raw === 'string') return raw.toLowerCase();
  if (typeof raw?.value === 'string') return raw.value.toLowerCase();
  return String(raw).toLowerCase();
}

function parseSkuServiceType(sku) {
  const raw = sku?.service_type;
  if (!raw) return '';
  if (typeof raw === 'string') return raw.toLowerCase();
  if (typeof raw?.value === 'string') return raw.value.toLowerCase();
  return String(raw).toLowerCase();
}

/** Subtype hints for gas / electric SKU name matching. */
function equipmentFuelHints(workOrder) {
  const subtype = norm(workOrder?.equipment_subtype);
  const hints = [];
  if (subtype.includes('gas')) hints.push('gas');
  if (subtype.includes('electric')) hints.push('electric');
  if (subtype.includes('gas_dryer') || subtype === 'gas_dryer') hints.push('gas');
  if (subtype.includes('electric_dryer') || subtype === 'electric_dryer') hints.push('electric');
  if (subtype.includes('gas_range') || subtype === 'gas_range') hints.push('gas');
  if (subtype.includes('electric_range') || subtype === 'electric_range') hints.push('electric');
  return [...new Set(hints)];
}

/**
 * Resolve likely SKU equipment_type values from work-order equipment fields.
 */
export function resolveSkuEquipmentTypesForWorkOrder(workOrder) {
  const iconKey = getEquipmentIconKey(
    workOrder?.equipment_type,
    workOrder?.equipment_subtype,
  );
  const fromIcon = ICON_KEY_TO_SKU_EQUIPMENT_TYPES[iconKey] || [];
  if (fromIcon.length) return fromIcon;

  const typeNorm = norm(workOrder?.equipment_type);
  if (typeNorm === 'tv') return ['tv'];
  if (typeNorm === 'network') return ['network'];

  const subNorm = norm(workOrder?.equipment_subtype);
  if (subNorm && ICON_KEY_TO_SKU_EQUIPMENT_TYPES[subNorm]) {
    return ICON_KEY_TO_SKU_EQUIPMENT_TYPES[subNorm];
  }

  return [];
}

function scoreRepairSku(sku, { preferredTypes, fuelHints, primaryType }) {
  const eq = parseSkuEquipmentType(sku);
  if (!eq) return -1;

  let score = 0;
  if (primaryType && eq === primaryType) score += 100;
  if (preferredTypes.includes(eq)) score += 50;

  const name = norm(sku.name);
  const code = norm(sku.sku_code);
  for (const hint of fuelHints) {
    if (name.includes(hint) || code.includes(hint)) score += 20;
  }
  if (name.includes('repair')) score += 5;

  return score;
}

/**
 * Best repair SKU suggestion for a work order, or null if none / already on order.
 */
export function suggestRepairSkuForWorkOrder(workOrder, catalogServices, existingServiceIds = []) {
  const preferredTypes = resolveSkuEquipmentTypesForWorkOrder(workOrder);
  if (!preferredTypes.length) return null;

  const existing = new Set((existingServiceIds || []).map((id) => String(id)));
  const primaryType = preferredTypes[0] || null;
  const fuelHints = equipmentFuelHints(workOrder);

  const candidates = (catalogServices || [])
    .filter((sku) => {
      if (existing.has(String(sku.id))) return false;
      if (parseSkuServiceType(sku) !== 'repair') return false;
      const eq = parseSkuEquipmentType(sku);
      if (!eq) return false;
      if (preferredTypes.length && !preferredTypes.includes(eq)) return false;
      return true;
    })
    .map((sku) => ({
      sku,
      score: scoreRepairSku(sku, { preferredTypes, fuelHints, primaryType }),
    }))
    .filter((row) => row.score >= 0)
    .sort((a, b) => b.score - a.score);

  if (!candidates.length) return null;

  const best = candidates[0].sku;
  const equipmentLabel = resolveWorkOrderEquipmentDisplayName(workOrder);

  return {
    sku: best,
    equipmentLabel,
    reason: preferredTypes.length
      ? `Matches ${equipmentLabel} repair SKUs`
      : `Repair SKU for ${equipmentLabel}`,
  };
}
