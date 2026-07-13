import type { ComplaintChipDefinition } from '../routing/types';

export const REFRIGERATOR_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'frost_buildup',
    label: 'Frost / Ice Buildup',
    keywords: ['frost', 'ice buildup', 'icing', 'freezer warm', 'heavy frost'],
  },
  {
    id: 'not_cooling',
    label: 'Not Cooling',
    keywords: ['not cooling', 'warm', 'too warm', 'not cold', 'temperature rising'],
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
