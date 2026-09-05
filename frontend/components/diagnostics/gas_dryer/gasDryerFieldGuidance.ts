import { allWhen, makeWhen, platformWhen, scopedHelp } from '../routing/scopedFieldHelp';
import type { FieldHelpEntry, FieldRecommendationRule } from '../routing/types';

export const gasDryerFieldHelp: Record<string, FieldHelpEntry> = {
  'commonly_missed.vent_restriction':
    'Poor vent airflow extends dry time and can cause weak flame or hi-limit trips — F4E3 / Restricted Air Flow starts here.',
  'commonly_missed.gas_supply':
    'Confirm shutoff open and flex line intact before ignition tests — no gas path looks like a bad valve.',
  'commonly_missed.lint_trap':
    'Clean lint screen before airflow and heat tests — restriction blows thermal fuse in the gas valve circuit.',
  'commonly_missed.lp_orifices':
    'Wrong LP orifice causes weak flame and long dry times — verify conversion before replacing the valve.',
  'customer_complaint.error_codes': scopedHelp([
    {
      when: [platformWhen('whirlpool_duet_sport_dryer')],
      text: 'Duet Sport MCE: PF; F-01 MCE; F-22/F-23 exhaust thermistor; F-26 motor; F-28/F-29 moisture (diag). Ignitor 50–250 Ω; coils 1000–1300 / 500–600 Ω.',
    },
    {
      when: [makeWhen('whirlpool')],
      text: 'Whirlpool: F3E1/F3E2 exhaust; F3E3–F3E5 inlet; F3E6/F3E7 moisture; F4E3/AF vent; F4E4 supply; F1E1/F6Ex control. Ignitor ~50–500 Ω.',
    },
    {
      when: [makeWhen('samsung')],
      text: 'Samsung: tC/tC5 thermistor+vent; dC/dF door; 9C1/FC supply; AC/HC control/heat; bC2 UI. Ignitor ~40–400 Ω.',
    },
    {
      when: [makeWhen('insignia')],
      text: 'Insignia TDRE: E5=outlet NTC, C9=display comm, D80–D95=duct restriction. Ignitor per manual spec.',
    },
  ]),
  'visual_inspection.vent_condition':
    'Restricted vent starves the burner — weak flame and long dry times before condemning gas parts.',
  'visual_inspection.lint_accumulation':
    'Heavy lint raises exhaust temps and trips thermal fuse in the gas valve circuit.',
  'visual_inspection.igniter_condition':
    'Cracked igniter = low amps; valve may never open. Cold resistance typically 50–500 Ω.',
  'visual_inspection.gas_valve':
    'Coil pairs: ~1400 Ω, ~570 Ω, ~1300 Ω. Open coil = no gas even with a glowing ignitor.',
  'functional_checks.drum_turning': scopedHelp([
    {
      when: [platformWhen('whirlpool_duet_sport_dryer')],
      text: 'Duet Sport: main 2.4–3.6 Ω, start 2.4–3.8 Ω; belt switch closes when pulley up; F-26 motor drive.',
    },
  ], 'No tumble — belt, belt switch, door switch, and motor windings (main 3.3–3.6 Ω, start 2.7–3.0 Ω) before CCU.'),
  'functional_checks.ignition':
    'Ignitor should draw ~2.5–4.5 A before the valve opens. Glow with no flame → flame sensor or valve.',
  'functional_checks.airflow':
    'Weak exterior airflow → vent restriction. Inlet thermistor at drum inlet helps detect AF faults.',
  'functional_checks.blower_operation':
    'Poor blower airflow can extinguish flame or extend dry time — check wheel and duct path.',
  'functional_checks.door_switch':
    'Closed door should read 0–2 Ω. Blocks start and heat when open.',
  'functional_checks.door_latched':
    'Confirm door fully engages latch before condemning switch or motor.',
  'functional_checks.moisture_sensor':
    'Auto cycles depend on moisture strips — clean and test in service mode; F3E6/F3E7 on many controls.',
  'gas_ignition.flame_sensor_continuity':
    'Bench continuity check — open sensor with glowing ignitor and no flame means replace sensor.',
  'motor_electrical.belt_switch':
    'Belt switch must close when pulley is raised — common no-tumble cause with good motor ohms.',
  'motor_electrical.motor_circuit_ohms':
    '1–6 Ω door-to-motor path suggests wiring OK — check belt switch and CCU if drum still won’t run.',
  'motor_electrical.motor_ohms': scopedHelp([
    {
      when: [platformWhen('whirlpool_duet_sport_dryer')],
      text: 'Duet Sport: main 2.4–3.6 Ω, start 2.4–3.8 Ω at motor switch. F-26 — belt switch if motor OK.',
    },
  ], 'Main 3.3–3.6 Ω, start 2.7–3.0 Ω at motor. Motor circuit 1–6 Ω door-to-motor path → wiring OK, suspect CCU.'),
  'motor_electrical.outlet_thermistor_kohm': scopedHelp([
    {
      when: [platformWhen('whirlpool_duet_sport_dryer')],
      text: 'Duet Sport exhaust NTC — F-22/F-23 in first 60 s. ~12 kΩ @ 70°F at thermistor.',
    },
  ], 'Exhaust thermistor at connector — F3E1/F3E2. Room temp often 5–15 kΩ.'),
  'motor_electrical.inlet_thermistor_kohm':
    'Gas inlet curve — ~58–68 kΩ at ~68°F on many models. F3E3–F3E5 inlet/harness faults.',
  'functional_checks.flame_quality':
    'Flame should stay lit through the heat cycle — short cycles = flame sensor, valve, or vent starvation.',
  'functional_checks.heats_on_air_cycle':
    'Burner/heat on AIR or fluff → stuck gas valve relay or shorted heat circuit — verify on timed AIR cycle.',
  'gas_ignition.igniter_amps':
    'Below ~2.5 A = weak glow; gas may not ignite. Silicon carbide types often need ~3.2–3.6 A.',
  'gas_ignition.igniter_ohms': scopedHelp([
    {
      when: [platformWhen('whirlpool_duet_sport_dryer')],
      text: 'Duet Sport ignitor 50–250 Ω cold (8178559 §5). Glow with no flame → valve coils or flame sensor.',
    },
  ], 'Cold resistance 50–500 Ω typical. Open or out of range → replace ignitor.'),
  'gas_ignition.gas_valve_coils': scopedHelp([
    {
      when: [platformWhen('whirlpool_duet_sport_dryer')],
      text: '2-pin coil 1000–1300 Ω; 3-pin 1&2 = 1300–1400 Ω, 1&3 = 500–600 Ω. Thermal fuse in valve circuit on gas.',
    },
  ], 'Measure each coil pair: terminals 1–2 ~1400 Ω, 1–3 ~570 Ω, 4–5 ~1300 Ω (±5%).'),
  'gas_ignition.flame_sensor':
    'Open flame sensor with glowing ignitor and no gas → replace sensor. Clean carbon before testing.',
  'gas_ignition.gas_pressure_note':
    'Manifold pressure affects flame quality — verify supply and orifice when flame is weak but parts test good.',
  'motor_electrical.supply_voltage':
    '120 VAC (100–130 V). Low voltage affects motor, ignitor, and controls.',
  'motor_electrical.thermal_fuse':
    'On gas dryers the thermal fuse is often in series with the gas valve — drum may run with no heat.',
  'motor_electrical.exhaust_temp':
    'Timed dry test: High ~155°F off, Medium ~140°F, Low ~125°F (±5°F), vent disconnected, empty drum.',
  'motor_electrical.board_notes':
    'Gas models: check P14 harness at CCU for thermistor loopback. Verify harnesses before board swap.',
  'diagnosis.root_cause':
    'Document vent airflow, ignitor amps/ohms, flame sensor, valve coils, and thermal fuse before valve or board.',
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
    message: 'Long dry times — verify vent restriction and exterior airflow before the ignition path.',
    tone: 'action',
  },
  {
    id: 'no_heat_ignition',
    field: 'functional_checks.ignition',
    when: [{ type: 'chip', id: 'no_heat' }],
    message: 'No heat — check ignitor amps/ohms, valve coils, flame sensor, and thermal fuse in valve circuit.',
    tone: 'action',
  },
  {
    id: 'ignition_no',
    field: 'functional_checks.ignition',
    when: [{ type: 'field', path: 'functional_checks.ignition', equals: 'no' }],
    message: 'No ignition — measure igniter draw (50–500 Ω cold) and gas valve coil resistance.',
    tone: 'tip',
  },
  {
    id: 'weak_flame',
    when: [{ type: 'chip', id: 'weak_flame' }],
    message: 'Weak or dropping flame — check LP orifice, vent airflow, flame sensor, and valve coils.',
    tone: 'action',
  },
  {
    id: 'wont_stop_spinning',
    when: [{ type: 'chip', id: 'wont_stop_spinning' }],
    message: 'Won’t shut off — check vent/airflow, moisture sensor, thermistors, and control before the motor relay.',
    tone: 'tip',
  },
  {
    id: 'not_drying_eco_washer',
    when: [{ type: 'chip', id: 'not_drying' }],
    message: 'Also check: washer spin/extract, Eco Dry air phase, mixed loads, and vent blockage test if equipped.',
    tone: 'tip',
  },
  {
    id: 'error_tc_thermistor',
    field: 'customer_complaint.error_codes',
    when: [allWhen({ type: 'keyword', match: 'tc' }, makeWhen('samsung'))],
    message: 'tC / tC5 (Samsung) — thermistor + vent path: clean lint and duct before replacing sensors.',
    tone: 'action',
  },
  {
    id: 'error_f4e3_vent',
    field: 'customer_complaint.error_codes',
    when: [allWhen({ type: 'keyword', match: 'f4e3' }, makeWhen('whirlpool'))],
    message: 'F4E3 / restricted airflow — clean lint screen and duct; weak vent can starve the burner flame.',
    tone: 'action',
  },
  {
    id: 'error_f3e1_exhaust_thermistor',
    field: 'customer_complaint.error_codes',
    when: [allWhen({ type: 'keyword', match: 'f3e1' }, makeWhen('whirlpool'))],
    message: 'F3E1 — exhaust thermistor open. Test outlet thermistor resistance; clear vent before replacing parts.',
    tone: 'action',
  },
  {
    id: 'error_f3e6_moisture',
    field: 'customer_complaint.error_codes',
    when: [allWhen({ type: 'keyword', match: 'f3e6' }, makeWhen('whirlpool'))],
    message: 'F3E6 — moisture sensor open. Clean drum strips and test sensor harness.',
    tone: 'action',
  },
  {
    id: 'flame_sensor_open',
    field: 'gas_ignition.flame_sensor_continuity',
    when: [{ type: 'field', path: 'gas_ignition.flame_sensor_continuity', equals: 'no' }],
    message: 'Flame sensor open — common cause of glow-with-no-flame or short heat cycles.',
    tone: 'action',
  },
  {
    id: 'heats_when_shouldnt',
    when: [{ type: 'chip', id: 'heats_when_shouldnt' }],
    message: 'Heat/flame on AIR cycle — check valve relay, flame sensor, and control before replacing valve.',
    tone: 'action',
  },
  {
    id: 'error_code_chip',
    when: [{ type: 'chip', id: 'error_code' }],
    message: 'Enter the displayed fault code — common codes map to vent, thermistor, moisture, and ignition paths.',
    tone: 'info',
  },
  {
    id: 'insignia_e5_outlet',
    field: 'motor_electrical.outlet_thermistor_kohm',
    when: [allWhen({ type: 'keyword', match: 'e5' }, makeWhen('insignia'))],
    message: 'Insignia E5 — outlet thermistor fault stops heat and motor. Clean vent, then measure outlet NTC.',
    tone: 'action',
  },
  {
    id: 'insignia_duct_codes',
    when: [allWhen({ type: 'keyword', match: 'd80' }, makeWhen('insignia'))],
    message: 'Insignia D80–D95 — duct restriction: lint screen, housing, and vent run before sensor replacement.',
    tone: 'action',
  },
];
