import type { FieldVisibilityRule } from '../routing/types';

export const gasRangeFieldVisibilityRules: FieldVisibilityRule[] = [
  {
    id: 'igniter_visual',
    field: 'visual_inspection.igniter_condition',
    showWhen: [
      { type: 'chip', id: 'no_ignition' },
      { type: 'chip', id: 'no_oven_heat' },
    ],
  },
  {
    id: 'oven_bake_ignition',
    field: 'functional_checks.oven_bake_ignition',
    showWhen: [
      { type: 'chip', id: 'no_oven_heat' },
      { type: 'chip', id: 'no_ignition' },
    ],
  },
  {
    id: 'oven_broil_ignition',
    field: 'functional_checks.oven_broil_ignition',
    showWhen: [{ type: 'chip', id: 'no_oven_heat' }],
  },
  {
    id: 'surface_ignition',
    field: 'functional_checks.surface_burner_ignition',
    showWhen: [{ type: 'chip', id: 'surface_burners' }],
  },
  {
    id: 'oven_flame',
    field: 'gas_flame_readings.oven_flame_quality',
    showWhen: [
      { type: 'chip', id: 'weak_flame' },
      { type: 'chip', id: 'no_ignition' },
      { type: 'chip', id: 'no_oven_heat' },
    ],
  },
  {
    id: 'surface_flame',
    field: 'gas_flame_readings.surface_flame_quality',
    showWhen: [
      { type: 'chip', id: 'surface_burners' },
      { type: 'chip', id: 'weak_flame' },
    ],
  },
  {
    id: 'door_lock',
    field: 'functional_checks.door_lock_operation',
    showWhen: [{ type: 'chip', id: 'self_clean' }],
  },
];
