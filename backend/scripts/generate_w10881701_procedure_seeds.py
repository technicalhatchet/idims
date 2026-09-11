#!/usr/bin/env python3
"""Generate W10881701 (Whirlpool/Maytag 9.2 cu ft steam dryer service manual) procedure seeds."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_ccu_dryer"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W10881701",
    "manualTitle": "Whirlpool & Maytag 9.2 Cu. Ft. Steam Dryer Service Manual",
    "extractedTextFile": "backend/docs/manuals/servicemanual-w10881701-l-91 wed9500-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dryer or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Electrical Shock Hazard. Disconnect power before accessing.",
    "requiresInput": False,
}

ELECTRIC_DRYER_ONLY = ["electric_dryer"]
GAS_DRYER_ONLY = ["gas_dryer"]


def proc(
    pid: str,
    title: str,
    oem_num: str,
    oem_title: str,
    pages: list[int],
    component_ids: list[str],
    tags: list[str],
    steps: list[dict],
    template_ids: list[str] | None = None,
) -> dict:
    if not steps:
        raise ValueError(f"{pid} must define at least one step after safety")
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    result = {
        "id": pid,
        "version": "1.0.0",
        "title": title,
        "platformId": "whirlpool_ccu_dryer",
        "componentIds": component_ids,
        "tags": tags,
        "source": {**SOURCE, "oemTestNumber": oem_num, "oemTestTitle": oem_title, "pages": pages},
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }
    if template_ids:
        result["templateIds"] = template_ids
    return result


def meas(sid, order, title, body, kid, connector, pins, branches, excerpt=""):
    return {
        "id": sid,
        "order": order,
        "type": "measurement",
        "title": title,
        "body": body,
        "sourceExcerpt": excerpt or body,
        "measurementKnowledgeId": kid,
        "testPoint": {"connector": connector, "pins": pins, "label": title},
        "requiresInput": True,
        "branches": branches,
    }


def instr(sid, order, title, body, nxt=None, excerpt=""):
    step = {
        "id": sid,
        "order": order,
        "type": "instruction",
        "title": title,
        "body": body,
        "sourceExcerpt": excerpt or body,
        "requiresInput": False,
    }
    if nxt:
        step["defaultNextStepId"] = nxt
    return step


def visual(sid, order, title, body, branches, excerpt=""):
    return {
        "id": sid,
        "order": order,
        "type": "visual_check",
        "title": title,
        "body": body,
        "sourceExcerpt": excerpt or body,
        "requiresInput": True,
        "branches": branches,
    }


def outcome(sid, order, title, text):
    return {
        "id": sid,
        "order": order,
        "type": "outcome",
        "title": title,
        "oemOutcome": text,
        "requiresInput": False,
    }


def pass_fail_branches(pass_id, pass_next, fail_id, fail_next, fail_outcome):
    return [
        {"id": pass_id, "label": "In spec", "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
        {
            "id": fail_id,
            "label": "Out of spec",
            "when": {"kind": "measurement_critical"},
            "nextStepId": fail_next,
            "terminal": True,
            "oemOutcome": fail_outcome,
        },
        {
            "id": f"{fail_id}_warn",
            "label": "Borderline",
            "when": {"kind": "measurement_warning"},
            "nextStepId": fail_next,
            "terminal": True,
            "oemOutcome": fail_outcome,
        },
        {
            "id": f"{fail_id}_open",
            "label": "Open circuit",
            "when": {"kind": "measurement_open"},
            "nextStepId": fail_next,
            "terminal": True,
            "oemOutcome": fail_outcome,
        },
    ]


def checkpoint_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {
            "id": no_id,
            "label": "No / failed",
            "when": {"kind": "checkpoint_no"},
            "nextStepId": no_next,
            "terminal": True,
            "oemOutcome": no_outcome,
        },
    ]


def fuel_variant_step(electric_next, gas_next, order=2, step_id="fuel_variant"):
    return visual(
        step_id,
        order,
        "Electric or gas dryer?",
        "WED/MED = electric dual-element; WGD/MGD = gas burner.",
        [
            {"id": "fuel_electric", "label": "Electric", "when": {"kind": "checkpoint_yes"}, "nextStepId": electric_next},
            {"id": "fuel_gas", "label": "Gas", "when": {"kind": "checkpoint_no"}, "nextStepId": gas_next},
        ],
    )


ACU_POWER = proc(
    "w10881701-acu-power",
    "TEST #1: ACU Power Check",
    "1",
    "ACU Power Check",
    [26, 27],
    ["acu"],
    ["supply_issue", "F1E1", "F1E3", "F1E5", "F6E2", "F6E3", "no_power"],
    [
        instr(
            "green_led",
            2,
            "Verify ACU green LED",
            "Power on — center green LED on ACU should flash then stay lit. If UI works but LED never wakes, suspect UI hibernate/wake path.",
            "verify_outlet",
        ),
        instr("verify_outlet", 3, "Verify outlet voltage", "Electric: 240/208 VAC. Gas: 120 VAC. Time-delay fuse required on electric.", "access_acu"),
        instr("access_acu", 4, "Access ACU", "Remove console. Restore power only for live voltage steps below.", "live_l1"),
        visual(
            "live_l1",
            5,
            "120 VAC at J8-3 (N) and J9-2 (L1)",
            "Use needle probes. Black to J8-3, red to J9-2 — expect 120 VAC.",
            checkpoint_yes_no("l1_ok", "live_5v", "l1_bad", "supply_connections", "No L1 at ACU — perform TEST #2 supply connections."),
        ),
        visual(
            "live_5v",
            6,
            "+5 VDC at J2-1 vs J2-3 (J2 unplugged)",
            "Unplug J2 from ACU. DC volts: red J2-1, black J2-3. Missing +5V with J14 unplugged → shorted thermistor (TEST #4a).",
            checkpoint_yes_no("v5_ok", "acu_power_verified", "v5_bad", "j14_thermistor_short", "Diagnose thermistor short or harness before replacing ACU."),
        ),
        instr(
            "j14_thermistor_short",
            7,
            "Thermistor short isolation",
            "Disconnect power. Unplug J14, restore power, retest +5 VDC. If +5 returns, run TEST #4a thermistors.",
            "j2_ui_isolation",
        ),
        instr(
            "j2_ui_isolation",
            8,
            "UI harness isolation",
            "Reconnect J14. Leave J2 unplugged. Retest +5 VDC at J2 header pins 1 & 3 (do not short pins). If +5 returns, check ACU↔UI harness; replace UI if harness OK.",
            "replace_acu",
        ),
        instr("supply_connections", 9, "Supply path fault", "Perform TEST #2 supply connections.", "acu_power_verified"),
        outcome("replace_acu", 10, "Replace ACU", "Replace appliance control unit (ACU)."),
        outcome("acu_power_verified", 11, "ACU power verified", "Line and +5 VDC present at ACU."),
    ],
)

SUPPLY_CONNECTIONS = proc(
    "w10881701-supply-connections",
    "TEST #2: Supply Connections",
    "2",
    "Supply Connections",
    [10, 11],
    ["supply"],
    ["supply_issue", "voltage_check", "F4E4"],
    [
        fuel_variant_step("electric_cover", "gas_cover"),
        instr("electric_cover", 3, "Electric — terminal block", "Remove rear cover plate. Verify cord at terminal block.", "electric_n_block"),
        visual(
            "electric_n_block",
            4,
            "Neutral to terminal block center",
            "Continuity from plug N to center terminal block contact.",
            checkpoint_yes_no("en_ok", "electric_l1_id", "en_bad", "replace_cord", "Replace power cord."),
        ),
        instr("electric_l1_id", 5, "Identify L1 at block", "Note which plug terminal connects to left-most block contact (L1).", "electric_l1_p9"),
        visual(
            "electric_l1_p9",
            6,
            "L1 plug to J9-2",
            "Continuity from L1 plug terminal to ACU J9-2 (black).",
            checkpoint_yes_no("el1_ok", "electric_n_p8", "el1_bad", "replace_harness", "Replace harness or cord."),
        ),
        visual(
            "electric_n_p8",
            7,
            "Neutral plug to J8-3",
            "Continuity from plug N to ACU J8-3 (white).",
            checkpoint_yes_no("enp8_ok", "connectors_seated", "enp8_bad", "replace_harness", "Replace main harness."),
        ),
        instr("gas_cover", 3, "Gas — cord to harness", "Verify power cord firmly connected to wire harness.", "gas_n_p8"),
        visual(
            "gas_n_p8",
            4,
            "Gas — neutral to J8-3",
            "Continuity plug N to J8-3. Test cord neutral if open.",
            checkpoint_yes_no("gn_ok", "gas_l1_p9", "gn_bad", "replace_cord", "Replace power cord."),
        ),
        visual(
            "gas_l1_p9",
            5,
            "Gas — L1 to J9-2",
            "Continuity L1 plug to J9-2.",
            checkpoint_yes_no("gl1_ok", "connectors_seated", "gl1_bad", "replace_harness", "Replace cord or harness."),
        ),
        visual(
            "connectors_seated",
            8,
            "All ACU/UI connectors seated",
            "All harness connectors fully inserted; UI assembly seated in console.",
            checkpoint_yes_no("conn_ok", "supply_verified", "conn_bad", "reseat_connectors", "Reseat connectors and retest."),
        ),
        outcome("replace_cord", 9, "Replace power cord", "Replace power cord."),
        outcome("replace_harness", 10, "Replace harness", "Replace main wire harness."),
        outcome("reseat_connectors", 11, "Reseat connectors", "Reseat ACU/UI connectors; run Quick Diagnostic Test."),
        outcome("supply_verified", 12, "Supply verified", "Cord, harness, and connector seating OK."),
    ],
)

MOTOR_CIRCUIT = proc(
    "w10881701-motor-circuit",
    "TEST #3: Motor Circuit",
    "3",
    "Motor Circuit",
    [12, 13],
    ["motor"],
    ["motor_check", "wont_spin", "no_spin"],
    [
        instr("access_acu_motor", 2, "ACU motor path pre-check", "Access ACU. Measure J8-4 to J9-1. 1–6 Ω = motor circuit OK at ACU — suspect ACU if still no run.", "door_switch_bench"),
        visual(
            "door_switch_bench",
            3,
            "Door switch J8-3 to J8-4",
            "Door closed: 0–2 Ω across J8-3 (white) and J8-4 (tan).",
            checkpoint_yes_no("door_ok", "access_motor", "door_bad", "replace_door_switch", "Replace door switch assembly."),
        ),
        instr("access_motor", 4, "Access motor & belt switch", "Release belt from belt switch pulley. Disconnect motor switch white connector.", "motor_circuit_ohms"),
        meas(
            "motor_circuit_ohms",
            5,
            "Motor circuit at ACU (optional)",
            "J8-4 to J9-1: 1–6 Ω indicates acceptable motor circuit path at ACU.",
            "dryerMotorCircuitOhms",
            "ACU motor path",
            "J8-4 to J9-1",
            pass_fail_branches("mc_ok", "main_winding", "mc_bad", "replace_acu", "Motor circuit reads OK at ACU — replace ACU if F26/no tumble persists."),
        ),
        meas(
            "main_winding",
            6,
            "Main winding pin 4–5",
            "Lt blue pin 4 to bare copper off pin 5. Spec 3.3–3.6 Ω.",
            "dryerDrumMotorWindingOhms",
            "Motor main",
            "4–5",
            pass_fail_branches("main_ok", "start_winding", "main_bad", "replace_motor", "Replace drive motor."),
        ),
        meas(
            "start_winding",
            7,
            "Start winding pin 4–3",
            "Lt blue pin 4 to bare copper on pin 3. Spec 2.7–3.0 Ω.",
            "dryerDrumMotorWindingOhms",
            "Motor start",
            "4–3",
            pass_fail_branches("start_ok", "belt_switch", "start_bad", "replace_motor", "Replace drive motor."),
        ),
        visual(
            "belt_switch",
            8,
            "Belt switch",
            "Belt off pulley: OL. Push pulley up: few Ω across light blue wires.",
            checkpoint_yes_no("belt_ok", "motor_verified", "belt_bad", "replace_belt_switch", "Replace belt switch or repair harness."),
        ),
        outcome("replace_motor", 9, "Replace motor", "Replace drive motor."),
        outcome("replace_door_switch", 10, "Replace door switch", "Replace door switch."),
        outcome("replace_belt_switch", 11, "Service belt switch", "Replace belt switch."),
        outcome("replace_acu", 12, "Replace ACU", "Replace ACU when motor circuit OK at J8-4/J9-1 but unit won't run."),
        outcome("motor_verified", 13, "Motor circuit verified", "Motor, belt switch, and door switch OK."),
    ],
)

HEATER_ELECTRIC = proc(
    "w10881701-heater-electric",
    "TEST #4: Heat System (electric)",
    "4",
    "Heat System",
    [14, 15],
    ["heating_element"],
    ["no_heat", "heating_element_check", "F4E1"],
    [
        instr("access_heat", 2, "Access heater relays", "Remove top panel. Access ACU heater relays per Figure 20a.", "dual_element"),
        meas(
            "dual_element",
            3,
            "Heater relay #1 violet to #2 violet",
            "Both elements in parallel: ≤50 Ω. Open → check each element violet to center red.",
            "whirlpoolCcuDryerHeaterOhms",
            "Heater relays",
            "violet #1 to violet #2",
            pass_fail_branches("heat_ok", "thermal_cutoff_l1", "heat_bad", "replace_elements", "Replace open element(s)."),
        ),
        visual(
            "thermal_cutoff_l1",
            4,
            "L1 through thermal cut-off to relays",
            "Continuity J9-2 (L1) to black on heater relay #1 and #2 through thermal cut-off path.",
            checkpoint_yes_no("cutoff_ok", "high_limit", "cutoff_bad", "replace_cutoff", "Replace thermal cut-off."),
        ),
        visual(
            "high_limit",
            5,
            "High-limit thermostat",
            "Continuity across high-limit. Open → replace high-limit and thermal cut-off.",
            checkpoint_yes_no("hilimit_ok", "outlet_ntc", "hilimit_bad", "replace_hilimit", "Replace high-limit and cut-off."),
        ),
        visual(
            "outlet_ntc",
            6,
            "Outlet thermistor J14-3 to J14-6",
            "Disconnect J14. 5–15 kΩ at room; <1 kΩ → replace thermistor; open → repair harness.",
            checkpoint_yes_no("ntc_ok", "heater_verified", "ntc_bad", "replace_thermistor", "Replace outlet thermistor."),
        ),
        outcome("replace_elements", 7, "Replace heater", "Replace failed heating element(s)."),
        outcome("replace_cutoff", 8, "Replace cut-off", "Replace thermal cut-off."),
        outcome("replace_hilimit", 9, "Replace cut-off & high-limit", "Replace thermal cut-off and high-limit thermostat."),
        outcome("replace_thermistor", 10, "Replace thermistor", "Replace outlet thermistor."),
        outcome("heater_verified", 11, "Heater circuit verified", "Elements, limits, and outlet NTC within spec."),
    ],
    ELECTRIC_DRYER_ONLY,
)

HEATER_GAS = proc(
    "w10881701-heater-gas",
    "TEST #4: Heat System (gas)",
    "4-gas",
    "Heat System — Gas",
    [14, 15],
    ["gas_valve", "thermal_fuse"],
    ["no_heat", "ignition_issue", "gas_heater_check"],
    [
        instr("access_gas_thermal", 2, "Access gas thermal path", "Remove top panel. Locate thermal fuse, cut-off, high-limit per Figure 20b.", "gas_fuse"),
        visual(
            "gas_fuse",
            3,
            "TEST #4b — thermal fuse",
            "Thermal fuse in gas valve circuit: continuity required.",
            checkpoint_yes_no("fuse_ok", "gas_cutoff", "fuse_open", "replace_fuse", "Replace thermal fuse."),
        ),
        visual(
            "gas_cutoff",
            4,
            "TEST #4c — thermal cut-off",
            "Cut-off continuity. Open → replace cut-off and high-limit.",
            checkpoint_yes_no("cutoff_ok", "gas_hilimit", "cutoff_open", "replace_cutoff", "Replace cut-off and high-limit."),
        ),
        visual(
            "gas_hilimit",
            5,
            "High-limit thermostat",
            "Red to black wire continuity at high-limit.",
            checkpoint_yes_no("hilimit_ok", "gas_valve_ref", "hilimit_open", "replace_cutoff", "Replace high-limit and cut-off."),
        ),
        instr(
            "gas_valve_ref",
            6,
            "TEST #4d — gas valve & ignitor",
            "Run w10881701-gas-valve coil checks and verify ignitor 50–500 Ω. Check flame sensor continuity.",
            "gas_heat_verified",
        ),
        outcome("replace_fuse", 7, "Replace thermal fuse", "Replace thermal fuse."),
        outcome("replace_cutoff", 8, "Replace cut-off & high-limit", "Replace thermal cut-off and high-limit."),
        outcome("gas_heat_verified", 9, "Gas heat path verified", "Thermal limits and gas valve path OK — suspect ACU if still no heat."),
    ],
    GAS_DRYER_ONLY,
)

THERMISTORS = proc(
    "w10881701-thermistors",
    "TEST #4a: Thermistors",
    "4a",
    "Thermistors",
    [16, 17],
    ["exhaust_thermistor", "inlet_thermistor"],
    ["thermistor", "F3E1", "F3E3", "no_heat"],
    [
        instr("disconnect_j14", 2, "Disconnect J14 at ACU", "Power off. Remove J14. Measure outlet thermistor at J14-3 to J14-6.", "outlet_ntc_ohms"),
        meas(
            "outlet_ntc_ohms",
            3,
            "Outlet (exhaust) thermistor",
            "~12 kΩ @ 70°F; use OEM R/T table. Open/short per F3E1/F3E2 thresholds.",
            "dryerExhaustThermistorOhms",
            "J14 outlet",
            "J14-3 to J14-6",
            pass_fail_branches("out_ok", "inlet_fuel_variant", "out_bad", "replace_outlet_ntc", "Replace outlet thermistor."),
        ),
        fuel_variant_step("inlet_ntc_electric", "inlet_ntc_gas", order=4, step_id="inlet_fuel_variant"),
        meas(
            "inlet_ntc_electric",
            5,
            "Inlet thermistor (electric)",
            "On high-limit assembly at J14-1 to J14-2. Use electric dryer R/T table.",
            "dryerInletThermistorOhmsElectric",
            "J14 inlet",
            "J14-1 to J14-2",
            pass_fail_branches("in_ok", "thermistors_verified", "in_bad", "replace_inlet_ntc", "Replace inlet thermistor."),
        ),
        meas(
            "inlet_ntc_gas",
            5,
            "Inlet thermistor (gas)",
            "At drum inlet duct, J14-1 to J14-2. Use gas dryer R/T table.",
            "dryerInletThermistorOhmsGas",
            "J14 inlet",
            "J14-1 to J14-2",
            pass_fail_branches("in_gas_ok", "thermistors_verified", "in_gas_bad", "replace_inlet_ntc", "Replace inlet thermistor."),
        ),
        outcome("replace_outlet_ntc", 6, "Replace outlet thermistor", "Replace exhaust/outlet thermistor."),
        outcome("replace_inlet_ntc", 7, "Replace inlet thermistor", "Replace inlet thermistor."),
        outcome("thermistors_verified", 8, "Thermistors verified", "Inlet and outlet NTC within OEM tables."),
    ],
)

THERMAL_FUSE = proc(
    "w10881701-thermal-fuse",
    "TEST #4b: Thermal Fuse",
    "4b",
    "Thermal Fuse",
    [17],
    ["thermal_fuse"],
    ["no_heat", "thermal_fuse_check", "no_spin"],
    [
        instr("access_fuse", 2, "Locate thermal fuse", "Electric: in motor circuit. Gas: in gas valve circuit.", "fuse_continuity"),
        visual(
            "fuse_continuity",
            3,
            "Thermal fuse continuity",
            "0 Ω = good. Open = failed fuse — clear vent restriction before replace.",
            checkpoint_yes_no("fuse_ok", "fuse_verified", "fuse_open", "replace_fuse", "Replace thermal fuse."),
        ),
        outcome("replace_fuse", 4, "Replace thermal fuse", "Replace thermal fuse; inspect vent path."),
        outcome("fuse_verified", 5, "Thermal fuse verified", "Fuse shows continuity."),
    ],
)

THERMAL_CUTOFF = proc(
    "w10881701-thermal-cutoff",
    "TEST #4c: Thermal Cut-Off",
    "4c",
    "Thermal Cut-Off",
    [17],
    ["thermal_cutoff"],
    ["no_heat", "heating_element_check"],
    [
        instr("access_cutoff", 2, "Access thermal cut-off", "At heater assembly per Figure 20a/20b.", "cutoff_continuity"),
        visual(
            "cutoff_continuity",
            3,
            "Cut-off continuity",
            "Open → replace thermal cut-off AND high-limit thermostat.",
            checkpoint_yes_no("cutoff_ok", "cutoff_verified", "cutoff_open", "replace_cutoff", "Replace cut-off and high-limit."),
        ),
        outcome("replace_cutoff", 4, "Replace cut-off & high-limit", "Replace thermal cut-off and high-limit."),
        outcome("cutoff_verified", 5, "Cut-off verified", "Thermal cut-off shows continuity."),
    ],
)

GAS_VALVE = proc(
    "w10881701-gas-valve",
    "TEST #4d: Gas Valve",
    "4d",
    "Gas Valve",
    [17, 18],
    ["gas_valve", "igniter"],
    ["no_heat", "gas_valve_check", "ignition_issue"],
    [
        instr("access_gas", 2, "Access gas valve & ignitor", "Gas off, power disconnected. Remove toe/back access as needed.", "coil_1_2"),
        meas(
            "coil_1_2",
            3,
            "Coil terminals 1–2",
            "Spec 1400 ± 70 Ω.",
            "gasValveCoilOhms",
            "Gas valve",
            "1–2",
            pass_fail_branches("c12_ok", "coil_1_3", "c12_bad", "replace_coils", "Replace gas valve coils."),
        ),
        meas(
            "coil_1_3",
            4,
            "Coil terminals 1–3",
            "Spec 570 ± 28.5 Ω.",
            "gasValveCoilOhms",
            "Gas valve",
            "1–3",
            pass_fail_branches("c13_ok", "coil_4_5", "c13_bad", "replace_coils", "Replace gas valve coils."),
        ),
        meas(
            "coil_4_5",
            5,
            "Coil terminals 4–5",
            "Spec 1300 ± 65 Ω.",
            "gasValveCoilOhms",
            "Gas valve",
            "4–5",
            pass_fail_branches("c45_ok", "ignitor_ohms", "c45_bad", "replace_coils", "Replace gas valve coils."),
        ),
        meas(
            "ignitor_ohms",
            6,
            "Ignitor resistance",
            "Disconnect ignitor 2-pin connector. Spec 50–500 Ω cold.",
            "hotSurfaceIgniterOhms",
            "Ignitor",
            "2-pin",
            pass_fail_branches("ign_ok", "gas_valve_verified", "ign_bad", "replace_ignitor", "Replace ignitor."),
        ),
        outcome("replace_coils", 7, "Replace valve coils", "Replace gas valve coil assembly."),
        outcome("replace_ignitor", 8, "Replace ignitor", "Replace gas ignitor."),
        outcome("gas_valve_verified", 9, "Gas valve path verified", "Coils and ignitor within spec."),
    ],
    GAS_DRYER_ONLY,
)

MOISTURE_SENSOR = proc(
    "w10881701-moisture-sensor",
    "TEST #5: Moisture Sensor",
    "5",
    "Moisture Sensor",
    [18],
    ["moisture_sensor"],
    ["long_dry", "not_drying", "F3E2", "F3E7", "steam_no_water"],
    [
        instr(
            "access_moisture",
            2,
            "Access moisture sensor harness",
            "Slide top back, remove front panel. Disconnect 3-wire moisture sensor below door opening. Remove J13 at ACU.",
            "j13_harness",
        ),
        visual(
            "j13_harness",
            3,
            "J13 harness continuity",
            "Ohmmeter: continuity from J13 at ACU to moisture sensor connector.",
            checkpoint_yes_no("harness_ok", "outer_contacts", "harness_bad", "replace_harness", "Replace main wire harness."),
        ),
        visual(
            "outer_contacts",
            4,
            "Outermost contacts (with MOVs)",
            "Small resistance across outer contacts → clean metal strips; if still low, replace sensor harness.",
            checkpoint_yes_no("outer_ok", "ground_isolation", "outer_bad", "replace_harness", "Replace moisture sensor harness."),
        ),
        visual(
            "ground_isolation",
            5,
            "Outer contacts to center ground",
            "Each outer contact to center terminal must read infinity (OL).",
            checkpoint_yes_no("ground_ok", "moisture_verified", "ground_bad", "replace_harness", "Replace moisture sensor harness."),
        ),
        instr(
            "outlet_ntc_ref",
            6,
            "Outlet thermistor follow-up",
            "If auto-dry still stops early after sensor OK, run TEST #4a outlet thermistor; then TEST #5a dryness level.",
            "moisture_verified",
        ),
        outcome("replace_harness", 7, "Replace harness/sensor", "Replace moisture sensor harness or sensor assembly."),
        outcome("moisture_verified", 8, "Moisture sensor verified", "J13 harness and strip circuit bench checks pass."),
    ],
)

DRYNESS_ADJUST = proc(
    "w10881701-dryness-adjust",
    "TEST #5a: Customer Dryness Level",
    "5a",
    "Adjusting Customer-Focused Dryness Level",
    [19],
    ["moisture_sensor"],
    ["long_dry", "not_drying"],
    [
        instr(
            "dryness_entry",
            2,
            "Enter dryness adjust mode",
            "Standby: press and hold DRYNESS ~3 sec until current level (default 2) shows on 7-segment display.",
            "select_level",
        ),
        instr(
            "select_level",
            3,
            "Select dryness offset",
            "Press DRYNESS to cycle 0 (30% less) through 4 (30% more). Press START to save to ACU EEPROM.",
            "dryness_saved",
        ),
        outcome("dryness_saved", 4, "Dryness level updated", "Customer auto-dry aggressiveness saved."),
    ],
)

BUTTON_INDICATOR = proc(
    "w10881701-button-indicator",
    "TEST #6: Buttons and Indicators",
    "6",
    "Buttons and Indicators",
    [19, 20],
    ["user_interface"],
    ["hmi_check", "F2E1", "F2E3", "F2E4", "F2E5", "error_code"],
    [
        instr(
            "key_encoder_test",
            2,
            "Key Activation & Encoder Test",
            "Service Diagnostics → press 1st button (Key Activation & Encoder Test). Verify all indicators, buttons, and beeps.",
            "ui_test_pass",
        ),
        visual(
            "ui_test_pass",
            3,
            "Key/encoder test result",
            "All indicators light, buttons respond, and beep heard?",
            [
                {"id": "ui_pass", "label": "Passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "ui_verified"},
                {"id": "ui_fail", "label": "Fails", "when": {"kind": "checkpoint_no"}, "nextStepId": "acu_ui_connectors"},
            ],
        ),
        visual(
            "acu_ui_connectors",
            4,
            "ACU and UI connectors seated",
            "All connectors fully seated; UI assembly in console?",
            checkpoint_yes_no("conn_ok", "replace_ui", "conn_bad", "replace_ui", "Reseat UI and retest."),
        ),
        outcome("replace_ui", 5, "Replace UI assembly", "Replace user interface and housing assembly. If supply OK but UI dead, replace ACU."),
        outcome("ui_verified", 6, "UI verified", "Buttons and indicators respond in Key Activation & Encoder Test."),
    ],
)

DOOR_SWITCH = proc(
    "w10881701-door-switch",
    "TEST #7: Door Switch",
    "7",
    "Door Switch",
    [20],
    ["door_switch"],
    ["door_switch_check", "wont_start", "no_spin"],
    [
        visual(
            "drum_light_check",
            2,
            "Drum light door check",
            "Open door → drum light on. Close door → drum light off. Confirms door switch sense path.",
            checkpoint_yes_no("light_ok", "door_wiring", "light_bad", "replace_door_switch", "Replace door switch / wire assembly."),
        ),
        visual(
            "door_wiring",
            3,
            "Door switch wiring at ACU",
            "Power off. Verify door switch wires J8-4 (tan) and J8-3 (white) connected per wiring diagram.",
            checkpoint_yes_no("wire_ok", "door_verified", "wire_bad", "replace_door_switch", "Replace door switch assembly."),
        ),
        outcome("replace_door_switch", 4, "Replace door switch", "Replace door switch; verify start/stop with door."),
        outcome("door_verified", 5, "Door switch verified", "Drum light and door switch wiring OK."),
    ],
)

DRUM_LED = proc(
    "w10881701-drum-led",
    "TEST #8: Drum LED",
    "8",
    "Drum LED",
    [43],
    ["drum_light"],
    ["drum_light_check", "no_light"],
    [
        instr("access_drum_led", 2, "Access drum LED circuit", "Remove console. Verify J6 drum LED connector seated at ACU.", "harness_check"),
        visual(
            "harness_check",
            3,
            "Drum LED harness",
            "Check inline connections between drum LED and ACU J6.",
            checkpoint_yes_no("harness_ok", "j6_current", "harness_bad", "repair_harness", "Repair or replace drum LED harness."),
        ),
        visual(
            "j6_current",
            4,
            "J6 driver current (150 mA)",
            "Unplug J6. Milliamps across J6 pins 1 & 3, power on, door open — expect ~150 mA if ACU driver OK.",
            checkpoint_yes_no("current_ok", "replace_led", "current_bad", "replace_acu", "Replace ACU — drum LED driver missing."),
        ),
        outcome("repair_harness", 5, "Repair harness", "Repair drum LED harness or connections."),
        outcome("replace_led", 6, "Replace drum LED", "Replace drum LED assembly."),
        outcome("replace_acu", 7, "Replace ACU", "Replace ACU when 150 mA present but LED still dark."),
    ],
)

WATER_VALVE = proc(
    "w10881701-water-valve",
    "TEST #9: Water Valve",
    "9",
    "Water Valve",
    [44],
    ["steam_valve"],
    ["steam_no_water", "steam_valve_check", "water_valve_check"],
    [
        instr(
            "service_test_spray",
            2,
            "Service Test Mode spray check",
            "Enter Service Test Mode (2nd diagnostic button, then START). Skip to step 8 — verify water sprays into drum.",
            "nozzle_check",
        ),
        visual(
            "nozzle_check",
            3,
            "Nozzle residue (leak/over-spray)",
            "If leaking or over-spraying: remove drum nozzle, clean residue, reinstall with 7/16 in wrench.",
            checkpoint_yes_no("nozzle_ok", "supply_on", "nozzle_bad", "clean_nozzle", "Clean or replace drum water nozzle."),
        ),
        instr("supply_on", 4, "Verify water supply", "Confirm fill hose connected and household water on.", "j8_1_wired"),
        visual(
            "j8_1_wired",
            5,
            "J8-1 water valve wire",
            "Red wire from water valve connected to ACU J8-1.",
            checkpoint_yes_no("wire_ok", "valve_coil_ohms", "wire_bad", "repair_harness", "Repair water valve harness."),
        ),
        meas(
            "valve_coil_ohms",
            6,
            "Water valve coil J8-1 to J9-2",
            "Power off. Coil resistance 510–590 Ω (strip circuit). Open → replace valve assembly.",
            "whirlpoolCcuDryerSteamValveOhms",
            "ACU water valve",
            "J8-1 to J9-2",
            pass_fail_branches("valve_ok", "valve_verified", "valve_bad", "replace_valve", "Replace water valve assembly."),
        ),
        instr(
            "valve_plumbing",
            7,
            "Valve plumbing check",
            "Remove back panel — verify hose and wires at valve; hose to drum nozzle connected.",
            "replace_acu",
        ),
        outcome("clean_nozzle", 8, "Service nozzle", "Clean or replace drum water nozzle."),
        outcome("repair_harness", 9, "Repair harness", "Repair water valve wiring to J8-1."),
        outcome("replace_valve", 10, "Replace water valve", "Replace water valve assembly."),
        outcome("replace_acu", 11, "Replace ACU", "Replace ACU when valve and plumbing OK but no spray."),
        outcome("valve_verified", 12, "Water valve verified", "Spray confirmed in Service Test Mode; coil in spec."),
    ],
)

SERVICE_LEDS = proc(
    "w10881701-service-leds",
    "TEST #10: Service LEDs",
    "10",
    "Service LEDs",
    [45],
    ["user_interface"],
    ["hmi_check", "F6E2", "F6E3"],
    [
        instr(
            "access_service_leds",
            2,
            "Access UI service LEDs",
            "Separate glass top from UI frame. Locate amber Service Power, blue Service Data, white Service Button Sounds LEDs.",
            "power_led",
        ),
        visual(
            "power_led",
            3,
            "Service Power (amber)",
            "Flashes 1 Hz when UI powered. No flash → check UI harness and connections.",
            checkpoint_yes_no("power_ok", "data_led", "power_bad", "check_harness", "Check UI power harness."),
        ),
        visual(
            "data_led",
            4,
            "Service Data (blue)",
            "Illuminates/flashes when ACU↔UI comm OK. Cycle POWER or replug — if still dark, check harness and ACU.",
            checkpoint_yes_no("data_ok", "button_led", "data_bad", "check_harness", "Check ACU↔UI harness continuity."),
        ),
        visual(
            "button_led",
            5,
            "Service Button Sounds (white)",
            "On when Control Lock off and Audio Level not muted. Hold STEAM REFRESH 3 sec to toggle lock; use AUDIO LEVEL if muted.",
            checkpoint_yes_no("button_ok", "service_leds_verified", "button_bad", "replace_ui", "Replace UI — speaker/lock/audio path fault."),
        ),
        outcome("check_harness", 6, "Check harness", "Verify UI harness continuity and connector seating."),
        outcome("replace_ui", 7, "Replace UI", "Replace UI when all three service LEDs fail after harness OK."),
        outcome("service_leds_verified", 8, "Service LEDs verified", "All three UI service LEDs behave per manual."),
    ],
)


def diagnostic_entry_bundle() -> dict:
    return {
        "id": "w10881701-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_ccu_dryer",
        "manualId": "W10881701",
        "title": "W10881701 — Service Diagnostics entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console", "any"],
        "description": "Enter ACU Service Diagnostics (3-button sequence × 3). Success: all indicators on 5 sec with 888, then fault scroll or home.",
        "tags": ["service_diagnostic", "fault_codes"],
        "entryStepId": "prep_standby",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [14, 15],
        },
        "steps": [
            {
                "id": "prep_standby",
                "order": 1,
                "type": "instruction",
                "title": "Standby mode",
                "body": "Dryer plugged in with all indicators off.",
                "sourceExcerpt": "Be sure the dryer is in standby mode.",
                "requiresInput": False,
                "defaultNextStepId": "three_button_entry",
            },
            {
                "id": "three_button_entry",
                "order": 2,
                "type": "instruction",
                "title": "3-button diagnostic entry",
                "body": (
                    "Select any three buttons (except POWER). Within 8 seconds, press and release each button once, "
                    "then repeat the same 3-button sequence two more times (9 presses total). "
                    "Select language, confirm service technician warning, then Diagnostics Home appears."
                ),
                "sourceExcerpt": "Press/release 1st, 2nd, 3rd button — repeat sequence 2 more times.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


def service_test_bundle() -> dict:
    return {
        "id": "w10881701-service-test-mode",
        "version": "1.0.0",
        "platformId": "whirlpool_ccu_dryer",
        "manualId": "W10881701",
        "title": "W10881701 — Service Test Mode",
        "modeKind": "load_test",
        "uiVariants": ["console", "any"],
        "description": "From Service Diagnostics, press 2nd button then START — L1/L2/heater/airflow sequence; step 8 verifies water spray.",
        "tags": ["service_test", "live_test"],
        "entryStepId": "service_test_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [15, 16],
        },
        "steps": [
            {
                "id": "service_test_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Service Test Mode",
                "body": (
                    "With Service Diagnostic mode active, press and release the 2nd diagnostic button, "
                    "then press and release START. Display shows 888 for 2 sec; START flashes. "
                    "Press START to begin L2 → L1 → heater → airflow sequence. Step 8 verifies water valve spray."
                ),
                "sourceExcerpt": "User enters Service Test Mode through Service Diagnostics.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    ACU_POWER,
    SUPPLY_CONNECTIONS,
    MOTOR_CIRCUIT,
    HEATER_ELECTRIC,
    HEATER_GAS,
    THERMISTORS,
    THERMAL_FUSE,
    THERMAL_CUTOFF,
    GAS_VALVE,
    MOISTURE_SENSOR,
    DRYNESS_ADJUST,
    BUTTON_INDICATOR,
    DOOR_SWITCH,
    DRUM_LED,
    WATER_VALVE,
    SERVICE_LEDS,
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLES = [diagnostic_entry_bundle(), service_test_bundle()]
BUNDLE_FILES = ["w10881701-diagnostic-entry.json", "w10881701-service-test-mode.json"]


def write_catalog() -> None:
    w10881701_entries = [
        {
            "id": item["id"],
            "oemSection": item["source"]["oemTestNumber"],
            "title": item["title"],
            "status": "generated",
            "knowledgeIds": [
                step["measurementKnowledgeId"]
                for step in item["steps"]
                if step.get("measurementKnowledgeId")
            ],
            "relatedCodes": [tag for tag in item.get("tags", []) if tag.startswith("F")],
        }
        for item in PROCEDURES
    ]
    catalog_path = OUT / "procedureCatalog.json"
    existing = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.is_file() else {}
    w10680150_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w10680150-")
    ]
    catalog = {
        "manualId": "W10680150",
        "platformId": "whirlpool_ccu_dryer",
        "templateId": "electric_dryer",
        "label": "Whirlpool/Maytag ACU/CCU electric & gas dryer",
        "notes": (
            "W10680150 tech sheet + W10881701 steam dryer manual share whirlpool_ccu_dryer. "
            "Connector J* (W10881701) = P* (W10680150). Duet Sport 83/85 → whirlpool_duet_sport_dryer. "
            "Steam 9.2 cu ft WED95*/MED95* → W10881701 procedures include TEST #8–#10."
        ),
        "plannedProcedures": w10680150_entries + w10881701_entries,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {catalog_path.name} ({len(w10680150_entries)} W10680150 + {len(w10881701_entries)} W10881701)")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)

    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        path = OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")

    for item, filename in zip(BUNDLES, BUNDLE_FILES, strict=True):
        path = BUNDLE_OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote bundles/{path.name}")

    write_catalog()

    for script_name in (
        "attach_w10881701_diagnostic_effects.py",
        "attach_w10881701_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
