import { format, parseISO, isValid } from 'date-fns';

export const PART_SOURCE_OPTIONS = [
  { value: '', label: 'Select source…' },
  { value: 'oem', label: 'OEM' },
  { value: 'aftermarket', label: 'Aftermarket' },
];

export const OEM_WARRANTY_DAYS = 365;

export function effectiveWarrantyDays(partSource, warrantyDaysOverride) {
  if (warrantyDaysOverride !== null && warrantyDaysOverride !== undefined && warrantyDaysOverride !== '') {
    const parsed = parseInt(warrantyDaysOverride, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  return partSource === 'oem' ? OEM_WARRANTY_DAYS : 0;
}

export function formatPartSourceLabel(partSource) {
  if (partSource === 'oem') return 'OEM';
  if (partSource === 'aftermarket') return 'Aftermarket';
  return '—';
}

export function formatPartWarrantySummary(part) {
  if (!part) return '—';
  const days = effectiveWarrantyDays(part.part_source, part.warranty_days_override);
  if (days <= 0) return 'No parts warranty';

  if (part.warranty_expires_at) {
    const expiry = parseISO(part.warranty_expires_at);
    if (isValid(expiry)) {
      return `Until ${format(expiry, 'MMM d, yyyy')}`;
    }
  }

  if (part.status === 'installed') {
    return `${days}-day warranty (active)`;
  }
  return `${days} days (starts when installed)`;
}

export function isValidPartSource(value) {
  return value === 'oem' || value === 'aftermarket';
}
