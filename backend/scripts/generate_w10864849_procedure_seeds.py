#!/usr/bin/env python3
"""Generate W10864849 (Whirlpool/Maytag TL direct-drive washer) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_tl_dd"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W10864849",
    "manualTitle": "Whirlpool & Maytag 6.2 cu ft Direct Drive Top Load Washer",
    "extractedTextFile": (
        "backend/docs/manuals/"
        "w10864849-whirlpool-and-maytag-direct-drive-top-load-washer wtw9500-extracted.txt"
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
    "sourceExcerpt": "WARNING — Electrical Shock Hazard. Disconnect power before servicing.",
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
        "platformId": "whirlpool_tl_dd",
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


PIN_J12 = [
    pin_detail("1", "L1", "BK", "verified"),
    pin_detail("3", "Neutral", "WT", "verified"),
]
PIN_J18 = [
    pin_detail("1", "+5 VDC", "BK", "verified"),
    pin_detail("3", "Circuit Gnd", "Y", "verified"),
]
PIN_J2_VALVE = [
    pin_detail("4", "Valve common (Neutral)", "WT", "verified"),
    pin_detail("9", "Hot valve", "RD", "verified"),
    pin_detail("10", "Cold valve", "BU", "verified"),
]
PIN_J1_MOTOR = [
    pin_detail("1", "VS2", "RD", "verified"),
    pin_detail("3", "VS1", "BR", "verified"),
    pin_detail("4", "VS3", "BK", "verified"),
]
PIN_J4_DRAIN = [
    pin_detail("1", "Neutral", "WT", "verified"),
    pin_detail("3", "Drain pump", "BU", "verified"),
]
PIN_J4_RECIRC = [
    pin_detail("1", "Neutral", "WT", "verified"),
    pin_detail("5", "Recirc pump", "BU", "verified"),
]
PIN_J6_LOCK = [
    pin_detail("2", "Lock motor", "BR", "verified"),
    pin_detail("3", "Lock motor", "BK", "verified"),
]
PIN_J2_THERM = [
    pin_detail("1", "Rtn (VSS)", "BK", "verified"),
    pin_detail("2", "Thermistor", "BK", "verified"),
]
PIN_J19_LIGHT = [
    pin_detail("1", "LED +", "R", "verified"),
    pin_detail("2", "LED −", "BK", "verified"),
]

PROCEDURES = [
    proc(
        "w10864849-test-01-acu-power",
        "TEST #1: Main Control (ACU)",
        "1",
        "Main Control (ACU)",
        [30, 31],
        ["supply"],
        ["voltage_check", "supply_issue", "F1E1", "F7E0", "F6E2", "F6E3"],
        [
            instr("access_console", 2, "Access main control", "Remove console. Verify ALL connectors fully seated at ACU.", "restore_power_line"),
            instr("restore_power_line", 3, "Restore power for line check", "Plug in or reconnect power for live measurements only.", "line_voltage"),
            meas(
                "line_voltage",
                4,
                "Line voltage J12-1 to J12-3",
                "AC voltmeter: black probe J12-3 (Neutral), red probe J12-1 (L1). Expect 120 VAC.",
                "supplyVoltage120",
                "J12",
                "1 & 3",
                [
                    {"id": "line_ok", "label": "120 VAC present", "when": {"kind": "measurement_normal"}, "nextStepId": "diagnostic_led"},
                    {"id": "line_bad", "label": "No line voltage", "when": {"kind": "measurement_critical"}, "nextStepId": "check_power_cord", "terminal": True, "oemOutcome": "Check outlet, breaker, and AC power cord continuity."},
                ],
                pin_details=PIN_J12,
            ),
            visual(
                "diagnostic_led",
                5,
                "Diagnostic LED state",
                "Is the Diagnostic LED flashing, continuously ON, or OFF?",
                [
                    {"id": "led_flash", "label": "Flashing (+5 VDC, micro operating)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "acu_verified"},
                    {"id": "led_on", "label": "ON steady (+5 VDC, micro failure)", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu"},
                    {"id": "led_off", "label": "OFF (+5 VDC missing)", "when": {"kind": "checkpoint_no"}, "nextStepId": "isolate_ui"},
                ],
                "Flashing: proceed to Key Activation. ON/OFF: continue ACU DC checks.",
            ),
            instr("isolate_ui", 6, "Isolate UI load on J18", "Disconnect power. Wait for LED off. Remove J18 from ACU. Restore power and recheck Diagnostic LED.", "led_after_j18"),
            visual(
                "led_after_j18",
                7,
                "LED flashes with J18 removed?",
                "With J18 disconnected, does Diagnostic LED flash?",
                [
                    {"id": "j18_ui_fault", "label": "No — still not flashing", "when": {"kind": "checkpoint_no"}, "nextStepId": "j18_5vdc"},
                    {"id": "j18_ui_ok", "label": "Yes — flashes without UI", "when": {"kind": "checkpoint_yes"}, "nextStepId": "ui_harness_fault", "terminal": True, "oemOutcome": "UI or UI harness fault — see TEST #4 Keys and Encoders."},
                ],
            ),
            meas(
                "j18_5vdc",
                8,
                "+5 VDC at J18",
                "DC volts: black J18-3 (Gnd), red J18-1 (+5 VDC). Do not short pins.",
                "whirlpoolTlDdWasherAcu5Vdc",
                "J18",
                "1 & 3",
                [
                    {"id": "v5_ok", "label": "+5 VDC present", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_acu"},
                    {"id": "v5_bad", "label": "+5 VDC missing", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_acu"},
                ],
                pin_details=PIN_J18,
            ),
            outcome("check_power_cord", 9, "Check power cord", "Verify outlet and AC cord continuity per wiring diagram."),
            outcome("acu_verified", 10, "ACU power verified", "Line voltage and diagnostic LED OK — proceed to complaint-specific test or Key Activation."),
            outcome("ui_harness_fault", 11, "UI harness fault", "Repair UI harness or replace UI per TEST #4."),
            outcome("replace_acu", 12, "Replace main control", "Replace ACU. Reassemble and run Service Diagnostics to verify."),
        ],
    ),
    proc(
        "w10864849-test-02-valves",
        "TEST #2: Valves",
        "2",
        "Valves",
        [32],
        ["inlet_valve"],
        ["water_valve_check", "fill_issue", "F8E1", "LF", "F0E4"],
        [
            instr("valve_live_precheck", 2, "Service Test valve pre-check", "In Service Test Mode, run Cold/Hot/Fresh Fill/Detergent/Softener/Oxi load functions. Note any valve that fails to energize.", "disconnect_j2"),
            instr("disconnect_j2", 3, "Disconnect J2 at ACU", "Unplug washer. Remove console. Disconnect J2 from main control.", "valve_ohms"),
            meas(
                "valve_ohms",
                4,
                "Valve coil resistance at J2",
                "Measure each suspect coil across J2-4 (White common) and valve pin: Softener J2-7, Hot J2-9, Cold J2-10, Detergent J2-11, Fresh Fill J2-12. Expect 790–840 Ω.",
                "whirlpoolTlDdWasherInletValveOhms",
                "J2",
                "4 & valve pin",
                ohm_branches("valve", "reconnect_j2_power", "replace_valve", "790–840 Ω"),
                pin_details=PIN_J2_VALVE,
            ),
            instr("reconnect_j2_power", 5, "Reconnect J2 and restore power", "Reconnect J2. Reassemble panels. Restore power for Service Test Mode valve exercise.", "live_test_valves"),
            visual(
                "live_test_valves",
                6,
                "Valves energize in Service Test Mode",
                "Toggle affected valve functions (001–004, etc.) in Service Test Mode. Does each valve in question turn on?",
                [
                    {"id": "valves_run", "label": "Valves operate", "when": {"kind": "checkpoint_yes"}, "nextStepId": "valves_verified"},
                    {"id": "valves_no_run", "label": "Ohms OK but valve does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_valves", "terminal": True, "oemOutcome": "Coils in range but no run — replace main control."},
                ],
            ),
            outcome("replace_valve", 7, "Replace valve assembly", "Replace water valve assembly when coil tens of ohms outside 790–840 Ω."),
            outcome("valves_verified", 8, "Valves verified", "Valve resistance and Service Test operation verified."),
            outcome("replace_acu_valves", 9, "Replace ACU", "Replace main control and verify with Service Diagnostics."),
        ],
    ),
    proc(
        "w10864849-test-03-drive-system",
        "TEST #3: Drive System (pre-test)",
        "3",
        "Drive System",
        [33],
        ["drive_motor"],
        ["motor_check", "F7E3", "F7E4", "F7E5", "F7E6", "F7E7", "F7E9"],
        [
            instr("enter_service_diag", 2, "Enter Service Diagnostic and clear codes", "Activate Service Diagnostic mode. Retrieve and clear fault codes. F7E3–F7E9 suggest motor/shifter path.", "fast_agitate_test"),
            visual(
                "fast_agitate_test",
                3,
                "Fast Agitate runs 15–20 sec",
                "Enter Service Test Mode. Run Fast Agitate. Does motor run after 15–20 seconds?",
                [
                    {"id": "agitate_ok", "label": "Motor runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "spin_test"},
                    {"id": "agitate_fail", "label": "Motor does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_shifter_motor"},
                ],
            ),
            visual(
                "spin_test",
                4,
                "Spin test completes",
                "In Service Test Mode, command spin. If motor hums briefly then stops, check fault code display.",
                [
                    {"id": "spin_ok", "label": "Spin OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "drive_verified"},
                    {"id": "spin_fail", "label": "Spin fails or hums out", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_shifter_motor"},
                ],
            ),
            instr(
                "route_shifter_motor",
                5,
                "Continue to shifter or motor test",
                "If shifter-related (F7E5) or mechanical bind — run TEST #3a Shifter. For motor circuit faults (F7E2–F7E9, F1E2) — run TEST #3b Motor.",
                "drive_deferred",
            ),
            outcome("drive_verified", 6, "Drive system OK", "Fast Agitate and spin pass in Service Test Mode — no further drive diagnosis needed."),
            outcome("drive_deferred", 7, "Run TEST #3a or #3b", "Proceed to w10864849-test-03a-shifter or w10864849-test-03b-motor per fault code."),
        ],
    ),
    proc(
        "w10864849-test-03a-shifter",
        "TEST #3a: Drive System — Shifter",
        "3a",
        "Drive System - Shifter",
        [33, 34],
        ["drive_motor"],
        ["shifter_check", "F7E5", "agitate_issue", "spin_issue"],
        [
            visual(
                "shifter_service_test",
                2,
                "Spin and Agitate tests in Service Test Mode",
                "Lid closed and locked. Run Spin and Agitate under Service Test Mode. Did shifter engage for both?",
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
                    {"id": "free_yes", "label": "Turn freely / independently", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j4"},
                    {"id": "free_no", "label": "Locked together or bound", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_drive_slider", "terminal": True, "oemOutcome": "Replace drive — slider binds or motor/shifter locked."},
                ],
            ),
            visual("check_j4", 4, "J4 fully seated", "Verify J4 inserted fully at ACU.", [
                {"id": "j4_ok", "label": "J4 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "shifter_voltage"},
                {"id": "j4_bad", "label": "J4 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j4"},
            ]),
            instr("reseat_j4", 5, "Reseat J4 and retest", "Reconnect J4 and repeat Service Test Spin/Agitate.", "shifter_service_test"),
            instr("shifter_voltage", 6, "Live shifter voltage check", "Restore power. AC volts J4-1 (N) to J4-7 (L1). Command Spin ON or Agitate OFF in Service Test (motor stopped). Expect 120 VAC.", "shifter_vac_present"),
            visual(
                "shifter_vac_present",
                7,
                "120 VAC at shifter when commanded",
                "Is 120 VAC present at J4-1 to J4-7 when shifter commanded?",
                [
                    {"id": "vac_yes", "label": "120 VAC present", "when": {"kind": "checkpoint_yes"}, "nextStepId": "harness_continuity"},
                    {"id": "vac_no", "label": "No voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_shifter"},
                ],
            ),
            visual(
                "harness_continuity",
                8,
                "Shifter harness continuity",
                "Power off. Tilt washer. Continuity J4-1 (White) to shifter pin 3 and J4-7 (Orange) to shifter pin 1.",
                [
                    {"id": "harness_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "slider_check"},
                    {"id": "harness_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness", "terminal": True, "oemOutcome": "Replace lower washer harness."},
                ],
            ),
            visual(
                "slider_check",
                9,
                "Shifter slider moves freely",
                "Remove motor bolt, cover, stator, and shifter coil. Slider on shaft moves freely without rubbing?",
                [
                    {"id": "slider_ok", "label": "Slider OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_shifter"},
                    {"id": "slider_bad", "label": "Binds or rubs", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_drive_slider"},
                ],
            ),
            outcome("shifter_verified", 10, "Shifter verified", "Spin and Agitate service tests pass."),
            outcome("replace_lower_harness", 11, "Replace lower harness", "Restore harness continuity and retest."),
            outcome("replace_drive_slider", 12, "Replace drive", "Replace drive assembly for slider or bind fault."),
            outcome("replace_acu_shifter", 13, "Replace ACU", "Shifter/mechanical OK but ACU does not drive shifter — replace main control."),
        ],
    ),
    proc(
        "w10864849-test-03b-motor",
        "TEST #3b: Drive System — Motor",
        "3b",
        "Drive System - Motor",
        [35],
        ["drive_motor"],
        ["motor_check", "F1E2", "F7E2", "F7E3", "F7E4", "F7E6", "F7E7", "F7E8", "F7E9"],
        [
            visual(
                "motor_spin_tests",
                2,
                "Low/Mid/High spin in Service Test Mode",
                "Service Diagnostic active. Run Low, Mid, and High Speed Spin tests. Did any speed run?",
                [
                    {"id": "spin_tests_fail", "label": "Failed", "when": {"kind": "checkpoint_no"}, "nextStepId": "impeller_free"},
                    {"id": "spin_tests_ok", "label": "Motor runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_verified"},
                ],
            ),
            visual(
                "impeller_free",
                3,
                "Impeller turns freely",
                "Power off. Impeller should turn freely and not be connected to basket.",
                [
                    {"id": "imp_free", "label": "Turns freely", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j1"},
                    {"id": "imp_bind", "label": "Does not turn freely", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_friction", "terminal": True, "oemOutcome": "Resolve mechanical friction or lockup before motor replacement."},
                ],
            ),
            visual("check_j1", 4, "J1 fully seated at ACU", "Verify J1 fully inserted.", [
                {"id": "j1_ok", "label": "J1 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "j1_motor_ohms"},
                {"id": "j1_bad", "label": "J1 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j1"},
            ]),
            instr("reseat_j1", 5, "Reseat J1 and retest", "Reconnect J1 and repeat Service Test spin.", "motor_spin_tests"),
            meas(
                "j1_motor_ohms",
                6,
                "Motor resistance at J1",
                "Ohms J1 1-3 and 3-4. Each expect 8–10 Ω. Much higher than 10 or less than 8 → step 10 path.",
                "whirlpoolTlDdWasherMotorOhms",
                "J1",
                "1-3 & 3-4",
                ohm_branches("j1", "motor_harness_cont", "replace_drive_motor", "8–10 Ω"),
                pin_details=PIN_J1_MOTOR,
            ),
            visual(
                "motor_harness_cont",
                7,
                "Motor harness continuity J1 to drive",
                "Tilt washer. Continuity all J1 pins to drive motor connector?",
                [
                    {"id": "mh_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_connector_ohms"},
                    {"id": "mh_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_motor", "terminal": True, "oemOutcome": "Replace lower washer harness."},
                ],
            ),
            meas(
                "motor_connector_ohms",
                8,
                "Motor resistance at drive connector",
                "Disconnect motor connector at drive. Measure 2-3 (R-BR) and 3-4 (BR-BK). Expect 8–10 Ω each.",
                "whirlpoolTlDdWasherMotorOhms",
                "Drive motor",
                "2-3 & 3-4",
                ohm_branches("motor", "motor_cover_check", "replace_drive_motor", "8–10 Ω"),
            ),
            visual(
                "motor_cover_check",
                9,
                "Motor connection cover seated",
                "Remove shifter coil and stator. Motor electrical connection cover fully seated?",
                [
                    {"id": "cover_ok", "label": "Cover seated", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_drive_motor"},
                    {"id": "cover_bad", "label": "Cover not seated", "when": {"kind": "checkpoint_no"}, "nextStepId": "seat_cover"},
                ],
            ),
            instr("seat_cover", 10, "Seat motor connection cover", "Fully seat cover, reassemble, and repeat Service Test.", "motor_spin_tests"),
            instr("reconnect_motor_power", 11, "Reconnect motor and restore power", "Reconnect motor harness. Reassemble. Restore power for Service Test spin.", "live_test_motor_spin"),
            visual(
                "live_test_motor_spin",
                12,
                "Motor runs in Service Test Mode",
                "Command Low/Mid/High spin in Service Test Mode. Does motor run at commanded speed?",
                [
                    {"id": "motor_runs", "label": "Motor runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_verified"},
                    {"id": "motor_no_run", "label": "Does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_motor", "terminal": True, "oemOutcome": "Motor ohms OK but no run — replace ACU."},
                ],
            ),
            outcome("clear_friction", 13, "Clear mechanical friction", "Remove obstruction between basket/tub/impeller."),
            outcome("replace_lower_harness_motor", 14, "Replace lower harness", "Restore motor circuit continuity."),
            outcome("replace_drive_motor", 15, "Replace drive", "Motor windings open or out of range — replace drive assembly."),
            outcome("motor_verified", 16, "Motor verified", "Motor resistance and Service Test rotation verified."),
            outcome("replace_acu_motor", 17, "Replace ACU", "Replace main control when motor and harness test good but no run."),
        ],
    ),
    proc(
        "w10864849-test-04-keys-encoders",
        "TEST #4: Keys and Encoders",
        "4",
        "Keys and Encoders",
        [36],
        ["hmi_control"],
        ["hmi_check", "F2E1", "F2E3", "F2E4", "F2E5", "F6E2", "F6E3"],
        [
            visual(
                "indicator_test",
                2,
                "Key Activation & Encoder Test",
                "In Service Diagnostic, run Key Activation test. Do all indicators light and buttons toggle with beep?",
                [
                    {"id": "all_ok", "label": "All keys/indicators OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "hmi_verified"},
                    {"id": "indicators_out", "label": "One or more indicators out", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j18_j17"},
                    {"id": "buttons_stuck", "label": "Some buttons do not toggle", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_ui"},
                ],
            ),
            visual(
                "check_j18_j17",
                3,
                "J18 and UI J17 seated",
                "Power off. Verify ACU J18 and UI J17 fully seated; speaker on UI J6 if visible.",
                [
                    {"id": "conn_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "ui_harness_cont"},
                    {"id": "conn_bad", "label": "Loose connector", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_connectors"},
                ],
            ),
            visual(
                "ui_harness_cont",
                4,
                "UI harness continuity",
                "Continuity ACU J18 pin 1↔UI J17 pin 3 (BK), J18-2↔J17-2 (BU), J18-3↔J17-1 (Y)?",
                [
                    {"id": "uh_ok", "label": "Continuity passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_acu_supply"},
                    {"id": "uh_fail", "label": "Continuity fails", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_ui_harness"},
                ],
            ),
            instr("check_acu_supply", 5, "Verify ACU supply", "Run TEST #1 Main Control supply checks, then TEST #11 Basket Light if needed.", "retest_keys"),
            instr("retest_keys", 6, "Retest Key Activation", "Reassemble, restore power, enter Service Diagnostic, rerun Key Activation test.", "hmi_verified"),
            instr("replace_ui", 7, "Replace UI assembly", "Replace user interface for stuck or non-toggling buttons.", "retest_keys"),
            outcome("repair_connectors", 8, "Repair connections", "Reseat harness connectors and retest."),
            outcome("replace_ui_harness", 9, "Replace UI harness", "Replace UI harness when continuity fails."),
            outcome("hmi_verified", 10, "HMI verified", "Keys, indicators, and audio feedback verified in Service Diagnostic."),
        ],
    ),
    proc(
        "w10864849-test-05-temp-thermistor",
        "TEST #5: Temperature Thermistor",
        "5",
        "Temperature Thermistor",
        [37],
        ["wash_ntc"],
        ["thermistor_check", "F3E2", "temp_fault"],
        [
            instr("cold_valve_test", 2, "Cold valve Service Test", "Service Test Mode: Cold valve test — cold water dispenses?", "hot_valve_test"),
            instr("hot_valve_test", 3, "Hot valve Service Test", "Hot valve test — hot water dispenses? Verify household hot supply if cold only.", "disconnect_j2_therm"),
            instr("disconnect_j2_therm", 4, "Disconnect J2", "Power off. Remove J2 from ACU.", "therm_ohms"),
            meas(
                "therm_ohms",
                5,
                "Inlet thermistor J2-1 to J2-2",
                "Measure resistance J2-1 to J2-2 at ambient. Compare to OEM table (10 kΩ @ 77°F / 25°C).",
                "whirlpoolTlDdWasherInletThermistorOhms",
                "J2",
                "1 & 2",
                [
                    {"id": "therm_ok", "label": "In R/T table range", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_acu_therm"},
                    {"id": "therm_bad", "label": "Open or out of range", "when": {"kind": "measurement_open"}, "nextStepId": "replace_valve_therm", "terminal": True, "oemOutcome": "Replace valve assembly (thermistor integral)."},
                    {"id": "therm_crit", "label": "Short/critical", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_valve_therm", "terminal": True, "oemOutcome": "Replace valve assembly."},
                ],
                pin_details=PIN_J2_THERM,
            ),
            outcome("replace_valve_therm", 6, "Replace valve assembly", "Thermistor open/short — valve assembly includes thermistor."),
            outcome("replace_acu_therm", 7, "Replace ACU", "Thermistor good — replace main control and run Service Diagnostics."),
        ],
    ),
    proc(
        "w10864849-test-06-water-level",
        "TEST #6: Water Level",
        "6",
        "Water Level",
        [38],
        ["water_level_sensor"],
        ["pressure_sensor", "F3E1", "F8E1", "F8E3", "F8E6", "long_fill"],
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
                "Hose secure at transducer (ACU) and pressure dome on tub? Routed without pinch? Clear of water/suds/debris?",
                [
                    {"id": "hose_ok", "label": "Hose OK after service", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_level"},
                    {"id": "hose_bad", "label": "Pinch, leak, or debris", "when": {"kind": "checkpoint_no"}, "nextStepId": "service_hose"},
                ],
            ),
            instr("service_hose", 5, "Service pressure hose", "Disconnect hose at ACU, blow clear, fix routing, replace if leaking. Retest fill.", "small_load_fill"),
            outcome("level_verified", 6, "Water level OK", "Pressure transducer and hose path verified."),
            outcome("replace_acu_level", 7, "Replace ACU", "Hose path good — replace main control; run fill cycle in Service Diagnostics."),
        ],
    ),
    proc(
        "w10864849-test-07-drain-recirc-pump",
        "TEST #7: Drain & Recirculation Pump",
        "7",
        "Drain & Recirculation Pump",
        [39],
        ["drain_pump"],
        ["pump_check", "drain_issue", "F9E1", "F9E2", "dr", "drn"],
        [
            instr("clear_obstructions", 2, "Clear drain path obstructions", "Check tub sump, hose, and filter areas. Then test drain/recirc in Service Test Mode.", "service_test_pumps"),
            visual(
                "service_test_pumps",
                3,
                "Drain/recirc run in Service Test Mode",
                "Command drain pump (and recirc if equipped) in Service Test Mode. Do they run?",
                [
                    {"id": "pump_live_fail", "label": "Does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j4_pump"},
                    {"id": "pump_live_ok", "label": "Runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pumps_verified"},
                ],
            ),
            visual("check_j4_pump", 4, "J4 fully seated", "Power off. J4 fully inserted at ACU?", [
                {"id": "j4p_ok", "label": "J4 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "j4_pump_ohms"},
                {"id": "j4p_bad", "label": "J4 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j4_pump"},
            ]),
            instr("reseat_j4_pump", 5, "Reseat J4 and retest", "Reconnect J4 and repeat Service Test pump run.", "service_test_pumps"),
            meas(
                "j4_pump_ohms",
                6,
                "Pump resistance at J4",
                "Disconnect J4. Drain J4-1↔3 expect 18–24 Ω. Recirc J4-1↔5 expect 26–32 Ω (if equipped).",
                "whirlpoolTlDdWasherDrainPumpOhms",
                "J4",
                "1 & 3",
                ohm_branches("drain_j4", "recirc_j4_optional", "pump_obstruction", "18–24 Ω drain"),
                pin_details=PIN_J4_DRAIN,
            ),
            meas(
                "recirc_j4_optional",
                7,
                "Recirc pump J4-1 to J4-5 (if equipped)",
                "If model has recirc pump, measure 26–32 Ω. Skip if not equipped.",
                "whirlpoolTlDdWasherRecircPumpOhms",
                "J4",
                "1 & 5",
                ohm_branches("recirc_j4", "harness_pump_cont", "pump_obstruction", "26–32 Ω"),
                pin_details=PIN_J4_RECIRC,
            ),
            visual(
                "harness_pump_cont",
                8,
                "Pump harness continuity",
                "Tilt washer. Continuity drain pump pins to J4-1/J4-3 and recirc to J4-1/J4-5?",
                [
                    {"id": "ph_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_terminal_ohms"},
                    {"id": "ph_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_pump"},
                ],
            ),
            meas(
                "pump_terminal_ohms",
                9,
                "Resistance at pump motor terminals",
                "At pump: drain 18–24 Ω; recirc 26–32 Ω.",
                "whirlpoolTlDdWasherDrainPumpOhms",
                "Drain pump",
                "1 & 2",
                ohm_branches("drain_pump", "reconnect_pump_power", "replace_drain_pump", "18–24 Ω"),
            ),
            instr("reconnect_pump_power", 10, "Reconnect pumps and restore power", "Reconnect J4 and pump harnesses. Restore power for Service Test drain.", "live_test_drain_pump"),
            visual(
                "live_test_drain_pump",
                11,
                "Drain pump runs in Service Test Mode",
                "Toggle drain pump in Service Test Mode. Does pump run and evacuate water?",
                [
                    {"id": "dp_run", "label": "Pump runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pumps_verified"},
                    {"id": "dp_no_run", "label": "Ohms OK but no run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_pump"},
                ],
            ),
            outcome("pump_obstruction", 12, "Clear pump obstruction", "Tilt washer, verify pump free, clear obstructions."),
            outcome("replace_lower_harness_pump", 13, "Replace lower harness", "Restore pump circuit continuity."),
            outcome("replace_drain_pump", 14, "Replace drain pump", "Pump motor open or out of range at terminals."),
            outcome("pumps_verified", 15, "Pumps verified", "Drain/recirc resistance and Service Test run verified."),
            outcome("replace_acu_pump", 16, "Replace ACU", "Pump good but no run — replace main control."),
        ],
    ),
    proc(
        "w10864849-test-08-lid-lock",
        "TEST #8: Lid Lock",
        "8",
        "Lid Lock",
        [40],
        ["door_lock"],
        ["lid_lock", "door_lock_check", "F5E1", "F5E2", "F5E3", "F5E4"],
        [
            visual(
                "lid_lock_service_test",
                2,
                "Lid Lock Service Test Mode",
                "Run Lid Lock test in Service Test Mode. Does lock cycle lock and unlock?",
                [
                    {"id": "ll_fail", "label": "Unsuccessful", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j6"},
                    {"id": "ll_ok", "label": "Lock cycles OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_verified"},
                ],
            ),
            visual("check_j6", 3, "J6 fully seated", "Power off. J6 fully inserted at ACU?", [
                {"id": "j6_ok", "label": "J6 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_ohms"},
                {"id": "j6_bad", "label": "J6 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j6"},
            ]),
            instr("reseat_j6", 4, "Reseat J6 and retest", "Reconnect J6 and repeat Lid Lock Service Test.", "lid_lock_service_test"),
            meas(
                "lid_lock_ohms",
                5,
                "Lid lock motor and switches J6",
                "Remove J6. Motor J6-2↔3: 35 Ω ±5 locked or unlocked. Home J6-1↔4: 0 unlocked / open locked. Lock J6-1↔7: open unlocked / 0 locked. Lid J6-1↔5: 0 closed / open open.",
                "whirlpoolTlDdWasherLidLockMotorOhms",
                "J6",
                "2 & 3",
                ohm_branches("lock_motor", "switch_states", "replace_lid_lock", "35 Ω ±5"),
                pin_details=PIN_J6_LOCK,
            ),
            visual(
                "switch_states",
                6,
                "Lock switch states match table",
                "Do Home, Lock, and Lid switch readings match unlocked/locked table for current lid state?",
                [
                    {"id": "sw_ok", "label": "Switch states OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_lid"},
                    {"id": "sw_bad", "label": "Switch readings wrong", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lid_lock"},
                ],
            ),
            instr("reconnect_lid_lock_power", 7, "Reconnect J6 and restore power", "Reconnect J6. Restore power for Lid Lock Service Test.", "live_test_lid_lock"),
            visual(
                "live_test_lid_lock",
                8,
                "Lid lock operates in Service Test Mode",
                "Run Lid Lock function in Service Test Mode. Does mechanism lock and unlock?",
                [
                    {"id": "ll_live_ok", "label": "Operates", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_verified"},
                    {"id": "ll_live_no", "label": "Ohms OK but no actuation", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_lid"},
                ],
            ),
            outcome("replace_lid_lock", 9, "Replace lid lock", "Replace lid lock mechanism when switch or motor readings fail."),
            outcome("replace_acu_lid", 10, "Replace ACU", "Lid lock good — replace main control."),
            outcome("lid_lock_verified", 11, "Lid lock verified", "Lid lock resistance and Service Test operation verified."),
        ],
    ),
    proc(
        "w10864849-test-09-heater",
        "TEST #9: Heater Element",
        "9",
        "Heater Element",
        [41],
        ["wash_heater"],
        ["heating_element_check", "F4E1", "F4E2", "no_heat"],
        [
            instr("access_heater", 2, "Access heater terminals", "Power off. Remove heater terminal cover. Verify connections.", "heater_ohms"),
            meas(
                "heater_ohms",
                3,
                "Heater element resistance",
                "Measure heater element resistance. Abnormal = infinity (open).",
                "whirlpoolTlDdWasherHeaterOhms",
                "Heater",
                "A & B",
                [
                    {"id": "heat_ok", "label": "Not open (in range)", "when": {"kind": "measurement_normal"}, "nextStepId": "check_j5"},
                    {"id": "heat_open", "label": "Infinite / open", "when": {"kind": "measurement_open"}, "nextStepId": "replace_heater", "terminal": True, "oemOutcome": "Replace heater element."},
                    {"id": "heat_crit", "label": "Short/critical", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_heater", "terminal": True, "oemOutcome": "Replace heater element."},
                ],
            ),
            visual("check_j5", 4, "J5 harness seated at ACU", "J5 to lower harness fully connected?", [
                {"id": "j5_ok", "label": "J5 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "reconnect_heater_power"},
                {"id": "j5_bad", "label": "J5 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j5"},
            ]),
            instr("reseat_j5", 5, "Reseat J5", "Reconnect J5 harness.", "reconnect_heater_power"),
            instr("reconnect_heater_power", 6, "Restore power for heater test", "Reinstall cover. Restore power. Water above impeller; other loads off.", "live_test_heater"),
            visual(
                "live_test_heater",
                7,
                "Heater toggles in Service Test Mode",
                "Service Test function 017 (Toggle Heater). Does heater energize?",
                [
                    {"id": "heat_run", "label": "Heater on", "when": {"kind": "checkpoint_yes"}, "nextStepId": "heater_verified"},
                    {"id": "heat_no_run", "label": "No heat", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_heater"},
                ],
            ),
            outcome("replace_heater", 8, "Replace heater element", "Element open — replace and verify torque on compression nut."),
            outcome("heater_verified", 9, "Heater verified", "Heater resistance and Service Test toggle verified."),
            outcome("replace_acu_heater", 10, "Replace ACU", "Element good but no heat — replace main control."),
        ],
    ),
    proc(
        "w10864849-test-10-service-leds",
        "TEST #10: Service LEDs",
        "10",
        "Service LEDs",
        [42],
        ["hmi_control"],
        ["hmi_check", "F2E1", "service_led"],
        [
            instr("access_service_leds", 2, "Access UI service LEDs", "Separate glass top from lid frame (Whirlpool) or access console UI (Maytag). Locate amber Power, blue Data, white Button Sounds LEDs.", "power_led_flash"),
            visual(
                "power_led_flash",
                3,
                "Service Power LED flashes at 1 Hz",
                "With power applied, does amber Service Power LED flash?",
                [
                    {"id": "pwr_led_ok", "label": "Flashes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "data_led_on"},
                    {"id": "pwr_led_bad", "label": "No flash", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_ui_harness_led", "terminal": True, "oemOutcome": "UI not powered — check harness and ACU (TEST #1, #4)."},
                ],
            ),
            visual(
                "data_led_on",
                4,
                "Service Data LED illuminates",
                "Press POWER or cycle power. Does blue Service Data LED illuminate?",
                [
                    {"id": "data_ok", "label": "Data LED on", "when": {"kind": "checkpoint_yes"}, "nextStepId": "audio_led_on"},
                    {"id": "data_bad", "label": "Data LED off", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_ui_harness_led"},
                ],
            ),
            visual(
                "audio_led_on",
                5,
                "Button Sounds LED with audio enabled",
                "Control Lock off. Audio Level not muted. Does white Service Button Sounds LED illuminate?",
                [
                    {"id": "audio_ok", "label": "White LED on", "when": {"kind": "checkpoint_yes"}, "nextStepId": "service_led_verified"},
                    {"id": "audio_bad", "label": "Still off", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_ui_led"},
                ],
            ),
            outcome("check_ui_harness_led", 6, "Check UI harness and ACU", "Verify J18/UI harness continuity per TEST #4."),
            outcome("replace_ui_led", 7, "Replace UI", "All three service LEDs do not behave — replace user interface."),
            outcome("service_led_verified", 8, "Service LEDs verified", "Service Power, Data, and Button Sounds LEDs behave per manual."),
        ],
    ),
    proc(
        "w10864849-test-11-basket-light",
        "TEST #11: Basket Light",
        "11",
        "Basket Light",
        [43],
        ["supply"],
        ["basket_light", "drum_light_check"],
        [
            visual(
                "lid_open_light",
                2,
                "Basket light with lid open",
                "Power on. Open lid — Whirlpool: non-Power indicators off; Maytag: basket light on. Service Test toggle basket light (fn 016).",
                [
                    {"id": "bl_fail", "label": "Light does not toggle", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j19"},
                    {"id": "bl_ok", "label": "Light operates", "when": {"kind": "checkpoint_yes"}, "nextStepId": "basket_light_verified"},
                ],
            ),
            visual("check_j19", 3, "J19 seated at ACU", "Power off. Basket light J19 secure at ACU?", [
                {"id": "j19_ok", "label": "J19 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "j19_voltage"},
                {"id": "j19_bad", "label": "Harness fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_j19"},
            ]),
            meas(
                "j19_voltage",
                4,
                "Basket light voltage J19",
                "Disconnect J19. Restore power. DC volts J19-1 (+) to J19-2 (−): ~0.13 V lid closed; 2.8–5.0 V lid open.",
                "whirlpoolTlDdWasherBasketLightVdc",
                "J19",
                "1 & 2",
                [
                    {"id": "v_ok_light", "label": "Voltage correct both states", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_basket_light"},
                    {"id": "v_bad_acu", "label": "Voltage wrong", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_acu_light"},
                ],
                pin_details=PIN_J19_LIGHT,
            ),
            instr("reconnect_j19_power", 5, "Reconnect J19 for Service Test", "Power off. Reconnect J19. Restore power.", "live_test_basket_light"),
            visual(
                "live_test_basket_light",
                6,
                "Basket light toggles in Service Test Mode",
                "Function 016 Toggle Basket Light. Does light turn on and off?",
                [
                    {"id": "bl_live_ok", "label": "Toggles", "when": {"kind": "checkpoint_yes"}, "nextStepId": "basket_light_verified"},
                    {"id": "bl_live_no", "label": "No toggle", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_basket_light"},
                ],
            ),
            outcome("repair_j19", 7, "Repair J19 harness", "Repair or replace basket light harness."),
            outcome("replace_basket_light", 8, "Replace basket light", "ACU voltage correct — replace basket light assembly."),
            outcome("replace_acu_light", 9, "Replace ACU", "J19 voltage incorrect — replace main control."),
            outcome("basket_light_verified", 10, "Basket light verified", "Basket light and J19 drive verified."),
        ],
    ),
    proc(
        "w10864849-test-12-bulk-dispense",
        "TEST #12: Bulk Dispense Pump and REX Board",
        "12",
        "Bulk Dispense Pump and Relay Expansion Board",
        [44, 45],
        ["bulk_level_switch"],
        ["bulk_dispense", "F3E4", "dispenser_check"],
        [
            instr("bulk_service_test", 2, "Bulk dispense Service Test", "Service Diagnostic: clear F3E4 if present. Fill bulk container. Service Test fn 018 — detergent trickle after ~2 min?", "check_j7_rex"),
            visual(
                "check_j7_rex",
                3,
                "J7 and Rex J1–J3 connected",
                "Power off. Console open. J7 at ACU and Rex board J1, J2, J3 secure?",
                [
                    {"id": "rex_conn_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bulk_harness_pump"},
                    {"id": "rex_conn_bad", "label": "Loose connection", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_rex_harness"},
                ],
            ),
            visual(
                "bulk_harness_pump",
                4,
                "Bulk dispense extension harness at pump",
                "Extension harness connected to pump through top?",
                [
                    {"id": "bh_ok", "label": "Connected", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bulk_pump_ohms"},
                    {"id": "bh_bad", "label": "Not connected", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_bulk_harness"},
                ],
            ),
            meas(
                "bulk_pump_ohms",
                5,
                "Bulk dispense pump resistance",
                "Disconnect pump connector. Measure resistance — expect 1485–1815 Ω.",
                "whirlpoolTlDdWasherBulkDispensePumpOhms",
                "Bulk pump",
                "1 & 2",
                ohm_branches("bulk", "replace_rex_board", "replace_bulk_pump", "1485–1815 Ω"),
            ),
            instr("reconnect_bulk_power", 6, "Reassemble and restore power", "Reconnect harnesses and panels. Restore power.", "live_test_bulk_pump"),
            visual(
                "live_test_bulk_pump",
                7,
                "Bulk pump runs in Service Test Mode",
                "Function 018 — detergent flows to front-left dispenser after ~2 minutes?",
                [
                    {"id": "bulk_run", "label": "Detergent flows", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bulk_verified"},
                    {"id": "bulk_no_run", "label": "No flow", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_bulk"},
                ],
            ),
            outcome("repair_rex_harness", 8, "Repair REX harness", "Secure J7 and Rex connectors; clear F3E4 and retest."),
            outcome("repair_bulk_harness", 9, "Repair bulk harness", "Connect extension harness at pump."),
            outcome("replace_bulk_pump", 10, "Replace bulk dispense pump", "Pump resistance out of range — inspect hoses for damage."),
            outcome("replace_rex_board", 11, "Replace Rex board", "Pump ohms good — replace relay expansion board."),
            outcome("replace_acu_bulk", 12, "Replace ACU", "Pump and Rex good but no dispense — replace main control."),
            outcome("bulk_verified", 13, "Bulk dispense verified", "Bulk pump, REX, and Service Test dispense verified."),
        ],
    ),
]

PROCEDURE_FILES = [
    "w10864849-test-01-acu-power.json",
    "w10864849-test-02-valves.json",
    "w10864849-test-03-drive-system.json",
    "w10864849-test-03a-shifter.json",
    "w10864849-test-03b-motor.json",
    "w10864849-test-04-keys-encoders.json",
    "w10864849-test-05-temp-thermistor.json",
    "w10864849-test-06-water-level.json",
    "w10864849-test-07-drain-recirc-pump.json",
    "w10864849-test-08-lid-lock.json",
    "w10864849-test-09-heater.json",
    "w10864849-test-10-service-leds.json",
    "w10864849-test-11-basket-light.json",
    "w10864849-test-12-bulk-dispense.json",
]


def service_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w10864849-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_tl_dd",
        "manualId": "W10864849",
        "title": "W10864849 — Service Diagnostic mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console"],
        "description": "Three-button Service Diagnostic entry (not POWER) × 3 rounds within 8 seconds.",
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
                    "Washer in standby (plugged in, indicators off). Choose any three buttons except POWER "
                    "and remember their order. Within 8 seconds: press and release button 1, then 2, then 3 — "
                    "repeat that same 3-button sequence two more times (3 rounds total). Success: all console "
                    "indicators illuminate for 5 seconds, seven-segment display shows 888, and a tone sounds. "
                    "Saved fault codes flash on entry; hold the 3rd entry button 5 seconds to clear (display 888)."
                ),
                "sourceExcerpt": (
                    "Select any three (3) buttons (except POWER)... Press and Release the 1st, 2nd, 3rd "
                    "selected button; Repeat this 3 button sequence 2 more times."
                ),
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


def service_test_mode_bundle() -> dict:
    return {
        "id": "w10864849-service-test-mode",
        "version": "1.0.0",
        "platformId": "whirlpool_tl_dd",
        "manualId": "W10864849",
        "title": "W10864849 — Service Test Mode",
        "modeKind": "load_test",
        "uiVariants": ["console"],
        "description": "Enter Service Test Mode via 2nd diagnostic button; select functions with Soil Level/Temperature; START toggles loads.",
        "tags": ["service_test", "live_test", "component_activation"],
        "entryStepId": "service_test_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [15, 16, 17],
        },
        "steps": [
            {
                "id": "service_test_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Service Test Mode",
                "body": (
                    "With Service Diagnostic mode active, press and release the 2nd button used for diagnostic entry. "
                    "POWER and START indicators: START flashes. Use Soil Level (+) or Temperature (−) to select function "
                    "number (001–018, 051 verification cycle, 052 load calibration). Press START to toggle selected "
                    "function on/off — flashing display = function active. Max four functions on simultaneously. "
                    "POWER exits to standby."
                ),
                "sourceExcerpt": "To enter Service Test Mode, press and release the 2nd button used to activate the Service Diagnostic mode.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


BUNDLES = [service_diagnostic_entry_bundle(), service_test_mode_bundle()]
BUNDLE_FILES = [
    "w10864849-service-diagnostic-entry.json",
    "w10864849-service-test-mode.json",
]


def write_catalog() -> None:
    catalog = {
        "manualId": "W10864849",
        "platformId": "whirlpool_tl_dd",
        "templateId": "washer",
        "label": "Whirlpool & Maytag 6.2 cu ft direct-drive top-load washer",
        "notes": "TEST #1–12 (+3a shifter / 3b motor). Service Diagnostic: 3 buttons × 3 within 8 sec; Service Test via 2nd button.",
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
    readme = """# whirlpool_tl_dd — W10864849 procedure seeds

