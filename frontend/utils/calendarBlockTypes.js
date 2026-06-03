export const CALENDAR_BLOCK_TYPES = [
  { value: 'lunch', label: 'Lunch' },
  { value: 'meeting', label: 'Meeting' },
  { value: 'shop', label: 'Shop' },
  { value: 'pto', label: 'PTO' },
  { value: 'other', label: 'Other' },
];

export const CALENDAR_BLOCK_TYPE_LABELS = Object.fromEntries(
  CALENDAR_BLOCK_TYPES.map((t) => [t.value, t.label])
);

/** Muted rail / fill accents per block type (schedule-test timeline). */
export const CALENDAR_BLOCK_ACCENT = {
  lunch: '#F59E0B',
  meeting: '#A78BFA',
  shop: '#64748B',
  pto: '#FB7185',
  other: '#94A3B8',
};

export function calendarBlockTypeLabel(blockType) {
  if (!blockType) return 'Block';
  return CALENDAR_BLOCK_TYPE_LABELS[blockType] || blockType;
}

export function isCalendarBlockEvent(ev) {
  return ev?.source === 'calendar_block';
}
