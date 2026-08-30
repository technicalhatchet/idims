import type { FieldRecommendationRule } from '../routing/types';

/** Refrigerator field help + contextual recommendations — config only. */
export const refrigeratorFieldHelp: Record<string, string> = {
  'commonly_missed.condenser_cleanliness':
    'Vacuum condenser coils and confirm toe-kick / grille airflow is clear.',
  'commonly_missed.door_alignment':
    'Doors should seal evenly — check hinges, spacers, and closing cam.',
  'commonly_missed.gasket_sealing':
    'Dollar-bill test: slight resistance when pulled through a closed door gasket.',
  'customer_complaint.complaint':
    'Capture symptoms in the customer’s words — duration and intermittent vs constant matter.',
  'temperature_checks.fresh_food_temp':
    'Typical target 35–38°F. Record after doors have been closed ~5 minutes.',
  'temperature_checks.freezer_temp':
    'Typical target 0–5°F. Warm freezer with frost often points to airflow or defrost.',
  'temperature_checks.ambient_room_temp':
    'High room temp or poor ventilation can mimic a sealed-system problem.',
  'visual_inspection.frost_present':
    'Heavy uniform evaporator frost suggests airflow or defrost failure before sealed system.',
  'visual_inspection.evaporator_frost_pattern':
    'Partial frost = likely sealed system; solid blanket = defrost or evap fan issue.',
  'visual_inspection.condenser_condition':
    'Look for blocked coils, broken fan blade, or failed condenser fan motor.',
  'visual_inspection.noise_location':
    'Rear/bottom is one zone — condenser fan and compressor sit together. Inside FF/FZ points to evaporator fan or defrost.',
  'visual_inspection.condenser_fan_blade':
    'Fan can spin with a cracked blade, bent housing, or bad bearing — inspect with power off.',
  'visual_inspection.evaporator_fan_condition':
    'Evap fan noise — ice drag, loose blade, or motor bearing; often heard inside the cabinet.',
  'visual_inspection.noise_source_notes':
    'Note where the noise is heard (condenser area, inside FF/FZ, compressor) and when (constant vs spin).',
  'functional_checks.condenser_fan_operation':
    'Motor running does not mean OK — blade, bearing, and airflow still matter.',
  'functional_checks.compressor_running':
    'Listen for hum at compressor — hot and silent often means start device or compressor.',
  'functional_checks.evaporator_fan_running':
    'Fan should run with compressor in most models — stops during defrost.',
  'functional_checks.defrost_cycle_observed':
    'Manual defrost or forced defrost mode helps confirm heater and termination thermostat.',
  'functional_checks.ice_maker_operation':
    'Check fill tube freeze-up, filter, saddle valve, and harvest cycle if equipped.',
  'functional_checks.water_dispenser':
    'Verify filter, reservoir freeze, inlet valve, and door switch if no water.',
  'defrost_circuit.defrost_heater_ohms':
    'Open heater = no defrost. Compare to spec — typically tens of ohms.',
  'diagnosis.root_cause':
    'Tie findings to measured temps, frost pattern, and amp draws — not guesswork.',
};

