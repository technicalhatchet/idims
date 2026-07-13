import type { FieldVisibilityRule } from '../routing/types';

export const gasDryerFieldVisibilityRules: FieldVisibilityRule[] = [
  {
    id: 'igniter_visual',
    field: 'visual_inspection.igniter_condition',
    showWhen: [{ type: 'chip', id: 'no_heat' }, { type: 'chip', id: 'weak_flame' }],
  },
  {
    id: 'gas_valve_visual',
    field: 'visual_inspection.gas_valve',
    showWhen: [{ type: 'chip', id: 'gas_smell' }, { type: 'chip', id: 'no_heat' }],
  },
  {
    id: 'ignition_functional',
    field: 'functional_checks.ignition',
    showWhen: [{ type: 'chip', id: 'no_heat' }, { type: 'chip', id: 'weak_flame' }],
  },
  {
    id: 'flame_quality',
    field: 'functional_checks.flame_quality',
    showWhen: [{ type: 'chip', id: 'no_heat' }, { type: 'chip', id: 'weak_flame' }],
  },
  {
    id: 'airflow_functional',
    field: 'functional_checks.airflow',
    showWhen: [{ type: 'chip', id: 'not_drying' }],
  },
  {
    id: 'drum_turning',
    field: 'functional_checks.drum_turning',
    showWhen: [
      { type: 'chip', id: 'no_spin' },
      { type: 'chip', id: 'wont_stop_spinning' },
    ],
  },
];
