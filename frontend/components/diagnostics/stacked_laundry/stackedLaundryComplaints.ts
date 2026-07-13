import type { ComplaintChipDefinition } from '../routing/types';

/** Shared washer-side complaint chips for combo units. */
export const LAUNDRY_COMBO_WASHER_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'washer_drain',
    label: "Washer Won't Drain",
    keywords: ['won\'t drain', 'not draining', 'standing water', 'washer drain'],
  },
  {
    id: 'washer_spin',
    label: "Washer Won't Spin",
    keywords: ['won\'t spin', 'not spinning', 'clothes wet', 'washer spin'],
  },
  {
    id: 'washer_leak',
    label: 'Washer Leaking',
    keywords: ['washer leak', 'leaking', 'water on floor', 'puddle'],
  },
  {
    id: 'washer_fill',
    label: "Washer Won't Fill",
    keywords: ['won\'t fill', 'no water', 'washer fill', 'slow fill'],
  },
];

export const LAUNDRY_COMBO_DRYER_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'dryer_no_heat',
    label: 'Dryer No Heat',
    keywords: ['no heat', 'dryer not heating', 'cold air', 'not heating'],
  },
  {
    id: 'dryer_not_drying',
    label: 'Dryer Takes Too Long',
    keywords: ['not drying', 'damp', 'too long', 'wet clothes', 'dryer'],
  },
  {
    id: 'dryer_no_tumble',
    label: "Dryer Won't Tumble",
    keywords: ['won\'t tumble', 'drum not turning', 'dryer drum'],
  },
];

export const LAUNDRY_COMBO_COMMON_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'noisy',
    label: 'Noisy / Vibration',
    keywords: ['noisy', 'banging', 'vibrat', 'thump', 'loud'],
  },
  {
    id: 'no_power',
    label: "Dead / Won't Start",
    keywords: ['no power', 'dead', 'won\'t start', 'tripped breaker'],
  },
  {
    id: 'error_code',
    label: 'Error Code',
    keywords: ['error', 'fault', 'code'],
  },
];

export const STACKED_LAUNDRY_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  ...LAUNDRY_COMBO_WASHER_CHIPS,
  ...LAUNDRY_COMBO_DRYER_CHIPS,
  ...LAUNDRY_COMBO_COMMON_CHIPS,
];
