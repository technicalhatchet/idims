#!/usr/bin/env python3
"""Generate W11697231 (Whirlpool WTW4950 PSC top-load washer) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_tl_dd"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_tl_dd"

SOURCE = {
    "manualId": "W11697231",
    "manualTitle": "Whirlpool 3.8 cu ft Top Load Washer with Removable Agitator (WTW4950)",
    "extractedTextFile": (
        "backend/docs/manuals/technical-manual-w11697231-reva wtw4950-extracted.txt"
    ),
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the washer or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Resistance checks must be made with washer unplugged or power disconnected.",
    "requiresInput": False,
}


def proc(
    pid: str,
    title: str,
    oem_num: str,
    oem_title: str,
    pages: list[int],
    component_ids: list[str],
    tags: list[str],
    steps: list[dict],
) -> dict:
    if not steps:
        raise ValueError(f"{pid} must define at least one step after safety")
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    return {
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


def meas(sid, order, title, body, kid, connector, pins, branches, excerpt="", pin_details=None):
    test_point = {"connector": connector, "pins": pins, "label": title}
    if pin_details:
        test_point["pinDetails"] = pin_details
    return {
        "id": sid,
        "order": order,
        "type": "measurement",
        "title": title,
        "body": body,
        "sourceExcerpt": excerpt or body,
        "measurementKnowledgeId": kid,
        "testPoint": test_point,
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


def ohm_branches(prefix, pass_next, fail_next, pass_label="In range"):
    return [
        {"id": f"{prefix}_open", "label": "Open circuit (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


PIN_J5 = [
    {"pin": "1", "signal": "L1", "wireColor": "BK", "wireColorConfidence": "verified"},
    {"pin": "2", "signal": "Neutral", "wireColor": "BK", "wireColorConfidence": "verified"},
]
PIN_J12 = [
    {"pin": "1", "signal": "+12 VDC", "wireColor": "BLK", "wireColorConfidence": "verified"},
    {"pin": "4", "signal": "Circuit Gnd", "wireColor": "GY", "wireColorConfidence": "verified"},
]
PIN_J9_VALVE = [
    {"pin": "4", "signal": "Valve common (L1)", "wireColor": "BK/W", "wireColorConfidence": "verified"},
    {"pin": "1", "signal": "Hot valve", "wireColor": "RD", "wireColorConfidence": "verified"},
    {"pin": "5", "signal": "Cold valve", "wireColor": "BU", "wireColorConfidence": "verified"},
]
PIN_J2_MOTOR = [
    {"pin": "4", "signal": "L1 common", "wireColor": "BK/W", "wireColorConfidence": "verified"},
    {"pin": "6", "signal": "CW winding", "wireColor": "RD", "wireColorConfidence": "verified"},
    {"pin": "5", "signal": "CCW winding", "wireColor": "OR", "wireColorConfidence": "verified"},
]
PIN_J2_SHIFTER = [
    {"pin": "1", "signal": "Shifter motor (N)", "wireColor": "BR", "wireColorConfidence": "verified"},
    {"pin": "2", "signal": "L1 common", "wireColor": "BK/W", "wireColorConfidence": "verified"},
]
PIN_J2_DRAIN = [
    {"pin": "2", "signal": "L1 common", "wireColor": "BK/W", "wireColorConfidence": "verified"},
    {"pin": "3", "signal": "Drain pump", "wireColor": "BU", "wireColorConfidence": "verified"},
]
PIN_J6_LOCK = [
    {"pin": "1", "signal": "Lid switch / lock solenoid", "wireColor": "BU", "wireColorConfidence": "verified"},
    {"pin": "2", "signal": "L1 / lid switch", "wireColor": "WH", "wireColorConfidence": "verified"},
]
PIN_J9_THERM = [
    {"pin": "3", "signal": "Thermistor input", "wireColor": "BLK", "wireColorConfidence": "verified"},
    {"pin": "7", "signal": "Thermistor GND", "wireColor": "BLK", "wireColorConfidence": "verified"},
]

PROCEDURES = [
    proc(
        "w11697231-test-01-acu-power",
        "TEST #1: Main Control",
        "1",
        "Main Control",
        [30, 31],
        ["supply"],
        ["voltage_check", "supply_issue", "F1E1", "F1E2", "no_power"],
        [
            instr("access_console", 2, "Access main control", "Remove console. Verify ALL connectors fully seated at main control.", "restore_power_line"),
            instr("restore_power_line", 3, "Restore power for line check", "Plug in or reconnect power for live measurements only.", "line_voltage"),
            meas(
                "line_voltage",
                4,
                "Line voltage J5-1 to J5-2",
                "AC voltmeter: black probe J5-2 (Neutral), red probe J5-1 (L1). Expect 120 VAC.",
                "supplyVoltage120",
                "J5",
                "1 & 2",
                [
                    {"id": "line_ok", "label": "120 VAC present", "when": {"kind": "measurement_normal"}, "nextStepId": "diagnostic_led"},
                    {"id": "line_bad", "label": "No line voltage", "when": {"kind": "measurement_critical"}, "nextStepId": "check_power_cord", "terminal": True, "oemOutcome": "Check outlet, breaker, and AC power cord continuity."},
                ],
                pin_details=PIN_J5,
            ),
            visual(
                "diagnostic_led",
                5,
                "Diagnostic LED state",
                "Is the Diagnostic LED ON or OFF? (ON = +5 VDC present, micro operating.)",
                [
                    {"id": "led_on", "label": "ON", "when": {"kind": "checkpoint_yes"}, "nextStepId": "dc_12v"},
                    {"id": "led_off", "label": "OFF (+5 VDC missing)", "when": {"kind": "checkpoint_no"}, "nextStepId": "isolate_j12"},
                ],
            ),
            meas(
                "dc_12v",
                6,
                "+12 VDC at J12",
                "DC volts: black J12-4 (Circuit Gnd), red J12-1 (+12 VDC). Do not short pins inside header.",
                "whirlpoolWtw4950WasherAcu12Vdc",
                "J12",
                "1 & 4",
                [
                    {"id": "v12_ok", "label": "+12 VDC present", "when": {"kind": "measurement_normal"}, "nextStepId": "acu_verified"},
                    {"id": "v12_bad", "label": "+12 VDC missing", "when": {"kind": "measurement_critical"}, "nextStepId": "isolate_j12"},
                ],
                pin_details=PIN_J12,
            ),
            instr("isolate_j12", 7, "Isolate shifter load on J12", "Disconnect power. Remove connector J12 from main control. Restore power and repeat Diagnostic LED and +12 VDC checks at J12 header.", "led_after_j12"),
            visual(
                "led_after_j12",
                8,
                "DC supplies return with J12 removed?",
                "With J12 disconnected, does Diagnostic LED turn ON and +12 VDC return?",
                [
                    {"id": "j12_shifter_short", "label": "DC returns — shifter/harness short", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_shifter_harness", "terminal": True, "oemOutcome": "Check harness between main control and shifter; replace shifter assembly if harness good."},
                    {"id": "j12_acu_fault", "label": "DC still missing", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu"},
                ],
            ),
            outcome("check_power_cord", 9, "Check power cord", "Verify outlet and AC cord continuity per wiring diagram."),
            outcome("acu_verified", 10, "Main control supplies verified", "Line voltage, Diagnostic LED, and +12 VDC OK — proceed to complaint-specific test."),
            outcome("replace_shifter_harness", 11, "Service shifter path", "Repair harness or replace shifter assembly per TEST #3a."),
            outcome("replace_acu", 12, "Replace main control", "Replace main control. Calibrate washer and run Automatic Test to verify."),
        ],
    ),
    proc(
        "w11697231-test-02-valves",
        "TEST #2: Valves",
        "2",
        "Valves",
        [31, 32],
        ["inlet_valve"],
        ["water_valve_check", "fill_issue", "F8E1", "F8E5", "LF"],
        [
            instr("valve_live_precheck", 2, "Manual Test valve pre-check", "In Manual Test Mode, run Cold and Hot Valve tests. Note any valve that fails to energize.", "disconnect_j9"),
            instr("disconnect_j9", 3, "Disconnect J9 at main control", "Unplug washer. Remove console. Disconnect J9 from main control.", "valve_ohms"),
            meas(
                "valve_ohms",
                4,
                "Valve coil resistance at J9",
                "Measure each coil across J9-4 (L1 common) and valve pin: Hot J9-1, Cold J9-5. Expect 890 Ω to 1.3 kΩ.",
                "whirlpoolWtw4950WasherInletValveOhms",
                "J9",
                "4 & valve pin",
                ohm_branches("valve", "reconnect_j9_power", "replace_valve", "890 Ω–1.3 kΩ"),
                pin_details=PIN_J9_VALVE,
            ),
            instr("reconnect_j9_power", 5, "Reconnect J9 and restore power", "Reconnect J9. Reassemble panels. Restore power for Manual Test Mode valve exercise.", "live_test_valves"),
            visual(
                "live_test_valves",
                6,
                "Valves energize in Manual Test Mode",
                "Toggle Cold/Hot valve tests in Manual Test Mode. Does each valve in question turn on?",
                [
                    {"id": "valves_run", "label": "Valves operate", "when": {"kind": "checkpoint_yes"}, "nextStepId": "valves_verified"},
                    {"id": "valves_no_run", "label": "Ohms OK but valve does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_valves", "terminal": True, "oemOutcome": "Coils in range but no run — replace main control and calibrate."},
                ],
            ),
            outcome("replace_valve", 7, "Replace valve assembly", "Replace water valve assembly when coil tens of ohms outside 890 Ω–1.3 kΩ."),
            outcome("valves_verified", 8, "Valves verified", "Valve resistance and Manual Test operation verified."),
            outcome("replace_acu_valves", 9, "Replace main control", "Replace main control, calibrate, and run Automatic Test."),
        ],
    ),
    proc(
        "w11697231-test-03-drive-system",
        "TEST #3: Drive System (pre-test)",
        "3",
        "Drive System",
        [32],
        ["drive_motor"],
        ["motor_check", "F7E1", "F7E5", "F7E6", "F7E7"],
        [
            instr("enter_service_diag", 2, "Enter Service Diagnostic and clear codes", "Activate Service Diagnostic mode. Retrieve and clear F7-E1, F7-E5, and motor speed codes if present.", "heavy_agitate_test"),
            visual(
                "heavy_agitate_test",
                3,
                "Heavy Agitate runs 15–20 sec",
                "Enter Manual Test Mode. Run Heavy Agitate. Does motor run after 15–20 seconds?",
                [
                    {"id": "agitate_ok", "label": "Motor runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "spin_test"},
                    {"id": "agitate_fail", "label": "Motor does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_shifter_motor"},
                ],
            ),
            visual(
                "spin_test",
                4,
                "Spin test completes",
                "In Manual Test Mode, command spin. If motor hums briefly then stops (lid lock blinking), check Fault Code Display for shifter/basket speed errors.",
                [
                    {"id": "spin_ok", "label": "Spin OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "drive_verified"},
                    {"id": "spin_fail", "label": "Spin fails or hums out", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_shifter_motor"},
                ],
            ),
            instr(
                "route_shifter_motor",
                5,
                "Continue to shifter or motor test",
                "Shifter-related (F7E5, basket speed) → TEST #3a Shifter. Motor circuit (F7E6, F7E7) → TEST #3b Motor.",
                "drive_deferred",
            ),
            outcome("drive_verified", 6, "Drive system OK", "Heavy Agitate and spin pass in Manual Test Mode."),
            outcome("drive_deferred", 7, "Run TEST #3a or #3b", "Proceed to w11697231-test-03a-shifter or w11697231-test-03b-motor per fault code."),
        ],
    ),
    proc(
        "w11697231-test-03a-shifter",
        "TEST #3a: Drive System — Shifter",
        "3a",
        "Drive System - Shifter",
        [32, 33],
        ["drive_motor"],
        ["shifter_check", "F7E5", "agitate_issue", "spin_issue"],
        [
            visual(
                "shifter_service_test",
                2,
                "Spin and Agitate in Manual Test Mode",
                "Lid closed and locked. Run Spin and Agitate tests. Did shifter engage for both?",
                [
                    {"id": "st_fail", "label": "Unsuccessful", "when": {"kind": "checkpoint_no"}, "nextStepId": "basket_free"},
                    {"id": "st_ok", "label": "Both pass", "when": {"kind": "checkpoint_yes"}, "nextStepId": "shifter_verified"},
                ],
            ),
            visual(
                "basket_free",
                3,
                "Basket turns freely",
                "Power off. Basket should turn freely. If not, resolve mechanical friction or lockup.",
                [
                    {"id": "basket_ok", "label": "Turns freely", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j12_j2"},
                    {"id": "basket_bind", "label": "Does not turn freely", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_friction", "terminal": True, "oemOutcome": "Determine and correct mechanical friction or lockup."},
                ],
            ),
            visual("check_j12_j2", 4, "J12 and J2 fully seated", "Verify J12 and J2 inserted fully at main control.", [
                {"id": "conn_ok", "label": "Connectors OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "shifter_ohms"},
                {"id": "conn_bad", "label": "Connector loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_connectors"},
            ]),
            instr("reseat_connectors", 5, "Reseat J12/J2 and retest", "Reconnect connectors and repeat Manual Test Spin/Agitate.", "shifter_service_test"),
            meas(
                "shifter_ohms",
                6,
                "Shifter motor resistance J2-1 to J2-2",
                "Remove J2. Expect 2 kΩ to 3.5 kΩ across shifter motor. Verify splutch cam moves freely before electrical checks.",
                "whirlpoolWtw4950WasherShifterOhms",
                "J2",
                "1 & 2",
                ohm_branches("shifter", "shifter_voltage", "harness_continuity", "2–3.5 kΩ"),
                pin_details=PIN_J2_SHIFTER,
            ),
            visual(
                "shifter_voltage",
                7,
                "120 VAC at shifter when commanded",
                "Restore power. AC volts J2-2 (L1) to J2-1 (N). Toggle Spin/Agitate in Manual Test Mode (4–15 sec state change). Expect 120 VAC.",
                [
                    {"id": "vac_yes", "label": "120 VAC present", "when": {"kind": "checkpoint_yes"}, "nextStepId": "shifter_switch_vdc"},
                    {"id": "vac_no", "label": "No voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_shifter"},
                ],
            ),
            visual(
                "shifter_switch_vdc",
                8,
                "Shifter switch voltage J12-3",
                "DC volts: black J12-4 (Gnd), red J12-3. Toggle Spin/Agitate — SPIN = +5 VDC, AGITATE = 0 VDC.",
                [
                    {"id": "sw_ok", "label": "Voltage toggles correctly", "when": {"kind": "checkpoint_yes"}, "nextStepId": "tach_12v"},
                    {"id": "sw_bad", "label": "Voltage does not switch", "when": {"kind": "checkpoint_no"}, "nextStepId": "harness_continuity"},
                ],
            ),
            visual(
                "tach_12v",
                9,
                "+12 VDC and tachometer verification",
                "DC volts J12-4 to J12-1 expect +12 VDC. Enter Tachometer Verification Mode; slowly turn basket — status LEDs should illuminate sequentially.",
                [
                    {"id": "tach_ok", "label": "+12 VDC OK; tach verified", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_shifter"},
                    {"id": "tach_bad", "label": "Tach not verified", "when": {"kind": "checkpoint_no"}, "nextStepId": "harness_continuity"},
                ],
            ),
            visual(
                "harness_continuity",
                10,
                "Shifter harness continuity",
                "Power off. Tilt washer. Continuity shifter pins to J12/J2 per OEM chart (pins 1–6 to J12-2, J12-1, J2-2, J12-3, J12-4, J2-1)?",
                [
                    {"id": "harness_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_shifter"},
                    {"id": "harness_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness", "terminal": True, "oemOutcome": "Replace lower washer harness."},
                ],
            ),
            outcome("clear_friction", 11, "Clear mechanical friction", "Resolve basket/tub friction before shifter replacement."),
            outcome("shifter_verified", 12, "Shifter verified", "Spin and Agitate Manual Test Mode pass."),
            outcome("replace_lower_harness", 13, "Replace lower harness", "Restore harness continuity and retest."),
            outcome("replace_shifter", 14, "Replace shifter assembly", "Replace shifter. Calibrate and run Automatic Test."),
            outcome("replace_acu_shifter", 15, "Replace main control", "Shifter/mechanical OK but ACU does not drive shifter — replace main control."),
        ],
    ),
    proc(
        "w11697231-test-03b-motor",
        "TEST #3b: Drive System — Motor",
        "3b",
        "Drive System - Motor",
        [33, 34],
        ["drive_motor"],
        ["motor_check", "F1E2", "F7E6", "F7E7", "agitate_issue", "spin_issue"],
        [
            visual(
                "motor_agitate_spin_test",
                2,
                "Agitate and spin in Manual Test Mode",
                "Run Gentle or Heavy Agitation and Low/High Spin. Basket should spin clockwise on spin tests.",
                [
                    {"id": "motor_fail", "label": "Unsuccessful", "when": {"kind": "checkpoint_no"}, "nextStepId": "basket_free_motor"},
                    {"id": "motor_ok", "label": "Motor runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_verified"},
                ],
            ),
            visual(
                "basket_free_motor",
                3,
                "Basket turns freely",
                "Power off. Basket should turn freely.",
                [
                    {"id": "basket_ok", "label": "Turns freely", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j12_j2_motor"},
                    {"id": "basket_bind", "label": "Does not turn freely", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_friction_motor", "terminal": True, "oemOutcome": "Resolve mechanical friction or lockup."},
                ],
            ),
            visual("check_j12_j2_motor", 4, "J12 and J2 fully seated", "Verify J12 and J2 fully inserted at main control.", [
                {"id": "j_conn_ok", "label": "Connectors OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "live_motor_voltage"},
                {"id": "j_conn_bad", "label": "Connector loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j2_motor"},
            ]),
            instr("reseat_j2_motor", 5, "Reseat connectors and retest", "Reconnect J12/J2 and repeat Manual Test agitate/spin.", "motor_agitate_spin_test"),
            instr("live_motor_voltage", 6, "Live motor voltage check", "Restore power. Run Gentle Agitation in Manual Test Mode.", "cw_voltage"),
            visual(
                "cw_voltage",
                7,
                "120 VAC cycling on CW winding",
                "AC volts J2-4 (L1) to J2-6 (CW). Expect 120 VAC cycling ON during CW rotation.",
                [
                    {"id": "cw_ok", "label": "120 VAC present on CW", "when": {"kind": "checkpoint_yes"}, "nextStepId": "ccw_voltage"},
                    {"id": "cw_bad", "label": "No CW voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_test1", "terminal": True, "oemOutcome": "See TEST #1 Main Control."},
                ],
            ),
            visual(
                "ccw_voltage",
                8,
                "120 VAC cycling on CCW winding",
                "AC volts J2-4 (L1) to J2-5 (CCW). Expect 120 VAC cycling ON during CCW rotation.",
                [
                    {"id": "ccw_ok", "label": "120 VAC present on CCW", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_winding_ohms"},
                    {"id": "ccw_bad", "label": "No CCW voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_test1"},
                ],
            ),
            instr("motor_winding_ohms", 9, "Disconnect power for ohms", "Unplug washer. Remove J2 from main control.", "j2_motor_ohms"),
            meas(
                "j2_motor_ohms",
                10,
                "Motor winding resistance at J2",
                "CW J2-4↔6 and CCW J2-4↔5. 1/4 HP: 5–9.5 Ω each; 1/3 HP (4 rotary switches): 3.5–6 Ω each.",
                "whirlpoolWtw4950WasherMotorWindingOhms",
                "J2",
                "4-6 & 4-5",
                ohm_branches("motor_j2", "motor_harness_cont", "replace_motor", "In OEM range"),
                pin_details=PIN_J2_MOTOR,
            ),
            visual(
                "motor_harness_cont",
                11,
                "Motor harness continuity",
                "Tilt washer. Continuity motor connector to J2 and run capacitor per OEM chart?",
                [
                    {"id": "mh_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_terminal_ohms"},
                    {"id": "mh_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_motor", "terminal": True, "oemOutcome": "Replace lower machine harness."},
                ],
            ),
            meas(
                "motor_terminal_ohms",
                12,
                "Motor resistance at drive connector",
                "At motor: CW pins 4↔2 and CCW pins 3↔2. Expect same Ω range as J2 measurement.",
                "whirlpoolWtw4950WasherMotorWindingOhms",
                "PSC motor",
                "4-2 & 3-2",
                ohm_branches("motor_term", "capacitor_check", "replace_motor", "In OEM range"),
            ),
            visual(
                "capacitor_check",
                13,
                "Run capacitor charge/discharge test",
                "Discharge capacitor with 20 kΩ resistor. Measure terminals — steady increase = good; short/open = replace capacitor.",
                [
                    {"id": "cap_ok", "label": "Capacitor OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_motor"},
                    {"id": "cap_bad", "label": "Capacitor shorted or open", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_capacitor", "terminal": True, "oemOutcome": "Replace run capacitor, calibrate, and retest."},
                ],
            ),
            outcome("route_test1", 14, "Run TEST #1", "Motor triac drive missing — verify main control supplies."),
            outcome("clear_friction_motor", 15, "Clear mechanical friction", "Resolve basket/tub bind before motor replacement."),
            outcome("replace_lower_harness_motor", 16, "Replace lower harness", "Restore motor circuit continuity."),
            outcome("replace_motor", 17, "Replace motor", "Motor windings open or out of range."),
            outcome("replace_capacitor", 18, "Replace run capacitor", "Faulty capacitor causes hum, no start, or slow turn."),
            outcome("motor_verified", 19, "Motor verified", "Motor resistance and Manual Test rotation verified."),
            outcome("replace_acu_motor", 20, "Replace main control", "Motor, harness, and capacitor good but no run — replace main control."),
        ],
    ),
    proc(
        "w11697231-test-04-console-indicators",
        "TEST #4: Console and Indicators",
        "4",
        "Console and Indicators",
        [34, 35],
        ["hmi_control"],
        ["hmi_check", "F2E1", "F2E3"],
        [
            visual(
                "ui_test_mode",
                2,
                "UI Test Mode check",
                "Enter UI Test Mode (Rinse + Spin LEDs). All status LEDs ON? START toggles LEDs; rotary switches toggle Fill/Wash/Rinse/Spin; cycle knob toggles Done.",
                [
                    {"id": "ui_ok", "label": "All LEDs and switches OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "hmi_verified"},
                    {"id": "none_on", "label": "None of the LEDs light up", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_connectors_ui"},
                    {"id": "leds_flash", "label": "One or more LEDs flashing", "when": {"kind": "checkpoint_no"}, "nextStepId": "flashing_switch_path"},
                    {"id": "switch_no_toggle", "label": "Rotary switch does not toggle LED", "when": {"kind": "checkpoint_no"}, "nextStepId": "flashing_switch_path"},
                ],
            ),
            visual(
                "check_connectors_ui",
                3,
                "All connectors seated",
                "Power off. ALL main control connectors fully seated; main control properly inserted in console.",
                [
                    {"id": "conn_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "route_test1_ui"},
                    {"id": "conn_bad", "label": "Loose connector", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_connectors"},
                ],
            ),
            visual(
                "flashing_switch_path",
                4,
                "Switch connector and harness",
                "Verify suspect rotary switch connector fully seated. Check harness continuity and shorts between switch and main control (J3/J4).",
                [
                    {"id": "sw_harness_ok", "label": "Harness OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_switch"},
                    {"id": "sw_harness_bad", "label": "Harness fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_ui_harness"},
                ],
            ),
            instr("route_test1_ui", 5, "Verify main control supplies", "Run TEST #1 Main Control supply checks, then retest UI Test Mode.", "hmi_verified"),
            outcome("repair_connectors", 6, "Repair connections", "Reseat all connectors and retest UI Test Mode."),
            outcome("replace_ui_harness", 7, "Replace console harness", "Repair or replace harness between rotary switches and main control."),
            outcome("replace_switch", 8, "Replace rotary switch", "Replace switch identified by flashing/toggle LED mapping."),
            outcome("hmi_verified", 9, "Console verified", "Status LEDs and rotary encoders verified in UI Test Mode."),
        ],
    ),
    proc(
        "w11697231-test-05-temp-thermistor",
        "TEST #5: Temperature Thermistor",
        "5",
        "Temperature Thermistor",
        [35],
        ["wash_ntc"],
        ["thermistor_check", "F3E2", "temp_fault", "F8E5"],
        [
            instr("cold_valve_test", 2, "Cold valve Manual Test", "Manual Test Mode: Cold valve test — cold water dispenses?", "hot_valve_test"),
            instr("hot_valve_test", 3, "Hot valve Manual Test", "Hot valve test — hot water dispenses? Verify household hot supply if cold only.", "disconnect_j9_therm"),
            instr("disconnect_j9_therm", 4, "Disconnect J9", "Power off. Remove J9 from main control.", "therm_ohms"),
            meas(
                "therm_ohms",
                5,
                "Temperature thermistor J9-3 to J9-7",
                "Measure resistance at ambient. Compare to OEM R/T table in manual (~50 kΩ @ 77°F / 25°C).",
                "whirlpoolWtw4950WasherInletThermistorOhms",
                "J9",
                "3 & 7",
                [
                    {"id": "therm_ok", "label": "In R/T table range", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_acu_therm"},
                    {"id": "therm_bad", "label": "Open or out of range", "when": {"kind": "measurement_open"}, "nextStepId": "replace_thermistor", "terminal": True, "oemOutcome": "Replace temperature thermistor assembly."},
                    {"id": "therm_crit", "label": "Short/critical", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_thermistor", "terminal": True, "oemOutcome": "Replace temperature thermistor assembly."},
                ],
                pin_details=PIN_J9_THERM,
            ),
            outcome("replace_thermistor", 6, "Replace thermistor assembly", "Thermistor open/short — replace temperature thermistor assembly."),
            outcome("replace_acu_therm", 7, "Replace main control", "Thermistor good — replace main control, calibrate, and run Automatic Test."),
        ],
    ),
    proc(
        "w11697231-test-06-water-level",
        "TEST #6: Water Level",
        "6",
        "Water Level",
        [35, 36],
        ["water_level_sensor"],
        ["pressure_sensor", "F3E1", "F8E1", "F8E3", "long_fill"],
        [
            visual(
                "small_load_fill",
                2,
                "Small load fill stops automatically",
                "Run small load cycle. Do valves shut off at correct water level?",
                [
                    {"id": "fill_ok", "label": "Fill stops correctly", "when": {"kind": "checkpoint_yes"}, "nextStepId": "level_verified"},
                    {"id": "fill_bad", "label": "Overfill or long fill", "when": {"kind": "checkpoint_no"}, "nextStepId": "drain_tub"},
                ],
            ),
            instr("drain_tub", 3, "Drain tub completely", "Drain all water from tub before pressure hose service.", "check_pressure_hose"),
            visual(
                "check_pressure_hose",
                4,
                "Pressure hose and dome",
                "Hose secure at main control transducer and tub dome? Routed without pinch? Clear of water/suds/debris?",
                [
                    {"id": "hose_ok", "label": "Hose OK after service", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_level"},
                    {"id": "hose_bad", "label": "Pinch, leak, or debris", "when": {"kind": "checkpoint_no"}, "nextStepId": "service_hose"},
                ],
            ),
            instr("service_hose", 5, "Service pressure hose", "Disconnect hose at main control, blow clear, fix routing, replace if leaking. Retest fill.", "small_load_fill"),
            outcome("level_verified", 6, "Water level OK", "On-board pressure transducer and hose path verified."),
            outcome("replace_acu_level", 7, "Replace main control", "Hose path good — replace main control; calibrate and run Automatic Test."),
        ],
    ),
    proc(
        "w11697231-test-07-drain-pump",
        "TEST #7: Drain Pump",
        "7",
        "Drain Pump",
        [36, 37],
        ["drain_pump"],
        ["pump_check", "drain_issue", "F9E1", "dr"],
        [
            instr("clear_obstructions", 2, "Clear drain path obstructions", "Check usual areas. Then test drain pump in Manual Test Mode.", "drain_service_test"),
            visual(
                "drain_service_test",
                3,
                "Drain pump in Manual Test Mode",
                "Run Drain Test in Manual Test Mode. Does pump run?",
                [
                    {"id": "pump_live_fail", "label": "Does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j2_pump"},
                    {"id": "pump_live_ok", "label": "Runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_verified"},
                ],
            ),
            visual("check_j2_pump", 4, "J2 fully seated", "Power off. J2 fully inserted at main control?", [
                {"id": "j2p_ok", "label": "J2 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "j2_pump_ohms"},
                {"id": "j2p_bad", "label": "J2 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j2_pump"},
            ]),
            instr("reseat_j2_pump", 5, "Reseat J2 and retest", "Reconnect J2 and repeat Manual Test drain.", "drain_service_test"),
            meas(
                "j2_pump_ohms",
                6,
                "Drain pump resistance J2-2 to J2-3",
                "Remove J2. Expect 14–25 Ω across drain pump winding.",
                "whirlpoolWtw4950WasherDrainPumpOhms",
                "J2",
                "2 & 3",
                ohm_branches("drain_j2", "pump_obstruction", "harness_pump_cont", "14–25 Ω"),
                pin_details=PIN_J2_DRAIN,
            ),
            visual(
                "pump_obstruction",
                7,
                "Pump free of obstructions",
                "Tilt washer. Verify drain pump free from obstructions.",
                [
                    {"id": "pump_clear", "label": "Pump clear", "when": {"kind": "checkpoint_yes"}, "nextStepId": "harness_pump_cont"},
                    {"id": "pump_stuck", "label": "Obstruction or stuck pump", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_pump_obstruction"},
                ],
            ),
            visual(
                "harness_pump_cont",
                8,
                "Drain pump harness continuity",
                "Continuity drain pump pin 1→J2-3 and pin 2→J2-2?",
                [
                    {"id": "ph_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_terminal_ohms"},
                    {"id": "ph_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_pump", "terminal": True, "oemOutcome": "Replace lower machine harness."},
                ],
            ),
            meas(
                "pump_terminal_ohms",
                9,
                "Resistance at drain pump terminals",
                "At pump motor terminals expect 14–25 Ω.",
                "whirlpoolWtw4950WasherDrainPumpOhms",
                "Drain pump",
                "1 & 2",
                ohm_branches("drain_pump", "reconnect_pump_power", "replace_drain_pump", "14–25 Ω"),
            ),
            instr("reconnect_pump_power", 10, "Reconnect pump and restore power", "Reconnect J2 and pump harness. Restore power for Manual Test drain.", "live_test_drain_pump"),
            visual(
                "live_test_drain_pump",
                11,
                "Drain pump runs in Manual Test Mode",
                "Run Drain Test. Does pump run and evacuate water?",
                [
                    {"id": "dp_run", "label": "Pump runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_verified"},
                    {"id": "dp_no_run", "label": "Ohms OK but no run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_pump", "terminal": True, "oemOutcome": "Pump good but no run — replace main control."},
                ],
            ),
            outcome("clear_pump_obstruction", 12, "Clear pump obstruction", "Remove obstruction and check for blown R69 surge resistor on board."),
            outcome("replace_lower_harness_pump", 13, "Replace lower harness", "Restore pump circuit continuity."),
            outcome("replace_drain_pump", 14, "Replace drain pump", "Pump motor open or out of range at terminals."),
            outcome("pump_verified", 15, "Drain pump verified", "Pump resistance and Manual Test run verified."),
            outcome("replace_acu_pump", 16, "Replace main control", "Pump good but no run — replace main control."),
        ],
    ),
    proc(
        "w11697231-test-08-lid-lock",
        "TEST #8: Lid Lock",
        "8",
        "Lid Lock",
        [37],
        ["door_lock"],
        ["lid_lock", "door_lock_check", "F5E1", "F5E2", "F5E3", "F5E4"],
        [
            visual(
                "lid_lock_service_test",
                2,
                "Lid Lock Manual Test Mode",
                "Run Lid Lock test in Manual Test Mode. Does lock cycle lock and unlock?",
                [
                    {"id": "ll_fail", "label": "Unsuccessful", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_obstruction"},
                    {"id": "ll_ok", "label": "Lock cycles OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_verified"},
                ],
            ),
            visual("check_obstruction", 3, "Lid lock mechanism free", "Check lid lock for obstruction or binding. Repair as necessary.", [
                {"id": "obst_clear", "label": "No obstruction", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j6"},
                {"id": "obst_found", "label": "Obstruction repaired", "when": {"kind": "checkpoint_no"}, "nextStepId": "lid_lock_service_test"},
            ]),
            visual("check_j6", 4, "J6 fully seated", "Power off. J6 fully inserted at main control?", [
                {"id": "j6_ok", "label": "J6 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_ohms"},
                {"id": "j6_bad", "label": "J6 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j6"},
            ]),
            instr("reseat_j6", 5, "Reseat J6 and retest", "Reconnect J6 and repeat Lid Lock Manual Test.", "lid_lock_service_test"),
            meas(
                "lid_lock_ohms",
                6,
                "Lid lock resistance J6",
                "Remove J6. Solenoid J6-1↔2 (lid closed): 85–155 Ω. Lock switch J6-3↔2: locked=0 Ω, unlocked=open. Lid switch J6-2↔1: lid open=open circuit.",
                "whirlpoolWtw4950WasherLidLockSolenoidOhms",
                "J6",
                "1 & 2",
                ohm_branches("lock_solenoid", "switch_states", "replace_lid_lock", "85–155 Ω"),
                pin_details=PIN_J6_LOCK,
            ),
            visual(
                "switch_states",
                7,
                "Lock and lid switch states",
                "Do lock switch and lid switch readings match unlocked/locked table for current lid state?",
                [
                    {"id": "sw_ok", "label": "Switch states OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_lid"},
                    {"id": "sw_bad", "label": "Switch readings wrong", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lid_lock"},
                ],
            ),
            outcome("replace_lid_lock", 8, "Replace lid lock mechanism", "Switch or solenoid readings fail — replace lid lock."),
            outcome("replace_acu_lid", 9, "Replace main control", "Lid lock components good but lock problem persists — replace main control."),
            outcome("lid_lock_verified", 10, "Lid lock verified", "Lid lock resistance and Manual Test operation verified."),
        ],
    ),
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def service_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11697231-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11697231",
        "title": "W11697231 — Service Diagnostic mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console"],
        "description": "Cycle selector knob sequence (RESET + 5 steps within 6 seconds).",
        "tags": ["service_diagnostic", "live_test"],
        "entryStepId": "service_diagnostic_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [15, 16],
        },
        "steps": [
            {
                "id": "service_diagnostic_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Service Diagnostic mode",
                "body": (
                    "Washer in standby (plugged in, all indicators off). Wait 10 seconds after power-up. "
                    "RESET: rotate cycle selector knob counterclockwise one or more clicks. "
                    "Within 6 seconds complete: (a) CW one click, wait ½ sec; (b) CW one click, wait ½ sec; "
                    "(c) CW one click, wait ½ sec; (d) CCW one click, wait ½ sec; (e) CW one click. "
                    "Success: all status LEDs (except Lid Locked) flash ON/OFF at ½-second intervals."
                ),
                "sourceExcerpt": (
                    "RESET - Rotate cycle selector knob counterclockwise one or more clicks... "
                    "sequence a through e must be completed within 6 seconds."
                ),
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


def manual_test_mode_bundle() -> dict:
    return {
        "id": "w11697231-manual-test-mode",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11697231",
        "title": "W11697231 — Manual Test Mode",
        "modeKind": "load_test",
        "uiVariants": ["console"],
        "description": "Spin + Done LEDs on, START enters Manual Test; cycle selector picks output, START toggles load.",
        "tags": ["service_test", "live_test", "component_activation"],
        "entryStepId": "manual_test_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [16, 17],
        },
        "steps": [
            {
                "id": "manual_test_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Manual Test Mode",
                "body": (
                    "With Service Diagnostic active, turn cycle selector until Spin and Done status LEDs are ON. "
                    "Press START to enter Manual Test Mode (all outputs OFF). "
                    "Use cycle selector knob to select output to test; START activates/deactivates selected output "
                    "(corresponding status LEDs flash when active). Lid must be closed with lock enabled for Agitate or Spin. "
                    "Hold START 3 seconds to exit."
                ),
                "sourceExcerpt": "Spin and Done LEDs On — Press the START button to enter Manual Overview Test Mode.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


BUNDLES = [service_diagnostic_entry_bundle(), manual_test_mode_bundle()]
BUNDLE_FILES = [
    "w11697231-service-diagnostic-entry.json",
    "w11697231-manual-test-mode.json",
]


def write_catalog() -> None:
    w11697231_entries = [
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
                tag
                for tag in item.get("tags", [])
                if tag.startswith("F") or tag in ("LF", "dr", "drn")
            ],
        }
        for item in PROCEDURES
    ]
    catalog_path = OUT / "procedureCatalog.json"
    existing = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.is_file() else {}
    w10864849_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w10864849-")
    ]
    catalog = {
        "manualId": "W10864849",
        "platformId": PLATFORM,
        "templateId": "washer",
        "label": "Whirlpool/Maytag top-load washer (whirlpool_tl_dd)",
        "notes": (
            "W10864849 BPM direct-drive 6.2 cu ft (WTW95*/MVW95*) + W11697231 PSC 3.8 cu ft (WTW49*/MVW49*). "
            "Do not reuse Ω specs or connector pinouts between manuals."
        ),
        "plannedProcedures": w10864849_entries + w11697231_entries,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {catalog_path.name} "
        f"({len(w10864849_entries)} W10864849 + {len(w11697231_entries)} W11697231)"
    )


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
        "attach_w11697231_diagnostic_effects.py",
        "attach_w11697231_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.is_file():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run(
        [sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")],
        check=True,
        cwd=ROOT,
    )


if __name__ == "__main__":
    main()
