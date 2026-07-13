import type { ComplaintChipDefinition } from '../routing/types';

export const ELECTRIC_RANGE_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'no_bake',
    label: 'No Bake / Oven Not Heating',
    keywords: ['no bake', "won't bake", 'oven not heating', 'not heating', 'bake not working'],
  },
  {
    id: 'no_broil',
    label: 'No Broil',
    keywords: ['no broil', 'broil not working', "won't broil", 'broiler'],
  },
  {
    id: 'surface_burners',
    label: 'Surface Burner Issue',
    keywords: ['burner', 'cooktop', 'surface element', 'coil', 'induction'],
  },
  {
    id: 'uneven_heat',
    label: 'Uneven / Wrong Temperature',
    keywords: ['uneven', 'too hot', 'too cold', 'temperature off', 'calibration', 'runs hot'],
  },
  {
    id: 'no_power',
    label: 'Dead / No Power',
    keywords: ['no power', 'dead', 'tripped breaker', 'no display', 'won\'t turn on'],
  },
  {
    id: 'error_code',
    label: 'Error Code on Display',
    keywords: ['error', 'f1', 'f2', 'f3', 'f9', 'fault code'],
  },
  {
    id: 'self_clean',
    label: 'Self-Clean / Door Lock',
    keywords: ['self clean', 'self-clean', 'door lock', 'locked door'],
  },
];
