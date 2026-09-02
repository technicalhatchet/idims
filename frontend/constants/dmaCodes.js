/**
 * Problem and resolution codes for DMA Repair Outcome notes.
 * Labels must stay in sync with backend/app/constants/dma_codes.py
 */

export const DMA_PROBLEM_CODES = {
  not_cooling: 'Not cooling / no cool',
  not_heating: 'Not heating',
  not_draining: 'Not draining',
  leaking: 'Leaking water',
  noisy: 'Noisy / vibration',
  wont_start: "Won't start / no power",
  wont_spin: "Won't spin / agitate",
  wont_stop_spinning: "Won't stop spinning",
  ice_maker: 'Ice maker issue',
  door_seal: 'Door seal / gasket',
  error_code_display: 'Error code on display',
  poor_drying: 'Poor drying / heating element',
  restricted_ventilation: 'Restricted ventilation / duct',
  display_issue: 'Display / UI issue',
  other: 'Other',
};

export const DMA_RESOLUTION_CODES = {
  mechanical_adjustment: 'Mechanical adjustment made',
  electrical_adjustment: 'Electrical adjustment made',
  mechanical_part_replaced: 'Mechanical part replaced',
  electrical_part_replaced: 'Electrical part replaced',
  cleaning_maintenance: 'Cleaning / maintenance',
  external_cause: 'External cause — not appliance fault',
  customer_education: 'Customer education / usage',
  referred_third_party: 'Referred third-party service',
  reset_software: 'Reset / software update',
  wiring_repair: 'Wiring / connection repair',
  other: 'Other',
};

export const REPAIR_OUTCOME_NOTE_TYPE = 'Repair Outcome';

export const REPAIR_MEMORY_MATCH_OPTIONS = [
  { value: '', label: 'Select one…' },
  { value: 'yes', label: 'Yes — top suggestion was the fix' },
  { value: 'partially', label: 'Partially — related area, different item' },
  { value: 'no', label: 'No — different root cause' },
  { value: 'didnt_use', label: "Didn't use / no suggestions shown" },
];

export const REPAIR_SUCCESSFUL_OPTIONS = [
  { value: '', label: 'Select one…' },
  { value: 'true', label: 'Yes — issue resolved' },
  { value: 'false', label: 'No — issue not resolved' },
];

export function repairMemoryMatchLabel(value) {
  const found = REPAIR_MEMORY_MATCH_OPTIONS.find((o) => o.value === value);
  return found?.label || value || '';
}

export function repairSuccessfulLabel(value) {
  if (value === true || value === 'true') return 'Yes — issue resolved';
  if (value === false || value === 'false') return 'No — issue not resolved';
  return '';
}

export function codeOptions(codeMap) {
  return Object.entries(codeMap).map(([value, label]) => ({ value, label }));
}

export function codeLabel(codeMap, value) {
  if (!value) return '';
  return codeMap[value] || value.replace(/_/g, ' ');
}
