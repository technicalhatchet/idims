import type { ComplaintChipDefinition } from '../routing/types';

export const ELECTRIC_DRYER_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'no_heat',
    label: 'No Heat',
    keywords: ['no heat', 'not heating', 'cold', 'air cold', 'no warmth', 'f4e1', 'f2e1', 'heater relay'],
  },
  {
    id: 'not_drying',
    label: 'Takes Too Long / Damp Clothes',
    keywords: [
      'not drying',
      'damp',
      'wet clothes',
      'too long',
      'hours to dry',
      'f4e3',
      'restricted air flow',
      'restricted airflow',
      'af',
      'f3e6',
      'f3e7',
    ],
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
    id: 'noisy',
    label: 'Noisy / Thumping',
    keywords: ['noisy', 'squeal', 'thump', 'grinding', 'rattling'],
  },
  {
    id: 'no_power',
    label: "Dead / Won't Start",
    keywords: ['no power', 'dead', 'won\'t start', 'tripped breaker', 'no lights', 'f4e4', 'l2', 'power failure', 'f6e2'],
  },
  {
    id: 'heats_when_shouldnt',
    label: 'Heats on AIR / No-Heat Cycle',
    keywords: [
      'heats on air',
      'heats when it shouldnt',
      'heats on fluff',
      'heats on no heat',
      'won\'t stop heating',
      'stuck heat',
      'f4e1',
    ],
  },
  {
    id: 'error_code',
    label: 'Error Code on Display',
    keywords: ['error', 'fault', 'code', 'f01', 'e1'],
  },
];
