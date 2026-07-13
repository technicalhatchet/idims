import type { FieldVisibilityRule } from '../routing/types';

export const electricDryerFieldVisibilityRules: FieldVisibilityRule[] = [
  {
    id: 'element_visual',
    field: 'visual_inspection.element_coils',
    showWhen: [{ type: 'chip', id: 'no_heat' }],
  },
  {
    id: 'heating_functional',
    field: 'functional_checks.heating',
    showWhen: [{ type: 'chip', id: 'no_heat' }, { type: 'chip', id: 'not_drying' }],
  },
  {
    id: 'airflow_functional',
    field: 'functional_checks.airflow',
    showWhen: [{ type: 'chip', id: 'not_drying' }],
  },
  {
    id: 'moisture_sensor',
    field: 'functional_checks.moisture_sensor',
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
  {
    id: 'blower_no_heat',
    field: 'functional_checks.blower_operation',
    showWhen: [{ type: 'chip', id: 'no_heat' }, { type: 'chip', id: 'not_drying' }],
  },
];
