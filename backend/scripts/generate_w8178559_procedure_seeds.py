#!/usr/bin/env python3
"""Generate W8178559 (Whirlpool Duet Sport MCE dryer) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_duet_sport_dryer"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W8178559",
    "manualTitle": "Whirlpool Duet Sport Front-Load Dryer (Job Aid L-79)",
    "extractedTextFile": "backend/docs/manuals/jobaid-8178559-l-79 whirlpool fl dryer 2013 era-extracted.txt",
    "verifiedAt": "2026-03-08",
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
        "platformId": "whirlpool_duet_sport_dryer",
        "componentIds": component_ids,
        "tags": tags,
        "source": {
            **SOURCE,
            "oemTestNumber": oem_num,
            "oemTestTitle": oem_title,
            "pages": pages,
        },
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }
    if template_ids:
        result["templateIds"] = template_ids
    return result


def meas(
    sid: str,
    order: int,
    title: str,
    body: str,
    kid: str,
    connector: str,
    pins: str,
    branches: list[dict],
    excerpt: str = "",
) -> dict:
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


def instr(sid: str, order: int, title: str, body: str, nxt: str | None = None, excerpt: str = "") -> dict:
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


def visual(sid: str, order: int, title: str, body: str, branches: list[dict], excerpt: str = "") -> dict:
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


def outcome(sid: str, order: int, title: str, text: str) -> dict:
    return {
        "id": sid,
        "order": order,
        "type": "outcome",
        "title": title,
        "oemOutcome": text,
        "requiresInput": False,
    }


def pass_fail_branches(
    pass_id: str,
    pass_next: str,
    fail_id: str,
    fail_next: str,
    fail_outcome: str,
) -> list[dict]:
    return [
        {
            "id": pass_id,
            "label": "In spec",
            "when": {"kind": "measurement_normal"},
            "nextStepId": pass_next,
        },
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
            "label": "Borderline / warning",
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


def checkpoint_yes_no(yes_id: str, yes_next: str, no_id: str, no_next: str, no_outcome: str) -> list[dict]:
    return [
        {
            "id": yes_id,
            "label": "Yes / passes",
            "when": {"kind": "checkpoint_yes"},
            "nextStepId": yes_next,
        },
        {
            "id": no_id,
            "label": "No / failed",
            "when": {"kind": "checkpoint_no"},
            "nextStepId": no_next,
            "terminal": True,
            "oemOutcome": no_outcome,
        },
    ]


def fuel_variant_step(electric_next: str, gas_next: str) -> dict:
    return visual(
        "fuel_variant",
        2,
        "Electric or gas dryer?",
        "Identify fuel type: WED/MED = electric element; WGD/MGD = gas burner.",
        [
            {
                "id": "fuel_electric",
                "label": "Electric (WED/MED)",
                "when": {"kind": "checkpoint_yes"},
                "nextStepId": electric_next,
            },
            {
                "id": "fuel_gas",
                "label": "Gas (WGD/MGD)",
                "when": {"kind": "checkpoint_no"},
                "nextStepId": gas_next,
            },
        ],
        excerpt="Electric dryer terminal block vs gas dryer wire harness connection.",
    )


SUPPLY_CONNECTIONS = proc(
    "w8178559-supply-connections",
    "TEST #1: Supply Connections",
    "1",
    "Supply Connections",
    [78, 79],
    ["supply"],
    ["supply_issue", "voltage_check", "no_power", "hmi_check"],
    [
        fuel_variant_step("electric_cover_plate", "gas_cover_plate"),
        instr(
            "electric_cover_plate",
            3,
            "Electric — access terminal block",
            "Remove cover plate from top right rear. Verify power cord is secure at terminal block.",
            "electric_n_to_block",
        ),
        visual(
            "electric_n_to_block",
            4,
            "Neutral plug to terminal block center",
            "Ohmmeter: continuity between plug neutral (N) and center terminal block contact.",
            checkpoint_yes_no(
                "electric_n_ok",
                "electric_identify_l1",
                "electric_n_bad",
                "replace_power_cord",
                "Replace power cord — open neutral.",
            ),
        ),
        instr(
            "electric_identify_l1",
            5,
            "Identify L1 at terminal block",
            "Find which plug terminal connects to left-most terminal block contact (L1 / black wire). Note for step 6.",
            "electric_l1_to_p9",
        ),
        visual(
            "electric_l1_to_p9",
            6,
            "L1 plug to P9-2 at MCE",
            "Access MCE without disconnecting board wiring. Continuity from L1 plug terminal to P9-2 (black).",
            checkpoint_yes_no(
                "electric_l1_ok",
                "electric_n_to_p8",
                "electric_l1_bad",
                "replace_harness_or_cord",
                "Secure terminal block wires or replace main harness / power cord.",
            ),
        ),
        visual(
            "electric_n_to_p8",
            7,
            "Neutral plug to P8-3 at MCE",
            "Continuity from plug neutral (N) to P8-3 (white) on machine control board.",
            checkpoint_yes_no(
                "electric_p8_ok",
                "console_visual_checks",
                "electric_p8_bad",
                "replace_harness",
                "Replace main wire harness — open neutral path to MCE.",
            ),
        ),
        instr(
            "gas_cover_plate",
            3,
            "Gas — access power connection",
            "Remove rear cover plate. Verify power cord is firmly connected to wire harness.",
            "gas_n_to_p8",
        ),
        visual(
            "gas_n_to_p8",
            4,
            "Gas — neutral to P8-3",
            "Access MCE. Continuity from plug neutral (N) to P8-3 (white). If open, test cord neutral per Figure 6.",
            checkpoint_yes_no(
                "gas_n_ok",
                "gas_l1_to_p9",
                "gas_n_bad",
                "replace_power_cord",
                "Replace power cord — open neutral.",
            ),
        ),
        visual(
            "gas_l1_to_p9",
            5,
            "Gas — L1 plug to P9-2",
            "Continuity from L1 plug terminal to P9-2 (black) on MCE.",
            checkpoint_yes_no(
                "gas_l1_ok",
                "console_visual_checks",
                "gas_l1_bad",
                "replace_harness_or_cord",
                "Replace power cord or main harness per OEM Figure 6 path.",
            ),
        ),
        visual(
            "console_visual_checks",
            8,
            "P5 and console housing seated",
            "P5 fully inserted into MCE; console electronics and housing assembly fully seated in front console.",
            checkpoint_yes_no(
                "console_seated_ok",
                "supply_verified_reconnect",
                "console_seated_bad",
                "replace_console",
                "Replace console electronics and housing assembly.",
            ),
        ),
        instr(
            "supply_verified_reconnect",
            9,
            "Reconnect and verify console diag",
            "Plug in dryer. Run Console Buttons and Indicators diagnostic test from diagnostic mode.",
            "supply_verified",
        ),
        outcome("replace_power_cord", 10, "Replace power cord", "Replace power cord and retest."),
        outcome(
            "replace_harness_or_cord",
            11,
            "Replace harness or cord",
            "Replace main wire harness or power cord per failed continuity path.",
        ),
        outcome("replace_harness", 12, "Replace main harness", "Replace main wire harness."),
        outcome(
            "replace_console",
            13,
            "Replace console assembly",
            "Replace console electronics and housing; retest. If indicators still fail, replace MCE.",
        ),
        outcome(
            "supply_verified",
            14,
            "Supply path verified",
            "Line/neutral paths and console connections OK — if UI still dead, replace MCE.",
        ),
    ],
)

BUTTON_INDICATOR = proc(
    "w8178559-button-indicator",
    "TEST #5: Button and Indicator Test",
    "5",
    "Button and Indicator Test",
    [86, 87],
    ["user_interface"],
    ["hmi_check", "F02", "error_code", "supply_issue"],
    [
        instr(
            "advance_console_diag",
            2,
            "Console Buttons and Indicators diagnostic",
            "In diagnostic test mode (past saved/active fault codes), press buttons and rotate cycle selector. "
            "Each control should extinguish its indicator and beep; MORE/LESS time toggles display digits.",
            "console_diag_pass",
        ),
        visual(
            "console_diag_pass",
            3,
            "Console button / indicator test result",
            "Do all indicators light and beep correctly when buttons and selector are exercised?",
            [
                {
                    "id": "console_pass",
                    "label": "Yes / all respond",
                    "when": {"kind": "checkpoint_yes"},
                    "nextStepId": "button_verified",
                },
                {
                    "id": "console_fail",
                    "label": "No / fault present",
                    "when": {"kind": "checkpoint_no"},
                    "nextStepId": "p5_seated_check",
                },
            ],
        ),
        visual(
            "p5_seated_check",
            4,
            "P5 connector fully seated",
            "Access electronic assemblies. Is P5 fully inserted into the machine control electronics?",
            checkpoint_yes_no(
                "p5_ok",
                "console_housing_seated",
                "p5_bad",
                "reseat_p5",
                "Reseat P5 connector and retest console diagnostic.",
            ),
        ),
        visual(
            "console_housing_seated",
            5,
            "Console housing fully seated",
            "Is the console electronics and housing assembly properly inserted into the front console?",
            checkpoint_yes_no(
                "housing_ok",
                "replace_console_asm",
                "housing_bad",
                "reseat_console",
                "Reseat console assembly and retest.",
            ),
        ),
        instr(
            "reseat_p5",
            6,
            "Reseat P5 and retest",
            "Reseat P5, reassemble, restore power, and rerun Console Buttons and Indicators diagnostic.",
            "button_verified",
        ),
        instr(
            "reseat_console",
            7,
            "Reseat console and retest",
            "Reseat console assembly, restore power, and rerun console diagnostic.",
            "button_verified",
        ),
        outcome(
            "replace_console_asm",
            8,
            "Replace console assembly",
            "Replace console electronics and housing assembly; retest. If still failed, replace MCE.",
        ),
        outcome(
            "button_verified",
            9,
            "Console UI verified",
            "Console buttons and indicators respond correctly in diagnostic mode.",
        ),
    ],
)

DOOR_SWITCH = proc(
    "w8178559-door-switch",
    "TEST #6: Door Switch Test",
    "6",
    "Door Switch Test",
    [87],
    ["door_switch"],
    ["door_switch_check", "wont_start", "no_power", "motor_check"],
    [
        instr(
            "advance_door_diag",
            2,
            "Door Switch diagnostic (live)",
            "In diagnostic mode, advance to Door Switch diagnostic. Opening/closing door should beep and show "
            "alphanumeric codes (e.g. 0E, 09). Wrong model code with door closed indicates a fault.",
            "door_diag_pass",
        ),
        visual(
            "door_diag_pass",
            3,
            "Door switch diagnostic result",
            "Does door open/close produce beep and expected display codes with door properly closed?",
            [
                {
                    "id": "door_diag_ok",
                    "label": "Yes / passes",
                    "when": {"kind": "checkpoint_yes"},
                    "nextStepId": "door_switch_verified",
                },
                {
                    "id": "door_diag_fail",
                    "label": "No / failed",
                    "when": {"kind": "checkpoint_no"},
                    "nextStepId": "bench_door_switch",
                },
            ],
        ),
        instr(
            "bench_door_switch",
            4,
            "Bench door switch — P8-3 to P8-4",
            "Disconnect power. Ohmmeter across P8-3 (neutral, white) and P8-4 (door, tan) at MCE. Door closed: 0–2 Ω.",
            "door_switch_ohms",
        ),
        visual(
            "door_switch_ohms",
            5,
            "Door closed resistance 0–2 Ω",
            "With door properly closed, does P8-3 to P8-4 read 0–2 Ω?",
            checkpoint_yes_no(
                "door_ohms_ok",
                "inspect_door_harness",
                "door_ohms_bad",
                "replace_door_switch",
                "Replace wire and door switch assembly.",
            ),
        ),
        instr(
            "inspect_door_harness",
            6,
            "Inspect door switch harness",
            "Verify harness between door switch and MCE. Repair opens; replace door switch assembly if wiring OK.",
            "door_switch_verified",
        ),
        outcome(
            "replace_door_switch",
            7,
            "Replace door switch",
            "Replace wire and door switch assembly; retest. If still fails, replace MCE.",
        ),
        outcome(
            "door_switch_verified",
            8,
            "Door switch verified",
            "Door switch diagnostic and/or bench checks pass.",
        ),
    ],
)

DRYNESS_ADJUST = proc(
    "w8178559-dryness-adjust",
    "TEST #4a: Customer Drying Mode",
    "4a",
    "Adjusting Customer-Focused Drying Modes",
    [86],
    ["moisture_sensor"],
    ["long_dry", "moisture_sensor_check"],
    [
        instr(
            "diag_past_faults",
            2,
            "Enter diagnostic mode",
            "Activate diagnostic test mode and advance past saved fault codes. Moisture sensor should already pass TEST #4.",
            "dryness_hold_entry",
        ),
        instr(
            "dryness_hold_entry",
            3,
            "Hold Dryness 5 seconds",
            "In diagnostic mode, press and hold the Dryness button 5 seconds. Dryer beeps; current mode (factory default 1) displays.",
            "dryness_cycle_mode",
        ),
        instr(
            "dryness_cycle_mode",
            4,
            "Select longer auto cycle",
            "Press Dryness again to cycle display through 2, 3, or 1 (longer auto dry times).",
            "dryness_save",
        ),
        instr(
            "dryness_save",
            5,
            "Save with START",
            "With desired mode flashing, press START to save to EEPROM and exit diagnostics. PAUSE/CANCEL cancels without saving.",
            "dryness_adjusted",
        ),
        outcome(
            "dryness_adjusted",
            6,
            "Drying mode updated",
            "Customer auto-dry aggressiveness increased — stored in MCE EEPROM across power loss.",
        ),
    ],
)

HEATER_GAS = proc(
    "w8178559-heater-gas",
    "TEST #3: Heater (gas)",
    "3-gas",
    "Heater Test — Gas Dryer",
    [82, 83],
    ["gas_valve", "thermal_fuse", "thermal_cutoff"],
    ["no_heat", "ignition_issue", "gas_heater_check", "heating_element_check"],
    [
        instr(
            "access_gas_thermal",
            2,
            "Access thermal components (gas)",
            "Remove toe panel. Gas dryer heating path: thermal fuse → thermal cut-off → high-limit → gas valve coils.",
            "gas_thermal_fuse",
        ),
        visual(
            "gas_thermal_fuse",
            3,
            "TEST #3b — thermal fuse continuity",
            "Thermal fuse in series with gas valve: 0 Ω = good. Open = replace fuse (see w8178559-thermal-fuse).",
            checkpoint_yes_no(
                "gas_fuse_ok",
                "gas_thermal_cutoff",
                "gas_fuse_open",
                "replace_thermal_fuse",
                "Replace failed thermal fuse.",
            ),
        ),
        visual(
            "gas_thermal_cutoff",
            4,
            "TEST #3c — thermal cut-off continuity",
            "Thermal cut-off shows continuity (0 Ω)? Open = replace cut-off and high-limit.",
            checkpoint_yes_no(
                "gas_cutoff_ok",
                "gas_high_limit",
                "gas_cutoff_open",
                "replace_cutoff_hilimit",
                "Replace thermal cut-off and high-limit thermostat.",
            ),
        ),
        visual(
            "gas_high_limit",
            5,
            "High-limit thermostat continuity",
            "Measure continuity red wire to blue wire at high-limit thermostat. Open = replace high-limit and cut-off.",
            checkpoint_yes_no(
                "gas_hilimit_ok",
                "gas_valve_next",
                "gas_hilimit_open",
                "replace_cutoff_hilimit",
                "Replace high-limit thermostat and thermal cut-off.",
            ),
        ),
        instr(
            "gas_valve_next",
            6,
            "TEST #3d — gas valve coils",
            "Perform gas valve coil resistance checks (procedure w8178559-gas-valve). Also verify ignitor 50–250 Ω if flame never appears.",
            "gas_heater_verified",
        ),
        outcome("replace_thermal_fuse", 7, "Replace thermal fuse", "Replace thermal fuse."),
        outcome(
            "replace_cutoff_hilimit",
            8,
            "Replace cut-off & high-limit",
            "Replace thermal cut-off and high-limit thermostat; inspect vent path.",
        ),
        outcome(
            "gas_heater_verified",
            9,
            "Gas heat path verified at components",
            "Thermal limits and gas valve coils within spec — if still no heat, replace MCE.",
        ),
    ],
    GAS_DRYER_ONLY,
)

MOTOR_CIRCUIT = proc(
    "w8178559-motor-circuit",
    "TEST #2: Motor Circuit",
    "2",
    "Motor Circuit Test",
    [80, 81],
    ["motor"],
    ["motor_check", "wont_spin", "F26"],
    [
        instr(
            "mce_p8_p9_precheck",
            2,
            "MCE P8-4 to P9-1 pre-check",
            "Access machine control electronics. Measure resistance across P8-4 and P9-1. If 1–6 Ω, replace MCE. Otherwise continue to belt switch and motor at component.",
            "access_motor",
        ),
        instr(
            "access_motor",
            3,
            "Access belt switch and motor",
            "Remove back panel. Release drum belt from belt switch pulley. Disconnect white connector from drive motor switch.",
            "main_winding",
        ),
        meas(
            "main_winding",
            4,
            "Main winding — pin 4 to pin 5",
            "At motor switch: measure main winding between lt. blue wire at pin 4 and bare copper at pin 5. Spec 2.4–3.6 Ω.",
            "whirlpoolDuetSportDryerMotorOhms",
            "Motor main",
            "4–5",
            pass_fail_branches(
                "main_ok",
                "start_winding",
                "main_bad",
                "replace_motor",
                "Replace drive motor — main winding out of spec.",
            ),
        ),
        meas(
            "start_winding",
            5,
            "Start winding — pin 4 to pin 3",
            "At motor switch: measure start winding between lt. blue at pin 4 and bare copper at pin 3. Spec 2.4–3.8 Ω.",
            "whirlpoolDuetSportDryerMotorOhms",
            "Motor start",
            "4–3",
            pass_fail_branches(
                "start_ok",
                "belt_switch_checkpoint",
                "start_bad",
                "replace_motor",
                "Replace drive motor — start winding out of spec.",
            ),
        ),
        visual(
            "belt_switch_checkpoint",
            6,
            "Belt switch — infinity down, few Ω up",
            "With belt off pulley, belt switch should read infinity (OL). Push pulley up — should read a few ohms. Door switch with door closed: 0–2 Ω.",
            checkpoint_yes_no(
                "belt_ok",
                "motor_verified",
                "belt_bad",
                "service_belt_switch",
                "Replace belt switch or door switch per failed check.",
            ),
        ),
        outcome("replace_motor", 7, "Replace motor", "Replace drive motor assembly."),
        outcome("service_belt_switch", 8, "Service belt/door switch", "Replace failed belt switch or door switch."),
        outcome(
            "motor_verified",
            9,
            "Motor circuit verified at component",
            "Motor windings and belt/door switches OK — inspect harness to MCE if F-26 persists.",
        ),
    ],
)

HEATER_ELECTRIC = proc(
    "w8178559-heater-electric",
    "TEST #3: Heater (electric)",
    "3",
    "Heater Test",
    [82, 83],
    ["heating_element"],
    ["heating_element_check", "no_heat", "F01"],
    [
        instr(
            "access_thermal",
            2,
            "Access thermal components",
            "Remove toe panel. Measure resistance from red wire at thermal cut-off to red wire at heater element.",
            "heater_circuit",
        ),
        meas(
            "heater_circuit",
            3,
            "Thermal cut-off to heater — ~10 Ω",
            "Red at thermal cut-off to red at heater should read about 10 Ω (7–12 Ω element path). Open — check thermal cut-off, high-limit, and element continuity.",
            "whirlpoolDuetSportDryerHeaterOhms",
            "Heater",
            "cut-off to heater",
            pass_fail_branches(
                "heater_path_ok",
                "p14_thermistor_check",
                "heater_path_bad",
                "replace_heater_path",
                "Replace open heater, thermal cut-off, or high-limit per component test.",
            ),
        ),
        visual(
            "p14_thermistor_check",
            4,
            "P14-3 to P14-6 at MCE",
            "At MCE: measure P14-3 to P14-6. 5–15 kΩ → replace MCE. Less than 1 kΩ → replace exhaust thermistor. Greater than 20 kΩ (heat won't shut off) → replace thermistor.",
            checkpoint_yes_no(
                "p14_ok",
                "heater_verified",
                "p14_mce",
                "replace_mce",
                "Replace machine control electronics — P14 thermistor circuit indicates MCE fault.",
            ),
        ),
        outcome("replace_heater_path", 5, "Replace heater path component", "Replace failed element, thermal cut-off, or high-limit."),
        outcome("replace_mce", 6, "Replace MCE", "Replace machine control electronics."),
        outcome("heater_verified", 7, "Heater circuit verified", "Heating circuit and P14 thermistor path within spec at test points."),
    ],
    ELECTRIC_DRYER_ONLY,
)

EXHAUST_THERMISTOR = proc(
    "w8178559-exhaust-thermistor",
    "TEST #3a: Exhaust Thermistor",
    "3a",
    "Thermistor Test",
    [83, 84],
    ["exhaust_thermistor"],
    ["thermistor", "no_heat", "F22", "F23"],
    [
        instr(
            "timed_dry_fault_check",
            2,
            "Timed Dry fault check (optional)",
            "Empty dryer, clean lint screen. Start Timed Dry. If F-22 or F-23 flashes within 60 s and dryer shuts off, thermistor or harness is open/short — disconnect power before bench tests.",
            "disconnect_p14",
        ),
        instr(
            "disconnect_p14",
            3,
            "Disconnect P14 at MCE",
            "Access MCE. Disconnect P14 connector. Measure thermistor at component or through harness per wiring diagram.",
            "thermistor_ohms",
        ),
        meas(
            "thermistor_ohms",
            4,
            "Exhaust thermistor resistance",
            "Measure exhaust thermistor. ~12 kΩ @ 70°F; 9.2 kΩ @ 80°F; 19.9 kΩ @ 50°F (OEM R/T table). Open → F-22. Short → F-23.",
            "whirlpoolDuetSportDryerExhaustThermistorKohm",
            "P14 thermistor",
            "P14-3 to P14-6",
            pass_fail_branches(
                "ntc_ok",
                "thermistor_verified",
                "ntc_bad",
                "replace_thermistor",
                "Replace exhaust thermistor — out of spec or shorted.",
            ),
        ),
        outcome("replace_thermistor", 5, "Replace thermistor", "Replace exhaust thermistor."),
        outcome("thermistor_verified", 6, "Thermistor verified", "Exhaust thermistor within OEM R/T expectations."),
    ],
)

MOISTURE_SENSOR = proc(
    "w8178559-moisture-sensor",
    "TEST #4: Moisture Sensor",
    "4",
    "Moisture Sensor Test",
    [85, 86],
    ["moisture_sensor"],
    ["long_dry", "F28", "F29"],
    [
        instr(
            "diag_mode_entry",
            2,
            "Enter diagnostic test mode",
            "Activate diagnostic test mode and advance past saved fault codes. Machine fully assembled.",
            "door_short_check",
        ),
        visual(
            "door_short_check",
            3,
            "Door open short check",
            "Open dryer door. If beep + alphanumeric display immediately, short exists in moisture sensor system — inspect harness and sensor.",
            checkpoint_yes_no(
                "no_short",
                "wet_cloth_test",
                "short_found",
                "repair_short",
                "Repair short in moisture sensor harness or replace sensor/MCE as needed.",
            ),
        ),
        visual(
            "wet_cloth_test",
            4,
            "Wet cloth bridge test",
            "Bridge lint screen housing sensor strips with wet cloth. Beep + software revision on console = pass.",
            checkpoint_yes_no(
                "wet_pass",
                "moisture_verified",
                "wet_fail",
                "bench_sensor",
                "Sensor failed wet-cloth test — bench test at disconnected harness.",
            ),
        ),
        instr(
            "bench_sensor",
            5,
            "Bench moisture sensor",
            "Disconnect power. Remove toe panel, disconnect sensor from harness. Measure outermost contacts on cable with red MOVs. Replace sensor/harness if shorted.",
            "moisture_verified",
        ),
        outcome("repair_short", 6, "Repair moisture short", "Clear short or replace moisture sensor / wire harness / MCE."),
        outcome("moisture_verified", 7, "Moisture sensor verified", "Moisture sensor responds in diagnostic and bench checks."),
    ],
)

THERMAL_FUSE = proc(
    "w8178559-thermal-fuse",
    "TEST #3b: Thermal Fuse",
    "3b",
    "Thermal Fuse Test",
    [84],
    ["thermal_fuse"],
    ["no_heat", "thermal_fuse_check"],
    [
        instr(
            "access_thermal_fuse",
            2,
            "Access thermal fuse",
            "Remove toe panel. Electric: fuse in series with drive motor. Gas: fuse in series with gas valve. See Figure 11.",
            "thermal_fuse_continuity",
        ),
        visual(
            "thermal_fuse_continuity",
            3,
            "Thermal fuse continuity",
            "With ohmmeter on thermal fuse terminals: does the fuse show continuity (0 Ω)? Open circuit = failed fuse.",
            checkpoint_yes_no(
                "fuse_ok",
                "thermal_fuse_verified",
                "fuse_open",
                "replace_thermal_fuse",
                "Replace failed thermal fuse.",
            ),
        ),
        outcome("replace_thermal_fuse", 4, "Replace thermal fuse", "Replace thermal fuse."),
        outcome("thermal_fuse_verified", 5, "Thermal fuse verified", "Thermal fuse shows continuity."),
    ],
)

THERMAL_CUTOFF = proc(
    "w8178559-thermal-cutoff",
    "TEST #3c: Thermal Cut-Off",
    "3c",
    "Thermal Cut-Off Test",
    [84],
    ["thermal_cutoff"],
    ["no_heat", "heating_element_check"],
    [
        instr(
            "access_cutoff",
            2,
            "Access thermal cut-off",
            "Remove toe panel. Locate thermal cut-off per Figure 11.",
            "cutoff_continuity",
        ),
        visual(
            "cutoff_continuity",
            3,
            "Thermal cut-off continuity",
            "Does the thermal cut-off show continuity (0 Ω)? Open = replace cut-off and high-limit thermostat; check vent path and heater (electric).",
            checkpoint_yes_no(
                "cutoff_ok",
                "cutoff_verified",
                "cutoff_open",
                "replace_cutoff",
                "Replace thermal cut-off and high-limit thermostat; inspect exhaust and heater.",
            ),
        ),
        outcome(
            "replace_cutoff",
            4,
            "Replace cut-off & high-limit",
            "Replace thermal cut-off and high-limit thermostat.",
        ),
        outcome("cutoff_verified", 5, "Cut-off verified", "Thermal cut-off shows continuity."),
    ],
)

GAS_IGNITOR = proc(
    "w8178559-gas-ignitor",
    "TEST #3 (gas): Ignitor",
    "3-gas-ignitor",
    "Gas Ignitor Check",
    [82],
    ["igniter"],
    ["no_heat", "igniter_check", "ignition_issue"],
    [
        instr(
            "access_ignitor",
            2,
            "Access ignitor",
            "Remove toe panel. Disconnect ignitor connector at harness.",
            "ignitor_ohms",
        ),
        meas(
            "ignitor_ohms",
            3,
            "Ignitor resistance",
            "Measure ignitor cold resistance. Spec 50–250 Ω. Open = no glow. In spec but weak glow — check amp draw before condemning valve.",
            "whirlpoolDuetSportDryerIgnitorOhms",
            "Ignitor",
            "harness",
            pass_fail_branches(
                "ignitor_ok",
                "ignitor_verified",
                "ignitor_bad",
                "replace_ignitor",
                "Replace gas ignitor.",
            ),
        ),
        outcome("replace_ignitor", 4, "Replace ignitor", "Replace gas ignitor."),
        outcome("ignitor_verified", 5, "Ignitor verified", "Ignitor resistance within 50–250 Ω."),
    ],
    GAS_DRYER_ONLY,
)

GAS_VALVE = proc(
    "w8178559-gas-valve",
    "TEST #3d: Gas Valve Coils",
    "3d",
    "Gas Valve Test",
    [84],
    ["gas_valve"],
    ["no_heat", "gas_valve_check", "ignition_issue"],
    [
        instr(
            "access_gas_valve",
            2,
            "Access gas valve",
            "Remove toe panel. Disconnect gas valve harness. Gas supply off, power disconnected.",
            "coil_1_2",
        ),
        meas(
            "coil_1_2",
            3,
            "Coil terminals 1 to 2",
            "Measure resistance across terminals 1 and 2. Spec 1365 Ω ± 25.",
            "whirlpoolDuetSportDryerGasValveCoilOhms",
            "Gas valve",
            "1–2",
            pass_fail_branches(
                "coil12_ok",
                "coil_1_3",
                "coil12_bad",
                "replace_coils",
                "Replace gas valve coil(s) — terminals 1–2 out of spec.",
            ),
        ),
        meas(
            "coil_1_3",
            4,
            "Coil terminals 1 to 3",
            "Measure resistance across terminals 1 and 3. Spec 560 Ω ± 25.",
            "whirlpoolDuetSportDryerGasValveCoilOhms",
            "Gas valve",
            "1–3",
            pass_fail_branches(
                "coil13_ok",
                "coil_4_5",
                "coil13_bad",
                "replace_coils",
                "Replace gas valve coil(s) — terminals 1–3 out of spec.",
            ),
        ),
        meas(
            "coil_4_5",
            5,
            "Coil terminals 4 to 5",
            "Measure resistance across terminals 4 and 5. Spec 1220 Ω ± 50.",
            "whirlpoolDuetSportDryerGasValveCoilOhms",
            "Gas valve",
            "4–5",
            pass_fail_branches(
                "coil45_ok",
                "gas_valve_verified",
                "coil45_bad",
                "replace_coils",
                "Replace gas valve coil(s) — terminals 4–5 out of spec.",
            ),
        ),
        outcome("replace_coils", 6, "Replace valve coils", "Replace failed gas valve coil assembly."),
        outcome("gas_valve_verified", 7, "Gas valve coils verified", "All coil resistance readings within OEM chart."),
    ],
    GAS_DRYER_ONLY,
)


def diagnostic_entry_bundle() -> dict:
    return {
        "id": "w8178559-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_duet_sport_dryer",
        "manualId": "W8178559",
        "title": "W8178559 — Diagnostic test mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter MCE diagnostic mode, review saved/active F-xx codes, console button check (§6-1).",
        "tags": ["service_diagnostic", "fault_codes"],
        "entryStepId": "prep_standby",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [73, 74],
        },
        "steps": [
            {
                "id": "prep_standby",
                "order": 1,
                "type": "instruction",
                "title": "Standby mode",
                "body": "Dryer plugged in with all indicators off, or only Cycle Complete on.",
                "sourceExcerpt": "Be sure the dryer is in standby mode (plugged in with all indicators off).",
                "requiresInput": False,
                "defaultNextStepId": "diag_touchpad_entry",
            },
            {
                "id": "diag_touchpad_entry",
                "order": 2,
                "type": "instruction",
                "title": "Diagnostic entry — 3 sec × 3 pattern (§6-1)",
                "body": (
                    "Select any one button (except PAUSE/CANCEL) and use the same button throughout. "
                    "Press and hold 3 seconds → release 3 seconds → press and hold 3 seconds → "
                    "release 3 seconds → press and hold 3 seconds. All indicators illuminate 5 seconds "
                    "with 88 in Estimated Time Remaining. Saved codes show F-XX on display; active codes flash. "
                    "Press PAUSE/CANCEL to exit diagnostic mode."
                ),
                "sourceExcerpt": "Press/hold 3 seconds — Release 3 seconds — (repeat 3 holds).",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    SUPPLY_CONNECTIONS,
    MOTOR_CIRCUIT,
    HEATER_ELECTRIC,
    HEATER_GAS,
    EXHAUST_THERMISTOR,
    MOISTURE_SENSOR,
    DRYNESS_ADJUST,
    THERMAL_FUSE,
    THERMAL_CUTOFF,
    GAS_IGNITOR,
    GAS_VALVE,
    BUTTON_INDICATOR,
    DOOR_SWITCH,
]

PROCEDURE_FILES = [
    "w8178559-supply-connections.json",
    "w8178559-motor-circuit.json",
    "w8178559-heater-electric.json",
    "w8178559-heater-gas.json",
    "w8178559-exhaust-thermistor.json",
    "w8178559-moisture-sensor.json",
    "w8178559-dryness-adjust.json",
    "w8178559-thermal-fuse.json",
    "w8178559-thermal-cutoff.json",
    "w8178559-gas-ignitor.json",
    "w8178559-gas-valve.json",
    "w8178559-button-indicator.json",
    "w8178559-door-switch.json",
]

BUNDLES = [diagnostic_entry_bundle()]
BUNDLE_FILES = ["w8178559-diagnostic-entry.json"]


def write_catalog() -> None:
    catalog = {
        "manualId": "W8178559",
        "platformId": "whirlpool_duet_sport_dryer",
        "templateId": "electric_dryer",
        "label": "Whirlpool Duet Sport MCE dryer (Job Aid 8178559)",
        "notes": "Also applies to gas_dryer template (shared platformId). Gas heater path uses TEST #3d for valve — electric heater procedure is electric-specific.",
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
                "relatedCodes": [
                    tag for tag in item.get("tags", []) if tag.startswith("F") or tag.startswith("f")
                ],
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

    effects_script = ROOT / "backend" / "scripts" / "attach_w8178559_diagnostic_effects.py"
    if effects_script.exists():
        subprocess.run([sys.executable, str(effects_script)], check=True, cwd=ROOT)

    service_modes_script = ROOT / "backend" / "scripts" / "attach_w8178559_service_modes.py"
    if service_modes_script.exists():
        subprocess.run([sys.executable, str(service_modes_script)], check=True, cwd=ROOT)

    diagrams_script = ROOT / "backend" / "scripts" / "attach_w8178559_procedure_diagrams.py"
    if diagrams_script.exists():
        subprocess.run([sys.executable, str(diagrams_script)], check=True, cwd=ROOT)

    registry_script = ROOT / "backend" / "scripts" / "generate_procedure_registry.py"
    subprocess.run([sys.executable, str(registry_script)], check=True, cwd=ROOT)

    validate_script = ROOT / "backend" / "scripts" / "validate_procedure_seed.py"
    subprocess.run([sys.executable, str(validate_script)], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
