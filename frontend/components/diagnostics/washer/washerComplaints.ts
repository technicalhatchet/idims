import type { ComplaintChipDefinition } from '../routing/types';

export const WASHER_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'leaking',
    label: 'Leaking Water',
    keywords: ['leak', 'leaking', 'water on floor', 'puddle', 'dripping'],
  },
  {
    id: 'wont_drain',
    label: "Won't Drain",
    keywords: ['won\'t drain', 'not draining', 'standing water', 'drain', 'nd code'],
  },
  {
    id: 'wont_spin',
    label: "Won't Spin / Clothes Wet",
    keywords: ['won\'t spin', 'not spinning', 'clothes wet', 'no spin', 'stuck on spin'],
  },
  {
    id: 'wont_agitate',
    label: "Won't Agitate / Wash",
    keywords: ['won\'t agitate', 'not agitating', 'won\'t wash', 'no agitation'],
  },
  {
    id: 'no_fill',
    label: "Won't Fill / Slow Fill",
    keywords: ['won\'t fill', 'no water', 'slow fill', 'lf code', 'fill'],
  },
  {
    id: 'noisy',
    label: 'Noisy / Banging',
    keywords: ['noisy', 'banging', 'grinding', 'squeal', 'clunk'],
  },
  {
    id: 'vibration',
    label: 'Walking / Vibration',
    keywords: ['vibrat', 'walking', 'shaking', 'out of balance', 'off balance'],
  },
  {
    id: 'lid_lock',
    label: 'Door / Lid Lock Issue',
    keywords: ['lid lock', 'door lock', 'won\'t unlock', 'f dl', 'dl code', 'locked'],
  },
  {
    id: 'error_code',
    label: 'Error Code on Display',
    keywords: ['error', 'fault', 'code', 'f1', 'e1', 'oe', 'ue'],
  },
];
