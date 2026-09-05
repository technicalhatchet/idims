/** Force uppercase while keeping spaces, symbols, and digits (no character stripping). */
export function uppercasePreserve(value) {
  return String(value || '').toUpperCase();
}

/** @deprecated Use uppercasePreserve — kept for imports during transition. */
export const sanitizeSolomonAlphanumeric = uppercasePreserve;

/** Diagnostic fields that should auto-uppercase in Solomon (model, serial, part #). */
export function shouldUppercaseSolomonField(field) {
  const id = String(field?.id || '').toLowerCase();
  const label = String(field?.label || '').toLowerCase();
  if (id.includes('model') || id.includes('serial')) return true;
  if (id.includes('part') || label.includes('part #') || label.includes('part number')) return true;
  return false;
}

/** @deprecated Use shouldUppercaseSolomonField */
export const shouldSolomonSanitizeField = shouldUppercaseSolomonField;
