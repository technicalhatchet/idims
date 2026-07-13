import type { ComplaintChipDefinition } from '../routing/types';

export const GAS_DRYER_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'no_heat',
    label: 'No Heat / Won\'t Ignite',
    keywords: ['no heat', 'not heating', 'won\'t ignite', 'no flame', 'cold air'],
  },
  {
    id: 'not_drying',
    label: 'Takes Too Long / Damp Clothes',
    keywords: ['not drying', 'damp', 'wet clothes', 'too long', 'hours to dry'],
  },
  {
    id: 'no_spin',
    label: "Won't Tumble / Drum Not Turning",
    keywords: ['won\'t tumble', 'not turning', 'drum not', 'no spin', 'stuck'],
  },
  {
    id: 'wont_stop_spinning',
    label: "Won't Stop Spinning",
    keywords: ['won\'t stop', 'keeps spinning', 'continuous spin', 'never stops'],
  },
  {
    id: 'gas_smell',
    label: 'Gas Smell / Leak Concern',
    keywords: ['gas smell', 'odor', 'leak', 'mercaptan'],
  },
  {
    id: 'weak_flame',
    label: 'Weak Flame / Goes Out',
    keywords: ['weak flame', 'flame out', 'yellow flame', 'goes out', 'short cycle'],
  },
  {
    id: 'noisy',
    label: 'Noisy / Thumping',
    keywords: ['noisy', 'squeal', 'thump', 'grinding', 'rattling'],
  },
  {
    id: 'error_code',
    label: 'Error Code on Display',
    keywords: ['error', 'fault', 'code'],
  },
];
