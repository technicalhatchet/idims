/** Portal/staff display helpers — nicknames are labels only; routing uses real address. */

export function formatPropertyAddress(prop) {
  if (!prop?.address) return '';
  const unit = prop.unit_number?.trim();
  return unit ? `${prop.address} · Unit ${unit}` : prop.address;
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
