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
  ice_maker: 'Ice maker issue',
  door_seal: 'Door seal / gasket',
  error_code_display: 'Error code on display',
  poor_drying: 'Poor drying / heating element',
  display_issue: 'Display / UI issue',
  other: 'Other',
};

export const DMA_RESOLUTION_CODES = {
  mechanical_adjustment: 'Mechanical adjustment made',
  electrical_adjustment: 'Electrical adjustment made',
  mechanical_part_replaced: 'Mechanical part replaced',
  electrical_part_replaced: 'Electrical part replaced',
  cleaning_maintenance: 'Cleaning / maintenance',
  reset_software: 'Reset / software update',
  wiring_repair: 'Wiring / connection repair',
  other: 'Other',
};

export const REPAIR_OUTCOME_NOTE_TYPE = 'Repair Outcome';

export function codeOptions(codeMap) {
  return Object.entries(codeMap).map(([value, label]) => ({ value, label }));
}

export function codeLabel(codeMap, value) {
  if (!value) return '';
  return codeMap[value] || value.replace(/_/g, ' ');
}
