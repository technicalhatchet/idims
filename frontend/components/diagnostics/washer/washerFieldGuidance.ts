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
  'commonly_missed.he_detergent':
    'Non-HE detergent causes F0E2/Sd oversuds on Whirlpool front-load — confirm HE only.',
  'visual_inspection.leak_present':
    'Trace source: door boot, pump, tub seal, inlet hoses, or dispenser.',
  'visual_inspection.tub_movement':
    'Excessive play suggests worn tub bearing or broken suspension.',
  'functional_checks.drain_operation':
    'Listen for pump hum — no sound may be dead pump or clogged filter.',
  'functional_checks.spin_operation':
    'No spin with good drain often = shift actuator, clutch, or motor.',
  'electrical_measurements.drive_motor_ohms':
    'Whirlpool FL DD motor J6: 6–20 Ω all pairs (TEST #3). F7E9 = locked rotor — check obstruction first.',
  'electrical_measurements.drain_pump_ohms':
    'Whirlpool FL drain pump J11: 18.5–21.5 Ω. F9E1 long drain — filter and hose height before pump.',
  'electrical_measurements.inlet_valve_ohms':
    'Whirlpool FL inlet valve: 1.1–1.35 kΩ per coil. F8E1/Lo FL — screens, pressure, and valve.',
  'electrical_measurements.wash_heater_ohms':
    'Heat/steam FL: wash heater J3 7–30 Ω (TEST #9). F4E1/F4E2 heat relay faults.',
  'electrical_measurements.recirc_pump_ohms':
    'Recirc pump 36–46 Ω on steam/heat variants.',
  'mechanical_controls.door_lock_ohms':
    'Front-load door lock — TEST #4. F5E1/E4 door faults; F5E4/dr = open door between cycles.',
  'mechanical_controls.pressure_switch':
    'Pinched air dome hose causes fill/drain/spin logic errors — F3E1 pressure sensor.',
  'customer_complaint.flex_compartment':
    'FlexWash WV55*: upper = DC4/AC7 path; lower = 3C motor/inverter AC6; shared drain = 5C.',
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
  {
    id: 'flexwash_upper',
    when: [{ type: 'chip', id: 'flexwash_upper' }],
    message: 'Upper FlexWash — check DC4 door closed, AC7 interconnect harness, upper sub PBA.',
    tone: 'action',
  },
  {
    id: 'flexwash_ac7',
    when: [{ type: 'chip', id: 'flexwash' }],
    message: 'FlexWash dual-load — identify upper vs lower compartment; AC7 = upper↔lower comm fault.',
    tone: 'tip',
  },
];
