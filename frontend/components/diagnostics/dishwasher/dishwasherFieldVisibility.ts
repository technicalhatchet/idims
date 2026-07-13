import type { FieldVisibilityRule } from '../routing/types';

export const dishwasherFieldVisibilityRules: FieldVisibilityRule[] = [
  {
    id: 'spray_arms',
    field: 'visual_inspection.spray_arms_clear',
    showWhen: [{ type: 'chip', id: 'not_cleaning' }],
  },
  {
    id: 'filter_condition',
    field: 'visual_inspection.filter_condition',
    showWhen: [{ type: 'chip', id: 'not_cleaning' }],
  },
  {
    id: 'drain_path',
    field: 'visual_inspection.drain_path_clear',
    showWhen: [{ type: 'chip', id: 'wont_drain' }],
  },
  {
    id: 'leak_present',
    field: 'visual_inspection.leak_present',
    showWhen: [{ type: 'chip', id: 'leaking' }],
  },
  {
    id: 'door_gasket',
    field: 'visual_inspection.door_gasket',
    showWhen: [{ type: 'chip', id: 'leaking' }],
  },
  {
    id: 'fill_operation',
    field: 'functional_checks.fill_operation',
    showWhen: [{ type: 'chip', id: 'no_fill' }, { type: 'chip', id: 'not_cleaning' }],
  },
  {
    id: 'wash_operation',
    field: 'functional_checks.wash_operation',
    showWhen: [{ type: 'chip', id: 'not_cleaning' }],
  },
  {
    id: 'drain_operation',
    field: 'functional_checks.drain_operation',
    showWhen: [{ type: 'chip', id: 'wont_drain' }],
  },
  {
    id: 'drying_operation',
    field: 'functional_checks.drying_operation',
    showWhen: [{ type: 'chip', id: 'no_heat_dry' }],
  },
  {
    id: 'heater_ohms',
    field: 'heat_water.heater_ohms',
    showWhen: [{ type: 'chip', id: 'no_heat_dry' }],
  },
  {
    id: 'heater_amps',
    field: 'heat_water.heater_amps',
    showWhen: [{ type: 'chip', id: 'no_heat_dry' }],
  },
  {
    id: 'incoming_water_temp',
    field: 'heat_water.incoming_water_temp',
    showWhen: [{ type: 'chip', id: 'no_heat_dry' }, { type: 'chip', id: 'not_cleaning' }],
  },
  {
    id: 'drain_motor',
    field: 'motor_electrical.drain_motor_ohms',
    showWhen: [{ type: 'chip', id: 'wont_drain' }],
  },
  {
    id: 'inlet_valve',
    field: 'motor_electrical.inlet_valve_ohms',
    showWhen: [{ type: 'chip', id: 'no_fill' }, { type: 'chip', id: 'leaking' }],
  },
  {
    id: 'float_switch',
    field: 'motor_electrical.float_switch',
    showWhen: [{ type: 'chip', id: 'leaking' }, { type: 'chip', id: 'no_fill' }],
  },
];
