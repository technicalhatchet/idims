#!/usr/bin/env python3
"""Generate W8178629 (Maytag Centennial electric/gas dryer job aid) procedure seeds."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_centennial_dryer"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W8178629",
    "manualTitle": "Maytag Centennial Electric & Gas Dryers (Job Aid ML-4)",
    "extractedTextFile": "backend/docs/manuals/jobaid-8178629 wed4950-extracted.txt",
    "verifiedAt": "2026-03-09",
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
PLATFORM = "whirlpool_centennial_dryer"


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
        "platformId": PLATFORM,
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
        "MED/WED = electric dual-element; MGD/WGD = gas burner.",
        [
            {"id": "fuel_electric", "label": "Electric", "when": {"kind": "checkpoint_yes"}, "nextStepId": electric_next},
            {"id": "fuel_gas", "label": "Gas", "when": {"kind": "checkpoint_no"}, "nextStepId": gas_next},
        ],
    )


SUPPLY_CONNECTIONS = proc(
    "w8178629-supply-connections",
    "Supply Connections Test",
    "6-3",
    "Supply Connections Test",
    [67, 70],
    ["supply"],
    ["supply_issue", "voltage_check", "no_power"],
    [
        fuel_variant_step("electric_cover", "gas_cover"),
        instr(
            "electric_cover",
            3,
            "Electric — terminal block",
            "Remove rear cover plate. Verify cord at terminal block.",
            "electric_n_block",
        ),
        visual(
            "electric_n_block",
            4,
            "Neutral plug to terminal block center",
            "Continuity from plug N to center terminal block contact.",
            checkpoint_yes_no("en_ok", "electric_l1_id", "en_bad", "replace_cord", "Replace power cord."),
        ),
        instr(
            "electric_l1_id",
            5,
            "Identify L1 at block",
            "Note which plug terminal connects to left-most block contact (L1).",
            "electric_l1_timer",
        ),
        visual(
            "electric_l1_timer",
            6,
            "L1 plug to timer BK",
            "Access electronic control without disconnecting board wiring. Continuity L1 plug to BK (black) on timer.",
            checkpoint_yes_no("el1_ok", "electric_n_p2", "el1_bad", "replace_harness", "Replace harness or cord."),
        ),
        visual(
            "electric_n_p2",
            7,
            "Neutral plug to P2-1",
            "Continuity from plug N to P2-1 (white) on electronic control.",
            checkpoint_yes_no("enp2_ok", "supply_verified", "enp2_bad", "replace_harness", "Replace main harness."),
        ),
        instr("gas_cover", 3, "Gas — cord to harness", "Verify power cord firmly connected to wire harness.", "gas_n_p1"),
        visual(
            "gas_n_p1",
            4,
            "Gas — neutral to P1-2",
            "Continuity plug N to P1-2 (white) on electronic control.",
            checkpoint_yes_no("gn_ok", "gas_l1_timer", "gn_bad", "replace_cord", "Replace power cord."),
        ),
        visual(
            "gas_l1_timer",
            5,
            "Gas — L1 to timer BK",
            "Continuity L1 plug to BK (black) on timer.",
            checkpoint_yes_no("gl1_ok", "supply_verified", "gl1_bad", "replace_harness", "Replace cord or harness."),
        ),
        outcome("replace_cord", 8, "Replace power cord", "Replace power cord."),
        outcome("replace_harness", 9, "Replace harness", "Replace main wire harness."),
        outcome("supply_verified", 10, "Supply verified", "Line/neutral paths OK — proceed to timer test if needed."),
    ],
)

TIMER_MOTOR = proc(
    "w8178629-timer-motor",
    "Timer & Motor Relay Test",
    "6-4",
    "Timer Test / Motor Relay",
    [68, 70],
    ["user_interface", "motor"],
    ["timer_issue", "motor_check", "hmi_check"],
    [
        instr(
            "less_dry_precheck",
            2,
            "Less Dry test (live)",
            "Door closed, Timer Less Dry, Temp High, Signal Louder → PTS. Timer should advance to Off in ~16 s.",
            "diag_mode_check",
        ),
        visual(
            "diag_mode_check",
            3,
            "Diagnostic mode — timer advances",
            "If Less Dry fails, enter diagnostic mode. Timer should advance continuously during test mode.",
            checkpoint_yes_no("timer_adv_ok", "motor_relay_path", "timer_adv_bad", "timer_bench", "Bench test timer motor."),
        ),
        meas(
            "timer_bench",
            4,
            "Timer motor BU to PT-1",
            "Disconnect timer wires. Spec 3 kΩ (±2).",
            "whirlpoolCentennialDryerTimerMotorOhms",
            "Timer motor",
            "BU–PT-1",
            pass_fail_branches("timer_ok", "motor_relay_path", "timer_bad", "replace_timer", "Replace timer."),
        ),
        meas(
            "motor_relay_path",
            5,
            "Motor relay COM to P2-6",
            "Door open, power off for bench motor. At control: COM to P2-6 should read 1–6 Ω.",
            "whirlpoolCentennialDryerMotorCircuitOhms",
            "Motor relay",
            "COM–P2-6",
            pass_fail_branches(
                "relay_ok",
                "timer_verified",
                "relay_bad",
                "thermal_door_check",
                "Run thermal fuse and door switch tests.",
            ),
        ),
        instr(
            "thermal_door_check",
            6,
            "Thermal fuse & door switch",
            "Perform w8178629-thermal-fuse-exhaust and w8178629-door-switch if motor relay path out of spec.",
            "timer_verified",
        ),
        outcome("replace_timer", 7, "Replace timer", "Replace timer assembly."),
        outcome("timer_verified", 8, "Timer/motor relay OK", "Timer motor and motor relay path within spec."),
    ],
)

DOOR_SWITCH = proc(
    "w8178629-door-switch",
    "Door Switch Test",
    "5-1",
    "Door Switch",
    [61, 71],
    ["door_switch"],
    ["door_switch_check", "wont_start", "no_power"],
    [
        instr(
            "diag_door_beep",
            2,
            "Diagnostic mode door check",
            "In diagnostic test mode, opening/closing door should produce audible beep.",
            "bench_door_switch",
        ),
        visual(
            "bench_door_switch",
            3,
            "Door switch plug pins 1–3",
            "Power off. Rx1: pins 1–3 closed (0 Ω) with door closed; open (OL) with door open.",
            checkpoint_yes_no("door_ok", "harness_check", "door_bad", "replace_door_switch", "Replace door switch."),
        ),
        visual(
            "harness_check",
            4,
            "Harness neutral to P2-6 (§6-5)",
            "Door closed: neutral to P2-6 on control should read closed. Open with door open.",
            checkpoint_yes_no("harness_ok", "door_verified", "harness_bad", "repair_harness", "Repair or replace harness."),
        ),
        outcome("replace_door_switch", 5, "Replace door switch", "Replace door switch."),
        outcome("repair_harness", 6, "Repair harness", "Repair or replace door switch harness."),
        outcome("door_verified", 7, "Door switch verified", "Door switch and harness OK."),
    ],
)

THERMAL_FUSE_EXHAUST = proc(
    "w8178629-thermal-fuse-exhaust",
    "Thermal Fuse & Exhaust Thermistor",
    "5-2",
    "Thermal Fuse & Exhaust Thermistor",
    [62, 72],
    ["thermal_fuse", "exhaust_thermistor"],
    ["no_heat", "thermistor", "no_spin"],
    [
        instr("access_thermal", 2, "Access thermal fuse & exhaust NTC", "Disconnect wires at component under test.", "fuse_continuity"),
        visual(
            "fuse_continuity",
            3,
            "Thermal fuse continuity",
            "Rx1 across thermal fuse terminals: 0 Ω. Opens at 196°F (91°C).",
            checkpoint_yes_no("fuse_ok", "exhaust_ntc", "fuse_open", "replace_fuse", "Replace thermal fuse; clear vent."),
        ),
        meas(
            "exhaust_ntc",
            4,
            "Exhaust thermistor resistance",
            "Rx100K at thermistor terminals. Use OEM R/T table (~12 kΩ @ 70°F).",
            "whirlpoolCentennialDryerExhaustThermistorKohm",
            "Exhaust thermistor",
            "terminals",
            pass_fail_branches(
                "ntc_ok",
                "thermal_exhaust_verified",
                "ntc_bad",
                "replace_thermistor",
                "Replace exhaust thermistor.",
            ),
        ),
        outcome("replace_fuse", 5, "Replace thermal fuse", "Replace thermal fuse."),
        outcome("replace_thermistor", 6, "Replace thermistor", "Replace exhaust thermistor."),
        outcome("thermal_exhaust_verified", 7, "Fuse & exhaust NTC OK", "Thermal fuse and exhaust thermistor within spec."),
    ],
)

ELECTRIC_HEATER = proc(
    "w8178629-electric-heater",
    "Electric Heater (Dual Element)",
    "5-4",
    "Electric Heater (Dual Element)",
    [64],
    ["heating_element"],
    ["no_heat", "heating_element_check"],
    [
        instr("access_heater", 2, "Access heater terminal block", "Disconnect wires at heater terminals.", "element_com_1"),
        meas(
            "element_com_1",
            3,
            "COM to terminal 1",
            "Rx1: COM to terminal 1 = 15–25 Ω.",
            "whirlpoolCentennialDryerHeaterElementOhms",
            "Heater",
            "COM–1",
            pass_fail_branches("e1_ok", "element_com_2", "e1_bad", "replace_element", "Replace heating element."),
        ),
        meas(
            "element_com_2",
            4,
            "COM to terminal 2",
            "Rx1: COM to terminal 2 = 15–25 Ω.",
            "whirlpoolCentennialDryerHeaterElementOhms",
            "Heater",
            "COM–2",
            pass_fail_branches("e2_ok", "element_series", "e2_bad", "replace_element", "Replace heating element."),
        ),
        meas(
            "element_series",
            5,
            "Terminals 1 to 2 (series)",
            "Rx1: terminals 1 & 2 = 30–50 Ω.",
            "whirlpoolCentennialDryerHeaterDualParallelOhms",
            "Heater",
            "1–2",
            pass_fail_branches(
                "series_ok",
                "heater_verified",
                "series_bad",
                "replace_element",
                "Replace heating element.",
            ),
        ),
        outcome("replace_element", 6, "Replace heater", "Replace dual heating element."),
        outcome("heater_verified", 7, "Heater verified", "Dual element resistances within OEM spec."),
    ],
    ELECTRIC_DRYER_ONLY,
)

ELECTRIC_TCO_INLET = proc(
    "w8178629-electric-tco-inlet",
    "TCO, High-Limit & Inlet Thermistor (electric)",
    "5-5",
    "Thermal Cutoff & Inlet Thermistor",
    [65],
    ["thermal_cutoff", "inlet_thermistor"],
    ["no_heat", "thermistor"],
    [
        instr("access_tco", 2, "Access TCO and inlet thermistor", "Disconnect wires at component under test.", "tco_continuity"),
        visual(
            "tco_continuity",
            3,
            "TCO and high-limit continuity",
            "Rx1: thermal cut-off and high-limit thermostat terminals = 0 Ω.",
            checkpoint_yes_no("tco_ok", "inlet_ntc", "tco_open", "replace_tco_hilimit", "Replace TCO and high-limit."),
        ),
        meas(
            "inlet_ntc",
            4,
            "Inlet thermistor",
            "Rx100K at inlet thermistor. Use OEM R/T table (~62 kΩ @ 68°F).",
            "whirlpoolCentennialDryerInletThermistorKohm",
            "Inlet thermistor",
            "terminals",
            pass_fail_branches(
                "inlet_ok",
                "tco_inlet_verified",
                "inlet_bad",
                "replace_inlet_ntc",
                "Replace inlet thermistor.",
            ),
        ),
        outcome("replace_tco_hilimit", 5, "Replace TCO & high-limit", "Replace thermal cut-off and high-limit thermostat."),
        outcome("replace_inlet_ntc", 6, "Replace inlet thermistor", "Replace inlet thermistor."),
        outcome("tco_inlet_verified", 7, "TCO & inlet NTC OK", "Thermal limits and inlet thermistor within spec."),
    ],
    ELECTRIC_DRYER_ONLY,
)

GAS_HILIMIT_CUTOFF = proc(
    "w8178629-gas-hilimit-cutoff",
    "High-Limit & Thermal Cutoff (gas)",
    "5-2-gas",
    "High-Limit Thermostat & TCO (Gas)",
    [62],
    ["thermal_cutoff"],
    ["no_heat", "heating_element_check"],
    [
        instr("access_gas_limits", 2, "Access high-limit and TCO (gas)", "Disconnect wire connectors from terminals.", "hilimit_continuity"),
        visual(
            "hilimit_continuity",
            3,
            "High-limit thermostat continuity",
            "Rx1: high-limit thermostat terminals = 0 Ω.",
            checkpoint_yes_no("hilimit_ok", "tco_continuity", "hilimit_open", "replace_limits", "Replace high-limit and TCO."),
        ),
        visual(
            "tco_continuity",
            4,
            "Thermal cut-off continuity",
            "Rx1: thermal cut-off (TCO) terminals = 0 Ω.",
            checkpoint_yes_no("tco_ok", "gas_limits_verified", "tco_open", "replace_limits", "Replace TCO and high-limit."),
        ),
        outcome("replace_limits", 5, "Replace limits", "Replace thermal cut-off and high-limit thermostat."),
        outcome("gas_limits_verified", 6, "Gas limits verified", "High-limit and TCO show continuity."),
    ],
    GAS_DRYER_ONLY,
)

FLAME_SENSOR = proc(
    "w8178629-flame-sensor",
    "Flame Sensor Test",
    "5-3",
    "Flame Sensor",
    [63],
    ["flame_sensor"],
    ["ignition_issue"],
    [
        instr("access_flame", 2, "Access flame sensor", "Disconnect wire connectors from flame sensor terminals.", "flame_continuity"),
        visual(
            "flame_continuity",
            3,
            "Flame sensor continuity",
            "Rx1 across flame sensor terminals: closed circuit (0 Ω).",
            checkpoint_yes_no("flame_ok", "flame_verified", "flame_bad", "replace_flame_sensor", "Replace flame sensor."),
        ),
        outcome("replace_flame_sensor", 4, "Replace flame sensor", "Replace flame sensor."),
        outcome("flame_verified", 5, "Flame sensor verified", "Flame sensor shows continuity."),
    ],
    GAS_DRYER_ONLY,
)

GAS_COILS = proc(
    "w8178629-gas-coils",
    "Gas Burner Coils Test",
    "6-8",
    "Gas Valve Coils",
    [74],
    ["gas_valve"],
    ["gas_valve_check", "no_heat", "ignition_issue"],
    [
        instr("access_coils", 2, "Access gas valve coils", "Disconnect coil harness. Gas off, power disconnected.", "coil_12"),
        meas(
            "coil_12",
            3,
            "Coil terminals 1–2",
            "Spec 1365 ± 25 Ω.",
            "whirlpoolCentennialDryerGasValveCoilOhms",
            "Gas valve",
            "1–2",
            pass_fail_branches("c12_ok", "coil_13", "c12_bad", "replace_coils", "Replace gas valve coil(s)."),
        ),
        meas(
            "coil_13",
            4,
            "Coil terminals 1–3",
            "Spec 560 ± 25 Ω.",
            "whirlpoolCentennialDryerGasValveCoilOhms",
            "Gas valve",
            "1–3",
            pass_fail_branches("c13_ok", "coil_45", "c13_bad", "replace_coils", "Replace gas valve coil(s)."),
        ),
        meas(
            "coil_45",
            5,
            "Coil terminals 4–5",
            "Spec 1220 ± 50 Ω.",
            "whirlpoolCentennialDryerGasValveCoilOhms",
            "Gas valve",
            "4–5",
            pass_fail_branches("c45_ok", "coils_verified", "c45_bad", "replace_coils", "Replace gas valve coil(s)."),
        ),
        outcome("replace_coils", 6, "Replace coils", "Replace failed gas valve coil assembly."),
        outcome("coils_verified", 7, "Gas coils verified", "All coil resistances within §6-8 table."),
    ],
    GAS_DRYER_ONLY,
)

GAS_IGNITOR = proc(
    "w8178629-gas-ignitor",
    "Burner Ignitor Test",
    "5-4-gas",
    "Burner Ignitor",
    [64],
    ["igniter"],
    ["igniter_check", "ignition_issue", "no_heat"],
    [
        instr("access_ignitor", 2, "Access burner ignitor", "Disconnect 2-wire ignitor connector from harness.", "ignitor_ohms"),
        meas(
            "ignitor_ohms",
            3,
            "Ignitor resistance",
            "Rx1 at 2-wire connector pins: 50–500 Ω.",
            "whirlpoolCentennialDryerIgnitorOhms",
            "Ignitor",
            "2-wire",
            pass_fail_branches("ign_ok", "ignitor_verified", "ign_bad", "replace_ignitor", "Replace burner ignitor."),
        ),
        outcome("replace_ignitor", 4, "Replace ignitor", "Replace burner ignitor."),
        outcome("ignitor_verified", 5, "Ignitor verified", "Ignitor resistance within spec."),
    ],
    GAS_DRYER_ONLY,
)

DRIVE_MOTOR = proc(
    "w8178629-drive-motor",
    "Drive Motor Test",
    "5-6",
    "Drive Motor",
    [66],
    ["motor"],
    ["motor_check", "wont_spin"],
    [
        instr("access_motor", 2, "Access drive motor", "Disconnect wire connector from motor terminals.", "main_winding"),
        meas(
            "main_winding",
            3,
            "Main winding pin 4–5",
            "Blue wire at pin 4 to bare copper on pin 5. Spec 1.4–2.6 Ω.",
            "whirlpoolCentennialDryerMotorOhms",
            "Motor main",
            "4–5",
            pass_fail_branches("main_ok", "start_winding", "main_bad", "replace_motor", "Replace drive motor."),
        ),
        meas(
            "start_winding",
            4,
            "Start winding pin 4–3",
            "Blue wire at pin 4 to bare copper on pin 3. Spec 1.4–2.8 Ω.",
            "whirlpoolCentennialDryerMotorOhms",
            "Motor start",
            "4–3",
            pass_fail_branches("start_ok", "motor_verified", "start_bad", "replace_motor", "Replace drive motor."),
        ),
        outcome("replace_motor", 5, "Replace motor", "Replace drive motor."),
        outcome("motor_verified", 6, "Motor verified", "Main and start windings within spec."),
    ],
)


def diagnostic_entry_bundle() -> dict:
    return {
        "id": "w8178629-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W8178629",
        "title": "W8178629 — Diagnostic test mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Less Dry pre-check and Diagnostic Test activation (§6-1 / §6-2). Beeps on each input change.",
        "tags": ["service_diagnostic", "hmi_check"],
        "entryStepId": "prep_assembled",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [67, 68],
        },
        "steps": [
            {
                "id": "prep_assembled",
                "order": 1,
                "type": "instruction",
                "title": "Fully assembled dryer",
                "body": "Empty dryer, clean lint screen, connected to known good power.",
                "sourceExcerpt": "Begin with a fully assembled, empty dryer with clean lint screen.",
                "requiresInput": False,
                "defaultNextStepId": "less_dry_test",
            },
            {
                "id": "less_dry_test",
                "order": 2,
                "type": "instruction",
                "title": "Less Dry test (§6-1)",
                "body": (
                    "Door closed, Timer Less Dry, Temperature High, End of Cycle Signal Louder. "
                    "Press Push to Start — timer should advance to Off in ~16 seconds. "
                    "If not, proceed to Diagnostic Test entry."
                ),
                "sourceExcerpt": "Timer will start to advance to the Off position after approximately 16 seconds.",
                "requiresInput": False,
                "defaultNextStepId": "diag_entry_wrinkle",
            },
            {
                "id": "diag_entry_wrinkle",
                "order": 3,
                "type": "instruction",
                "title": "Diagnostic Test entry (§6-2)",
                "body": (
                    "Door open, Temperature Air Fluff, Signal Louder, Timer Timed or Sensor Drying. "
                    "Turn Wrinkle Prevent Off→On three times within 5 seconds. "
                    "Single beep, pause, single beep = test mode active. "
                    "Each input change beeps (door, moisture sensor, temp, wrinkle, PTS, timer)."
                ),
                "sourceExcerpt": "Wrinkle Prevent switch from Off to On three times within a five second period.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    SUPPLY_CONNECTIONS,
    TIMER_MOTOR,
    DOOR_SWITCH,
    THERMAL_FUSE_EXHAUST,
    ELECTRIC_HEATER,
    ELECTRIC_TCO_INLET,
    GAS_HILIMIT_CUTOFF,
    FLAME_SENSOR,
    GAS_COILS,
    GAS_IGNITOR,
    DRIVE_MOTOR,
]

PROCEDURE_FILES = [
    "w8178629-supply-connections.json",
    "w8178629-timer-motor.json",
    "w8178629-door-switch.json",
    "w8178629-thermal-fuse-exhaust.json",
    "w8178629-electric-heater.json",
    "w8178629-electric-tco-inlet.json",
    "w8178629-gas-hilimit-cutoff.json",
    "w8178629-flame-sensor.json",
    "w8178629-gas-coils.json",
    "w8178629-gas-ignitor.json",
    "w8178629-drive-motor.json",
]

BUNDLES = [diagnostic_entry_bundle()]
BUNDLE_FILES = ["w8178629-diagnostic-entry.json"]


def write_catalog() -> None:
    catalog = {
        "manualId": "W8178629",
        "platformId": PLATFORM,
        "templateId": "electric_dryer",
        "label": "Maytag Centennial electric & gas dryer (Job Aid 8178629)",
        "notes": (
            "MED/MGD 5500–5900 and WED4815-class. Timer+electronic control — not CCU W10680150. "
            "Gas procedures use templateIds gas_dryer; electric heater/TCO use electric_dryer."
        ),
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

    effects_script = ROOT / "backend" / "scripts" / "attach_w8178629_diagnostic_effects.py"
    if effects_script.exists():
        subprocess.run([sys.executable, str(effects_script)], check=True, cwd=ROOT)

    service_modes_script = ROOT / "backend" / "scripts" / "attach_w8178629_service_modes.py"
    if service_modes_script.exists():
        subprocess.run([sys.executable, str(service_modes_script)], check=True, cwd=ROOT)

    registry_script = ROOT / "backend" / "scripts" / "generate_procedure_registry.py"
    subprocess.run([sys.executable, str(registry_script)], check=True, cwd=ROOT)

    validate_script = ROOT / "backend" / "scripts" / "validate_procedure_seed.py"
    subprocess.run([sys.executable, str(validate_script)], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
