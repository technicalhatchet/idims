import type { FieldVisibilityRule } from '../routing/types';

/**
 * Refrigerator conditional fields — yn/tri/chip triggers only (no measured values).
 * Core checks (doors, compressor, fans) stay visible when their step is enabled.
 */
export const refrigeratorFieldVisibilityRules: FieldVisibilityRule[] = [
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
  {
    id: 'frost_pattern_when_frost',
    field: 'visual_inspection.evaporator_frost_pattern',
    showWhen: [
      { type: 'field', path: 'visual_inspection.frost_present', equals: 'yes' },
      { type: 'chip', id: 'frost_buildup' },
    ],
  },
  {
    id: 'defrost_observed_when_frost',
    field: 'functional_checks.defrost_cycle_observed',
    showWhen: [
      { type: 'field', path: 'visual_inspection.frost_present', equals: 'yes' },
      { type: 'chip', id: 'frost_buildup' },
    ],
  },
  {
    id: 'ice_maker_visual',
    field: 'visual_inspection.ice_maker_visual',
    showWhen: [{ type: 'chip', id: 'ice_maker' }],
  },
  {
    id: 'ice_maker_functional',
    field: 'functional_checks.ice_maker_operation',
    showWhen: [{ type: 'chip', id: 'ice_maker' }],
  },
  {
    id: 'water_dispenser_functional',
    field: 'functional_checks.water_dispenser',
    showWhen: [{ type: 'chip', id: 'water_dispenser' }],
  },
];
