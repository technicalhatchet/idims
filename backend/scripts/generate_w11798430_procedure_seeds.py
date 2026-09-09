#!/usr/bin/env python3
"""Generate W11798430 (Whirlpool ACU top-load dryer WED4100 technical manual) procedure seeds."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_acu_tl_dryer"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W11798430",
    "manualTitle": "Whirlpool 7.0 cu. ft. Gas & Electric Dryers Technical Manual (WED4100/WGD4100)",
    "extractedTextFile": "backend/docs/manuals/technical-manual-w11798430-revc wed4100-extracted.txt",
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
        "platformId": "whirlpool_acu_tl_dryer",
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
        "WED/MED = electric single-element ~10 Ω; WGD/MGD = gas burner.",
        [
            {"id": "fuel_electric", "label": "Electric", "when": {"kind": "checkpoint_yes"}, "nextStepId": electric_next},
            {"id": "fuel_gas", "label": "Gas", "when": {"kind": "checkpoint_no"}, "nextStepId": gas_next},
        ],
    )


ACU_POWER = proc(
    "w11798430-acu-power",
    "TEST #1: ACU Power Check",
    "1",
    "ACU Power Check",
    [51, 53],
    ["acu"],
    ["supply_issue", "F1E1", "F6E1", "F6E2", "no_power"],
    [
        instr(
            "verify_outlet",
            2,
            "Verify outlet voltage",
            "Electric: 240/208 VAC (2-phase or 3-phase). Gas: 120 VAC. Confirm green ACU status LED blinks slowly after power-up.",
            "access_acu",
        ),
        instr("access_acu", 3, "Access ACU", "Remove console/top panel. Restore power only for live voltage steps below.", "live_l1"),
        visual(
            "live_l1",
            4,
            "120 VAC at J7-4 (N) and J7-3 (L1)",
            "AC volts: black probe J7-4, red probe J7-3 — expect 120 VAC.",
            checkpoint_yes_no("l1_ok", "live_5v", "l1_bad", "supply_connections", "No L1 at ACU — perform TEST #2 supply connections."),
        ),
        visual(
            "live_5v",
            5,
            "+5 VDC at J4-1 vs J4-2",
            "Unplug J4. DC volts: red J4-1, black J4-2. Missing +5 VDC → replace ACU.",
            checkpoint_yes_no("v5_ok", "live_12v", "v5_bad", "replace_acu", "Replace ACU — +5 VDC missing."),
        ),
        visual(
            "live_12v",
            6,
            "+12 VDC at J2-1 vs J2-4",
            "DC volts: red J2-1, black J2-4. +12 VDC actuates relays.",
            checkpoint_yes_no("v12_ok", "acu_power_verified", "v12_bad", "j2_isolate", "Isolate +12 VDC fault before replacing ACU."),
        ),
        instr(
            "j2_isolate",
            7,
            "J2 isolation check",
            "Power off. Unplug J2 from ACU, restore power, retest J2 pins 1–4. If +12 returns, check HMI harness; if still missing, replace ACU.",
            "replace_acu",
        ),
        instr("supply_connections", 8, "Supply path fault", "Perform TEST #2 supply connections.", "acu_power_verified"),
        outcome("replace_acu", 9, "Replace ACU", "Replace machine control electronics."),
        outcome("acu_power_verified", 10, "ACU power verified", "Line, +5 VDC, and +12 VDC present at ACU."),
    ],
)

SUPPLY_CONNECTIONS = proc(
    "w11798430-supply-connections",
    "TEST #2: Supply Connections",
    "2",
    "Supply Connections",
    [10, 11],
    ["supply"],
    ["supply_issue", "voltage_check"],
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
        instr("electric_l1_id", 5, "Identify L1 at block", "Note which plug terminal connects to left-most block contact (L1).", "electric_l1_p7"),
        visual(
            "electric_l1_p7",
            6,
            "L1 plug to J7-3",
            "Continuity from L1 plug terminal to ACU J7-3 (black).",
            checkpoint_yes_no("el1_ok", "electric_n_p7", "el1_bad", "replace_harness", "Replace harness or cord."),
        ),
        visual(
            "electric_n_p7",
            7,
            "Neutral plug to J7-4",
            "Continuity from plug N to ACU J7-4 (white).",
            checkpoint_yes_no("enp7_ok", "electric_l2_motor", "enp7_bad", "replace_harness", "Replace main harness."),
        ),
        visual(
            "electric_l2_motor",
            8,
            "L2 to motor pin 2",
            "Continuity from L2 plug terminal to pin 2 (red) of motor connector.",
            checkpoint_yes_no("el2_ok", "connectors_seated", "el2_bad", "replace_harness", "Replace main harness or cord."),
        ),
        instr("gas_cover", 3, "Gas — cord to harness", "Verify power cord firmly connected to wire harness.", "gas_n_p7"),
        visual(
            "gas_n_p7",
            4,
            "Gas — neutral to J7-4",
            "Continuity plug N to J7-4. Test cord neutral if open.",
            checkpoint_yes_no("gn_ok", "gas_l1_p7", "gn_bad", "replace_cord", "Replace power cord."),
        ),
        visual(
            "gas_l1_p7",
            5,
            "Gas — L1 to J7-3",
            "Continuity L1 plug to J7-3.",
            checkpoint_yes_no("gl1_ok", "connectors_seated", "gl1_bad", "replace_harness", "Replace cord or harness."),
        ),
        visual(
            "connectors_seated",
            9,
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
    "w11798430-motor-circuit",
    "TEST #3: Motor Circuit",
    "3",
    "Motor Circuit",
    [59, 61],
    ["motor"],
    ["motor_check", "wont_spin", "no_spin", "F1E1"],
    [
        instr(
            "access_acu_motor",
            2,
            "Inspect belt and door path",
            "Access ACU. Check drum belt. Door closed: 0–2 Ω J7-3 (L1) to J7-5 (door). Motor path J7-1 to J7-3: 1–6 Ω = OK at ACU.",
            "door_switch_bench",
        ),
        visual(
            "door_switch_bench",
            3,
            "Door switch J7-3 to J7-5",
            "Door closed: 0–2 Ω across J7-3 (black) and J7-5 (blue).",
            checkpoint_yes_no("door_ok", "motor_circuit_ohms", "door_bad", "replace_door_switch", "Replace door switch assembly."),
        ),
        meas(
            "motor_circuit_ohms",
            4,
            "Motor circuit at ACU",
            "J7-1 to J7-3: 1–6 Ω indicates acceptable motor circuit path at ACU.",
            "dryerMotorCircuitOhms",
            "ACU motor path",
            "J7-1 to J7-3",
            pass_fail_branches("mc_ok", "access_motor", "mc_bad", "replace_acu", "Motor circuit OK at ACU — replace ACU if still no run."),
        ),
        instr(
            "access_motor",
            5,
            "Access drive motor",
            "Check thermal fuse (TEST #4b). Release belt from pulley. Disconnect motor white connector; remove bare copper from pin 5.",
            "main_winding",
        ),
        meas(
            "main_winding",
            6,
            "Main winding pin 4–5",
            "Lt blue pin 4 to bare copper removed from pin 5. Spec 3.1–3.8 Ω.",
            "whirlpoolAcuTlDryer4100MotorMainWindingOhms",
            "Motor main",
            "4–5",
            pass_fail_branches("main_ok", "start_winding", "main_bad", "replace_motor", "Replace drive motor."),
        ),
        meas(
            "start_winding",
            7,
            "Start winding pin 4–3",
            "Lt blue pin 4 to bare copper at pin 3. Spec 2.5–3.2 Ω.",
            "whirlpoolAcuTlDryer4100MotorStartWindingOhms",
            "Motor start",
            "4–3",
            pass_fail_branches("start_ok", "motor_verified", "start_bad", "replace_motor", "Replace drive motor."),
        ),
        outcome("replace_motor", 8, "Replace motor", "Replace drive motor."),
        outcome("replace_door_switch", 9, "Replace door switch", "Replace door switch."),
        outcome("replace_acu", 10, "Replace ACU", "Replace ACU when motor circuit OK at J7-1/J7-3 but unit won't run."),
        outcome("motor_verified", 11, "Motor circuit verified", "Motor, belt, and door switch OK."),
    ],
)

HEATER_ELECTRIC = proc(
    "w11798430-heater-electric",
    "TEST #4: Heat System (electric)",
    "4",
    "Heat System",
    [14, 15],
    ["heating_element"],
    ["no_heat", "heating_element_check", "F1E1"],
    [
        instr("access_heat", 2, "Access heater assembly", "Remove front panel. Access thermal cut-off and heater per manual figures.", "element_ohms"),
        meas(
            "element_ohms",
            3,
            "Heater cut-off red to heater red",
            "Measure red wire at thermal cut-off to red wire at heater. Spec ~10 Ω.",
            "whirlpoolAcuTlDryerHeaterOhms",
            "Heater element",
            "cut-off red to heater red",
            pass_fail_branches("heat_ok", "thermal_cutoff_l1", "heat_bad", "replace_element", "Replace open heating element."),
        ),
        visual(
            "thermal_cutoff_l1",
            4,
            "L1 through thermal cut-off to relays",
            "Continuity J7-3 (L1) through thermal cut-off to heater relay path.",
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
            "Outlet thermistor J4-1 to J4-2",
            "Disconnect J4. Use outlet thermistor R/T table; open/short → replace thermistor.",
            checkpoint_yes_no("ntc_ok", "heater_verified", "ntc_bad", "replace_thermistor", "Replace outlet thermistor."),
        ),
        outcome("replace_element", 7, "Replace element", "Replace heating element."),
        outcome("replace_cutoff", 8, "Replace cut-off", "Replace thermal cut-off."),
        outcome("replace_hilimit", 9, "Replace cut-off & high-limit", "Replace thermal cut-off and high-limit thermostat."),
        outcome("replace_thermistor", 10, "Replace thermistor", "Replace outlet thermistor."),
        outcome("heater_verified", 11, "Heater circuit verified", "Elements, limits, and outlet NTC within spec."),
    ],
    ELECTRIC_DRYER_ONLY,
)

HEATER_GAS = proc(
    "w11798430-heater-gas",
    "TEST #4: Heat System (gas)",
    "4-gas",
    "Heat System — Gas",
    [14, 15],
    ["gas_valve", "thermal_fuse"],
    ["no_heat", "ignition_issue", "gas_heater_check"],
    [
        instr("access_gas_thermal", 2, "Access gas thermal path", "Verify gas supply on. Remove back panel for cut-off and high-limit.", "gas_cutoff"),
        visual(
            "gas_cutoff",
            3,
            "TEST #4c — thermal cut-off",
            "Cut-off continuity. Open → replace cut-off and high-limit.",
            checkpoint_yes_no("cutoff_ok", "gas_hilimit", "cutoff_open", "replace_cutoff", "Replace cut-off and high-limit."),
        ),
        visual(
            "gas_hilimit",
            4,
            "High-limit thermostat",
            "Black and yellow wire continuity at high-limit.",
            checkpoint_yes_no("hilimit_ok", "gas_valve_ref", "hilimit_open", "replace_cutoff", "Replace high-limit and cut-off."),
        ),
        instr(
            "gas_valve_ref",
            5,
            "TEST #4d — gas valve & ignitor",
            "Run w11798430-gas-valve coil checks and verify ignitor 40–200 Ω. Check flame sensor continuity.",
            "gas_heat_verified",
        ),
        outcome("replace_cutoff", 6, "Replace cut-off & high-limit", "Replace thermal cut-off and high-limit."),
        outcome("gas_heat_verified", 7, "Gas heat path verified", "Thermal limits and gas valve path OK — suspect centrifugal switch or ACU if still no heat."),
    ],
    GAS_DRYER_ONLY,
)

THERMISTORS = proc(
    "w11798430-thermistors",
    "TEST #4a: Thermistors",
    "4a",
    "Thermistors",
    [16, 17],
    ["exhaust_thermistor", "inlet_thermistor"],
    ["thermistor", "F3E1", "F3E3", "no_heat"],
    [
        instr("disconnect_j4", 2, "Disconnect J4 at ACU", "Power off. Remove J4. Measure inlet thermistor at J4-3 to J4-4 first per OEM sequence.", "inlet_ntc_ohms"),
        meas(
            "inlet_ntc_ohms",
            3,
            "Inlet thermistor",
            "J4-3 to J4-4. Use inlet thermistor R/T table (shared gas/electric on W4100).",
            "dryerInletThermistorOhmsElectric",
            "J4 inlet",
            "J4-3 to J4-4",
            pass_fail_branches("in_ok", "outlet_ntc_ohms", "in_bad", "replace_inlet_ntc", "Replace inlet thermistor."),
        ),
        meas(
            "outlet_ntc_ohms",
            4,
            "Outlet (exhaust) thermistor",
            "J4-1 to J4-2. Use outlet thermistor R/T table. Open/short per F3E1.",
            "dryerExhaustThermistorOhms",
            "J4 outlet",
            "J4-1 to J4-2",
            pass_fail_branches("out_ok", "thermistors_verified", "out_bad", "replace_outlet_ntc", "Replace outlet thermistor."),
        ),
        outcome("replace_outlet_ntc", 6, "Replace outlet thermistor", "Replace exhaust/outlet thermistor."),
        outcome("replace_inlet_ntc", 7, "Replace inlet thermistor", "Replace inlet thermistor."),
        outcome("thermistors_verified", 8, "Thermistors verified", "Inlet and outlet NTC within OEM tables."),
    ],
)

THERMAL_FUSE = proc(
    "w11798430-thermal-fuse",
    "TEST #4b: Thermal Fuse",
    "4b",
    "Thermal Fuse",
    [17],
    ["thermal_fuse"],
    ["no_heat", "thermal_fuse_check", "no_spin"],
    [
        instr("access_fuse", 2, "Locate thermal fuse", "Wired in series with drive motor. Remove back panel.", "fuse_continuity"),
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
    "w11798430-thermal-cutoff",
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
    "w11798430-gas-valve",
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
            "Spec 1350 ± 67.5 Ω.",
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
            "Disconnect ignitor 2-pin connector. Spec 40–200 Ω at ~75°F.",
            "whirlpoolAcuTlDryer4100IgniterOhms",
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

HMI = proc(
    "w11798430-hmi",
    "TEST #5: HMI",
    "5",
    "HMI",
    [19, 20],
    ["user_interface"],
    ["hmi_check", "F2E1", "F6E1", "F6E2", "error_code"],
    [
        instr(
            "ui_component_test",
            2,
            "HMI Test",
            "Service Diagnostic mode → press Key 1 for HMI Test. Encoder knob test, then button/LED toggle per manual.",
            "ui_test_pass",
        ),
        visual(
            "ui_test_pass",
            3,
            "UI test result",
            "All LEDs, buttons, and cycle selector indicators respond with beep?",
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
        outcome("ui_verified", 6, "UI verified", "Buttons and indicators respond in UI Component Test."),
    ],
)

DOOR_SWITCH = proc(
    "w11798430-door-switch",
    "TEST #6: Door Switch",
    "6",
    "Door Switch",
    [20],
    ["door_switch"],
    ["door_switch_check", "wont_start", "no_spin"],
    [
        instr(
            "door_diag",
            2,
            "Door / drum light check",
            "Opening door should turn drum light on; closing turns it off. If not, continue bench test.",
            "door_bench",
        ),
        visual(
            "door_bench",
            3,
            "J7-3 to J7-5 bench check",
            "Power off. Door closed: 0–2 Ω across J7-3 and J7-5. Open = OL.",
            checkpoint_yes_no("door_ok", "door_verified", "door_bad", "replace_door_switch", "Replace door switch assembly."),
        ),
        outcome("replace_door_switch", 4, "Replace door switch", "Replace door switch; retest Quick Diagnostic."),
        outcome("door_verified", 5, "Door switch verified", "Door switch diagnostic and bench checks pass."),
    ],
)



DRUM_LIGHT = proc(
    "w11798430-drum-light",
    "TEST #7: Drum Light",
    "7",
    "Drum Light",
    [74],
    ["drum_light"],
    ["drum_light_check", "hmi_check"],
    [
        instr(
            "door_light_check",
            2,
            "Door-open drum light",
            "Open door — drum light should illuminate. If not, access ACU and drum light harness.",
            "harness_check",
        ),
        instr(
            "harness_check",
            3,
            "Harness continuity",
            "Power off. Check harness and inline connections between drum light and ACU.",
            "j7_bulb_ohms",
        ),
        visual(
            "j7_bulb_ohms",
            4,
            "J7-3 to J7-4 with door open",
            "Ohms at ACU J7 pins 3–4, door open: expect 10 Ω–1.44 kΩ (bulb good). Door closed = OL.",
            checkpoint_yes_no("bulb_ok", "drum_light_verified", "bulb_bad", "replace_bulb_or_switch", "Replace bulb or door switch per pin-out test at light."),
        ),
        outcome("replace_bulb_or_switch", 5, "Replace bulb or door switch", "Replace drum light bulb; if bulb OK at light, replace door switch."),
        outcome("replace_acu_drum", 6, "Replace ACU", "Resistance good at board but no light — replace ACU."),
        outcome("drum_light_verified", 7, "Drum light verified", "Drum light illuminates when door opens."),
    ],
)

def diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11798430-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_acu_tl_dryer",
        "manualId": "W11798430",
        "title": "W11798430 — Service Diagnostic entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console", "any"],
        "description": "Enter Service Diagnostic mode (Key 1 → Key 2 → Key 3, repeat × 3 within 8 s).",
        "tags": ["service_diagnostic", "fault_codes"],
        "entryStepId": "prep_standby",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [31, 32],
        },
        "steps": [
            {
                "id": "prep_standby",
                "order": 1,
                "type": "instruction",
                "title": "Standby mode",
                "body": "Dryer plugged in with all LEDs off.",
                "sourceExcerpt": "Be sure the dryer is in standby mode (plugged in with all LEDs off).",
                "requiresInput": False,
                "defaultNextStepId": "three_button_entry",
            },
            {
                "id": "three_button_entry",
                "order": 2,
                "type": "instruction",
                "title": "Key 1/2/3 diagnostic entry",
                "body": (
                    "Within 8 seconds: press and release Key 1, Key 2, Key 3 — repeat this 3-button sequence "
                    "two more times (9 presses total). All HMI indicators flash 1 s on success; STATUS LEDs blink "
                    "twice if no saved fault codes."
                ),
                "sourceExcerpt": "Press/release Key 1, Key 2, Key 3 — repeat sequence 2 more times.",
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
    HMI,
    DOOR_SWITCH,
    DRUM_LIGHT,
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLES = [diagnostic_entry_bundle()]
BUNDLE_FILES = ["w11798430-diagnostic-entry.json"]


def write_catalog() -> None:
    w11798430_entries = [
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
    w11416805_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w11416805-")
    ]
    catalog = {
        "manualId": "W11416805",
        "platformId": "whirlpool_acu_tl_dryer",
        "templateId": "electric_dryer",
        "label": "Whirlpool/Maytag ACU top-load dryer (WED4100/WED5100, W11798430/W11416805)",
        "notes": (
            "W11798430 WED41*/WGD41* + W11416805 WED51*/WGD51* share whirlpool_acu_tl_dryer. "
            "W4100 uses J7/J4 connectors; W5100 uses J8/J9/J14. W5100 adds moisture sensor and steam valve tests."
        ),
        "plannedProcedures": w11416805_entries + w11798430_entries,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {catalog_path.name} ({len(w11416805_entries)} W11416805 + {len(w11798430_entries)} W11798430)")


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
        "attach_w11798430_diagnostic_effects.py",
        "attach_w11798430_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
