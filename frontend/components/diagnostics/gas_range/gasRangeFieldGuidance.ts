import type { FieldRecommendationRule } from '../routing/types';

export const gasRangeFieldHelp: Record<string, string> = {
  'commonly_missed.gas_supply':
    'Confirm shutoff open, flex line intact, and no kinks before ignition tests.',
  'commonly_missed.lp_orifices':
    'LP conversion requires correct orifices and regulator setting.',
  'commonly_missed.gas_odor':
    'Use leak solution at fittings — never flame-test for leaks.',
  'visual_inspection.igniter_condition':
    'Cracks or breaks in the igniter cause low amp draw and no valve open.',
  'functional_checks.oven_bake_ignition':
    'Igniter should glow ~3.2A before valve opens on most systems.',
  'electrical_at_board.igniter_amps':
    'Below spec amps = weak glow; valve may never open.',
  'electrical_at_board.gas_valve_coil_ohms':
    'Open coil = no gas. Compare both coils to spec.',
  'gas_flame_readings.oven_flame_quality':
    'Soft blue base with defined inner cone — yellow tips suggest air shutter or LP issue.',
  'gas_flame_readings.manifold_pressure':
    'Measure per manufacturer — typically 5" WC natural, 10" WC LP.',
  'diagnosis.root_cause':
    'Document igniter amps, valve ohms, and flame quality before replacing board.',
};

export const gasRangeRecommendations: FieldRecommendationRule[] = [
  {
    id: 'gas_smell_safety',
    when: [{ type: 'chip', id: 'gas_smell' }],
    message: 'Gas odor — leak-check fittings and shutoff before electrical ignition tests.',
    tone: 'action',
  },
  {
    id: 'no_ignition_path',
    field: 'functional_checks.oven_bake_ignition',
    when: [{ type: 'chip', id: 'no_ignition' }],
    message: 'No ignition — verify igniter amps, valve coils, and flame sensor.',
    tone: 'action',
  },
  {
    id: 'ignition_bad',
    field: 'functional_checks.oven_bake_ignition',
    when: [{ type: 'field', path: 'functional_checks.oven_bake_ignition', equals: 'bad' }],
    message: 'Bake ignition failed — measure igniter draw and valve voltage at board.',
    tone: 'tip',
  },
  {
    id: 'weak_flame_lp',
    when: [{ type: 'chip', id: 'weak_flame' }],
    message: 'Weak/yellow flame — check LP orifice, regulator, and air shutter adjustment.',
    tone: 'action',
  },
  {
    id: 'error_code_board',
    when: [{ type: 'chip', id: 'error_code' }],
    message: 'Error code — note exact code; verify igniter, valve, and lock circuits.',
    tone: 'tip',
  },
];
