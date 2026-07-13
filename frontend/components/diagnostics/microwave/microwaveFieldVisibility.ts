import type { FieldVisibilityRule } from '../routing/types';

export const microwaveFieldVisibilityRules: FieldVisibilityRule[] = [
  {
    id: 'waveguide',
    field: 'visual_inspection.waveguide_condition',
    showWhen: [{ type: 'chip', id: 'sparking' }, { type: 'chip', id: 'no_heat' }],
  },
  {
    id: 'turntable_visual',
    field: 'visual_inspection.turntable_support',
    showWhen: [{ type: 'chip', id: 'turntable' }],
  },
  {
    id: 'door_visual',
    field: 'visual_inspection.door_condition',
    showWhen: [{ type: 'chip', id: 'door_issue' }],
  },
  {
    id: 'latch_visual',
    field: 'visual_inspection.latch_condition',
    showWhen: [{ type: 'chip', id: 'door_issue' }],
  },
  {
    id: 'heats_properly',
    field: 'functional_checks.heats_properly',
    showWhen: [{ type: 'chip', id: 'no_heat' }],
  },
  {
    id: 'turntable_functional',
    field: 'functional_checks.turntable_operation',
    showWhen: [{ type: 'chip', id: 'turntable' }],
  },
  {
    id: 'fan_operation',
    field: 'functional_checks.fan_operation',
    showWhen: [{ type: 'chip', id: 'noisy' }, { type: 'chip', id: 'vent_fan' }],
  },
  {
    id: 'cooktop_lights',
    field: 'functional_checks.cooktop_lights',
    showWhen: [{ type: 'chip', id: 'vent_fan' }],
  },
  {
    id: 'door_switches',
    field: 'door_safety.primary_door_switch',
    showWhen: [
      { type: 'chip', id: 'door_issue' },
      { type: 'chip', id: 'no_power' },
      { type: 'chip', id: 'no_heat' },
    ],
  },
  {
    id: 'monitor_switch',
    field: 'door_safety.monitor_switch',
    showWhen: [{ type: 'chip', id: 'door_issue' }, { type: 'chip', id: 'no_heat' }],
  },
  {
    id: 'fuse',
    field: 'door_safety.fuse_continuity',
    showWhen: [{ type: 'chip', id: 'no_power' }],
  },
  {
    id: 'magnetron',
    field: 'electrical_hv.magnetron_ohms',
    showWhen: [{ type: 'chip', id: 'no_heat' }],
  },
  {
    id: 'hv_diode',
    field: 'electrical_hv.hv_diode',
    showWhen: [{ type: 'chip', id: 'no_heat' }, { type: 'chip', id: 'sparking' }],
  },
  {
    id: 'capacitor',
    field: 'electrical_hv.capacitor_uf',
    showWhen: [{ type: 'chip', id: 'no_heat' }],
  },
];
