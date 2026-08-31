import type { FieldRecommendationRule } from '../routing/types';

export const electricDryerFieldHelp: Record<string, string> = {
  'commonly_missed.vent_restriction':
    'Restricted vent is the #1 long-dry cause — check run length, elbows, and exterior hood. F4E3 / Restricted Air Flow points here first.',
  'commonly_missed.crushed_vent':
    'Crushed flex behind the dryer mimics a bad heater — verify full 4" path before replacing heat parts.',
  'commonly_missed.poor_airflow':
    'Strong airflow at the exterior hood — weak flow with a clean lint screen means duct or blower restriction.',
  'commonly_missed.overloading':
    'Overloading extends auto cycles and can trip high-limit devices — test with a small timed load when in doubt.',
  'commonly_missed.lint_trap':
    'Clean the lint screen before heat/airflow tests. Built-up housing blocks airflow and trips hi-limits and thermal fuse.',
  'customer_complaint.error_codes':
    'F3E1/F3E2 = exhaust thermistor; F3E3–F3E5 = inlet/harness; F3E6/F3E7 = moisture sensor; F4E3/AF = vent; F4E4/L2 = supply leg (<30 V); F4E1 = heater relay; F1E1/F6Ex = control/UI.',
  'visual_inspection.vent_condition':
    'Crushed flex, bird nests, and long runs mimic heater failures — clear the path before condemning the element.',
  'visual_inspection.lint_accumulation':
    'Lint inside the cabinet or around the element causes overheating, odor, and blown thermal cut-off/fuse.',
  'visual_inspection.drum_condition':
    'Worn rollers, glides, or idler cause thumping — separate from heat and motor electrical faults.',
  'visual_inspection.element_coils':
    'Broken or grounded coils show as no heat or heat that will not shut off — check for short to cabinet.',
  'functional_checks.drum_turning':
    'If the drum does not turn, check belt, belt switch, door switch, and thermal fuse (in motor circuit on many electrics) before the motor.',
  'functional_checks.heating':
    'Confirm both L1 and L2 at the control. No heat with good airflow → element, thermal fuse, cut-off, high-limit, or relay.',
  'functional_checks.heats_on_air_cycle':
    'Heat on AIR/fluff only → shorted element or stuck heater relay on control. Run timed AIR cycle and check relay voltage.',
  'functional_checks.airflow':
    'Weak hood airflow with a clean lint screen → vent restriction. Inlet/outlet thermistor faults often trace to airflow too.',
  'functional_checks.blower_operation':
    'Blower must move air through the element — a dead blower can look like no heat or long dry times.',
  'functional_checks.door_switch':
    'Closed door should read 0–2 Ω at the switch. Open circuit prevents start and heat on most models.',
  'functional_checks.door_latched':
    'Door must fully engage the latch — partial close mimics a bad switch.',
  'functional_checks.moisture_sensor':
    'Touch both strips in service mode — status should toggle. F3E6/F3E7 or odd auto-cycle length points here.',
  'heat_circuit.thermal_cutoff':
    'Open cut-off = no heat. Replace cut-off and high-limit together; fix vent restriction that caused the trip.',
  'heat_circuit.outlet_thermistor_kohm':
    'At room temp often 5–15 kΩ at the connector. F3E1 open (>50 kΩ) or F3E2 short (<0.5 kΩ).',
  'heat_circuit.inlet_thermistor_kohm':
    'Electric inlet at ~68°F often 61–64 kΩ. F3E3/F3E4 inlet faults; F3E5 = harness unplugged.',
  'motor_electrical.belt_switch':
    'Pulley up should close switch (open → few Ω). Open with good belt → replace switch or harness.',
  'motor_electrical.motor_circuit_ohms':
    'Door neutral to motor relay path often 1–6 Ω when wiring and motor are good — suspect CCU if in range but no run.',
  'heat_circuit.heater_ohms':
    'Typical single element ~10–20 Ω; dual elements in parallel often ≤50 Ω relay-to-relay. Open = no heat.',
  'heat_circuit.heater_amps':
    'Low amps on heat call with good voltage → open element, fuse, or limit. Near 30 A sustained → circuit/load issue.',
  'heat_circuit.thermal_fuse':
    'Open fuse from vent restriction — always fix airflow first. On many electrics the fuse is in the motor circuit (no tumble + no heat).',
  'heat_circuit.cycling_thermostat':
    'Open at room temp = no heat. Test cool, power off. Distinct from high-limit/thermal cut-off at the heater box.',
  'heat_circuit.high_limit':
    'Open high-limit often pairs with blown thermal cut-off — replace both and clear vent restriction.',
  'heat_circuit.exhaust_temp':
    'Timed dry, empty drum, vent disconnected: High ~155°F off, Medium ~140°F, Low ~125°F (±5°F). Should reach setpoint in ~7 min.',
  'motor_electrical.supply_voltage':
    '240 V line-to-line (200–260 V). F4E4/L2 = less than ~30 V on L2 at control — check breaker, cord, and terminal block.',
  'motor_electrical.motor_ohms':
    'Main winding 3.3–3.6 Ω, start 2.7–3.0 Ω at motor. Start much above 3 Ω → replace motor.',
  'motor_electrical.motor_amps':
    'High amps can indicate seized drum, bad bearing, or locked blower — check mechanical path first.',
  'motor_electrical.belt_idler':
    'Belt switch must close when pulley is up — open switch stops tumble even with a good motor.',
  'motor_electrical.board_notes':
    'ESD-sensitive controls — verify harnesses before CCU swap. Motor circuit 1–6 Ω with good windings → suspect CCU.',
  'diagnosis.root_cause':
    'Document vent airflow, element ohms, fuse/cut-off continuity, and supply voltage before quoting a control board.',
};

