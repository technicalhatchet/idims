import type { ComplaintChipDefinition } from '../routing/types';

export const GAS_RANGE_COMPLAINT_CHIPS: ComplaintChipDefinition[] = [
  {
    id: 'no_oven_heat',
    label: 'Oven Not Heating',
    keywords: ['oven not heating', 'no heat', "won't heat", 'cold oven', 'not baking'],
  },
  {
    id: 'no_ignition',
    label: 'Won\'t Ignite / No Flame',
    keywords: ['won\'t ignite', 'no flame', 'clicks', 'glows no flame', 'igniter'],
  },
  {
    id: 'gas_smell',
    label: 'Gas Smell / Leak Concern',
    keywords: ['gas smell', 'odor', 'leak', 'mercaptan'],
  },
  {
    id: 'surface_burners',
    label: 'Surface Burner Issue',
    keywords: ['surface', 'cooktop', 'burner won\'t light', 'top burner'],
  },
  {
    id: 'weak_flame',
    label: 'Weak / Yellow Flame',
    keywords: ['yellow flame', 'weak flame', 'sooting', 'lp', 'orifice'],
  },
  {
    id: 'error_code',
    label: 'Error Code on Display',
    keywords: ['error', 'f1', 'f2', 'f3', 'fault code'],
  },
  {
    id: 'self_clean',
    label: 'Self-Clean / Door Lock',
    keywords: ['self clean', 'self-clean', 'door lock', 'locked door'],
  },
];
