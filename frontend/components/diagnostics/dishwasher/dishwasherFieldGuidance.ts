import { allWhen, makeWhen, scopedHelp } from '../routing/scopedFieldHelp';
import type { FieldHelpEntry, FieldRecommendationRule } from '../routing/types';

export const dishwasherFieldHelp: Record<string, FieldHelpEntry> = {
  'commonly_missed.disposal_knockout':
    'New installs — knockout plug in disposal drain causes immediate drain failure.',
  'commonly_missed.drain_restrictions':
    'High loop / air gap required on many installs — check before replacing pump.',
  'commonly_missed.water_temperature':
    'Incoming water below ~120°F causes poor wash and long cycles.',
  'visual_inspection.spray_arms_clear':
    'Clogged arm holes are the most common “won’t clean” fix.',
  'visual_inspection.filter_condition':
    'Debris in filter mimics weak circulation and drain issues.',
  'visual_inspection.drain_path_clear':
    'Check sump, chopper, and drain hose before condemning pump.',
  'functional_checks.wash_operation':
    'Weak circulation — listen for wash motor and check for debris in sump.',
  'functional_checks.drain_operation':
    'Pump should run audibly — silence may mean dead motor or stuck impeller.',
  'heat_water.incoming_water_temp':
    'Low inlet temp extends wash time and hurts drying performance.',
  'heat_water.heater_ohms': scopedHelp([
    {
      when: [makeWhen('insignia')],
      text: 'Insignia DWR3 tub heater ~10–15 Ω. Open = no heat during wash/dry.',
    },
  ], 'Open heater = no dry heat. Compare to spec before board diagnosis.'),
  'motor_electrical.drain_motor_ohms': scopedHelp([
    {
      when: [makeWhen('insignia')],
      text: 'Insignia DWR3 drain pump ~28–32 Ω. Open = standing water after cycle.',
    },
  ], 'Open drain motor winding = standing water after cycle.'),
  'customer_complaint.error_codes': scopedHelp([
    {
      when: [makeWhen('insignia')],
      text: 'Insignia DWR3: E8=diverter valve motor/switch, fill/drain/heat faults map to inlet, pump, and heater ohms.',
    },
  ]),
  'diagnosis.root_cause':
    'Document fill, wash, drain, and heat findings — many complaints overlap.',
};

export const dishwasherRecommendations: FieldRecommendationRule[] = [
  {
    id: 'not_cleaning',
    when: [{ type: 'chip', id: 'not_cleaning' }],
    message: 'Poor cleaning — check spray arms, filter, inlet temp, and detergent use first.',
    tone: 'action',
  },
  {
    id: 'wont_drain',
    when: [{ type: 'chip', id: 'wont_drain' }],
    message: 'No drain — verify disposal knockout, air gap, then pump and drain path.',
    tone: 'action',
  },
  {
    id: 'drain_bad',
    field: 'functional_checks.drain_operation',
    when: [{ type: 'field', path: 'functional_checks.drain_operation', equals: 'bad' }],
    message: 'Drain failed — inspect sump, chopper, and drain motor ohms.',
    tone: 'tip',
  },
  {
    id: 'leaking',
    when: [{ type: 'chip', id: 'leaking' }],
    message: 'Leak — check door gasket, inlet valve, pump seal, and float switch.',
    tone: 'action',
  },
  {
    id: 'leak_yes',
    field: 'visual_inspection.leak_present',
    when: [{ type: 'field', path: 'visual_inspection.leak_present', equals: 'yes' }],
    message: 'Leak confirmed — run fill and wash to isolate source under pressure.',
    tone: 'tip',
  },
  {
    id: 'no_heat_dry',
    when: [{ type: 'chip', id: 'no_heat_dry' }],
    message: 'Not drying — verify inlet water temp, heater ohms, and dry cycle selection.',
    tone: 'action',
  },
  {
    id: 'no_fill',
    when: [{ type: 'chip', id: 'no_fill' }],
    message: 'No fill — check inlet screen, water supply, and valve coils.',
    tone: 'action',
  },
  {
    id: 'noisy_motor_path',
    when: [{ type: 'chip', id: 'noisy' }],
    message: 'Noisy / grinding — run drain and wash portions separately; listen at sump, spray arms, and pump.',
    tone: 'action',
  },
  {
    id: 'noisy_wash_bad',
    field: 'functional_checks.wash_operation',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'functional_checks.wash_operation', equals: 'bad' },
    ],
    message: 'Noise with weak wash — check filter, chopper, and circulation pump before heater or board.',
    tone: 'action',
  },
  {
    id: 'noisy_drain_bad',
    field: 'functional_checks.drain_operation',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'functional_checks.drain_operation', equals: 'bad' },
    ],
    message: 'Grinding on drain — inspect sump debris, drain hose, then drain motor ohms.',
    tone: 'tip',
  },
  {
    id: 'noisy_spray_arms',
    field: 'visual_inspection.spray_arms_clear',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'visual_inspection.spray_arms_clear', equals: 'no' },
    ],
    message: 'Blocked spray arms can rattle and mimic pump failure — clear holes and spin freely first.',
    tone: 'tip',
  },
  {
    id: 'insignia_e8_diverter',
    when: [allWhen({ type: 'keyword', match: 'e8' }, makeWhen('insignia'))],
    message: 'Insignia E8 — diverter valve motor (~4 kΩ class) or micro switch. Check cam position before motor swap.',
    tone: 'action',
  },
  {
    id: 'insignia_fill_valve',
    field: 'heat_water.heater_ohms',
    when: [allWhen({ type: 'chip', id: 'no_fill' }, makeWhen('insignia'))],
    message: 'Insignia DWR3 inlet valve ~0.95–1.05 kΩ per coil — verify screens and supply before valve.',
    tone: 'tip',
  },
];
