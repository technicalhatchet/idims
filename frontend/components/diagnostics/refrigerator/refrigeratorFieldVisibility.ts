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
  {
    id: 'door_switch_not_cooling',
    field: 'functional_checks.door_switch',
    showWhen: [
      { type: 'chip', id: 'not_cooling' },
      { type: 'chip', id: 'door_alarm' },
      { type: 'chip', id: 'error_code' },
    ],
  },
  {
    id: 'fans_compressor_off_pattern',
    field: 'functional_checks.fans_on_compressor_off',
    showWhen: [
      { type: 'chip', id: 'not_cooling' },
      { type: 'chip', id: 'cooling_off' },
      { type: 'chip', id: 'weak_cooling' },
    ],
  },
  {
    id: 'display_panel_check',
    field: 'functional_checks.display_panel',
    showWhen: [
      { type: 'chip', id: 'display_dead' },
      { type: 'chip', id: 'error_code' },
    ],
  },
  {
    id: 'thermistor_voltage_error',
    field: 'fans_and_electrical.thermistor_voltage_v',
    showWhen: [{ type: 'chip', id: 'error_code' }, { type: 'platform', id: 'samsung_sxs' }],
  },
  {
    id: 'evap_fan_voltage_error',
    field: 'fans_and_electrical.evap_fan_feedback_voltage',
    showWhen: [
      { type: 'chip', id: 'error_code' },
      { type: 'chip', id: 'frost_buildup' },
      { type: 'chip', id: 'weak_cooling_ff' },
      { type: 'platform', id: 'samsung_sxs' },
    ],
  },
  {
    id: 'inverter_voltage_sealed',
    field: 'fans_and_electrical.inverter_ipm_voltage',
    showWhen: [
      { type: 'chip', id: 'not_cooling' },
      { type: 'chip', id: 'weak_cooling_fz' },
      { type: 'chip', id: 'error_code' },
      { type: 'platform', id: 'samsung_sxs' },
    ],
  },
  {
    id: 'lg_fan_voltage',
    field: 'fans_and_electrical.lg_fan_voltage',
    showWhen: [{ type: 'platform', id: 'lg_lrmvs' }],
  },
  {
    id: 'lg_defrost_heater_voltage',
    field: 'defrost_circuit.lg_defrost_heater_voltage',
    showWhen: [{ type: 'platform', id: 'lg_lrmvs' }],
  },
  {
    id: 'wrt_defrost_timer_platform',
    field: 'defrost_circuit.defrost_timer_test',
    showWhen: [{ type: 'platform', id: 'whirlpool_wrt_top_mount' }],
  },
  {
    id: 'wrt_defrost_timer_frost',
    field: 'defrost_circuit.defrost_timer_test',
    showWhen: [{ type: 'chip', id: 'frost_buildup' }],
  },
  {
    id: 'wrt_ptc_start_ohms',
    field: 'compressor_sealed_system.ptc_start_ohms',
    showWhen: [
      { type: 'platform', id: 'whirlpool_wrt_top_mount' },
      { type: 'chip', id: 'compressor_wont_start' },
    ],
  },
  {
    id: 'wrt_cold_control_not_off',
    field: 'commonly_missed.cold_control_not_off',
    showWhen: [
      { type: 'platform', id: 'whirlpool_wrt_top_mount' },
      { type: 'chip', id: 'not_cooling' },
    ],
  },
];
