import type { ComplaintChipDefinition } from '../routing/types';

export const REFRIGERATOR_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'frost_buildup',
    label: 'Frost / Ice Buildup',
    keywords: ['frost', 'ice buildup', 'icing', 'heavy frost', 'evaporator frosted'],
  },
  {
    id: 'not_cooling',
    label: 'Not Cooling',
    keywords: ['not cooling', 'completely warm', 'both warm', 'not cold', 'temperature rising', 'dead warm'],
  },
  {
    id: 'weak_cooling_ff',
    label: 'Weak Cooling (Fresh Food)',
    keywords: [
      'weak cooling',
      'not cold enough',
      'running warm',
      'fresh food warm',
      'fridge warm',
      'refrigerator warm',
      'ff warm',
      'dairy spoiling',
      'soft food',
      'fridge section warm',
    ],
  },
  {
    id: 'weak_cooling_fz',
    label: 'Weak Cooling (Freezer)',
    keywords: [
      'freezer warm',
      'fz warm',
      'freezer not freezing',
      'not freezing',
      'soft ice',
      'ice melting',
      'freezer soft',
      'freezer section warm',
    ],
  },
  {
    id: 'weak_cooling',
    label: 'Weak Cooling (General)',
    keywords: ['weak cool', 'cooling poorly', 'not keeping cold', 'losing temperature'],
  },
  {
    id: 'ice_maker',
    label: 'Ice Maker Issue',
    keywords: ['ice maker', 'no ice', 'not making ice', 'ice dispenser'],
  },
  {
    id: 'water_dispenser',
    label: "Won't Dispense Water",
    keywords: ['water dispenser', 'no water', "won't dispense", 'dispenser', 'water slow'],
  },
  {
    id: 'noisy',
    label: 'Noisy / Vibrating',
    keywords: ['noisy', 'loud', 'vibrat', 'buzzing', 'grinding'],
  },
  {
    id: 'leaking',
    label: 'Leaking Water',
    keywords: ['leak', 'leaking', 'water on floor', 'puddle'],
  },
];
