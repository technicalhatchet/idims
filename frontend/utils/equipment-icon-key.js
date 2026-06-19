/**
 * Normalize arbitrary equipment strings → icon-registry key segments (letters only, lowercase).
 * @param {string | undefined | null} s
 */
function normalizeEquipmentSegment(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[^a-z]/g, '');
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
    if (subNorm === 'aiolaundry') return 'aiolaundry';
    return subNorm;
  }

  return typeNorm;
}
