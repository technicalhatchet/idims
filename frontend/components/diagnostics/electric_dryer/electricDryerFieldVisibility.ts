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
    showWhen: [
      { type: 'chip', id: 'no_heat' },
      { type: 'chip', id: 'not_drying' },
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
      { type: 'chip', id: 'no_power' },
      { type: 'chip', id: 'no_spin' },
      { type: 'chip', id: 'wont_stop_spinning' },
    ],
  },
  {
    id: 'door_latched',
    field: 'functional_checks.door_latched',
    showWhen: [
      { type: 'chip', id: 'no_power' },
      { type: 'chip', id: 'no_spin' },
    ],
  },
  {
    id: 'blower_no_heat',
    field: 'functional_checks.blower_operation',
    showWhen: [{ type: 'chip', id: 'no_heat' }, { type: 'chip', id: 'not_drying' }],
  },
  {
    id: 'thermal_cutoff',
    field: 'heat_circuit.thermal_cutoff',
    showWhen: [{ type: 'chip', id: 'no_heat' }, { type: 'chip', id: 'heats_when_shouldnt' }],
  },
  {
    id: 'outlet_thermistor',
    field: 'heat_circuit.outlet_thermistor_kohm',
    showWhen: [{ type: 'chip', id: 'not_drying' }, { type: 'chip', id: 'error_code' }],
  },
  {
    id: 'inlet_thermistor',
    field: 'heat_circuit.inlet_thermistor_kohm',
    showWhen: [{ type: 'chip', id: 'not_drying' }, { type: 'chip', id: 'error_code' }],
  },
  {
    id: 'belt_switch',
    field: 'motor_electrical.belt_switch',
    showWhen: [{ type: 'chip', id: 'no_spin' }],
  },
  {
    id: 'motor_circuit_ohms',
    field: 'motor_electrical.motor_circuit_ohms',
    showWhen: [{ type: 'chip', id: 'no_spin' }, { type: 'chip', id: 'no_power' }],
  },
];
