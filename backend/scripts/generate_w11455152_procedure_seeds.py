#!/usr/bin/env python3
"""Generate W11455152 (Whirlpool WTW6157 PSC top-load washer) procedure seed JSON files."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_tl_dd_6157"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_tl_dd_6157"

SOURCE = {
    "manualId": "W11455152",
    "manualTitle": "Whirlpool 5.3 cu ft Top Load Washer (WTW6157, W11455152A)",
    "extractedTextFile": "backend/docs/manuals/technical-manual-w11455152-reva wtw6157-extracted.txt",
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


PIN_J1 = [
    {"pin": "1", "signal": "Neutral", "wireColor": "BU", "wireColorConfidence": "verified"},
    {"pin": "2", "signal": "Line", "wireColor": "GY", "wireColorConfidence": "verified"},
]
PIN_J5 = [
    {"pin": "1", "signal": "+12 VDC", "wireColor": "BK", "wireColorConfidence": "verified"},
    {"pin": "4", "signal": "Circuit Gnd (AGND)", "wireColor": "WH", "wireColorConfidence": "verified"},
]
PIN_J8_VALVE = [
    {"pin": "1", "signal": "Valve common (AGND)", "wireColor": "BK", "wireColorConfidence": "verified"},
    {"pin": "3", "signal": "Cold valve", "wireColor": "YL", "wireColorConfidence": "verified"},
    {"pin": "5", "signal": "Hot valve", "wireColor": "RD", "wireColorConfidence": "verified"},
    {"pin": "6", "signal": "Fabric softener valve", "wireColor": "BK", "wireColorConfidence": "verified"},
]
PIN_J6_MOTOR = [
    {"pin": "1", "signal": "CCW winding", "wireColor": "PK", "wireColorConfidence": "verified"},
    {"pin": "4", "signal": "CW winding", "wireColor": "OR", "wireColorConfidence": "verified"},
    {"pin": "6", "signal": "Neutral", "wireColor": "WH", "wireColorConfidence": "verified"},
]
PIN_J6_SHIFTER = [
    {"pin": "2", "signal": "Shifter", "wireColor": "BU", "wireColorConfidence": "verified"},
    {"pin": "6", "signal": "Neutral", "wireColor": "WH", "wireColorConfidence": "verified"},
]
PIN_J6_DRAIN = [
    {"pin": "3", "signal": "Drain pump", "wireColor": "BU", "wireColorConfidence": "verified"},
    {"pin": "6", "signal": "Neutral", "wireColor": "WH", "wireColorConfidence": "verified"},
]
PIN_J4_LOCK = [
    {"pin": "2", "signal": "Lock solenoid", "wireColor": "BU", "wireColorConfidence": "verified"},
    {"pin": "3", "signal": "Lock solenoid", "wireColor": "WH", "wireColorConfidence": "verified"},
]
PIN_J8_THERM = [
    {"pin": "8", "signal": "NTC 1", "wireColor": "BK", "wireColorConfidence": "verified"},
    {"pin": "9", "signal": "AGND", "wireColor": "BK", "wireColorConfidence": "verified"},
]

PROCEDURES = [
    proc(
        "w11455152-test-01-acu-power",
        "TEST #1: Main Control (ACU)",
        "1",
        "Main Control (ACU)",
        [25],
        ["supply"],
        ["voltage_check", "supply_issue", "F1E1", "F6E1", "F7E1", "no_power"],
        [
            instr("access_console", 2, "Access main control", "Remove console. Verify all connectors fully seated at ACU.", "restore_power_line"),
            instr("restore_power_line", 3, "Restore power for line check", "Plug in or reconnect power for live measurements only.", "line_voltage"),
            meas(
                "line_voltage",
                4,
                "Line voltage J1-1 to J1-2",
                "AC voltmeter: black probe J1-1 (Neutral), red probe J1-2 (Line). Expect 120 VAC.",
                "supplyVoltage120",
                "J1",
                "1 & 2",
                [
                    {"id": "line_ok", "label": "120 VAC present", "when": {"kind": "measurement_normal"}, "nextStepId": "diagnostic_led"},
                    {"id": "line_bad", "label": "No line voltage", "when": {"kind": "measurement_critical"}, "nextStepId": "check_power_cord", "terminal": True, "oemOutcome": "Check outlet, breaker, and AC power cord continuity."},
                ],
                pin_details=PIN_J1,
            ),
            visual(
                "diagnostic_led",
                5,
                "Diagnostic LED state",
                "Is the Diagnostic LED flashing, continuously ON, or OFF?",
                [
                    {"id": "led_flash", "label": "Flashing (+5 VDC, micro operating)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "acu_verified"},
                    {"id": "led_on", "label": "ON steady (+5 VDC, micro failure)", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu"},
                    {"id": "led_off", "label": "OFF (+5 VDC missing)", "when": {"kind": "checkpoint_no"}, "nextStepId": "isolate_hmi"},
                ],
            ),
            instr("isolate_hmi", 6, "Isolate HMI load on J5", "Disconnect power. Remove connector J5 from main control. Restore power.", "dc_12v"),
            meas(
                "dc_12v",
                7,
                "+12 VDC at J5",
                "DC volts: black J5-4 (Circuit Gnd), red J5-1 (+12 VDC). Do not short pins.",
                "whirlpoolMvw6200WasherAcu12Vdc",
                "J5",
                "1 & 4",
                [
                    {"id": "v12_ok", "label": "+12 VDC present", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_acu"},
                    {"id": "v12_bad", "label": "+12 VDC missing", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_acu"},
                ],
                pin_details=PIN_J5,
            ),
            outcome("check_power_cord", 8, "Check power cord", "Verify outlet and AC cord continuity per wiring diagram."),
            outcome("acu_verified", 9, "ACU power verified", "Line voltage and diagnostic LED OK — proceed to complaint-specific test or Service Diagnostic."),
            outcome("replace_acu", 10, "Replace main control", "Replace ACU. Reassemble and run Service Diagnostic cycle to verify."),
        ],
    ),
    proc(
        "w11455152-test-02-valves",
        "TEST #2: Valves",
        "2",
        "Valves",
        [25],
        ["inlet_valve"],
        ["water_valve_check", "fill_issue", "F8E1", "LF", "F0E4"],
        [
            instr("valve_live_precheck", 2, "Service Test valve pre-check", "In Service Test Mode, run automatic water valve sequence. Note any valve that fails to energize.", "disconnect_j8"),
            instr("disconnect_j8", 3, "Disconnect J8 at ACU", "Unplug washer. Remove console. Disconnect J8 from main control.", "valve_ohms"),
            meas(
                "valve_ohms",
                4,
                "Valve coil resistance at J8",
                "Measure each coil J8-1 (common) to valve pin: Cold J8-3, Hot J8-5, Fabric Softener J8-6. Expect 890–1090 Ω.",
                "whirlpoolMvw6200WasherInletValveOhms",
                "J8",
                "1 & valve pin",
                ohm_branches("valve", "reconnect_j8_power", "replace_valve", "890–1090 Ω"),
                pin_details=PIN_J8_VALVE,
            ),
            instr("reconnect_j8_power", 5, "Reconnect J8 and restore power", "Reconnect J8. Reassemble panels. Restore power for Service Test valve sequence.", "live_test_valves"),
            visual(
                "live_test_valves",
                6,
                "Valves energize in Service Test Mode",
                "Does each valve in question turn on during Service Test water valve sequence?",
                [
                    {"id": "valves_run", "label": "Valves operate", "when": {"kind": "checkpoint_yes"}, "nextStepId": "valves_verified"},
                    {"id": "valves_no_run", "label": "Ohms OK but valve does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_valves", "terminal": True, "oemOutcome": "Coils in range but no run — replace main control."},
                ],
            ),
            outcome("replace_valve", 7, "Replace valve assembly", "Replace water valve assembly when coil tens of ohms outside 890–1090 Ω."),
            outcome("valves_verified", 8, "Valves verified", "Valve resistance and Service Test operation verified."),
            outcome("replace_acu_valves", 9, "Replace ACU", "Replace main control and verify with Service Diagnostics."),
        ],
    ),
    proc(
        "w11455152-test-03-drive-system",
        "TEST #3: Drive System (pre-test)",
        "3",
        "Drive System",
        [25],
        ["drive_motor"],
        ["motor_check", "F7E1", "F7E3", "F7E4", "F7E6", "F7E7"],
        [
            instr("enter_service_diag", 2, "Enter Service Diagnostic and clear codes", "Activate Service Diagnostic. Retrieve and clear F7E1, F7E3, F7E4, F7E6, F7E7 if present.", "wash_test"),
            visual(
                "wash_test",
                3,
                "Slow wash/agitate in Component Activation",
                "In Component Activation, run Slow Agitate. Does motor run after 15–20 seconds?",
                [
                    {"id": "agitate_ok", "label": "Motor runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "spin_test"},
                    {"id": "agitate_fail", "label": "Motor does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_shifter_motor"},
                ],
            ),
            visual(
                "spin_test",
                4,
                "Spin Low Speed test",
                "Run Spin Low Speed in Component Activation. If motor hums briefly then stops, check fault codes.",
                [
                    {"id": "spin_ok", "label": "Spin OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "drive_verified"},
                    {"id": "spin_fail", "label": "Spin fails or hums out", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_shifter_motor"},
                ],
            ),
            instr(
                "route_shifter_motor",
                5,
                "Continue to shifter or motor test",
                "Shifter-related (F7E3/F7E4) → TEST #3a Shifter. Motor circuit (F7E6/F7E7) → TEST #3b Motor.",
                "drive_deferred",
            ),
            outcome("drive_verified", 6, "Drive system OK", "Agitate and spin pass in Component Activation — no further drive diagnosis needed."),
            outcome("drive_deferred", 7, "Run TEST #3a or #3b", "Proceed to w11455152-test-03a-shifter or w11455152-test-03b-motor per fault code."),
        ],
    ),
    proc(
        "w11455152-test-03a-shifter",
        "TEST #3a: Drive System — Shifter",
        "3a",
        "Drive System - Shifter",
        [25, 26],
        ["drive_motor"],
        ["shifter_check", "F7E3", "F7E4", "agitate_issue", "spin_issue"],
        [
            visual(
                "shifter_service_test",
                2,
                "Spin and Wash in Component Activation",
                "Lid closed and locked. Run Spin and Wash tests. Did shifter engage for both?",
                [
                    {"id": "st_fail", "label": "Unsuccessful", "when": {"kind": "checkpoint_no"}, "nextStepId": "motor_shifter_free"},
                    {"id": "st_ok", "label": "Both pass", "when": {"kind": "checkpoint_yes"}, "nextStepId": "shifter_verified"},
                ],
            ),
            visual(
                "motor_shifter_free",
                3,
                "Motor and shifter turn independently",
                "Power off. Motor and shifter should turn independently. If locked together, shifter slider issue.",
                [
                    {"id": "free_yes", "label": "Turn freely / independently", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j2_j6"},
                    {"id": "free_no", "label": "Locked together or bound", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_shifter", "terminal": True, "oemOutcome": "Replace shifter assembly — slider binds or motor/shifter locked."},
                ],
            ),
            visual("check_j2_j6", 4, "J2 and J6 fully seated", "Verify J2 and J6 inserted fully at ACU.", [
                {"id": "conn_ok", "label": "Connectors OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "shifter_ohms"},
                {"id": "conn_bad", "label": "Connector loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_connectors"},
            ]),
            instr("reseat_connectors", 5, "Reseat J2/J6 and retest", "Reconnect connectors and repeat Component Activation Spin/Wash.", "shifter_service_test"),
            meas(
                "shifter_ohms",
                6,
                "Shifter coil resistance J6-2 to J6-6",
                "Remove J6. Expect 2–3.5 kΩ (2000–3500 Ω) across shifter coil.",
                "whirlpoolMvw6200WasherShifterOhms",
                "J6",
                "2 & 6",
                ohm_branches("shifter", "shifter_voltage", "replace_shifter", "2–3.5 kΩ"),
                pin_details=PIN_J6_SHIFTER,
            ),
            visual(
                "shifter_voltage",
                7,
                "120 VAC at shifter when commanded",
                "Restore power. AC volts J6-2 to J6-6. Toggle shifter ON/OFF in Component Activation (motor stopped). Expect 120 VAC.",
                [
                    {"id": "vac_yes", "label": "120 VAC present", "when": {"kind": "checkpoint_yes"}, "nextStepId": "shifter_switch_vdc"},
                    {"id": "vac_no", "label": "No voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "harness_continuity"},
                ],
            ),
            visual(
                "shifter_switch_vdc",
                8,
                "Shifter status voltage J2-1",
                "DC volts: black J2-2 (Gnd), red J2-1. Toggle Spin/Agitate — SPIN = +5 VDC, AGITATE = 0 VDC.",
                [
                    {"id": "sw_ok", "label": "Voltage toggles correctly", "when": {"kind": "checkpoint_yes"}, "nextStepId": "tach_power"},
                    {"id": "sw_bad", "label": "Voltage does not switch", "when": {"kind": "checkpoint_no"}, "nextStepId": "harness_continuity"},
                ],
            ),
            visual(
                "tach_power",
                9,
                "+12 VDC tach power J2-3",
                "DC volts: black J2-2, red J2-3. Expect +12 VDC. Then verify tach in Sensor Feedback.",
                [
                    {"id": "tach_ok", "label": "+12 VDC present; tach verified", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_shifter"},
                    {"id": "tach_bad", "label": "Missing tach power or feedback", "when": {"kind": "checkpoint_no"}, "nextStepId": "harness_continuity"},
                ],
            ),
            visual(
                "harness_continuity",
                10,
                "Shifter harness continuity",
                "Power off. Tilt washer. Continuity shifter pins to J2/J6 per OEM chart?",
                [
                    {"id": "harness_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_shifter"},
                    {"id": "harness_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness", "terminal": True, "oemOutcome": "Replace lower washer harness."},
                ],
            ),
            outcome("shifter_verified", 11, "Shifter verified", "Spin and Wash Component Activation tests pass."),
            outcome("replace_lower_harness", 12, "Replace lower harness", "Restore harness continuity and retest."),
            outcome("replace_shifter", 13, "Replace shifter assembly", "Replace shifter. Calibrate and run Automatic Test."),
            outcome("replace_acu_shifter", 14, "Replace ACU", "Shifter/mechanical OK but ACU does not drive shifter — replace main control."),
        ],
    ),
    proc(
        "w11455152-test-03b-motor",
        "TEST #3b: Drive System — Motor",
        "3b",
        "Drive System - Motor",
        [26, 27],
        ["drive_motor"],
        ["motor_check", "F7E6", "F7E7", "agitate_issue", "spin_issue"],
        [
            visual(
                "motor_wash_test",
                2,
                "Motor Slow Wash in Component Activation",
                "Run Motor Slow Wash test. Does basket spin clockwise during Low/Mid/High spin tests?",
                [
                    {"id": "wash_fail", "label": "Unsuccessful", "when": {"kind": "checkpoint_no"}, "nextStepId": "basket_free"},
                    {"id": "wash_ok", "label": "Motor runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_verified"},
                ],
            ),
            visual(
                "basket_free",
                3,
                "Basket turns freely",
                "Power off. Basket should turn freely.",
                [
                    {"id": "basket_ok", "label": "Turns freely", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j2_j6_motor"},
                    {"id": "basket_bind", "label": "Does not turn freely", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_friction", "terminal": True, "oemOutcome": "Resolve mechanical friction or lockup before motor replacement."},
                ],
            ),
            visual("check_j2_j6_motor", 4, "J2 and J6 fully seated", "Verify J2 and J6 fully inserted at ACU.", [
                {"id": "j_conn_ok", "label": "Connectors OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_winding_ohms"},
                {"id": "j_conn_bad", "label": "Connector loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j6_motor"},
            ]),
            instr("reseat_j6_motor", 5, "Reseat connectors and retest", "Reconnect J2/J6 and repeat Component Activation wash/spin.", "motor_wash_test"),
            meas(
                "motor_winding_ohms",
                6,
                "Motor winding resistance at J6",
                "Remove J6. CW J6-4↔6 and CCW J6-1↔6. Each expect 5–9.5 Ω.",
                "whirlpoolMvw6200WasherMotorWindingOhms",
                "J6",
                "4-6 & 1-6",
                ohm_branches("motor_j6", "motor_harness_cont", "replace_motor", "5–9.5 Ω"),
                pin_details=PIN_J6_MOTOR,
            ),
            visual(
                "motor_harness_cont",
                7,
                "Motor harness continuity",
                "Tilt washer. Continuity motor connector to J6 and run capacitor per OEM chart?",
                [
                    {"id": "mh_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_terminal_ohms"},
                    {"id": "mh_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_motor", "terminal": True, "oemOutcome": "Replace lower machine harness."},
                ],
            ),
            meas(
                "motor_terminal_ohms",
                8,
                "Motor resistance at drive connector",
                "At motor: CW pins 3↔2 and CCW pins 4↔2. Expect 5–9.5 Ω each.",
                "whirlpoolMvw6200WasherMotorWindingOhms",
                "PSC motor",
                "3-2 & 4-2",
                ohm_branches("motor_term", "capacitor_check", "replace_motor", "5–9.5 Ω"),
            ),
            visual(
                "capacitor_check",
                9,
                "Run capacitor charge/discharge test",
                "Discharge capacitor with 20 kΩ resistor. Measure terminals — steady increase in resistance = good; short/open = replace capacitor.",
                [
                    {"id": "cap_ok", "label": "Capacitor OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_motor"},
                    {"id": "cap_bad", "label": "Capacitor shorted or open", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_capacitor", "terminal": True, "oemOutcome": "Replace run capacitor, calibrate, and retest."},
                ],
            ),
            outcome("clear_friction", 10, "Clear mechanical friction", "Remove obstruction between basket/tub/impeller."),
            outcome("replace_lower_harness_motor", 11, "Replace lower harness", "Restore motor circuit continuity."),
            outcome("replace_motor", 12, "Replace motor", "Motor windings open or out of range — replace motor assembly."),
            outcome("replace_capacitor", 13, "Replace run capacitor", "Faulty capacitor causes hum, no start, or slow turn."),
            outcome("motor_verified", 14, "Motor verified", "Motor resistance and Component Activation rotation verified."),
            outcome("replace_acu_motor", 15, "Replace ACU", "Motor, harness, and capacitor good but no run — replace main control."),
        ],
    ),
    proc(
        "w11455152-test-04-hmi",
        "TEST #4: HMI",
        "4",
        "HMI",
        [27],
        ["hmi_control"],
        ["hmi_check", "F2E1", "F2E2", "F6E1"],
        [
            visual(
                "hmi_service_test",
                2,
                "UI Test (Encoder + Button Activation)",
                "In Service Diagnostic, press Key 1 to enter UI Test. Complete encoder rotation, then Button Activation — do keys toggle LED groups and encoder rotate status LEDs?",
                [
                    {"id": "hmi_ok", "label": "Keys and encoder OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "hmi_verified"},
                    {"id": "hmi_fail", "label": "Key or encoder failure", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j5_hmi"},
                ],
            ),
            visual(
                "check_j5_hmi",
                3,
                "J5 and HMI harness seated",
                "Power off. J5 fully seated at ACU; HMI harness and ribbon cables fully connected.",
                [
                    {"id": "conn_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "hmi_harness_cont"},
                    {"id": "conn_bad", "label": "Loose connector", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_connectors"},
                ],
            ),
            visual(
                "hmi_harness_cont",
                4,
                "HMI harness continuity J5 to HMI J1",
                "Continuity J5-1↔HMI J1-1 (Red), J5-3↔J1-2 (Yellow), J5-4↔J1-3 (Black)?",
                [
                    {"id": "uh_ok", "label": "Continuity passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_ui"},
                    {"id": "uh_fail", "label": "Continuity fails", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_ui_harness"},
                ],
            ),
            instr("check_acu_supply", 5, "Verify ACU supply", "If harness good, run TEST #1 Main Control supply checks.", "retest_hmi"),
            instr("retest_hmi", 6, "Retest HMI in Service mode", "Reassemble, restore power, enter Service Diagnostic, rerun UI Test.", "hmi_verified"),
            outcome("repair_connectors", 7, "Repair connections", "Reseat harness connectors and retest."),
            outcome("replace_ui_harness", 8, "Replace HMI harness", "Replace HMI harness when continuity fails."),
            outcome("replace_ui", 9, "Replace user interface", "Replace UI when harness continuity passes but HMI test fails."),
            outcome("hmi_verified", 10, "HMI verified", "Keys, encoder, and LED feedback verified in Service Diagnostic."),
        ],
    ),
    proc(
        "w11455152-test-05-water-level",
        "TEST #5: Water Level",
        "5",
        "Water Level",
        [28],
        ["water_level_sensor"],
        ["pressure_sensor", "F3E2", "F8E1", "F8E3", "F8E6", "long_fill"],
        [
            visual(
                "pressure_sensor_feedback",
                2,
                "Water Level Pressure Sensor cycle",
                "In Service Sensor Feedback, run Water Level Pressure Sensor cycle. Valves open, level rises on display, then decreases as basket drains.",
                [
                    {"id": "sensor_ok", "label": "Behaves correctly", "when": {"kind": "checkpoint_yes"}, "nextStepId": "level_verified"},
                    {"id": "sensor_bad", "label": "Does not behave correctly", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_pressure_hose"},
                ],
            ),
            visual(
                "check_pressure_hose",
                3,
                "Pressure hose and dome",
                "Power off. Hose secure at ACU transducer and tub dome? Routed without pinch? Clear of water/suds/debris?",
                [
                    {"id": "hose_ok", "label": "Hose OK after service", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_level"},
                    {"id": "hose_bad", "label": "Pinch, leak, or debris", "when": {"kind": "checkpoint_no"}, "nextStepId": "service_hose"},
                ],
            ),
            instr("service_hose", 4, "Service pressure hose", "Disconnect hose at ACU, blow clear, fix routing, replace if leaking. Retest Sensor Feedback.", "pressure_sensor_feedback"),
            outcome("level_verified", 5, "Water level OK", "Pressure transducer and hose path verified."),
            outcome("replace_acu_level", 6, "Replace ACU", "Hose path good — replace main control; run Water Level Sensor Feedback to verify."),
        ],
    ),
    proc(
        "w11455152-test-06-drain-pump",
        "TEST #6: Drain Pump",
        "6",
        "Drain Pump",
        [28],
        ["drain_pump"],
        ["pump_check", "drain_issue", "F9E1", "dr"],
        [
            instr("clear_obstructions", 2, "Clear drain path obstructions", "Check tub sump, hose, and usual areas. Then test drain pump in Component Activation.", "drain_service_test"),
            visual(
                "drain_service_test",
                3,
                "Drain pump in Component Activation",
                "Turn on drain pump in Service Component Activation. Does pump run?",
                [
                    {"id": "pump_live_fail", "label": "Does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j6_pump"},
                    {"id": "pump_live_ok", "label": "Runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_verified"},
                ],
            ),
            visual("check_j6_pump", 4, "J6 fully seated", "Power off. J6 fully inserted at ACU?", [
                {"id": "j6p_ok", "label": "J6 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "j6_pump_ohms"},
                {"id": "j6p_bad", "label": "J6 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j6_pump"},
            ]),
            instr("reseat_j6_pump", 5, "Reseat J6 and retest", "Reconnect J6 and repeat Component Activation drain test.", "drain_service_test"),
            meas(
                "j6_pump_ohms",
                6,
                "Drain pump resistance J6-3 to J6-6",
                "Remove J6. Expect 17.8–21.8 Ω across drain pump winding.",
                "whirlpoolMvw6200WasherDrainPumpOhms",
                "J6",
                "3 & 6",
                ohm_branches("drain_j6", "harness_pump_cont", "pump_obstruction", "17.8–21.8 Ω"),
                pin_details=PIN_J6_DRAIN,
            ),
            visual(
                "harness_pump_cont",
                7,
                "Drain pump harness continuity",
                "Tilt washer. Continuity drain pump pin 1→J6-3 and pin 3→J6-6?",
                [
                    {"id": "ph_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_terminal_ohms"},
                    {"id": "ph_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_pump", "terminal": True, "oemOutcome": "Replace lower washer harness."},
                ],
            ),
            meas(
                "pump_terminal_ohms",
                8,
                "Resistance at drain pump terminals",
                "At pump motor terminals expect 17.8–21.8 Ω.",
                "whirlpoolMvw6200WasherDrainPumpOhms",
                "Drain pump",
                "1 & 3",
                ohm_branches("drain_pump", "reconnect_pump_power", "replace_drain_pump", "17.8–21.8 Ω"),
            ),
            instr("reconnect_pump_power", 9, "Reconnect pump and restore power", "Reconnect J6 and pump harness. Restore power for Component Activation drain test.", "live_test_drain_pump"),
            visual(
                "live_test_drain_pump",
                10,
                "Drain pump runs in Component Activation",
                "Turn on drain pump in Component Activation. Does pump run and evacuate water?",
                [
                    {"id": "dp_run", "label": "Pump runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_verified"},
                    {"id": "dp_no_run", "label": "Ohms OK but no run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_pump", "terminal": True, "oemOutcome": "Pump good but no run — replace main control."},
                ],
            ),
            outcome("pump_obstruction", 11, "Clear pump obstruction", "Tilt washer, verify pump free, clear obstructions."),
            outcome("replace_lower_harness_pump", 12, "Replace lower harness", "Restore pump circuit continuity."),
            outcome("replace_drain_pump", 13, "Replace drain pump", "Pump motor open or out of range at terminals."),
            outcome("pump_verified", 14, "Drain pump verified", "Pump resistance and Component Activation run verified."),
            outcome("replace_acu_pump", 15, "Replace ACU", "Pump good but no run — replace main control."),
        ],
    ),
    proc(
        "w11455152-test-07-lid-lock",
        "TEST #7: Lid Lock",
        "7",
        "Lid Lock",
        [28, 29],
        ["door_lock"],
        ["lid_lock", "door_lock_check", "F5E1", "F5E3", "F5E4"],
        [
            visual(
                "lid_lock_service_test",
                2,
                "Lid Lock Load Control test",
                "In Service Load Control, run Lid Lock test. Does lock cycle lock and unlock?",
                [
                    {"id": "ll_fail", "label": "Unsuccessful", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j4"},
                    {"id": "ll_ok", "label": "Lock cycles OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_verified"},
                ],
            ),
            visual("check_j4", 3, "J4 fully seated", "Power off. J4 fully inserted at ACU?", [
                {"id": "j4_ok", "label": "J4 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_ohms"},
                {"id": "j4_bad", "label": "J4 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j4"},
            ]),
            instr("reseat_j4", 4, "Reseat J4 and retest", "Reconnect J4 and repeat Lid Lock Load Control test.", "lid_lock_service_test"),
            meas(
                "lid_lock_ohms",
                5,
                "Lid lock solenoid J4-2 to J4-3",
                "Remove J4. Lock solenoid expect 50–160 Ω. Lock switch J4-1↔2: locked=0 Ω, unlocked=open. Lid switch J4-2↔1: open=open, closed=open circuit per table.",
                "whirlpoolMvw6200WasherLidLockSolenoidOhms",
                "J4",
                "2 & 3",
                ohm_branches("lock_solenoid", "switch_states", "replace_lid_lock", "50–160 Ω"),
                pin_details=PIN_J4_LOCK,
            ),
            visual(
                "switch_states",
                6,
                "Lock and lid switch states",
                "Do lock switch and lid switch readings match unlocked/locked table for current lid state?",
                [
                    {"id": "sw_ok", "label": "Switch states OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_lid"},
                    {"id": "sw_bad", "label": "Switch readings wrong", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lid_lock"},
                ],
            ),
            outcome("replace_lid_lock", 7, "Replace lid lock mechanism", "Switch measurements do not match table — replace lid lock."),
            outcome("replace_acu_lid", 8, "Replace ACU", "Lid lock components good but lock problem persists — replace main control."),
            outcome("lid_lock_verified", 9, "Lid lock verified", "Lid lock resistance and Load Control test verified."),
        ],
    ),
]

PROCEDURE_FILES = [
    "w11455152-test-01-acu-power.json",
    "w11455152-test-02-valves.json",
    "w11455152-test-03-drive-system.json",
    "w11455152-test-03a-shifter.json",
    "w11455152-test-03b-motor.json",
    "w11455152-test-04-hmi.json",
    "w11455152-test-05-water-level.json",
    "w11455152-test-06-drain-pump.json",
    "w11455152-test-07-lid-lock.json",
]


def service_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11455152-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11455152",
        "title": "W11455152 — Service Diagnostic mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console"],
        "description": "Three-button Service Diagnostic entry (Key 1, 2, 3) × 3 rounds within 8 seconds.",
        "tags": ["service_diagnostic", "live_test"],
        "entryStepId": "service_diagnostic_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [14, 15],
        },
        "steps": [
            {
                "id": "service_diagnostic_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Service Diagnostic mode",
                "body": (
                    "Washer in standby (plugged in, all LEDs off). Within 8 seconds: press and release Key 1, "
                    "Key 2, Key 3 — repeat that same 3-button sequence two more times (3 rounds total). "
                    "Success: all HMI indicators illuminate for 1 second then turn off. Saved fault codes flash on entry; "
                    "hold Key 3 for 5 seconds to clear codes."
                ),
                "sourceExcerpt": "Press and Release Key 1, Key 2, Key 3; Repeat this 3 button sequence 2 more times.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


def automatic_test_mode_bundle() -> dict:
    return {
        "id": "w11455152-automatic-test-mode",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11455152",
        "title": "W11455152 — Automatic Test Mode",
        "modeKind": "load_test",
        "uiVariants": ["console"],
        "description": "Enter Automatic Test Mode via Key 2 then START; auto-sequence runs valves, drain, wash, spin.",
        "tags": ["automatic_test", "live_test", "component_activation"],
        "entryStepId": "automatic_test_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [16, 17],
        },
        "steps": [
            {
                "id": "automatic_test_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Automatic Test Mode",
                "body": (
                    "With Service Diagnostic mode active, press and release Key 2, then press and release START. "
                    "Press START again to begin automatic test sequence: "
                    "water valves → drain pump → wash (CW/CCW agitate) → spin (140/300/500 rpm). "
                    "Key 1 repeats prior step; Key 2 skips. Lid must be closed. POWER exits to standby."
                ),
                "sourceExcerpt": "To enter Automatic Test Mode, press and release Key 2... then press Key 5/Start.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


BUNDLES = [service_diagnostic_entry_bundle(), automatic_test_mode_bundle()]
BUNDLE_FILES = [
    "w11455152-service-diagnostic-entry.json",
    "w11455152-automatic-test-mode.json",
]


def write_catalog() -> None:
    catalog = {
        "manualId": "W11455152",
        "platformId": PLATFORM,
        "templateId": "washer",
        "label": "Whirlpool/Maytag 5.3 cu ft PSC top-load washer (WTW6157)",
        "notes": "TEST #1–7 (+3a shifter / 3b motor). Service Diagnostic: Key 1/2/3 × 3 within 8 sec; Automatic Test via Key 2 + START.",
        "plannedProcedures": [
            {
                "id": proc_data["id"],
                "oemSection": proc_data["source"]["oemTestNumber"],
                "title": proc_data["title"],
                "status": "generated",
                "knowledgeIds": [
                    step["measurementKnowledgeId"]
                    for step in proc_data["steps"]
                    if step.get("measurementKnowledgeId")
                ],
                "relatedCodes": [
                    tag
                    for tag in proc_data.get("tags", [])
                    if tag.startswith("F") or tag in ("LF", "dr", "drn")
                ],
            }
            for proc_data in PROCEDURES
        ],
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name}")


def write_readme() -> None:
    readme = """# whirlpool_tl_dd_6157 — W11455152 procedure seeds

