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
    'Open heater = no defrost. Many brands ~26–32 Ω; Samsung SxS ~63 Ω ±7% at CN70/CN85.',
  'commonly_missed.cooling_off_ruled_out':
    'Display O FF / OF OF or fans-on-comp-off? Hold Fridge + Power Cool ~6 s (Samsung) or Lock key per manual to exit demo.',
  'functional_checks.door_switch':
    'Samsung: door open ≈5 V, closed ≈0 V at CN20. Stuck open stops F-fan and triggers door alarm.',
  'functional_checks.fans_on_compressor_off':
    'Fans run with compressor off = Cooling Off / exhibition mode until proven otherwise.',
  'functional_checks.display_panel':
    'Dead keys or partial segments — check top-hinge LVDS before main board swap (41E, PC ER, 21E).',
  'fans_and_electrical.thermistor_voltage_v':
    'At board connector: ~4.5 V warm → 1.0 V cold (Samsung §4-2). Stuck high/low = open/short.',
  'fans_and_electrical.evap_fan_feedback_voltage':
    'BLDC evap fan feedback 7–12 V while commanded (Samsung F-FAN/C-FAN). Door open may stop F-fan.',
  'fans_and_electrical.inverter_ipm_voltage':
    'Inverter IPM DC must exceed 13.5 V or comp will not start (84C/86E). Read after 5-min lockout.',
  'customer_complaint.error_codes':
    'Samsung: 22E=fan, 5E=defrost sensor, 84C/86E=inverter, 41E=display comm, O FF=demo, RD=damper.',
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
  {
    id: 'samsung_22e_fan',
    field: 'functional_checks.evaporator_fan_running',
    when: [{ type: 'chip', id: 'error_code' }],
    message:
      'Samsung 22E/22C (F-FAN / C-FAN): check CN20 fan feedback 7–12 V, ice on evaporator, then fan motor. Service manual §4-2.',
    tone: 'action',
  },
  {
    id: 'samsung_5e_defrost_sensor',
    field: 'functional_checks.defrost_heater_ohms',
    when: [{ type: 'chip', id: 'error_code' }],
    message:
      'Samsung 5E/SE (F-DEF-Sensor): defrost thermistor CN20 pins 5–7 should read ~4.5–1.0 V warm→cold. Replace thermistor before board.',
    tone: 'tip',
  },
  {
    id: 'samsung_84c_compressor',
    field: 'functional_checks.compressor_running',
    when: [{ type: 'chip', id: 'error_code' }],
    message:
      'Samsung 84C/86E: inverter/compressor fault — check inverter LED blink pattern, harness CN70, locked rotor vs board.',
    tone: 'action',
  },
  {
    id: 'samsung_cooling_off',
    field: 'functional_checks.compressor_running',
    when: [{ type: 'chip', id: 'not_cooling' }],
    message:
      'Display shows O FF / OF OF? That is Cooling Off (demo) — compressor off, fans on. Hold Fridge + Power Cool ~6 s to exit before sealed-system work.',
    tone: 'tip',
  },
  {
    id: 'samsung_pcer_door',
    field: 'visual_inspection.door_alignment',
    when: [{ type: 'chip', id: 'error_code' }],
    message:
      'Samsung PC ER: reseat top-hinge door harness (LVDS). Also check 21E if display flickers when door moves.',
    tone: 'action',
  },
  {
    id: 'samsung_comm_codes',
    field: 'customer_complaint.error_codes',
    when: [{ type: 'chip', id: 'error_code' }],
    message:
      '41Er = main↔display, 44Er = inverter, 46Er = I/O expander, 47Er = dispenser panel, 52Er = WiFi — check harness first, then board.',
    tone: 'tip',
  },
  {
    id: 'cooling_off_fans_comp',
    field: 'functional_checks.fans_on_compressor_off',
    when: [{ type: 'chip', id: 'not_cooling' }],
    message:
      'If evap/condenser fans run but compressor never starts, check Cooling Off (O FF) before sealed-system parts.',
    tone: 'action',
  },
  {
    id: 'cooling_off_chip',
    field: 'commonly_missed.cooling_off_ruled_out',
    when: [{ type: 'chip', id: 'cooling_off' }],
    message: 'Exit demo/Cooling Off per manual, then confirm compressor starts before any sealed-system work.',
    tone: 'action',
  },
  {
    id: 'door_alarm_switch',
    field: 'functional_checks.door_switch',
    when: [{ type: 'chip', id: 'door_alarm' }],
    message: 'Continuous Ding-Dong — door ajar, gasket interference, or reed switch stuck/wet at hinge.',
    tone: 'action',
  },
  {
    id: 'display_dead_hinge',
    field: 'functional_checks.display_panel',
    when: [{ type: 'chip', id: 'display_dead' }],
    message: 'Reseat top-hinge LVDS harness first — pairs with 21E and PC ER on Samsung SxS.',
    tone: 'action',
  },
  {
    id: 'damper_weak_ff',
    field: 'functional_checks.damper_operation',
    when: [{ type: 'chip', id: 'weak_cooling_ff' }],
    message: 'Weak FF with cold freezer — verify damper opens and RD code before sealed system.',
    tone: 'tip',
  },
];
