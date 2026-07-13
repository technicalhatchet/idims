import type { FieldVisibilityRule } from '../routing/types';

/**
 * Refrigerator conditional fields — yn/tri/chip triggers only (no measured values).
 * Core checks (doors, compressor, fans) stay visible when their step is enabled.
 */
export const refrigeratorFieldVisibilityRules: FieldVisibilityRule[] = [
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
