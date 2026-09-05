/** Uppercase letters and digits only — model, serial, and part # fields in Solomon. */
export function sanitizeSolomonAlphanumeric(value) {
  return String(value || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
}

/** Diagnostic template fields that should use alphanumeric-only input in Solomon. */
export function shouldSolomonSanitizeField(field) {
  const id = String(field?.id || '').toLowerCase();
  const label = String(field?.label || '').toLowerCase();
  if (id.includes('model') || id.includes('serial')) return true;
  if (id.includes('part') || label.includes('part #') || label.includes('part number')) return true;
  return false;
}
