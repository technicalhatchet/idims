import type { ComplaintChipDefinition } from '../routing/types';

export const STANDALONE_FREEZER_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'frost_buildup',
    label: 'Frost / Ice Buildup',
    keywords: ['frost', 'ice buildup', 'icing', 'heavy frost', 'snow'],
  },
  {
    id: 'not_cooling',
    label: 'Not Cooling / Too Warm',
    keywords: ['not cooling', 'warm', 'too warm', 'not cold', 'thawing', 'soft'],
  },
  {
    id: 'too_cold',
    label: 'Too Cold / Over-freezing',
    keywords: ['too cold', 'over freeze', 'ice cream hard', 'thermostat'],
  },
  {
    id: 'noisy',
    label: 'Noisy / Vibrating',
    keywords: ['noisy', 'loud', 'vibrat', 'buzzing', 'grinding'],
  },
  {
    id: 'leaking',
    label: 'Leaking Water',
    keywords: ['leak', 'leaking', 'water on floor', 'puddle', 'defrost drain'],
  },
  {
    id: 'running_constant',
    label: 'Runs Constantly',
    keywords: ['runs all the time', 'never stops', 'constantly running', 'always on'],
  },
];
