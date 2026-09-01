import type { ComplaintChipDefinition } from '../routing/types';

export const DISHWASHER_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'not_cleaning',
    label: 'Not Cleaning / Dirty Dishes',
    keywords: ['not cleaning', 'dirty dishes', 'poor wash', 'cloudy', 'film', 'spots'],
  },
  {
    id: 'wont_drain',
    label: "Won't Drain",
    keywords: ['won\'t drain', 'not draining', 'standing water', 'drain', 'water in bottom'],
  },
  {
    id: 'leaking',
    label: 'Leaking Water',
    keywords: ['leak', 'leaking', 'water on floor', 'puddle', 'dripping'],
  },
  {
    id: 'no_fill',
    label: "Won't Fill",
    keywords: ['won\'t fill', 'no water', 'no fill', 'float'],
  },
  {
    id: 'no_heat_dry',
    label: 'Not Drying / No Heat',
    keywords: ['not drying', 'wet dishes', 'no heat', 'cold', 'plastic still wet'],
  },
  {
    id: 'noisy',
    label: 'Noisy / Grinding',
    keywords: ['noisy', 'grinding', 'humming', 'loud', 'rattling'],
  },
  {
    id: 'wont_start',
    label: "Dead / Won't Start",
    keywords: ['won\'t start', 'no power', 'dead', 'no lights', 'tripped breaker'],
  },
  {
    id: 'error_code',
    label: 'Error Code on Display',
    keywords: ['error', 'fault', 'code', 'i30', 'oe', 'le', 'f3e2', 'f8e1', 'f9e1', 'f10e5', 'f7e4', 'vario', 'e8', 'ae', 'be', 'ed', 'fae'],
  },
];
