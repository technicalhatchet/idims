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
];
