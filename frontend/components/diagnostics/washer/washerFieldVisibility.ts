import type { FieldVisibilityRule } from '../routing/types';

export const washerFieldVisibilityRules: FieldVisibilityRule[] = [
  {
    id: 'leak_visual',
    field: 'visual_inspection.leak_present',
    showWhen: [{ type: 'chip', id: 'leaking' }],
  },
  {
    id: 'door_boot',
    field: 'visual_inspection.door_boot',
    showWhen: [{ type: 'chip', id: 'leaking' }, { type: 'chip', id: 'lid_lock' }],
  },
  {
    id: 'drive_belt',
    field: 'visual_inspection.drive_belt',
    showWhen: [
      { type: 'chip', id: 'wont_spin' },
      { type: 'chip', id: 'wont_agitate' },
      { type: 'chip', id: 'noisy' },
    ],
  },
  {
    id: 'fill_operation',
    field: 'functional_checks.fill_operation',
    showWhen: [{ type: 'chip', id: 'no_fill' }],
  },
  {
    id: 'agitation',
    field: 'functional_checks.agitation',
    showWhen: [{ type: 'chip', id: 'wont_agitate' }],
  },
  {
    id: 'spin_operation',
    field: 'functional_checks.spin_operation',
    showWhen: [{ type: 'chip', id: 'wont_spin' }],
  },
  {
    id: 'drain_operation',
    field: 'functional_checks.drain_operation',
    showWhen: [{ type: 'chip', id: 'wont_drain' }],
  },
  {
    id: 'lid_lock',
    field: 'functional_checks.lid_lock_operation',
    showWhen: [{ type: 'chip', id: 'lid_lock' }],
  },
  {
    id: 'balance',
    field: 'functional_checks.balance',
    showWhen: [{ type: 'chip', id: 'vibration' }, { type: 'chip', id: 'noisy' }],
  },
  {
    id: 'drain_pump_electrical',
    field: 'electrical_measurements.drain_pump_ohms',
    showWhen: [{ type: 'chip', id: 'wont_drain' }],
  },
  {
    id: 'inlet_valve',
    field: 'electrical_measurements.inlet_valve_ohms',
    showWhen: [{ type: 'chip', id: 'no_fill' }, { type: 'chip', id: 'leaking' }],
  },
  {
    id: 'shift_actuator',
    field: 'mechanical_controls.shift_actuator',
    showWhen: [{ type: 'chip', id: 'wont_spin' }, { type: 'chip', id: 'wont_agitate' }],
  },
  {
    id: 'pressure_switch',
    field: 'mechanical_controls.pressure_switch',
    showWhen: [
      { type: 'chip', id: 'wont_drain' },
      { type: 'chip', id: 'no_fill' },
      { type: 'chip', id: 'wont_spin' },
    ],
  },
  {
    id: 'door_lock_ohms',
    field: 'mechanical_controls.door_lock_ohms',
    showWhen: [{ type: 'chip', id: 'lid_lock' }],
  },
];
