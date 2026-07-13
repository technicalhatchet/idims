import type { FieldVisibilityRule } from '../routing/types';

export const aioLaundryFieldVisibilityRules: FieldVisibilityRule[] = [
  {
    id: 'wash_fill',
    field: 'wash_functions.fill',
    showWhen: [{ type: 'chip', id: 'washer_fill' }],
  },
  {
    id: 'wash_drain',
    field: 'wash_functions.drain',
    showWhen: [{ type: 'chip', id: 'washer_drain' }],
  },
  {
    id: 'wash_spin',
    field: 'wash_functions.spin',
    showWhen: [{ type: 'chip', id: 'washer_spin' }],
  },
  {
    id: 'wash_leak',
    field: 'wash_functions.washer_leak',
    showWhen: [{ type: 'chip', id: 'washer_leak' }],
  },
  {
    id: 'dry_drum',
    field: 'dry_functions.drum_turning',
    showWhen: [{ type: 'chip', id: 'dryer_no_tumble' }],
  },
  {
    id: 'dry_heat',
    field: 'dry_functions.heat_present',
    showWhen: [{ type: 'chip', id: 'dryer_no_heat' }, { type: 'chip', id: 'heat_pump_dry' }],
  },
  {
    id: 'dry_airflow',
    field: 'dry_functions.airflow',
    showWhen: [
      { type: 'chip', id: 'dryer_not_drying' },
      { type: 'chip', id: 'heat_pump_dry' },
      { type: 'chip', id: 'compressor' },
    ],
  },
  {
    id: 'condensate_drain',
    field: 'dry_functions.condensate_drain',
    showWhen: [{ type: 'chip', id: 'condensate' }, { type: 'chip', id: 'washer_drain' }],
  },
  {
    id: 'drain_pump_ohms',
    field: 'wash_electrical.drain_pump_ohms',
    showWhen: [{ type: 'chip', id: 'washer_drain' }, { type: 'chip', id: 'condensate' }],
  },
  {
    id: 'compressor_amps',
    field: 'heat_pump_readings.compressor_amps',
    showWhen: [{ type: 'chip', id: 'compressor' }, { type: 'chip', id: 'heat_pump_dry' }],
  },
  {
    id: 'compressor_ohms',
    field: 'heat_pump_readings.compressor_ohms',
    showWhen: [{ type: 'chip', id: 'compressor' }],
  },
  {
    id: 'heat_pump_fan',
    field: 'heat_pump_readings.heat_pump_fan_amps',
    showWhen: [{ type: 'chip', id: 'heat_pump_dry' }, { type: 'chip', id: 'compressor' }],
  },
];