**Manual:** Whirlpool 5.3 cu ft Top Load Washer (W11455152A / WTW6157)  
**Platform:** `whirlpool_tl_dd_6157` — models `MVW61*`, `WTW61*` (PSC motor; not BPM `whirlpool_tl_dd_5100`)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11455152_TL_WASHER_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11455152
```

## Procedures (9)

| ID | OEM | Notes |
|----|-----|-------|
| w11455152-test-01-acu-power | TEST #1 | J1 line, diagnostic LED, J5 +12 VDC |
| w11455152-test-02-valves | TEST #2 | J8 valves 890–1090 Ω |
| w11455152-test-03-drive-system | TEST #3 | Component Activation pre-check |
| w11455152-test-03a-shifter | TEST #3a | Shifter J6 2–3.5 kΩ |
| w11455152-test-03b-motor | TEST #3b | PSC motor J6 5–9.5 Ω + run cap |
| w11455152-test-04-hmi | TEST #4 | UI Test (Key 1) / J5 harness |
| w11455152-test-05-water-level | TEST #5 | Pressure hose / Sensor Feedback |
| w11455152-test-06-drain-pump | TEST #6 | J6 drain 17.8–21.8 Ω |
| w11455152-test-07-lid-lock | TEST #7 | J4 solenoid 50–160 Ω |

## Bundles (2)

- `w11455152-service-diagnostic-entry` — Key 1/2/3 diagnostic entry
- `w11455152-automatic-test-mode` — Key 2 + START Automatic Test sequence

## WO smoke

Whirlpool `WTW6157PW` → `whirlpool_tl_dd_6157`; F5E3 → `w11455152-test-07-lid-lock`
"""
    path = OUT / "README.md"
    path.write_text(readme, encoding="utf-8")
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
    write_readme()


if __name__ == "__main__":
    main()
