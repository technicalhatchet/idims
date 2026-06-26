import { format, parseISO, isValid } from 'date-fns';

export const PART_SOURCE_OPTIONS = [
  { value: 'oem', label: 'OEM' },
  { value: 'aftermarket', label: 'Aftermarket' },
];

export const DEFAULT_PART_SOURCE = 'aftermarket';

export function normalizePartSource(value) {
  return value === 'oem' ? 'oem' : 'aftermarket';
}

export function partToFormState(part = {}) {
  return {
    ...part,
    part_source: normalizePartSource(part.part_source),
    warranty_days_override:
      part.warranty_days_override != null ? String(part.warranty_days_override) : '',
  };
}

export function emptyPartFormState() {
  return {
    number: '',
    description: '',
    cost: '',
    price: '',
    status: 'needed',
    part_source: DEFAULT_PART_SOURCE,
    warranty_days_override: '',
    vendor: '',
    tracking_number: '',
    notes: '',
  };
}

export const OEM_WARRANTY_DAYS = 365;

export function effectiveWarrantyDays(partSource, warrantyDaysOverride, defaults = {}) {
  if (warrantyDaysOverride !== null && warrantyDaysOverride !== undefined && warrantyDaysOverride !== '') {
    const parsed = parseInt(warrantyDaysOverride, 10);
    if (Number.isFinite(parsed)) return Math.max(0, parsed);
  }
  const oemDays = defaults.oemWarrantyDays ?? OEM_WARRANTY_DAYS;
  const amDays = defaults.aftermarketWarrantyDays ?? 0;
  return partSource === 'oem' ? oemDays : amDays;
}

export function formatPartSourceLabel(partSource) {
  if (partSource === 'oem') return 'OEM';
  if (partSource === 'aftermarket') return 'Aftermarket';
  return '—';
}

export function formatPartWarrantySummary(part, warrantyDefaults = {}) {
  if (!part) return '—';
  const days = effectiveWarrantyDays(part.part_source, part.warranty_days_override, warrantyDefaults);
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
