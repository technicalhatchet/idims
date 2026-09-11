#!/usr/bin/env python3
"""Generate W11800233 (Whirlpool WTW4100 ACU belt-drive top-load washer) procedure seed JSON files."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_tl_dd_4100"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_tl_dd_4100"

SOURCE = {
    "manualId": "W11800233",
    "manualTitle": "Whirlpool 4.0–4.3 cu ft Top Load Washer (WTW4100 ACU)",
    "extractedTextFile": (
        "backend/docs/manuals/technical-manual-W11800233-revc wtw4100-extracted.txt"
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
        "source": {
            **SOURCE,
            "oemTestNumber": oem_num,
            "oemTestTitle": oem_title,
            "pages": pages,
        },
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }


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
    pin_details: list[dict] | None = None,
) -> dict:
    test_point: dict = {"connector": connector, "pins": pins, "label": title}
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


def pin_detail(pin: str, signal: str, wire: str | None = None, confidence: str = "verified") -> dict:
    detail: dict = {"pin": pin, "signal": signal}
    if wire:
        detail["wireColor"] = wire
        detail["wireColorConfidence"] = confidence
    return detail


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


def ohm_branches(prefix: str, pass_next: str, fail_next: str, pass_label: str = "In range") -> list[dict]:
    return [
        {"id": f"{prefix}_open", "label": "Open circuit (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


PIN_J1 = [
    pin_detail("1", "Neutral", "WH", "verified"),
    pin_detail("2", "Line", "BK", "verified"),
]
PIN_J5 = [
    pin_detail("1", "+12 VDC", "RD", "verified"),
    pin_detail("3", "Communication", "YL", "verified"),
    pin_detail("4", "Circuit Gnd", "BK", "verified"),
]
PIN_J8_VALVE = [
    pin_detail("1", "GND (common)", "WH", "verified"),
    pin_detail("3", "Cold valve", "BU", "verified"),
    pin_detail("5", "Hot valve", "RD", "verified"),
    pin_detail("6", "Fabric softener valve", "BU", "verified"),
]
PIN_J6_DRIVE = [
    pin_detail("1", "Motor CCW", "RD", "verified"),
    pin_detail("2", "Shifter motor", "BR", "verified"),
    pin_detail("3", "Drain pump", "BU", "verified"),
    pin_detail("4", "Motor CW", "OR", "verified"),
    pin_detail("6", "Neutral", "BK", "verified"),
]
PIN_J2_SHIFTER = [
    pin_detail("1", "Microswitch +5V", "BU", "verified"),
    pin_detail("2", "GND", "GRY", "verified"),
    pin_detail("4", "Tachometer +5V", "PNK", "verified"),
]
PIN_J4_LOCK = [
    pin_detail("1", "Lid switch line return", "BU", "verified"),
    pin_detail("2", "Line in / lid switch", "WH", "verified"),
    pin_detail("3", "Lid lock neutral", "RD", "verified"),
]

PROCEDURES = [
    proc(
        "w11800233-test-01-acu-power",
        "TEST #1: Main Control (ACU)",
        "1",
        "Main Control (ACU)",
        [81, 82],
        ["supply"],
        ["voltage_check", "supply_issue", "F1E1", "F6E1", "no_power"],
        [
            instr("access_console", 2, "Access main control", "Remove console. Verify ALL connectors fully seated at ACU.", "restore_power_line"),
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
                    {"id": "line_ok", "label": "120 VAC present", "when": {"kind": "measurement_normal"}, "nextStepId": "status_led"},
                    {"id": "line_bad", "label": "No line voltage", "when": {"kind": "measurement_critical"}, "nextStepId": "check_power_cord", "terminal": True, "oemOutcome": "Check outlet, breaker, and AC power cord continuity."},
                ],
                pin_details=PIN_J1,
            ),
            visual(
                "status_led",
                5,
                "ACU status LED state",
                "After power-up: rapid flash then slow blink = micro OK. Steady ON = control malfunction. OFF = no 5 VDC. Rapid flash >30 sec or 2-quick-flash pattern = comm/load fault.",
                [
                    {"id": "led_ok", "label": "Slow blink during operation (ACU OK)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "acu_verified"},
                    {"id": "led_off", "label": "OFF (no 5 VDC)", "when": {"kind": "checkpoint_no"}, "nextStepId": "isolate_j5"},
                    {"id": "led_steady", "label": "Steady ON or rapid fault pattern", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu"},
                ],
            ),
            instr("isolate_j5", 6, "Isolate HMI load on J5", "Disconnect power. Remove connector J5 from main control. Restore power.", "j5_12vdc"),
            meas(
                "j5_12vdc",
                7,
                "+12 VDC at J5",
                "DC volts: black J5-4 (Circuit Gnd), red J5-1 (+12 VDC). Do not short pins inside header.",
                "whirlpoolWtw4100WasherAcu12Vdc",
                "J5",
                "1 & 4",
                [
                    {"id": "v12_ok", "label": "+12 VDC present", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_acu"},
                    {"id": "v12_bad", "label": "+12 VDC missing", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_acu"},
                ],
                pin_details=PIN_J5,
            ),
            outcome("check_power_cord", 8, "Check power cord", "Verify outlet and AC cord continuity per wiring diagram."),
            outcome("acu_verified", 9, "ACU power verified", "Line voltage and status LED OK — proceed to complaint-specific test or HMI Test."),
            outcome("replace_acu", 10, "Replace main control", "Replace ACU. Calibrate washer and run Automatic Test to verify."),
        ],
    ),
    proc(
        "w11800233-test-02-valves",
        "TEST #2: Valves",
        "2",
        "Valves",
        [83],
        ["inlet_valve"],
        ["water_valve_check", "fill_issue", "F8E1", "F8E3", "LF"],
        [
            instr(
                "valve_auto_precheck",
                2,
                "Automatic Test valve pre-check",
                "In Automatic Test Mode, note any valve that fails during the water valve test sequence (cold then hot).",
                "disconnect_j8",
            ),
            instr("disconnect_j8", 3, "Disconnect J8 at ACU", "Unplug washer. Remove console. Disconnect J8 from main control.", "valve_ohms"),
            meas(
                "valve_ohms",
                4,
                "Valve coil resistance at J8",
                "Measure each suspect coil across J8-1 (GND common) and valve pin: Cold J8-1&3, Hot J8-1&5, Fabric Softener J8-1&6 (dispenser models). Expect 1300–1540 Ω.",
                "whirlpoolWtw4100WasherInletValveOhms",
                "J8",
                "1 & valve pin",
                ohm_branches("valve", "reconnect_j8_power", "replace_valve", "1300–1540 Ω"),
                pin_details=PIN_J8_VALVE,
            ),
            instr("reconnect_j8_power", 5, "Reconnect J8 and restore power", "Reconnect J8. Reassemble panels. Restore power for Automatic Test valve exercise.", "live_test_valves"),
            visual(
                "live_test_valves",
                6,
                "Valves energize in Automatic Test",
                "Run Automatic Test Mode valve sequence. Does each valve in question turn on?",
                [
                    {"id": "valves_run", "label": "Valves operate", "when": {"kind": "checkpoint_yes"}, "nextStepId": "valves_verified"},
                    {"id": "valves_no_run", "label": "Ohms OK but valve does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_valves", "terminal": True, "oemOutcome": "Coils in range but no run — replace main control and run Auto Test."},
                ],
            ),
            outcome("replace_valve", 7, "Replace valve assembly", "Replace water valve assembly when coil tens of ohms outside 1300–1540 Ω."),
            outcome("valves_verified", 8, "Valves verified", "Valve resistance and Automatic Test operation verified."),
            outcome("replace_acu_valves", 9, "Replace main control", "Replace main control and verify with Automatic Test."),
        ],
    ),
    proc(
        "w11800233-test-03-drive-system",
        "TEST #3: Drive System (pre-test)",
        "3",
        "Drive System",
        [83, 84],
        ["drive_motor"],
        ["motor_check", "F7E1", "F7E3", "F7E4", "F7E6", "F7E7"],
        [
            instr("enter_service_diag", 2, "Enter Service Diagnostic and clear codes", "Activate Service Diagnostic mode. Retrieve and clear F7E1, F7E3, F7E4, F7E6, F7E7 if present.", "agitate_auto_test"),
            visual(
                "agitate_auto_test",
                3,
                "Wash/Agitate in Automatic Test",
                "Enter Automatic Test Mode (Key 2 + START). During wash step, does motor run after 15–20 seconds?",
                [
                    {"id": "agitate_ok", "label": "Motor runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "spin_auto_test"},
                    {"id": "agitate_fail", "label": "Motor does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_shifter_motor"},
                ],
            ),
            visual(
                "spin_auto_test",
                4,
                "Spin Low Speed in Automatic Test",
                "During spin test, if motor hums briefly then shuts down, enter Fault Code Display and note codes.",
                [
                    {"id": "spin_ok", "label": "Spin completes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "drive_verified"},
                    {"id": "spin_fail", "label": "Spin fails or hums out", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_shifter_motor"},
                ],
            ),
            instr(
                "route_shifter_motor",
                5,
                "Continue to shifter or motor test",
                "Shifter/tach (F7E1, F7E3, F7E4) → TEST #3a Shifter. Motor circuit (F7E6, F7E7) → TEST #3b Motor.",
                "drive_deferred",
            ),
            outcome("drive_verified", 6, "Drive system OK", "Automatic Test wash and spin pass."),
            outcome("drive_deferred", 7, "Run TEST #3a or #3b", "Proceed to w11800233-test-03a-shifter or w11800233-test-03b-motor per fault code."),
        ],
    ),
    proc(
        "w11800233-test-03a-shifter",
        "TEST #3a: Drive System — Shifter",
        "3a",
        "Drive System - Shifter",
        [84, 86],
        ["drive_motor"],
        ["shifter_check", "F7E1", "F7E3", "F7E4", "agitate_issue", "spin_issue"],
        [
            visual(
                "shifter_auto_test",
                2,
                "Spin and Wash in Automatic Test",
                "Lid closed and locked. Run Automatic Test wash and spin steps. Did shifter engage for both?",
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
                    {"id": "free_ok", "label": "Turn independently / basket free", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j2_j6"},
                    {"id": "slider_bind", "label": "Locked together or basket bind", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_slider", "terminal": True, "oemOutcome": "Resolve shifter slider bind or mechanical friction."},
                ],
            ),
            visual("check_j2_j6", 4, "J2 and J6 fully seated", "Verify J2 and J6 inserted fully at main control.", [
                {"id": "conn_ok", "label": "Connectors OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "shifter_ohms"},
                {"id": "conn_bad", "label": "Connector loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_connectors"},
            ]),
            instr("reseat_connectors", 5, "Reseat J2/J6 and retest", "Reconnect connectors and repeat Automatic Test wash/spin.", "shifter_auto_test"),
            meas(
                "shifter_ohms",
                6,
                "Shifter motor resistance J6-2 to J6-6",
                "Remove J6. Expect 2 kΩ to 3.5 kΩ across shifter motor. Verify splutch cam moves freely.",
                "whirlpoolWtw4100WasherShifterOhms",
                "J6",
                "2 & 6",
                ohm_branches("shifter", "shifter_voltage", "harness_continuity", "2–3.5 kΩ"),
                pin_details=PIN_J6_DRIVE,
            ),
            visual(
                "shifter_voltage",
                7,
                "120 VAC at shifter when commanded",
                "Restore power. AC volts J6-2 to J6-6. Toggle wash/spin in Automatic Test (motor must stop before shifter toggles). Expect 120 VAC.",
                [
                    {"id": "vac_yes", "label": "120 VAC present", "when": {"kind": "checkpoint_yes"}, "nextStepId": "shifter_switch_vdc"},
                    {"id": "vac_no", "label": "No voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "harness_continuity"},
                ],
            ),
            visual(
                "shifter_switch_vdc",
                8,
                "Shifter switch voltage J2-1",
                "DC volts: black J2-2 (Gnd), red J2-1. Toggle wash/spin in Automatic Test — SPIN = +5 VDC, AGITATE = 0 VDC.",
                [
                    {"id": "sw_ok", "label": "Voltage toggles correctly", "when": {"kind": "checkpoint_yes"}, "nextStepId": "tach_5v"},
                    {"id": "sw_bad", "label": "Voltage does not switch", "when": {"kind": "checkpoint_no"}, "nextStepId": "harness_continuity"},
                ],
            ),
            visual(
                "tach_5v",
                9,
                "Tachometer +5 VDC and Hz verification",
                "DC volts J2-2 to J2-4 expect +5 VDC. In test cycle, AC/Hz on tach should increase as basket spins.",
                [
                    {"id": "tach_ok", "label": "+5 VDC OK; tach verified", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_shifter"},
                    {"id": "tach_bad", "label": "Tach not verified", "when": {"kind": "checkpoint_no"}, "nextStepId": "harness_continuity"},
                ],
            ),
            visual(
                "harness_continuity",
                10,
                "Shifter harness continuity",
                "Power off. Tilt washer. Continuity shifter pins to J2/J6 per OEM chart (pins 1–6)?",
                [
                    {"id": "harness_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_shifter"},
                    {"id": "harness_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness", "terminal": True, "oemOutcome": "Replace lower washer harness."},
                ],
            ),
            outcome("clear_slider", 11, "Clear shifter slider bind", "Repair shifter slider or mechanical bind before electrical replacement."),
            outcome("shifter_verified", 12, "Shifter verified", "Automatic Test wash and spin pass."),
            outcome("replace_lower_harness", 13, "Replace lower harness", "Restore harness continuity and retest."),
            outcome("replace_shifter", 14, "Replace shifter assembly", "Replace shifter. Calibrate and run Automatic Test."),
            outcome("replace_acu_shifter", 15, "Replace main control", "Shifter/mechanical OK but ACU does not drive shifter — replace main control."),
        ],
    ),
    proc(
        "w11800233-test-03b-motor",
        "TEST #3b: Drive System — Motor",
        "3b",
        "Drive System - Motor",
        [87, 89],
        ["drive_motor"],
        ["motor_check", "F7E6", "F7E7", "agitate_issue", "spin_issue"],
        [
            visual(
                "motor_auto_test",
                2,
                "Wash and spin in Automatic Test",
                "Run Automatic Test wash and spin. Basket should spin clockwise during spin step.",
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
                    {"id": "basket_ok", "label": "Turns freely", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j2_j6_motor"},
                    {"id": "basket_bind", "label": "Does not turn freely", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_friction_motor", "terminal": True, "oemOutcome": "Resolve mechanical friction or lockup."},
                ],
            ),
            visual("check_j2_j6_motor", 4, "J2 and J6 fully seated", "Verify J2 and J6 fully inserted at main control.", [
                {"id": "j_conn_ok", "label": "Connectors OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "live_motor_voltage"},
                {"id": "j_conn_bad", "label": "Connector loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j6_motor"},
            ]),
            instr("reseat_j6_motor", 5, "Reseat connectors and retest", "Reconnect J2/J6 and repeat Automatic Test wash/spin.", "motor_auto_test"),
            instr("live_motor_voltage", 6, "Live motor voltage check", "Restore power. Run wash/agitate step in Automatic Test.", "cw_voltage"),
            visual(
                "cw_voltage",
                7,
                "120 VAC cycling on CW winding",
                "AC volts J6-6 (Neutral) to J6-4 (CW). Expect 120 VAC cycling ON during CW rotation.",
                [
                    {"id": "cw_ok", "label": "120 VAC present on CW", "when": {"kind": "checkpoint_yes"}, "nextStepId": "ccw_voltage"},
                    {"id": "cw_bad", "label": "No CW voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_test1", "terminal": True, "oemOutcome": "See TEST #1 Main Control (ACU)."},
                ],
            ),
            visual(
                "ccw_voltage",
                8,
                "120 VAC cycling on CCW winding",
                "AC volts J6-6 (Neutral) to J6-1 (CCW). Expect 120 VAC cycling ON during CCW rotation.",
                [
                    {"id": "ccw_ok", "label": "120 VAC present on CCW", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_winding_ohms"},
                    {"id": "ccw_bad", "label": "No CCW voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_test1"},
                ],
            ),
            instr("motor_winding_ohms", 9, "Disconnect power for ohms", "Unplug washer. Remove J6 from main control.", "j6_motor_ohms"),
            meas(
                "j6_motor_ohms",
                10,
                "Motor winding resistance at J6",
                "CW J6-4↔6 and CCW J6-1↔6. Expect 3.5–6 Ω each.",
                "whirlpoolWtw4100WasherMotorWindingOhms",
                "J6",
                "4-6 & 1-6",
                ohm_branches("motor_j6", "motor_harness_cont", "replace_motor", "3.5–6 Ω"),
                pin_details=PIN_J6_DRIVE,
            ),
            visual(
                "motor_harness_cont",
                11,
                "Motor harness continuity",
                "Tilt washer. Continuity motor connector to J6 and run capacitor per OEM chart?",
                [
                    {"id": "mh_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_terminal_ohms"},
                    {"id": "mh_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_motor", "terminal": True, "oemOutcome": "Replace lower machine harness."},
                ],
            ),
            meas(
                "motor_terminal_ohms",
                12,
                "Motor resistance at drive connector",
                "At motor: CW pins 2↔3 and CCW pins 4↔2. Expect 3.5–6 Ω.",
                "whirlpoolWtw4100WasherMotorWindingOhms",
                "PSC motor",
                "2-3 & 4-2",
                ohm_branches("motor_term", "capacitor_check", "replace_motor", "3.5–6 Ω"),
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
            outcome("motor_verified", 19, "Motor verified", "Motor resistance and Automatic Test rotation verified."),
            outcome("replace_acu_motor", 20, "Replace main control", "Motor, harness, and capacitor good but no run — replace main control."),
        ],
    ),
    proc(
        "w11800233-test-04-hmi",
        "TEST #4: HMI",
        "4",
        "HMI",
        [89, 90],
        ["hmi_control"],
        ["hmi_check", "F2E1", "F2E3", "F6E1"],
        [
            instr("hmi_test_entry", 2, "Run HMI Test in Service Diagnostic", "Enter Service Diagnostic mode. Press Key 1 for HMI Test — run encoder and button activation tests.", "check_connectors_hmi"),
            visual(
                "check_connectors_hmi",
                3,
                "J5 and HMI harness seated",
                "Power off. J5 fully seated at ACU; HMI harness and ribbon cables fully seated on HMI.",
                [
                    {"id": "conn_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "route_test1_hmi"},
                    {"id": "conn_bad", "label": "Loose connector or ribbon", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_connectors"},
                ],
            ),
            visual(
                "hmi_harness_cont",
                4,
                "HMI harness continuity",
                "Continuity ACU J5 to HMI J1: J5-1↔J1-1 (Red), J5-3↔J1-2 (Yellow), J5-4↔J1-3 (Black)?",
                [
                    {"id": "harness_ok", "label": "Continuity passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_hmi"},
                    {"id": "harness_bad", "label": "Continuity fails", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_hmi_harness"},
                ],
            ),
            instr("route_test1_hmi", 5, "Verify ACU supplies", "If HMI Test fails, run TEST #1 Main Control supply checks.", "hmi_harness_cont"),
            outcome("repair_connectors", 6, "Repair connections", "Reseat J5, ribbon cables, and HMI harness; retest HMI Test."),
            outcome("replace_hmi_harness", 7, "Replace HMI harness", "Replace HMI harness and retest HMI Test."),
            outcome("replace_hmi", 8, "Replace user interface", "Harness good — replace HMI assembly and verify HMI Test."),
            outcome("hmi_verified", 9, "HMI verified", "Encoder and button activation pass in HMI Test."),
        ],
    ),
    proc(
        "w11800233-test-05-water-level",
        "TEST #5: Water Level",
        "5",
        "Water Level",
        [90, 91],
        ["water_level_sensor"],
        ["pressure_sensor", "F3E2", "F8E1", "F8E3", "F9E1", "long_fill"],
        [
            visual(
                "auto_test_fill",
                2,
                "Automatic Test fill step (70 mm)",
                "Run Automatic Test. During step 2, do valves open and basket fill to 70 mm before advancing?",
                [
                    {"id": "fill_ok", "label": "Fill step passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "auto_test_drain_level"},
                    {"id": "fill_bad", "label": "Long fill or no pressure change", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_pressure_hose"},
                ],
            ),
            visual(
                "auto_test_drain_level",
                3,
                "Automatic Test drain step (3 mm)",
                "During step 3, does drain pump run and washer sense 3 mm water remaining?",
                [
                    {"id": "level_ok", "label": "Fill and drain steps OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "level_verified"},
                    {"id": "level_bad", "label": "Drain/level step fails", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_pressure_hose"},
                ],
            ),
            instr("check_pressure_hose", 4, "Inspect pressure hose and dome", "Power off. Remove console. Hose secure at transducer and tub dome? Routed without pinch? Clear of water/suds/debris?", "service_hose"),
            instr("service_hose", 5, "Service pressure hose", "Disconnect hose at main control, blow clear, fix routing, replace if leaking. Retest Automatic Test.", "auto_test_fill"),
            outcome("level_verified", 6, "Water level OK", "On-board pressure transducer and hose path verified via Automatic Test."),
            outcome("replace_acu_level", 7, "Replace main control", "Hose path good — replace main control; calibrate and run Automatic Test."),
        ],
    ),
    proc(
        "w11800233-test-06-drain-pump",
        "TEST #6: Drain Pump",
        "6",
        "Drain Pump",
        [91, 92],
        ["drain_pump"],
        ["pump_check", "drain_issue", "F9E1", "dr"],
        [
            instr("clear_obstructions", 2, "Clear drain path obstructions", "Check usual areas. Then test drain pump in Automatic Test Mode.", "drain_auto_test"),
            visual(
                "drain_auto_test",
                3,
                "Drain pump in Automatic Test",
                "During Automatic Test drain step, does pump run?",
                [
                    {"id": "pump_live_fail", "label": "Does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j6_pump"},
                    {"id": "pump_live_ok", "label": "Runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_verified"},
                ],
            ),
            visual("check_j6_pump", 4, "J6 fully seated", "Power off. J6 fully inserted at main control?", [
                {"id": "j6p_ok", "label": "J6 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "j6_pump_ohms"},
                {"id": "j6p_bad", "label": "J6 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j6_pump"},
            ]),
            instr("reseat_j6_pump", 5, "Reseat J6 and retest", "Reconnect J6 and repeat Automatic Test drain.", "drain_auto_test"),
            meas(
                "j6_pump_ohms",
                6,
                "Drain pump resistance J6-3 to J6-6",
                "Remove J6. Expect 14–25 Ω across drain pump winding.",
                "whirlpoolWtw4100WasherDrainPumpOhms",
                "J6",
                "3 & 6",
                ohm_branches("drain_j6", "pump_obstruction", "harness_pump_cont", "14–25 Ω"),
                pin_details=PIN_J6_DRIVE,
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
                "Continuity pump pin 1→J6-3 and pin 3→J6-6?",
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
                "whirlpoolWtw4100WasherDrainPumpOhms",
                "Drain pump",
                "1 & 3",
                ohm_branches("drain_pump", "reconnect_pump_power", "replace_drain_pump", "14–25 Ω"),
            ),
            instr("reconnect_pump_power", 10, "Reconnect pump and restore power", "Reconnect J6 and pump harness. Restore power for Automatic Test drain.", "live_test_drain_pump"),
            visual(
                "live_test_drain_pump",
                11,
                "Drain pump runs in Automatic Test",
                "Run Automatic Test drain step. Does pump run and evacuate water?",
                [
                    {"id": "dp_run", "label": "Pump runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_verified"},
                    {"id": "dp_no_run", "label": "Ohms OK but no run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_pump", "terminal": True, "oemOutcome": "Pump good but no run — replace main control."},
                ],
            ),
            outcome("clear_pump_obstruction", 12, "Clear pump obstruction", "Remove obstruction and retest."),
            outcome("replace_lower_harness_pump", 13, "Replace lower harness", "Restore pump circuit continuity."),
            outcome("replace_drain_pump", 14, "Replace drain pump", "Pump motor open or out of range at terminals."),
            outcome("pump_verified", 15, "Drain pump verified", "Pump resistance and Automatic Test run verified."),
            outcome("replace_acu_pump", 16, "Replace main control", "Pump good but no run — replace main control."),
        ],
    ),
    proc(
        "w11800233-test-07-lid-lock",
        "TEST #7: Lid Lock",
        "7",
        "Lid Lock",
        [93, 94],
        ["door_lock"],
        ["lid_lock", "door_lock_check", "F5E1", "F5E3", "F5E4"],
        [
            visual(
                "lid_lock_auto_test",
                2,
                "Lid lock in Automatic Test",
                "During Automatic Test wash/spin steps, does lid lock cycle lock and unlock?",
                [
                    {"id": "ll_fail", "label": "Unsuccessful", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j4"},
                    {"id": "ll_ok", "label": "Lock cycles OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_verified"},
                ],
            ),
            visual("check_j4", 3, "J4 fully seated", "Power off. J4 fully inserted at main control?", [
                {"id": "j4_ok", "label": "J4 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_ohms"},
                {"id": "j4_bad", "label": "J4 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j4"},
            ]),
            instr("reseat_j4", 4, "Reseat J4 and retest", "Reconnect J4 and repeat Automatic Test.", "lid_lock_auto_test"),
            meas(
                "lid_lock_ohms",
                5,
                "Lid lock solenoid J4-2 to J4-1",
                "Remove J4. Lock solenoid J4-2↔1: 50–160 Ω. Lock switch J4-3↔2: locked=0 Ω, unlocked=open. Lid switch J4-2↔1: lid open=open.",
                "whirlpoolWtw4100WasherLidLockSolenoidOhms",
                "J4",
                "2 & 1",
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
            outcome("replace_lid_lock", 7, "Replace lid lock mechanism", "Switch or solenoid readings fail — replace lid lock."),
            outcome("replace_acu_lid", 8, "Replace main control", "Lid lock components good but lock problem persists — replace main control."),
            outcome("lid_lock_verified", 9, "Lid lock verified", "Lid lock resistance and Automatic Test operation verified."),
        ],
    ),
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def service_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11800233-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11800233",
        "title": "W11800233 — Service Diagnostic mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console"],
        "description": "Three-button Service Diagnostic entry × 3 rounds within 8 seconds.",
        "tags": ["service_diagnostic", "live_test"],
        "entryStepId": "service_diagnostic_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [48, 49],
        },
        "steps": [
            {
                "id": "service_diagnostic_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Service Diagnostic mode",
                "body": (
                    "Washer in standby (plugged in, all LEDs off). Choose any three buttons and remember their order. "
                    "Within 8 seconds: press and release button 1, then 2, then 3 — repeat that same 3-button sequence "
                    "two more times (3 rounds total). Success: all HMI indicators illuminate 1 second then turn off; "
                    "status LEDs blink twice if no saved fault codes. Key 1 = HMI Test; Key 2 = Automatic Test; "
                    "Key 3 = Fault Code Display."
                ),
                "sourceExcerpt": (
                    "Press and Release Key 1, Key 2, Key 3; Repeat this 3 button sequence 2 more times within 8 seconds."
                ),
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


def automatic_test_mode_bundle() -> dict:
    return {
        "id": "w11800233-automatic-test-mode",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11800233",
        "title": "W11800233 — Automatic Test Mode",
        "modeKind": "load_test",
        "uiVariants": ["console"],
        "description": "Service Diagnostic Key 2 + START runs valves, drain, wash, and spin sequence (lid closed).",
        "tags": ["service_test", "live_test", "automatic_test"],
        "entryStepId": "automatic_test_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [63, 65],
        },
        "steps": [
            {
                "id": "automatic_test_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Automatic Test Mode",
                "body": (
                    "With Service Diagnostic active, press Key 2 then press START (lid must be closed). "
                    "Sequence: water valves (fill to 70 mm) → drain pump (to 3 mm) → wash (shifter agitate) → "
                    "spin (140/300/500 rpm). Key 1 repeats previous step; Key 2 skips to next. POWER exits to standby."
                ),
                "sourceExcerpt": "Press Key 2 used to activate Service Diagnostic Mode. To start Automatic Test Mode, press Key 5/Start.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


BUNDLES = [service_diagnostic_entry_bundle(), automatic_test_mode_bundle()]
BUNDLE_FILES = [
    "w11800233-service-diagnostic-entry.json",
    "w11800233-automatic-test-mode.json",
]


def write_catalog() -> None:
    catalog = {
        "manualId": "W11800233",
        "platformId": PLATFORM,
        "templateId": "washer",
        "label": "Whirlpool/Maytag 4.0–4.3 cu ft ACU belt-drive top-load (WTW4100)",
        "notes": "TEST #1–7 (+3a shifter / 3b motor). Belt-drive PSC + shifter; Service Diagnostic 3-button × 3; Automatic Test via Key 2 + START.",
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
    readme = """# whirlpool_tl_dd_4100 — W11800233 procedure seeds

