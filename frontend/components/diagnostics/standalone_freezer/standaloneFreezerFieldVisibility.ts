import type { FieldVisibilityRule } from '../routing/types';

export const standaloneFreezerFieldVisibilityRules: FieldVisibilityRule[] = [
  {
    id: 'frost_pattern',
    field: 'visual_inspection.frost_pattern',
    showWhen: [{ type: 'chip', id: 'frost_buildup' }, { type: 'chip', id: 'not_cooling' }],
  },
  {
    id: 'defrost_operational',
    field: 'functional_checks.defrost_operational',
    showWhen: [
      { type: 'chip', id: 'frost_buildup' },
      { type: 'field', path: 'visual_inspection.drain_clear', equals: 'no' },
    ],
  },
  {
    id: 'defrost_heater',
    field: 'defrost_circuit.defrost_heater_ohms',
    showWhen: [{ type: 'chip', id: 'frost_buildup' }],
  },
  {
    id: 'defrost_thermostat',
    field: 'defrost_circuit.defrost_thermostat',
    showWhen: [{ type: 'chip', id: 'frost_buildup' }],
  },
  {
    id: 'compressor_amps',
    field: 'compressor_sealed_system.compressor_amps_running',
    showWhen: [
      { type: 'chip', id: 'not_cooling' },
      { type: 'chip', id: 'running_constant' },
      { type: 'field', path: 'functional_checks.compressor_running', equals: 'no' },
    ],
  },
  {
    id: 'compressor_windings',
    field: 'compressor_sealed_system.run_winding_ohms',
    showWhen: [
      { type: 'chip', id: 'not_cooling' },
      { type: 'field', path: 'functional_checks.compressor_running', equals: 'no' },
    ],
  },
  {
    id: 'start_winding',
    field: 'compressor_sealed_system.start_winding_ohms',
    showWhen: [{ type: 'field', path: 'functional_checks.compressor_running', equals: 'no' }],
  },
  {
    id: 'sealed_system_notes',
    field: 'compressor_sealed_system.sealed_system_notes',
    showWhen: [{ type: 'chip', id: 'not_cooling' }, { type: 'chip', id: 'running_constant' }],
  },
  {
    id: 'noisy_noise_location',
    field: 'visual_inspection.noise_location',
    showWhen: [{ type: 'chip', id: 'noisy' }],
  },
  {
    id: 'noisy_condenser_fan_blade',
    field: 'visual_inspection.condenser_fan_blade',
    showWhen: [{ type: 'chip', id: 'noisy' }],
  },
  {
    id: 'noisy_condenser_fan_blade_fan_running',
    field: 'visual_inspection.condenser_fan_blade',
    showWhen: [{ type: 'field', path: 'functional_checks.condenser_fan_running', equals: 'yes' }],
  },
  {
    id: 'noisy_evaporator_fan_condition',
    field: 'visual_inspection.evaporator_fan_condition',
    showWhen: [{ type: 'chip', id: 'noisy' }],
  },
  {
    id: 'noisy_source_notes',
    field: 'visual_inspection.noise_source_notes',
    showWhen: [{ type: 'chip', id: 'noisy' }],
  },
  {
    id: 'noisy_condenser_fan_operation',
    field: 'functional_checks.condenser_fan_operation',
    showWhen: [{ type: 'chip', id: 'noisy' }],
  },
  {
    id: 'condenser_fan_operation_when_running',
    field: 'functional_checks.condenser_fan_operation',
    showWhen: [{ type: 'field', path: 'functional_checks.condenser_fan_running', equals: 'yes' }],
  },
];
