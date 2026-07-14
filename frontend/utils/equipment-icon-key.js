/**
 * Normalize arbitrary equipment strings → icon-registry key segments (letters only, lowercase).
 * @param {string | undefined | null} s
 */
function normalizeEquipmentSegment(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
}

/** Explicit subtype slugs → APPLIANCE_ICONS keys. */
const SUBTYPE_ICON_ALIASES = {
  electricdryer: 'dryer',
  gasdryer: 'dryer',
  electricrange: 'oven',
  gasrange: 'oven',
  rangeoven: 'oven',
  stackedlaundry: 'aiolaundry',
  washingmachine: 'washer',
  chestfreezer: 'freezer',
  standalonfreezer: 'freezer',
  rangehood: 'rangehood',
};

/**
 * Map a normalized equipment segment to a known icon registry key.
 * @param {string} segment
 */
function resolveIconKey(segment) {
  if (!segment) return '';
  if (SUBTYPE_ICON_ALIASES[segment]) return SUBTYPE_ICON_ALIASES[segment];

  if (segment.includes('dryer')) return 'dryer';
  if (segment.includes('washer') || segment.includes('laundry')) {
    if (segment.includes('aio') || segment.includes('combo') || segment.includes('stacked')) {
      return 'aiolaundry';
    }
    return 'washer';
  }
  if (segment.includes('range') || segment.includes('oven') || segment.includes('stove')) {
    return 'oven';
  }
  if (segment.includes('fridge') || segment.includes('refrigerator')) return 'refrigerator';
  if (segment.includes('freez')) return 'freezer';
  if (segment.includes('dish')) return 'dishwasher';
  if (segment.includes('micro')) return 'microwave';
  if (segment.includes('cooktop')) return 'cooktop';
  if (segment.includes('hood')) return 'rangehood';
  if (segment === 'tv' || segment.includes('television')) return 'tv';

  return segment;
}

/**
 * Resolve `equipment_type` / `equipment_subtype` to APPLIANCE_ICONS map keys (`tv`, `washer`, …).
 *
 * TVs are keyed off `equipment_type` (`tv` / television). `equipment_subtype` for TVs is typically
 * a size SKU and must **not** win over type for icons. Appliances continue to prefer subtype when set.
 *
 * @param {string | undefined | null} equipmentType
 * @param {string | undefined | null} equipmentSubtype
 * @returns {string}
 */
export function getEquipmentIconKey(equipmentType, equipmentSubtype) {
  const typeNorm = normalizeEquipmentSegment(equipmentType);
  if (typeNorm === 'tv' || typeNorm === 'television') {
    return 'tv';
  }

  const subNorm = normalizeEquipmentSegment(equipmentSubtype);
  if (subNorm) {
    return resolveIconKey(subNorm);
  }

  return resolveIconKey(typeNorm) || typeNorm;
}
