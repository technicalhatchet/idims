import type { FieldRecommendationRule } from '../routing/types';

export const gasDryerFieldHelp: Record<string, string> = {
  'commonly_missed.vent_restriction':
    'Poor vent airflow extends dry time and can cause flame rollout or hi-limit trips.',
  'commonly_missed.gas_supply':
    'Confirm shutoff open and flex line intact before ignition tests.',
  'commonly_missed.lp_orifices':
    'Wrong LP orifice causes weak flame and long dry times.',
  'visual_inspection.igniter_condition':
    'Cracked igniter = low amps; valve may never open.',
  'functional_checks.ignition':
    'Igniter should draw ~3.2A before gas valve opens on most dryers.',
  'functional_checks.flame_quality':
    'Flame should stay lit through entire heat cycle — short cycles = sensor or vent.',
  'gas_ignition.igniter_amps':
    'Below-spec amps = weak glow; check igniter and wiring.',
  'gas_ignition.flame_sensor':
    'Dirty or open flame sensor causes burner to shut off quickly.',
  'motor_electrical.thermal_fuse':
    'Open fuse often from vent restriction — fix airflow first.',
  'diagnosis.root_cause':
    'Document igniter amps, flame sensor, and vent airflow before replacing valve or board.',
};

export const gasDryerRecommendations: FieldRecommendationRule[] = [
  {
    id: 'gas_smell_safety',
    when: [{ type: 'chip', id: 'gas_smell' }],
    message: 'Gas odor — leak-check fittings and shutoff before ignition tests.',
    tone: 'action',
  },
  {
    id: 'not_drying_vent',
    when: [{ type: 'chip', id: 'not_drying' }],
    message: 'Long dry times — verify vent restriction and exterior airflow first.',
    tone: 'action',
  },
  {
    id: 'no_heat_ignition',
    field: 'functional_checks.ignition',
    when: [{ type: 'chip', id: 'no_heat' }],
    message: 'No heat — check igniter amps, valve coils, and flame sensor.',
    tone: 'action',
  },
  {
    id: 'ignition_no',
    field: 'functional_checks.ignition',
    when: [{ type: 'field', path: 'functional_checks.ignition', equals: 'no' }],
    message: 'No ignition — measure igniter draw and valve resistance.',
    tone: 'tip',
  },
  {
    id: 'weak_flame',
    when: [{ type: 'chip', id: 'weak_flame' }],
    message: 'Weak or dropping flame — check LP orifice, vent airflow, and flame sensor.',
    tone: 'action',
  },
  {
    id: 'wont_stop_spinning',
    when: [{ type: 'chip', id: 'wont_stop_spinning' }],
    message: 'Continuous spin — check door switch, moisture sensor, and control relay.',
    tone: 'tip',
  },
];