**Manual:** Whirlpool 4.0–4.3 cu ft Top Load Washer (W11800233 Rev C, ACU belt-drive)  
**Platform:** `whirlpool_tl_dd_4100` — models `WTW41*`, `MVW41*`, `WTW40*`  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11800233_TL_WASHER_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11800233
```

## Procedures (9)

| ID | OEM | Notes |
|----|-----|-------|
| w11800233-test-01-acu-power | TEST #1 | J1 line, status LED, J5 +12 VDC |
| w11800233-test-02-valves | TEST #2 | J8 valves 1300–1540 Ω |
| w11800233-test-03-drive-system | TEST #3 | Automatic Test pre-check |
| w11800233-test-03a-shifter | TEST #3a | Shifter J6-2↔6; switch J2-1 |
| w11800233-test-03b-motor | TEST #3b | PSC motor J6 3.5–6 Ω + run cap |
| w11800233-test-04-hmi | TEST #4 | HMI Test; J5 harness to HMI J1 |
| w11800233-test-05-water-level | TEST #5 | Auto Test fill 70 mm / drain 3 mm |
| w11800233-test-06-drain-pump | TEST #6 | J6 drain 14–25 Ω |
| w11800233-test-07-lid-lock | TEST #7 | J4 solenoid 50–160 Ω |

## Bundles (2)

- `w11800233-service-diagnostic-entry` — 3-button Service Diagnostic entry
- `w11800233-automatic-test-mode` — Key 2 + START Automatic Test

## WO smoke

Whirlpool `WTW4100` → `whirlpool_tl_dd_4100`; F5E3 → `w11800233-test-07-lid-lock`; F3E2 → `w11800233-test-05-water-level`
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
