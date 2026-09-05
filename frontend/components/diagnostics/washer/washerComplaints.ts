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
    keywords: ['vibrat', 'walking', 'shaking', 'out of balance', 'off balance', 'f0e5', 'ob', 'ue'],
  },
  {
    id: 'lid_lock',
    label: 'Door / Lid Lock Issue',
    keywords: ['lid lock', 'door lock', 'won\'t unlock', 'f dl', 'dl code', 'locked', 'f5e1', 'f5e2', 'f5e3', 'f5e4', 'dr'],
  },
  {
    id: 'error_code',
    label: 'Error Code on Display',
    keywords: [
      'error', 'fault', 'code', 'f1', 'e1', 'oe', 'ue', 'f0e2', 'sd', 'oversuds',
      'f8e1', 'lo fl', 'f9e1', 'fce0', 'f3e1', 'f4e1', 'f4e2', 'f7e9', 'f6e1',
      'f20', 'f21', 'f22', 'f23', 'f24', 'f25', 'f26', 'f27', 'f28', 'f29', 'f30', 'f31',
      'f06', 'f01', 'rl',
      'ac7', 'dc4', '4c2', 'ac6', 'tc4', 'sf',
    ],
  },
  {
    id: 'flexwash_upper',
    label: 'Upper FlexWash Compartment',
    keywords: ['upper washer', 'top washer', 'flexwash upper', 'small load', 'dc4', 'upper door', 'upper compartment'],
  },
  {
    id: 'flexwash',
    label: 'Samsung FlexWash / Dual Load',
    keywords: ['flexwash', 'flex wash', 'dual load', 'ac7', 'wv55', 'two washers', 'lower washer'],
  },
];
