import type { FieldRecommendationRule } from '../routing/types';

export const washerFieldHelp: Record<string, string> = {
  'commonly_missed.drain_restrictions':
    'Standpipe height and clogs cause slow drain and ND codes — check before pump.',
  'commonly_missed.shipping_bolts':
    'New installs with bolts left in cause violent vibration and damage.',
  'commonly_missed.inlet_screens':
    'Clogged hose screens mimic slow-fill and inlet valve failures.',
  'commonly_missed.level':
    'Out-of-level units walk and stress suspension on spin.',
  'visual_inspection.leak_present':
    'Trace source: door boot, pump, tub seal, inlet hoses, or dispenser.',
  'visual_inspection.tub_movement':
    'Excessive play suggests worn tub bearing or broken suspension.',
  'functional_checks.drain_operation':
    'Listen for pump hum — no sound may be dead pump or clogged filter.',
  'functional_checks.spin_operation':
    'No spin with good drain often = shift actuator, clutch, or motor.',
  'electrical_measurements.drain_pump_ohms':
    'Open pump winding = no drain. Typical low tens of ohms.',
  'electrical_measurements.inlet_valve_ohms':
    'Open coil = no fill on that valve leg.',
  'mechanical_controls.pressure_switch':
    'Pinched air dome hose causes fill/drain/spin logic errors.',
  'diagnosis.root_cause':
    'Tie complaint to fill, drain, spin, and leak findings before quoting board.',
};

export const washerRecommendations: FieldRecommendationRule[] = [
  {
    id: 'leak_path',
    when: [{ type: 'chip', id: 'leaking' }],
    message: 'Leak — inspect door boot, tub seal, pump, and inlet connections first.',
    tone: 'action',
  },
  {
    id: 'leak_yes',
    field: 'visual_inspection.leak_present',
    when: [{ type: 'field', path: 'visual_inspection.leak_present', equals: 'yes' }],
    message: 'Leak confirmed — isolate fill vs drain vs seal before replacing parts.',
    tone: 'tip',
  },
  {
    id: 'wont_drain',
    when: [{ type: 'chip', id: 'wont_drain' }],
    message: 'No drain — check filter, drain hose, then pump ohms and obstructions.',
    tone: 'action',
  },
  {
    id: 'drain_bad',
    field: 'functional_checks.drain_operation',
    when: [{ type: 'field', path: 'functional_checks.drain_operation', equals: 'bad' }],
    message: 'Drain failed — verify pump runs and impeller is clear.',
    tone: 'tip',
  },
  {
    id: 'wont_spin',
    when: [{ type: 'chip', id: 'wont_spin' }],
    message: 'No spin — confirm drain completed, then shift actuator, clutch, and motor.',
    tone: 'action',
  },
  {
    id: 'vibration',
    when: [{ type: 'chip', id: 'vibration' }],
    message: 'Vibration — level unit, check shipping bolts removed, suspension, and load balance.',
    tone: 'action',
  },
  {
    id: 'no_fill',
    when: [{ type: 'chip', id: 'no_fill' }],
    message: 'No fill — verify house pressure, inlet screens, and valve coils.',
    tone: 'action',
  },
  {
    id: 'lid_lock',
    when: [{ type: 'chip', id: 'lid_lock' }],
    message: 'Lock issue — test lid switch, door lock ohms, and wiring to MCU.',
    tone: 'tip',
  },
  {
    id: 'noisy_mechanical_path',
    when: [{ type: 'chip', id: 'noisy' }],
    message: 'Noisy / banging — spin empty, listen at tub, pump, and bottom panel before condemning control.',
    tone: 'action',
  },
  {
    id: 'noisy_tub_movement',
    field: 'visual_inspection.tub_movement',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'visual_inspection.tub_movement', equals: 'bad' },
    ],
    message: 'Excessive tub play with noise — bearing, shaft, or suspension rods/shocks next.',
    tone: 'action',
  },
  {
    id: 'noisy_drain_pump',
    field: 'functional_checks.drain_operation',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'functional_checks.drain_operation', equals: 'bad' },
    ],
    message: 'Noise during drain — check filter, coin trap, then pump impeller and ohms/amps.',
    tone: 'tip',
  },
  {
    id: 'noisy_belt',
    field: 'visual_inspection.drive_belt',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'visual_inspection.drive_belt', equals: 'bad' },
    ],
    message: 'Worn belt or pulley — squeal on spin/agitate is common; verify tension and drum free spin.',
    tone: 'tip',
  },
];
