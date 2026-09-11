#!/usr/bin/env python3
"""Generate W10410465 (Whirlpool CCU top-load dryer tech sheet) procedure seeds."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_ccu_tl_dryer"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W10410465",
    "manualTitle": "Whirlpool & Maytag CCU Top-Load Dryer Service Data Sheet",
    "extractedTextFile": "backend/docs/manuals/WPL Top load Dryer Service Manual-extracted.txt",
    "verifiedAt": "2026-09-10",
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
        "platformId": "whirlpool_ccu_tl_dryer",
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


CCU_POWER = proc(
    "w10410465-ccu-power",
    "TEST #1: CCU Power Check",
    "1",
    "CCU Power Check",
    [9, 10],
    ["ccu"],
    ["supply_issue", "F1E1", "F6E1", "F6E2", "no_power"],
    [
        instr("verify_outlet", 2, "Verify outlet voltage", "Electric: 240/208 VAC. Gas: 120 VAC. Time-delay fuse required on electric.", "access_ccu"),
        instr("access_ccu", 3, "Access CCU", "Remove top panel. Restore power only for live voltage steps below.", "live_l1"),
        visual(
            "live_l1",
            4,
            "120 VAC at P8-3 (N) and P9-2 (L1)",
            "Use needle probes. Black to P8-3, red to P9-2 — expect 120 VAC.",
            checkpoint_yes_no("l1_ok", "live_5v", "l1_bad", "supply_connections", "No L1 at CCU — perform TEST #2 supply connections."),
        ),
        visual(
            "live_5v",
            5,
            "+5 VDC at P2-1 vs P2-3",
            "DC volts: red P2-1, black P2-3. Missing +5V with P14 unplugged → shorted thermistor (TEST #4a).",
            checkpoint_yes_no("v5_ok", "live_12v", "v5_bad", "p14_thermistor_short", "Diagnose thermistor short or harness before replacing CCU."),
        ),
        visual(
            "live_12v",
            6,
            "+12 VDC at P5-8 vs P5-3",
            "DC volts: red P5-8, black P5-3. +12 VDC actuates relays.",
            checkpoint_yes_no("v12_ok", "ccu_power_verified", "v12_bad", "replace_ccu", "Replace CCU — +12 VDC missing."),
        ),
        instr(
            "p14_thermistor_short",
            7,
            "Thermistor short isolation",
            "Disconnect power. Unplug P14, restore power, retest +5 VDC. If +5 returns, run TEST #4a thermistors.",
            "ccu_power_verified",
        ),
        instr("supply_connections", 8, "Supply path fault", "Perform TEST #2 supply connections.", "ccu_power_verified"),
        outcome("replace_ccu", 9, "Replace CCU", "Replace machine control electronics."),
        outcome("ccu_power_verified", 10, "CCU power verified", "Line, +5 VDC, and +12 VDC present at CCU."),
    ],
)

SUPPLY_CONNECTIONS = proc(
    "w10410465-supply-connections",
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
            "L1 plug to P9-2",
            "Continuity from L1 plug terminal to CCU P9-2 (black).",
            checkpoint_yes_no("el1_ok", "electric_n_p8", "el1_bad", "replace_harness", "Replace harness or cord."),
        ),
        visual(
            "electric_n_p8",
            7,
            "Neutral plug to P8-3",
            "Continuity from plug N to CCU P8-3 (white).",
            checkpoint_yes_no("enp8_ok", "connectors_seated", "enp8_bad", "replace_harness", "Replace main harness."),
        ),
        instr("gas_cover", 3, "Gas — cord to harness", "Verify power cord firmly connected to wire harness.", "gas_n_p8"),
        visual(
            "gas_n_p8",
            4,
            "Gas — neutral to P8-3",
            "Continuity plug N to P8-3. Test cord neutral if open.",
            checkpoint_yes_no("gn_ok", "gas_l1_p9", "gn_bad", "replace_cord", "Replace power cord."),
        ),
        visual(
            "gas_l1_p9",
            5,
            "Gas — L1 to P9-2",
            "Continuity L1 plug to P9-2.",
            checkpoint_yes_no("gl1_ok", "connectors_seated", "gl1_bad", "replace_harness", "Replace cord or harness."),
        ),
        visual(
            "connectors_seated",
            8,
            "All CCU/UI connectors seated",
            "All harness connectors fully inserted; UI assembly seated in console.",
            checkpoint_yes_no("conn_ok", "supply_verified", "conn_bad", "reseat_connectors", "Reseat connectors and retest."),
        ),
        outcome("replace_cord", 9, "Replace power cord", "Replace power cord."),
        outcome("replace_harness", 10, "Replace harness", "Replace main wire harness."),
        outcome("reseat_connectors", 11, "Reseat connectors", "Reseat CCU/UI connectors; run Quick Diagnostic Test."),
        outcome("supply_verified", 12, "Supply verified", "Cord, harness, and connector seating OK."),
    ],
)

MOTOR_CIRCUIT = proc(
    "w10410465-motor-circuit",
    "TEST #3: Motor Circuit",
    "3",
    "Motor Circuit",
    [12, 13],
    ["motor"],
    ["motor_check", "wont_spin", "no_spin"],
    [
        instr("access_ccu_motor", 2, "CCU motor path pre-check", "Access CCU. Measure P8-4 to P9-1. 1–6 Ω = motor circuit OK at CCU — suspect CCU if still no run.", "door_switch_bench"),
        visual(
            "door_switch_bench",
            3,
            "Door switch P8-3 to P8-4",
            "Door closed: 0–2 Ω across P8-3 (white) and P8-4 (tan).",
            checkpoint_yes_no("door_ok", "access_motor", "door_bad", "replace_door_switch", "Replace door switch assembly."),
        ),
        instr("access_motor", 4, "Access motor & belt switch", "Release belt from belt switch pulley. Disconnect motor switch white connector.", "motor_circuit_ohms"),
        meas(
            "motor_circuit_ohms",
            5,
            "Motor circuit at CCU (optional)",
            "P8-4 to P9-1: 1–6 Ω indicates acceptable motor circuit path at CCU.",
            "dryerMotorCircuitOhms",
            "CCU motor path",
            "P8-4 to P9-1",
            pass_fail_branches("mc_ok", "main_winding", "mc_bad", "replace_ccu", "Motor circuit reads OK at CCU — replace CCU if F26/no tumble persists."),
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
        outcome("replace_ccu", 12, "Replace CCU", "Replace CCU when motor circuit OK at P8-4/P9-1 but unit won't run."),
        outcome("motor_verified", 13, "Motor circuit verified", "Motor, belt switch, and door switch OK."),
    ],
)

HEATER_ELECTRIC = proc(
    "w10410465-heater-electric",
    "TEST #4: Heat System (electric)",
    "4",
    "Heat System",
    [14, 15],
    ["heating_element"],
    ["no_heat", "heating_element_check", "F4E1"],
    [
        instr("access_heat", 2, "Access heater relays", "Remove top panel. Access CCU heater relays per Figure 20a.", "dual_element"),
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
            "Continuity P9-2 (L1) to black on heater relay #1 and #2 through thermal cut-off path.",
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
            "Outlet thermistor P14-3 to P14-6",
            "Disconnect P14. 5–15 kΩ at room; <1 kΩ → replace thermistor; open → repair harness.",
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
    "w10410465-heater-gas",
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
            "Run w10410465-gas-valve coil checks and verify ignitor 50–500 Ω. Check flame sensor continuity.",
            "gas_heat_verified",
        ),
        outcome("replace_fuse", 7, "Replace thermal fuse", "Replace thermal fuse."),
        outcome("replace_cutoff", 8, "Replace cut-off & high-limit", "Replace thermal cut-off and high-limit."),
        outcome("gas_heat_verified", 9, "Gas heat path verified", "Thermal limits and gas valve path OK — suspect CCU if still no heat."),
    ],
    GAS_DRYER_ONLY,
)

THERMISTORS = proc(
    "w10410465-thermistors",
    "TEST #4a: Thermistors",
    "4a",
    "Thermistors",
    [16, 17],
    ["exhaust_thermistor", "inlet_thermistor"],
    ["thermistor", "F3E1", "F3E2", "F3E3", "F3E4", "F3E5", "no_heat"],
    [
        instr("disconnect_p14", 2, "Disconnect P14 at CCU", "Power off. Remove P14. Measure outlet thermistor at P14-3 to P14-6.", "outlet_ntc_ohms"),
        meas(
            "outlet_ntc_ohms",
            3,
            "Outlet (exhaust) thermistor",
            "~12 kΩ @ 70°F; use OEM R/T table. Open/short per F3E1/F3E2 thresholds.",
            "dryerExhaustThermistorOhms",
            "P14 outlet",
            "P14-3 to P14-6",
            pass_fail_branches("out_ok", "inlet_fuel_variant", "out_bad", "replace_outlet_ntc", "Replace outlet thermistor."),
        ),
        fuel_variant_step("inlet_ntc_electric", "inlet_ntc_gas", order=4, step_id="inlet_fuel_variant"),
        meas(
            "inlet_ntc_electric",
            5,
            "Inlet thermistor (electric)",
            "On high-limit assembly at P14-1 to P14-2. Use electric dryer R/T table.",
            "dryerInletThermistorOhmsElectric",
            "P14 inlet",
            "P14-1 to P14-2",
            pass_fail_branches("in_ok", "thermistors_verified", "in_bad", "replace_inlet_ntc", "Replace inlet thermistor."),
        ),
        meas(
            "inlet_ntc_gas",
            5,
            "Inlet thermistor (gas)",
            "At drum inlet duct, P14-1 to P14-2. Use gas dryer R/T table.",
            "dryerInletThermistorOhmsGas",
            "P14 inlet",
            "P14-1 to P14-2",
            pass_fail_branches("in_gas_ok", "thermistors_verified", "in_gas_bad", "replace_inlet_ntc", "Replace inlet thermistor."),
        ),
        outcome("replace_outlet_ntc", 6, "Replace outlet thermistor", "Replace exhaust/outlet thermistor."),
        outcome("replace_inlet_ntc", 7, "Replace inlet thermistor", "Replace inlet thermistor."),
        outcome("thermistors_verified", 8, "Thermistors verified", "Inlet and outlet NTC within OEM tables."),
    ],
)

THERMAL_FUSE = proc(
    "w10410465-thermal-fuse",
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
    "w10410465-thermal-cutoff",
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
    "w10410465-gas-valve",
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
    "w10410465-moisture-sensor",
    "TEST #5: Moisture Sensor",
    "5",
    "Moisture Sensor",
    [18],
    ["moisture_sensor"],
    ["long_dry", "not_drying", "F3E6", "F3E7"],
    [
        instr(
            "diag_moisture",
            2,
            "Service Diagnostics → Moisture Sensor",
            "Component Activation → Moisture Sensor status open/closed.",
            "door_short_check",
        ),
        visual(
            "door_short_check",
            3,
            "Door open short check",
            "Open dryer door. Immediate beep or display response indicates short in moisture sensor harness — inspect harness and sensor.",
            [
                {"id": "no_short", "label": "Yes / passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "wet_cloth"},
                {
                    "id": "short_found",
                    "label": "No / failed",
                    "when": {"kind": "checkpoint_no"},
                    "nextStepId": "repair_short",
                    "terminal": True,
                    "oemOutcome": "Repair short in moisture sensor harness or replace sensor.",
                },
            ],
        ),
        visual(
            "wet_cloth",
            4,
            "Wet cloth bridge test",
            "Touch both strips with wet cloth — status should change open→closed.",
            [
                {"id": "wet_pass", "label": "Passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "moisture_verified"},
                {
                    "id": "wet_fail",
                    "label": "Fails",
                    "when": {"kind": "checkpoint_no"},
                    "nextStepId": "bench_harness",
                    "terminal": True,
                    "oemOutcome": "Sensor failed wet-cloth test — bench test P13 harness at CCU.",
                },
            ],
        ),
        instr(
            "bench_harness",
            5,
            "Bench P13 harness",
            "Disconnect P13 at CCU. Check harness to sensor; outer contacts to ground must be OL.",
            "moisture_verified",
        ),
        outcome("repair_short", 6, "Repair moisture short", "Clear short or replace moisture sensor / wire harness."),
        outcome("moisture_verified", 7, "Moisture sensor verified", "Sensor responds in service mode and harness OK."),
    ],
)

DRYNESS_ADJUST = proc(
    "w10410465-dryness-adjust",
    "TEST #5a: Customer Dryness Level",
    "5a",
    "Adjusting Customer-Focused Dryness Level",
    [19],
    ["moisture_sensor"],
    ["long_dry", "not_drying"],
    [
        instr("auto_cycle", 2, "Automatic cycle + dryness menu", "Select automatic cycle. Hold Dryness Level ~3 sec for Customer-Focused Dryness screen.", "select_level"),
        instr(
            "select_level",
            3,
            "Select dryness offset",
            "Choose Factory Preset, 15% More, 30% More, 15% Less, or 30% Less. Stored in CCU EEPROM.",
            "dryness_saved",
        ),
        outcome("dryness_saved", 4, "Dryness level updated", "Customer auto-dry aggressiveness saved."),
    ],
)

BUTTON_INDICATOR = proc(
    "w10410465-button-indicator",
    "TEST #6: Buttons and Indicators",
    "6",
    "Buttons and Indicators",
    [19, 20],
    ["user_interface"],
    ["hmi_check", "F2E1", "F2E2", "F2E3", "error_code"],
    [
        instr("ui_component_test", 2, "UI Component Test", "Service Diagnostics → Component Activation → UI Component Test.", "ui_test_pass"),
        visual(
            "ui_test_pass",
            3,
            "UI test result",
            "All LEDs, buttons, and cycle selector indicators respond with beep?",
            [
                {"id": "ui_pass", "label": "Passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "ui_verified"},
                {"id": "ui_fail", "label": "Fails", "when": {"kind": "checkpoint_no"}, "nextStepId": "ccu_ui_connectors"},
            ],
        ),
        visual(
            "ccu_ui_connectors",
            4,
            "CCU and UI connectors seated",
            "All connectors fully seated; UI assembly in console?",
            checkpoint_yes_no("conn_ok", "replace_ui", "conn_bad", "replace_ui", "Reseat UI and retest."),
        ),
        outcome("replace_ui", 5, "Replace UI assembly", "Replace user interface and housing assembly. If supply OK but UI dead, replace CCU."),
        outcome("ui_verified", 6, "UI verified", "Buttons and indicators respond in UI Component Test."),
    ],
)

DOOR_SWITCH = proc(
    "w10410465-door-switch",
    "TEST #7: Door Switch",
    "7",
    "Door Switch",
    [20],
    ["door_switch"],
    ["door_switch_check", "wont_start", "no_spin"],
    [
        instr("door_diag", 2, "Door status in service mode", "Component Activation → Door Switch — status changes when door opens/closes.", "door_bench"),
        visual(
            "door_bench",
            3,
            "P8-3 to P8-4 bench check",
            "Power off. Door closed: 0–2 Ω across P8-3 and P8-4.",
            checkpoint_yes_no("door_ok", "door_verified", "door_bad", "replace_door_switch", "Replace door switch assembly."),
        ),
        outcome("replace_door_switch", 4, "Replace door switch", "Replace door switch; retest Quick Diagnostic."),
        outcome("door_verified", 5, "Door switch verified", "Door switch diagnostic and bench checks pass."),
    ],
)

DRUM_LIGHT = proc(
    "w10410465-drum-light",
    "TEST #8: Drum Light",
    "8",
    "Drum Light",
    [20, 21],
    ["drum_light"],
    ["drum_light_check", "no_light"],
    [
        instr(
            "drum_light_button",
            2,
            "Drum light UI activation",
            "Hold EcoBoost/Drum Light button until LCD confirms drum light is on.",
            "lcd_confirm",
        ),
        visual(
            "lcd_confirm",
            3,
            "LCD acknowledges drum light",
            "If LCD does not confirm the button press, replace the user interface.",
            checkpoint_yes_no("lcd_ok", "p13_connected", "lcd_bad", "replace_ui", "Replace user interface and housing assembly."),
        ),
        visual(
            "p13_connected",
            4,
            "P13 drum LED connector at UI",
            "Disconnect power. Verify drum LED connector P13 seated at UI.",
            checkpoint_yes_no("p13_ok", "harness_check", "p13_bad", "replace_ui", "Reseat P13 at UI; if still fails, replace UI."),
        ),
        visual(
            "harness_check",
            5,
            "Drum LED harness",
            "Check harness and inline connections between drum LED and UI.",
            checkpoint_yes_no("harness_ok", "live_current", "harness_bad", "repair_harness", "Repair or replace drum LED harness."),
        ),
        visual(
            "live_current",
            6,
            "P13 driver current 150–370 mA",
            "Unplug P13 from UI. Restore power. Hold EcoBoost/Drum Light. Milliamps across P13 pins 1 and 3.",
            checkpoint_yes_no("current_ok", "replace_led", "current_bad", "replace_ui", "Replace UI — drum LED driver missing."),
        ),
        outcome("replace_ui", 7, "Replace UI", "Replace user interface and housing assembly."),
        outcome("repair_harness", 8, "Repair harness", "Repair drum LED harness or connections."),
        outcome("replace_led", 9, "Replace drum LED", "Replace drum light assembly."),
        outcome("drum_light_verified", 10, "Drum light verified", "Drum light and UI driver OK."),
    ],
)

MYST_VALVE = proc(
    "w10410465-myst-valve",
    "TEST #9: Myst Valve",
    "9",
    "Myst Valve",
    [21, 22],
    ["steam_valve"],
    ["steam_no_water", "steam_valve_check"],
    [
        instr(
            "myst_quick_check",
            2,
            "Myst valve activation",
            "Service Diagnostics → Component Activation → Myst Valve. Verify spray into drum.",
            "water_supply",
        ),
        instr("water_supply", 3, "Verify water supply", "Confirm fill hose connected and household water on.", "p8_wiring"),
        visual(
            "p8_wiring",
            4,
            "P8-1 myst valve wire",
            "Red wire from water valve connected to CCU P8-1 per wiring diagram.",
            checkpoint_yes_no("wire_ok", "valve_coil_ohms", "wire_bad", "repair_harness", "Repair myst valve harness."),
        ),
        meas(
            "valve_coil_ohms",
            5,
            "Myst valve coil P8-1 to P9-2",
            "Power off. Coil resistance 510–590 Ω. Open → check harness then replace valve.",
            "whirlpoolCcuDryerSteamValveOhms",
            "CCU myst valve",
            "P8-1 to P9-2",
            pass_fail_branches("valve_ok", "nozzle_check", "valve_bad", "replace_valve", "Replace myst valve assembly."),
        ),
        instr(
            "nozzle_check",
            6,
            "Myst nozzle",
            "Inside drum: unscrew/replace myst nozzle with 7/16 in wrench if plugged; retest.",
            "valve_plumbing",
        ),
        instr(
            "valve_plumbing",
            7,
            "Valve plumbing",
            "Remove back panel — verify hose and wires at myst valve assembly.",
            "replace_ccu",
        ),
        outcome("repair_harness", 8, "Repair harness", "Repair myst valve wiring to P8-1."),
        outcome("replace_valve", 9, "Replace myst valve", "Replace myst valve assembly."),
        outcome("replace_ccu", 10, "Replace CCU", "Replace CCU when valve and plumbing OK but no spray."),
        outcome("myst_valve_verified", 11, "Myst valve verified", "Valve coil and spray path OK."),
    ],
)


def diagnostic_entry_bundle() -> dict:
    return {
        "id": "w10410465-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_ccu_tl_dryer",
        "manualId": "W10410465",
        "title": "W10410465 — Service Diagnostics entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console", "any"],
        "description": "Enter CCU Service Diagnostics (3-button sequence × 3), select language, Diagnostics Home.",
        "tags": ["service_diagnostic", "fault_codes"],
        "entryStepId": "prep_standby",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [3, 4],
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


PROCEDURES = [
    CCU_POWER,
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
    DRUM_LIGHT,
    MYST_VALVE,
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLES = [diagnostic_entry_bundle()]
BUNDLE_FILES = ["w10410465-diagnostic-entry.json"]


def write_catalog() -> None:
    catalog = {
        "manualId": "W10410465",
        "platformId": "whirlpool_ccu_tl_dryer",
        "templateId": "electric_dryer",
        "label": "Whirlpool/Maytag CCU top-load dryer (tech sheet W10410465)",
        "notes": "CCU top-load LCD console family. FL CCU dryers use whirlpool_ccu_dryer; ACU TL (W11416805) uses whirlpool_acu_tl_dryer.",
        "plannedProcedures": [
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
        ],
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name}")


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
        "attach_w10410465_diagnostic_effects.py",
        "attach_w10410465_service_modes.py",
        "attach_w10410465_procedure_diagrams.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
