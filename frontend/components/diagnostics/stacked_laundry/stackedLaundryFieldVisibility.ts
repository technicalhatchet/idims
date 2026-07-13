import type { FieldVisibilityRule } from '../routing/types';

export const stackedLaundryFieldVisibilityRules: FieldVisibilityRule[] = [
  {
    id: 'washer_fill',
    field: 'washer_section.fill',
    showWhen: [{ type: 'chip', id: 'washer_fill' }],
  },
  {
    id: 'washer_drain_field',
    field: 'washer_section.drain',
    showWhen: [{ type: 'chip', id: 'washer_drain' }],
  },
  {
    id: 'washer_spin',
    field: 'washer_section.spin',
    showWhen: [{ type: 'chip', id: 'washer_spin' }],
  },
  {
    id: 'washer_leak_field',
    field: 'washer_section.washer_leak',
    showWhen: [{ type: 'chip', id: 'washer_leak' }],
  },
  {
    id: 'dryer_drum',
    field: 'dryer_section.drum_turning',
    showWhen: [{ type: 'chip', id: 'dryer_no_tumble' }],
  },
  {
    id: 'dryer_heat',
    field: 'dryer_section.heat_present',
    showWhen: [{ type: 'chip', id: 'dryer_no_heat' }],
  },
  {
    id: 'dryer_airflow',
    field: 'dryer_section.airflow',
    showWhen: [{ type: 'chip', id: 'dryer_not_drying' }, { type: 'chip', id: 'dryer_no_heat' }],
  },
  {
    id: 'washer_pump_ohms',
    field: 'washer_measurements.drain_pump_ohms',
    showWhen: [{ type: 'chip', id: 'washer_drain' }],
  },
  {
    id: 'dryer_heater',
    field: 'dryer_measurements.heater_ohms',
    showWhen: [{ type: 'chip', id: 'dryer_no_heat' }],
  },
];
