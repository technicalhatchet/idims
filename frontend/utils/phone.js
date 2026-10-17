/**
 * US phone helpers — keep in sync with backend/app/utils/us_phone.py
 */

export function normalizeUsPhoneE164(raw) {
  if (raw == null) return null;
  const trimmed = String(raw).trim();
  if (!trimmed) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length === 10) return `+1${digits}`;
  if (digits.length === 11 && digits.startsWith('1')) return `+1${digits.slice(1)}`;
  return null;
}

export function phonesEqual(a, b) {
  const na = normalizeUsPhoneE164(a);
  const nb = normalizeUsPhoneE164(b);
  if (na && nb) return na === nb;
  const sa = (a || '').trim();
  const sb = (b || '').trim();
  return Boolean(sa) && sa === sb;
}

export function formatPhoneNumber(phone) {
  if (!phone) return '';
  const e164 = normalizeUsPhoneE164(phone);
  if (e164 && e164.length === 12 && e164.startsWith('+1')) {
    const d = e164.slice(2);
    return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 10)}`;
  }
  const cleaned = String(phone).replace(/\D/g, '');
  if (cleaned.length === 10) {
    return `(${cleaned.slice(0, 3)}) ${cleaned.slice(3, 6)}-${cleaned.slice(6, 10)}`;
  }
  return String(phone).trim();
}

export function preferDialPhone(mobile, phone) {
  if (mobile && String(mobile).trim()) return String(mobile).trim();
  if (phone && String(phone).trim()) return String(phone).trim();
  return '';
}

/**
 * When both numbers are the same (normalized), show one line in UI.
 */
export function clientPhoneDisplayLines(mobile, phone) {
  const cell = mobile && String(mobile).trim() ? formatPhoneNumber(mobile) : '';
  const other = phone && String(phone).trim() ? formatPhoneNumber(phone) : '';
  if (cell && other && phonesEqual(mobile, phone)) {
    return { cell, other: null, single: cell };
  }
  return { cell, other: other || null, single: null };
}
