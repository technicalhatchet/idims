/** Portal/staff display helpers — nicknames are labels only; routing uses real address. */

export function stripTrailingUsa(value) {
  if (!value) return '';
  return String(value).replace(/,\s*USA\s*$/i, '').trim();
}

export function formatPropertyAddress(prop) {
  if (!prop?.address) return '';
  const unit = prop.unit_number?.trim();
  const line = unit ? `${prop.address} · Unit ${unit}` : prop.address;
  return stripTrailingUsa(line);
}

/** Portal property section header: nickname title + optional address line. */
export function propertyHeaderLines(prop) {
  const nick = prop?.nickname?.trim();
  const addr = formatPropertyAddress(prop);
  if (nick) {
    return { title: nick, addressLine: addr || null };
  }
  return { title: addr || 'Property', addressLine: null };
}

export function propertyPrimaryTitle(prop) {
  const nick = prop?.nickname?.trim();
  if (nick) return nick;
  return formatPropertyAddress(prop) || 'Property';
}

/** Muted secondary line when a nickname is set; otherwise null (address is the title). */
export function propertySecondaryLine(prop) {
  const nick = prop?.nickname?.trim();
  if (!nick) return null;
  return formatPropertyAddress(prop) || null;
}

export function propertySortKey(prop) {
  return `${propertyPrimaryTitle(prop)} ${formatPropertyAddress(prop)}`.toLowerCase();
}
