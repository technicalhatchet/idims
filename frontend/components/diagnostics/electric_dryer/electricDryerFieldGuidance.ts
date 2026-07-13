import type { FieldRecommendationRule } from '../routing/types';

export const electricDryerFieldHelp: Record<string, string> = {
  'commonly_missed.vent_restriction':
    'Restricted vent is the #1 “not drying” cause — check run length and exterior hood.',
  'commonly_missed.lint_trap':
    'Built-up lint screen housing blocks airflow and trips hi-limits.',
  'visual_inspection.vent_condition':
    'Crushed flex, bird nests, and long runs mimic heater failures.',
  'visual_inspection.lint_accumulation':
    'Lint inside cabinet or around element can cause overheating and odor.',
  'functional_checks.heating':
    'Confirm element energizes — no heat with good airflow points to heat circuit.',
  'functional_checks.airflow':
    'Strong airflow at exterior vent hood — weak flow = vent or blower issue.',
  'heat_circuit.heater_ohms':
    'Open element = no heat. Typical 8–30Ω depending on model.',
  'heat_circuit.thermal_fuse':
    'Open fuse from vent restriction — always fix airflow before replacing.',
  'motor_electrical.motor_amps':
    'High amps can indicate seized drum or bad bearing.',
  'diagnosis.root_cause':
    'Document vent airflow, element ohms, and fuse continuity before quoting board.',
};

export const electricDryerRecommendations: FieldRecommendationRule[] = [
  {
    id: 'not_drying_vent',
    when: [{ type: 'chip', id: 'not_drying' }],
    message: 'Long dry times — verify vent restriction and exterior airflow first.',
    tone: 'action',
  },
  {
    id: 'no_heat_path',
    field: 'functional_checks.heating',
    when: [{ type: 'chip', id: 'no_heat' }],
    message: 'No heat — check element, thermal fuse, and cycling thermostat.',
    tone: 'action',
  },
  {
    id: 'heating_no',
    field: 'functional_checks.heating',
    when: [{ type: 'field', path: 'functional_checks.heating', equals: 'no' }],
    message: 'No heat confirmed — measure element ohms and thermal fuse before board.',
    tone: 'tip',
  },
  {
    id: 'lint_excessive',
    field: 'visual_inspection.lint_accumulation',
    when: [{ type: 'field', path: 'visual_inspection.lint_accumulation', equals: 'excessive' }],
    message: 'Heavy lint — clean housing and vent path; check for restricted exhaust.',
    tone: 'action',
  },
  {
    id: 'wont_stop_spinning',
    when: [{ type: 'chip', id: 'wont_stop_spinning' }],
    message: 'Continuous spin — check door switch, timer/control, and motor relay.',
    tone: 'tip',
  },
];
