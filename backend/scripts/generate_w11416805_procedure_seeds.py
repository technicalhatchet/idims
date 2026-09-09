#!/usr/bin/env python3
"""Generate W11416805 (Whirlpool ACU top-load dryer technical manual) procedure seeds."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_acu_tl_dryer"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W11416805",
    "manualTitle": "Whirlpool & Maytag ACU Top-Load Dryer Technical Manual (WED5100/WGD5100)",
    "extractedTextFile": "backend/docs/manuals/technical-manual-w11416805-revb wed5100 wgd5100-extracted.txt",
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
    "w11416805-acu-power",
    "TEST #1: Main Control (ACU)",
    "1",
    "Main Control (ACU)",
    [9, 10],
    ["acu"],
    ["supply_issue", "F1E1", "F6E1", "no_power"],
    [
        instr("verify_outlet", 2, "Verify outlet voltage", "Electric: 240/208 VAC. Gas: 120 VAC. Time-delay fuse required on electric.", "access_acu"),
        instr("access_acu", 3, "Access ACU", "Remove top panel. Restore power only for live voltage steps below.", "live_l1"),
        visual(
            "live_l1",
            4,
            "120 VAC at J8-3 (N) and J9-2 (L1)",
            "Use needle probes. Black to J8-3, red to J9-2 — expect 120 VAC.",
            checkpoint_yes_no("l1_ok", "live_5v", "l1_bad", "supply_connections", "No L1 at ACU — perform TEST #2 supply connections."),
        ),
        visual(
            "live_5v",
            5,
            "+5 VDC at J2-2 vs J2-4",
            "DC volts: red J2-2, black J2-4. Unplug J2 first. Missing +5V with J14 unplugged → shorted thermistor (TEST #4a).",
            checkpoint_yes_no("v5_ok", "live_12v", "v5_bad", "p14_thermistor_short", "Diagnose thermistor short or harness before replacing ACU."),
        ),
        visual(
            "live_12v",
            6,
            "+12.7 VDC at J2-1 vs J2-4",
            "DC volts: red J2-1, black J2-4. +12.7 VDC actuates relays.",
            checkpoint_yes_no("v12_ok", "acu_power_verified", "v12_bad", "replace_acu", "Replace ACU — +12.7 VDC missing."),
        ),
        instr(
            "p14_thermistor_short",
            7,
            "Thermistor short isolation",
            "Disconnect power. Unplug J14, restore power, retest +5 VDC. If +5 returns, run TEST #4a thermistors.",
            "acu_power_verified",
        ),
        instr("supply_connections", 8, "Supply path fault", "Perform TEST #2 supply connections.", "acu_power_verified"),
        outcome("replace_acu", 9, "Replace ACU", "Replace machine control electronics."),
        outcome("acu_power_verified", 10, "ACU power verified", "Line, +5 VDC, and +12.7 VDC present at ACU."),
    ],
)

SUPPLY_CONNECTIONS = proc(
    "w11416805-supply-connections",
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
    "w11416805-motor-circuit",
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
    "w11416805-heater-electric",
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
            "Disconnect J14. ~12 kΩ at room per OEM table; open/short → replace thermistor.",
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
    "w11416805-heater-gas",
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
            "Run w11416805-gas-valve coil checks and verify ignitor 50–500 Ω. Check flame sensor continuity.",
            "gas_heat_verified",
        ),
        outcome("replace_fuse", 7, "Replace thermal fuse", "Replace thermal fuse."),
        outcome("replace_cutoff", 8, "Replace cut-off & high-limit", "Replace thermal cut-off and high-limit."),
        outcome("gas_heat_verified", 9, "Gas heat path verified", "Thermal limits and gas valve path OK — suspect ACU if still no heat."),
    ],
    GAS_DRYER_ONLY,
)

THERMISTORS = proc(
    "w11416805-thermistors",
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
            "~12 kΩ @ 70°F; use OEM R/T table. Open/short per F3E1 thresholds.",
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
    "w11416805-thermal-fuse",
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
    "w11416805-thermal-cutoff",
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
    "w11416805-gas-valve",
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
    "w11416805-moisture-sensor",
    "TEST #5: Moisture Sensor",
    "5",
    "Moisture Sensor",
    [18],
    ["moisture_sensor"],
    ["long_dry", "not_drying", "F3E2", "F3E5"],
    [
        instr(
            "diag_moisture",
            2,
            "Service Diagnostics → Diagnostic Cycle",
            "Advance to Sensing phase with Right key. Open door and touch both moisture strips with wet cloth — drum light should turn off.",
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
                    "oemOutcome": "Sensor failed wet-cloth test — bench test J13 harness at ACU.",
                },
            ],
        ),
        instr(
            "bench_harness",
            5,
            "Bench J13 harness",
            "Disconnect J13 at ACU. Check harness to sensor; outer contacts to ground must be OL.",
            "moisture_verified",
        ),
        outcome("repair_short", 6, "Repair moisture short", "Clear short or replace moisture sensor / wire harness."),
        outcome("moisture_verified", 7, "Moisture sensor verified", "Sensor responds in service mode and harness OK."),
    ],
)


HMI = proc(
    "w11416805-hmi",
    "TEST #6: HMI",
    "6",
    "HMI",
    [19, 20],
    ["user_interface"],
    ["hmi_check", "F2E1", "F2E2", "F6E1", "error_code"],
    [
        instr("ui_component_test", 2, "HMI Test", "Service Diagnostics → HMI Test — Key, LED, Display, Audio, and Encoder tests per on-screen prompts.", "ui_test_pass"),
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
    "w11416805-door-switch",
    "TEST #7: Door Switch",
    "7",
    "Door Switch",
    [20],
    ["door_switch"],
    ["door_switch_check", "wont_start", "no_spin"],
    [
        instr("door_diag", 2, "Door status in service mode", "Service Diagnostics → Sensor Feedback → Door Switch — open/close changes display (0=open, 1=closed).", "door_bench"),
        visual(
            "door_bench",
            3,
            "J8-3 to J8-4 bench check",
            "Power off. Door closed: 0–2 Ω across J8-3 and J8-4.",
            checkpoint_yes_no("door_ok", "door_verified", "door_bad", "replace_door_switch", "Replace door switch assembly."),
        ),
        outcome("replace_door_switch", 4, "Replace door switch", "Replace door switch; retest Quick Diagnostic."),
        outcome("door_verified", 5, "Door switch verified", "Door switch diagnostic and bench checks pass."),
    ],
)



DRUM_LIGHT = proc(
    "w11416805-drum-light",
    "TEST #8: Drum Light",
    "8",
    "Drum Light Incandescent Bulb or LED",
    [34],
    ["drum_light"],
    ["drum_light_check", "hmi_check"],
    [
        instr("drum_light_button", 2, "Console drum light button", "Press DRUM LIGHT on console — verify on/off toggles drum light.", "power_off_access"),
        instr("power_off_access", 3, "Access ACU", "Unplug dryer. Remove top panel. Verify J8-5 (incandescent) or J6 pins 1-2 (LED) seated.", "incandescent_check"),
        visual(
            "incandescent_check",
            4,
            "Incandescent bulb path",
            "Unplug J8 and J9. Measure J8-5 to J9-2. Open → replace bulb.",
            checkpoint_yes_no("bulb_ok", "drum_light_verified", "bulb_bad", "replace_bulb", "Replace drum light bulb."),
        ),
        instr("led_driver_check", 5, "LED drum light — driver current", "Unplug J6 from HMI. Milliamps across J6 pins 1 and 3 with power on and drum light button on. Spec 150–370 mA.", "drum_light_verified"),
        outcome("replace_bulb", 6, "Replace bulb", "Replace incandescent drum light bulb."),
        outcome("replace_hmi_led", 7, "Replace HMI or LED", "No driver current — replace HMI; current present — replace drum LED."),
        outcome("drum_light_verified", 8, "Drum light verified", "Drum light responds to console and electrical path OK."),
    ],
)

WATER_VALVE = proc(
    "w11416805-water-valve",
    "TEST #9: Water Valve",
    "9",
    "Water Valve (steam models)",
    [34],
    ["steam_valve"],
    ["steam_valve_check", "no_steam"],
    [
        instr("diag_cycle_water", 2, "Service Diagnostic Cycle", "Enter Service Mode → Diagnostic Cycle. Verify water sprays into drum during cycle.", "supply_on"),
        visual(
            "supply_on",
            3,
            "Water supply on",
            "Verify water hooked up and turned on at wall.",
            checkpoint_yes_no("supply_ok", "valve_ohms", "supply_bad", "open_supply", "Turn on water supply and retest."),
        ),
        meas(
            "valve_ohms",
            4,
            "Valve coil J8-1 to J9-2",
            "Power off. Measure ACU J8-1 (red) to J9-2 (black). Spec 510–590 Ω.",
            "whirlpoolAcuTlDryerSteamValveOhms",
            "Steam valve",
            "J8-1 to J9-2",
            pass_fail_branches("valve_ok", "nozzle_check", "valve_bad", "replace_valve", "Replace water valve assembly."),
        ),
        instr("nozzle_check", 5, "Nozzle inspection", "Unscrew drum nozzle; clean residue. Replace nozzle if clogged.", "water_valve_verified"),
        outcome("open_supply", 6, "Open water supply", "Turn on water supply."),
        outcome("replace_valve", 7, "Replace water valve", "Replace water valve assembly."),
        outcome("water_valve_verified", 8, "Water valve verified", "Valve resistance in spec and water dispenses in diagnostic cycle."),
    ],
)

def diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11416805-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_acu_tl_dryer",
        "manualId": "W11416805",
        "title": "W11416805 — Service Diagnostics entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console", "any"],
        "description": "Enter ACU Service Diagnostics (3-button sequence × 3), select language, Diagnostics Home.",
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
    HMI,
    DOOR_SWITCH,
    DRUM_LIGHT,
    WATER_VALVE,
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLES = [diagnostic_entry_bundle()]
BUNDLE_FILES = ["w11416805-diagnostic-entry.json"]


def write_catalog() -> None:
    catalog = {
        "manualId": "W11416805",
        "platformId": "whirlpool_acu_tl_dryer",
        "templateId": "electric_dryer",
        "label": "Whirlpool/Maytag ACU top-load dryer (WED5100/WGD5100, W11416805)",
        "notes": "ACU top-load WED51*/WGD51* family. Not CCU dual-element or Duet Sport MCE.",
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
        "attach_w11416805_diagnostic_effects.py",
        "attach_w11416805_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
