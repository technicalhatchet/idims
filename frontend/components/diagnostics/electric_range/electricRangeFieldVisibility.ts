import type { FieldVisibilityRule } from '../routing/types';

export const electricRangeFieldVisibilityRules: FieldVisibilityRule[] = [
  {
    id: 'bake_element_visual',
    field: 'visual_inspection.bake_element_visible',
    showWhen: [{ type: 'chip', id: 'no_bake' }, { type: 'chip', id: 'uneven_heat' }],
  },
  {
    id: 'broil_element_visual',
    field: 'visual_inspection.broil_element_visible',
    showWhen: [{ type: 'chip', id: 'no_broil' }],
  },
  {
    id: 'surface_burners_functional',
    field: 'functional_checks.surface_burners',
    showWhen: [{ type: 'chip', id: 'surface_burners' }],
  },
  {
    id: 'bake_operation',
    field: 'functional_checks.bake_operation',
    showWhen: [
      { type: 'chip', id: 'no_bake' },
      { type: 'chip', id: 'uneven_heat' },
      { type: 'chip', id: 'no_power' },
    ],
  },
  {
    id: 'broil_operation',
    field: 'functional_checks.broil_operation',
    showWhen: [{ type: 'chip', id: 'no_broil' }],
  },
  {
    id: 'door_lock',
    field: 'functional_checks.door_lock_operation',
    showWhen: [{ type: 'chip', id: 'self_clean' }],
  },
];
