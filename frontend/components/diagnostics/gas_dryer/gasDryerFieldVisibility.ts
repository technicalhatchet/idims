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
    showWhen: [
      { type: 'chip', id: 'no_heat' },
      { type: 'chip', id: 'weak_flame' },
      { type: 'chip', id: 'heats_when_shouldnt' },
    ],
  },
  {
    id: 'heats_on_air_cycle',
    field: 'functional_checks.heats_on_air_cycle',
    showWhen: [{ type: 'chip', id: 'heats_when_shouldnt' }],
  },
  {
    id: 'airflow_functional',
    field: 'functional_checks.airflow',
    showWhen: [{ type: 'chip', id: 'not_drying' }],
  },
  {
    id: 'moisture_sensor',
    field: 'functional_checks.moisture_sensor',
    showWhen: [
      { type: 'chip', id: 'not_drying' },
      { type: 'chip', id: 'wont_stop_spinning' },
      { type: 'chip', id: 'error_code' },
    ],
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
    id: 'door_switch',
    field: 'functional_checks.door_switch',
    showWhen: [
      { type: 'chip', id: 'no_spin' },
      { type: 'chip', id: 'wont_stop_spinning' },
    ],
  },
  {
    id: 'door_latched',
    field: 'functional_checks.door_latched',
    showWhen: [{ type: 'chip', id: 'no_spin' }],
  },
  {
    id: 'blower_operation',
    field: 'functional_checks.blower_operation',
    showWhen: [
      { type: 'chip', id: 'no_heat' },
      { type: 'chip', id: 'not_drying' },
      { type: 'chip', id: 'weak_flame' },
    ],
  },
  {
    id: 'flame_sensor_continuity',
    field: 'gas_ignition.flame_sensor_continuity',
    showWhen: [{ type: 'chip', id: 'no_heat' }, { type: 'chip', id: 'weak_flame' }],
  },
  {
    id: 'belt_switch',
    field: 'motor_electrical.belt_switch',
    showWhen: [{ type: 'chip', id: 'no_spin' }],
  },
  {
    id: 'motor_circuit_ohms',
    field: 'motor_electrical.motor_circuit_ohms',
    showWhen: [{ type: 'chip', id: 'no_spin' }],
  },
  {
    id: 'outlet_thermistor',
    field: 'motor_electrical.outlet_thermistor_kohm',
    showWhen: [{ type: 'chip', id: 'not_drying' }, { type: 'chip', id: 'error_code' }],
  },
  {
    id: 'inlet_thermistor',
    field: 'motor_electrical.inlet_thermistor_kohm',
    showWhen: [{ type: 'chip', id: 'not_drying' }, { type: 'chip', id: 'error_code' }],
  },
];