export const refrigeratorRecommendations: FieldRecommendationRule[] = [
  {
    id: 'frost_check_defrost',
    field: 'visual_inspection.frost_present',
    when: [{ type: 'field', path: 'visual_inspection.frost_present', equals: 'yes' }],
    message: 'Heavy frost — plan defrost circuit and evaporator fan checks next.',
    tone: 'action',
  },
  {
    id: 'frost_pattern_bad',
    field: 'visual_inspection.evaporator_frost_pattern',
    when: [{ type: 'field', path: 'visual_inspection.evaporator_frost_pattern', equals: 'bad' }],
    message: 'Poor frost pattern — compare sealed-system readings vs defrost/airflow faults.',
    tone: 'tip',
  },
  {
    id: 'compressor_not_running',
    field: 'functional_checks.compressor_running',
    when: [{ type: 'field', path: 'functional_checks.compressor_running', equals: 'no' }],
    message: 'Compressor not running — check start relay/overload, cap, and compressor windings.',
    tone: 'action',
  },
  {
    id: 'evap_fan_no',
    field: 'functional_checks.evaporator_fan_running',
    when: [{ type: 'field', path: 'functional_checks.evaporator_fan_running', equals: 'no' }],
    message: 'Evap fan out — expect warm fresh food and heavy coil frost.',
    tone: 'action',
  },
  {
    id: 'freezer_warm',
    field: 'temperature_checks.freezer_temp',
    when: [{ type: 'chip', id: 'not_cooling' }],
    message: 'Not cooling — confirm freezer temp first, then airflow vs sealed system.',
    tone: 'tip',
  },
  {
    id: 'weak_ff_temp',
    field: 'temperature_checks.fresh_food_temp',
    when: [{ type: 'chip', id: 'weak_cooling_ff' }],
    message:
      'Start with fresh food temp — if freezer is still cold, suspect evap fan, defrost, damper, or FF door seal before sealed system.',
    tone: 'action',
  },
  {
    id: 'weak_ff_evap_fan',
    field: 'functional_checks.evaporator_fan_running',
    when: [{ type: 'chip', id: 'weak_cooling_ff' }],
    message: 'Weak FF cooling with a cold freezer often traces to evap fan or iced air tower / damper.',
    tone: 'tip',
  },
  {
    id: 'weak_ff_gasket',
    field: 'visual_inspection.gasket_condition',
    when: [{ type: 'chip', id: 'weak_cooling_ff' }],
    message: 'Check FF door gasket and alignment — warm FF only can be an air leak at the fresh food door.',
    tone: 'tip',
  },
  {
    id: 'weak_fz_temp',
    field: 'temperature_checks.freezer_temp',
    when: [{ type: 'chip', id: 'weak_cooling_fz' }],
    message:
      'Confirm freezer temp first — weak FZ often points to sealed system, defrost failure, or condenser/airflow before damper issues.',
    tone: 'action',
  },
  {
    id: 'weak_fz_condenser',
    field: 'visual_inspection.condenser_condition',
    when: [{ type: 'chip', id: 'weak_cooling_fz' }],
    message: 'Inspect condenser coils and fan — poor heat rejection shows up in the freezer first.',
    tone: 'tip',
  },
  {
    id: 'weak_fz_sealed',
    field: 'functional_checks.compressor_running',
    when: [{ type: 'chip', id: 'weak_cooling_fz' }],
    message: 'If compressor runs but FZ is soft, compare amp draw and frost pattern for sealed-system vs defrost.',
    tone: 'tip',
  },
  {
    id: 'weak_general_temp',
    field: 'temperature_checks.fresh_food_temp',
    when: [{ type: 'chip', id: 'weak_cooling' }],
    message: 'Record both compartment temps — FF-only warm vs both warm narrows the path quickly.',
    tone: 'tip',
  },
  {
    id: 'ice_maker_path',
    field: 'functional_checks.ice_maker_operation',
    when: [{ type: 'chip', id: 'ice_maker' }],
    message: 'Ice maker complaints — freezer must be cold enough (~0°F) for harvest.',
    tone: 'tip',
  },
  {
    id: 'dispenser_path',
    field: 'functional_checks.water_dispenser',
    when: [{ type: 'chip', id: 'water_dispenser' }],
    message: 'No water — check filter, inlet valve, and frozen reservoir or fill tube.',
    tone: 'tip',
  },
  {
    id: 'leak_defrost_drain',
    when: [{ type: 'chip', id: 'leaking' }],
    message: 'Water leaks — inspect defrost drain pan, clogged drain, and inlet fittings.',
    tone: 'action',
  },
  {
    id: 'noisy_fans_path',
    when: [{ type: 'chip', id: 'noisy' }],
    message: 'Noisy / vibrating — pick where the noise is heard first, then check the fans in that zone.',
    tone: 'action',
  },
  {
    id: 'noisy_location_rear',
    field: 'visual_inspection.noise_location',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'visual_inspection.noise_location', equals: 'rear_bottom' },
    ],
    message: 'Rear / bottom — condenser fan blade, bearing, and compressor mount are the main suspects.',
    tone: 'action',
  },
  {
    id: 'noisy_location_ff',
    field: 'visual_inspection.noise_location',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'visual_inspection.noise_location', equals: 'fresh_food' },
    ],
    message: 'Inside fresh food — check evaporator fan, damper, and ice buildup before rear condenser work.',
    tone: 'action',
  },
  {
    id: 'noisy_location_fz',
    field: 'visual_inspection.noise_location',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'visual_inspection.noise_location', equals: 'freezer' },
    ],
    message: 'Inside freezer — evaporator fan, ice drag, and defrost noise are more likely than condenser fan.',
    tone: 'action',
  },
  {
    id: 'noisy_location_dispenser',
    field: 'visual_inspection.noise_location',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'visual_inspection.noise_location', equals: 'dispenser' },
    ],
    message: 'Dispenser / ice area — check ice maker, auger, and fill valve before rear fan work.',
    tone: 'action',
  },
  {
    id: 'noisy_condenser_bad',
    field: 'visual_inspection.condenser_condition',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'visual_inspection.condenser_condition', equals: 'bad' },
    ],
    message: 'Bad condenser area with noise — check coil cleanliness, fan blade, and motor bearing even if the fan spins.',
    tone: 'action',
  },
  {
    id: 'noisy_condenser_fan_running',
    field: 'functional_checks.condenser_fan_running',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'functional_checks.condenser_fan_running', equals: 'yes' },
      { type: 'field', path: 'visual_inspection.condenser_condition', equals: 'bad' },
    ],
    message: 'Fan runs but condenser is bad — amp draw and blade obstruction can still point to bearing or dirty coil.',
    tone: 'tip',
  },
  {
    id: 'noisy_condenser_fan_amps',
    field: 'fans_and_electrical.condenser_fan_amps',
    when: [{ type: 'chip', id: 'noisy' }],
    message: 'Record condenser fan amps — normal draw with noise often means cleaning; low or high amps favors motor/bearing.',
    tone: 'tip',
  },
  {
    id: 'noisy_evap_fan',
    field: 'functional_checks.evaporator_fan_running',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'functional_checks.evaporator_fan_running', equals: 'no' },
    ],
    message: 'Evap fan not running — stalled motor or ice drag can cause noise before the fan stops.',
    tone: 'action',
  },
  {
    id: 'noisy_condenser_fan_running',
    field: 'functional_checks.condenser_fan_running',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'functional_checks.condenser_fan_running', equals: 'yes' },
    ],
    message: 'Fan motor runs — still check blade, bearing, and coil restriction in the fields below.',
    tone: 'action',
  },
  {
    id: 'noisy_condenser_fan_operation_bad',
    field: 'functional_checks.condenser_fan_operation',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'functional_checks.condenser_fan_operation', equals: 'bad' },
    ],
    message: 'Condenser fan runs but operation is bad — blade, bearing, or restricted coil is likely.',
    tone: 'action',
  },
  {
    id: 'noisy_condenser_fan_blade_bad',
    field: 'visual_inspection.condenser_fan_blade',
    when: [
      { type: 'chip', id: 'noisy' },
      { type: 'field', path: 'visual_inspection.condenser_fan_blade', equals: 'bad' },
    ],
    message: 'Damaged condenser fan blade or housing — replace fan assembly even if motor spins.',
    tone: 'action',
  },
];
