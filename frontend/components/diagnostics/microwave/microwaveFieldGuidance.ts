import type { FieldRecommendationRule } from '../routing/types';

export const microwaveFieldHelp: Record<string, string> = {
  'commonly_missed.door_switch':
    'Most no-heat and no-start calls are door switch or monitor switch failures.',
  'commonly_missed.misuse':
    'Metal, foil, or damaged waveguide cover causes arcing — rule out before HV parts.',
  'commonly_missed.ventilation':
    'Over-range models — grease filter and fan duct affect cooktop lighting and vent.',
  'visual_inspection.waveguide_condition':
    'Burned or missing stirrer cover is a common sparking source.',
  'functional_checks.heats_properly':
    'Water test: 1 cup should reach boil in ~2–3 minutes on high (varies by wattage).',
  'door_safety.primary_door_switch':
    'Test continuity with door latched — open switch = no start or no heat.',
  'door_safety.monitor_switch':
    'Monitor switch must open when primary closes — mis-adjustment is a safety hazard.',
  'electrical_hv.magnetron_ohms':
    'Discharge HV capacitor first. Open filament or case ground = replace magnetron.',
  'electrical_hv.hv_notes':
    'Capacitor holds lethal charge — discharge before any HV component test.',
  'diagnosis.root_cause':
    'Confirm door switches and fuse before magnetron — document water test result.',
};

export const microwaveRecommendations: FieldRecommendationRule[] = [
  {
    id: 'no_heat_path',
    when: [{ type: 'chip', id: 'no_heat' }],
    message: 'No heat — door switches, fuse, then magnetron/diode/cap (discharge cap first).',
    tone: 'action',
  },
  {
    id: 'heats_no',
    field: 'functional_checks.heats_properly',
    when: [{ type: 'field', path: 'functional_checks.heats_properly', equals: 'no' }],
    message: 'Failed water test — check HV circuit and door interlock switches.',
    tone: 'tip',
  },
  {
    id: 'sparking',
    when: [{ type: 'chip', id: 'sparking' }],
    message: 'Arcing — inspect waveguide cover, cavity paint, and remove metal/debris.',
    tone: 'action',
  },
  {
    id: 'no_power',
    when: [{ type: 'chip', id: 'no_power' }],
    message: 'Dead unit — check outlet, line fuse, and thermal cutout before board.',
    tone: 'action',
  },
  {
    id: 'door_issue',
    when: [{ type: 'chip', id: 'door_issue' }],
    message: 'Door problem — test primary and monitor switches; check latch hooks.',
    tone: 'action',
  },
  {
    id: 'turntable',
    when: [{ type: 'chip', id: 'turntable' }],
    message: 'Turntable — check support ring, coupler, and turntable motor.',
    tone: 'tip',
  },
];