**Manual:** Whirlpool & Maytag 6.2 cu ft Direct Drive Top Load Washer (W10864849)  
**Platform:** `whirlpool_tl_dd` — models `WTW*`, `MVW*` (Whirlpool/Maytag top-load DD)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W10864849_TL_WASHER_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10864849
```

## Procedures (14)

| ID | OEM | Notes |
|----|-----|-------|
| w10864849-test-01-acu-power | TEST #1 | J12 line, diagnostic LED, J18 +5 VDC |
| w10864849-test-02-valves | TEST #2 | J2 valves 790–840 Ω |
| w10864849-test-03-drive-system | TEST #3 | Service Test pre-check |
| w10864849-test-03a-shifter | TEST #3a | Shifter J4-7, slider |
| w10864849-test-03b-motor | TEST #3b | Motor J1 8–10 Ω |
| w10864849-test-04-keys-encoders | TEST #4 | UI J18/J17 |
| w10864849-test-05-temp-thermistor | TEST #5 | Inlet NTC J2 |
| w10864849-test-06-water-level | TEST #6 | Pressure hose |
| w10864849-test-07-drain-recirc-pump | TEST #7 | J4 18–24 / 26–32 Ω |
| w10864849-test-08-lid-lock | TEST #8 | J6 lid lock |
| w10864849-test-09-heater | TEST #9 | Heater (some models) |
| w10864849-test-10-service-leds | TEST #10 | UI service LEDs |
| w10864849-test-11-basket-light | TEST #11 | J19 basket light |
| w10864849-test-12-bulk-dispense | TEST #12 | REX + bulk pump |

## Bundles (2)

- `w10864849-service-diagnostic-entry` — 3-button diagnostic entry
- `w10864849-service-test-mode` — 2nd-button Service Test Mode

## WO smoke

Whirlpool `WTW9500` + F5E2 → `w10864849-test-08-lid-lock`
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