export const electricDryerRecommendations: FieldRecommendationRule[] = [
  {
    id: 'not_drying_vent',
    when: [{ type: 'chip', id: 'not_drying' }],
    message: 'Long dry times — verify vent restriction and exterior airflow before the heat circuit.',
    tone: 'action',
  },
  {
    id: 'no_heat_path',
    field: 'functional_checks.heating',
    when: [{ type: 'chip', id: 'no_heat' }],
    message: 'No heat — check L1/L2 supply, element ohms, thermal fuse, cut-off, and high-limit.',
    tone: 'action',
  },
  {
    id: 'heating_no',
    field: 'functional_checks.heating',
    when: [{ type: 'field', path: 'functional_checks.heating', equals: 'no' }],
    message: 'No heat confirmed — measure element ohms and thermal fuse before replacing the control board.',
    tone: 'tip',
  },
  {
    id: 'lint_excessive',
    field: 'visual_inspection.lint_accumulation',
    when: [{ type: 'field', path: 'visual_inspection.lint_accumulation', equals: 'bad' }],
    message: 'Heavy lint — clean housing and vent path; check thermal fuse and cut-off.',
    tone: 'action',
  },
  {
    id: 'wont_stop_spinning',
    when: [{ type: 'chip', id: 'wont_stop_spinning' }],
    message: 'Won’t shut off — check vent/airflow, moisture sensor, thermistors, and UI before the motor relay.',
    tone: 'tip',
  },
  {
    id: 'error_f4e3_vent',
    field: 'customer_complaint.error_codes',
    when: [{ type: 'keyword', match: 'f4e3' }],
    message: 'F4E3 / restricted airflow — clean lint screen, duct, and verify blower; retest thermistors after airflow is clear.',
    tone: 'action',
  },
  {
    id: 'error_f4e4_supply',
    field: 'customer_complaint.error_codes',
    when: [{ type: 'keyword', match: 'f4e4' }],
    message: 'F4E4 / L2 low voltage — verify 240 V supply, both legs at the terminal block, and cord connections.',
    tone: 'action',
  },
  {
    id: 'error_f3e1_exhaust_thermistor',
    field: 'customer_complaint.error_codes',
    when: [{ type: 'keyword', match: 'f3e1' }],
    message: 'F3E1 — exhaust thermistor open (>50 kΩ). Test P14 outlet thermistor; check harness before CCU.',
    tone: 'action',
  },
  {
    id: 'error_f3e6_moisture',
    field: 'customer_complaint.error_codes',
    when: [{ type: 'keyword', match: 'f3e6' }],
    message: 'F3E6 — moisture sensor open. Clean strips, test harness, and run moisture sensor activation.',
    tone: 'action',
  },
  {
    id: 'door_switch_no',
    field: 'functional_checks.door_switch',
    when: [{ type: 'field', path: 'functional_checks.door_switch', equals: 'no' }],
    message: 'Door switch open — check latch alignment and 0–2 Ω at switch before motor or board.',
    tone: 'action',
  },
  {
    id: 'belt_switch_no',
    field: 'motor_electrical.belt_switch',
    when: [{ type: 'field', path: 'motor_electrical.belt_switch', equals: 'no' }],
    message: 'Belt switch not closing — drum may not tumble even with a good motor.',
    tone: 'action',
  },
  {
    id: 'heats_when_shouldnt',
    when: [{ type: 'chip', id: 'heats_when_shouldnt' }],
    message: 'Stuck heat on AIR cycle — check heater relay on board and element short to ground.',
    tone: 'action',
  },
  {
    id: 'heats_on_air_yes',
    field: 'functional_checks.heats_on_air_cycle',
    when: [{ type: 'field', path: 'functional_checks.heats_on_air_cycle', equals: 'yes' }],
    message: 'Confirmed heat on no-heat cycle — test heater relay output and element for short.',
    tone: 'action',
  },
  {
    id: 'error_code_chip',
    when: [{ type: 'chip', id: 'error_code' }],
    message: 'Enter the displayed fault code — Solomon will map common F-codes to vent, thermistor, moisture, and supply paths.',
    tone: 'info',
  },
];
