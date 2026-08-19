import { parseISO } from 'date-fns';

/**
 * Parse API datetimes stored as UTC but often serialized without a timezone (naive isoformat).
 * Without this, parseISO treats naive strings as local time → "in 4 hours" in US timezones.
 */
export function parseApiDateTime(value) {
  if (!value) return null;
  if (value instanceof Date) return value;

  const s = String(value).trim();
  if (!s) return null;

  const hasZone = s.endsWith('Z') || /[+-]\d{2}:?\d{2}$/.test(s);
  return parseISO(hasZone ? s : `${s}Z`);
}
