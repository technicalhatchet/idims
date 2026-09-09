#!/usr/bin/env python3
"""Generate W11416787 (Whirlpool/Maytag 4.7/5.3 cu ft direct-drive top-load washer) procedure seed JSON files."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_tl_dd_5100"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_tl_dd_5100"

SOURCE = {
    "manualId": "W11416787",
    "manualTitle": "Whirlpool & Maytag 4.7/5.3 cu ft Top Load Washer (Direct Drive)",
    "extractedTextFile": (
        "backend/docs/manuals/technical-manual-w11416787-revc wtw5100+-extracted.txt"
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
PIN_J14 = [
    pin_detail("1", "+12.7 VDC", "RD", "verified"),
    pin_detail("3", "+5 V / WIN_DATA", "YL", "verified"),
    pin_detail("4", "Circuit Gnd", "BK", "verified"),
]
PIN_J16_VALVE = [
    pin_detail("1", "Valve common (LINE_OUT)", "RD", "verified"),
    pin_detail("2", "Cold valve", "BU", "verified"),
    pin_detail("5", "Hot valve", "OR", "verified"),
    pin_detail("6", "Fabric softener valve", "BR", "verified"),
    pin_detail("7", "Oxi valve", "BK", "verified"),
]
PIN_J3_MOTOR = [
    pin_detail("1", "MCU_M_V", "GN", "verified"),
    pin_detail("2", "MCU_M_W", "BR", "verified"),
    pin_detail("3", "MCU_M_U", "RD", "verified"),
    pin_detail("4", "RTN", "BK", "verified"),
]
PIN_J15 = [
    pin_detail("1", "Neutral", "WH", "verified"),
    pin_detail("2", "Drain pump", "PK", "verified"),
    pin_detail("3", "Recirc pump", "BU", "verified"),
    pin_detail("4", "Shifter", "OR", "verified"),
]
PIN_J6_LOCK = [
    pin_detail("1", "LINE / lock switch", "RD", "verified"),
    pin_detail("2", "Lock solenoid / switch", "BU", "verified"),
    pin_detail("3", "Lock solenoid", "WH", "verified"),
]
PIN_J16_THERM = [
    pin_detail("4", "Inlet NTC", "BK", "verified"),
    pin_detail("8", "AGND", "BK", "verified"),
]

PROCEDURES = [
    proc(
        "w11416787-test-01-acu-power",
        "TEST #1: Main Control (ACU)",
        "1",
        "Main Control (ACU)",
        [55, 56],
        ["supply"],
        ["voltage_check", "supply_issue", "F1E1", "no_power"],
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
                "Flashing: proceed to HMI Test. ON/OFF: continue ACU DC checks.",
            ),
            instr("isolate_hmi", 6, "Isolate HMI load on J14", "Disconnect power. Remove connector J14 from main control. Restore power and recheck Diagnostic LED.", "led_after_j14"),
            visual(
                "led_after_j14",
                7,
                "LED flashes with J14 removed?",
                "With J14 disconnected, does Diagnostic LED flash?",
                [
                    {"id": "j14_ui_fault", "label": "No — still not flashing", "when": {"kind": "checkpoint_no"}, "nextStepId": "j14_12vdc"},
                    {"id": "j14_ui_ok", "label": "Yes — flashes without HMI", "when": {"kind": "checkpoint_yes"}, "nextStepId": "ui_harness_fault", "terminal": True, "oemOutcome": "HMI or HMI harness fault — see TEST #4 HMI."},
                ],
            ),
            meas(
                "j14_12vdc",
                8,
                "+12.7 VDC at J14",
                "DC volts: black J14-4 (Circuit Gnd), red J14-1 (+12.7 VDC). Do not short pins.",
                "whirlpoolTlDd5100WasherAcu12Vdc",
                "J14",
                "1 & 4",
                [
                    {"id": "v12_ok", "label": "+12.7 VDC present", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_acu"},
                    {"id": "v12_bad", "label": "+12.7 VDC missing", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_acu"},
                ],
                pin_details=PIN_J14,
            ),
            outcome("check_power_cord", 9, "Check power cord", "Verify outlet and AC cord continuity per wiring diagram."),
            outcome("acu_verified", 10, "ACU power verified", "Line voltage and diagnostic LED OK — proceed to complaint-specific test or HMI Test."),
            outcome("ui_harness_fault", 11, "HMI harness fault", "Repair HMI harness or replace UI per TEST #4."),
            outcome("replace_acu", 12, "Replace main control", "Replace ACU. Reassemble and run Service Diagnostics to verify."),
        ],
    ),
    proc(
        "w11416787-test-02-valves",
        "TEST #2: Valves",
        "2",
        "Valves",
        [56],
        ["inlet_valve"],
        ["water_valve_check", "fill_issue", "F8E1", "LF", "F0E4"],
        [
            instr(
                "valve_component_precheck",
                2,
                "Component Activation valve pre-check",
                "In Component Activation, run Cold, Hot, Oxi (if equipped), and Fabric Softener valve tests. Note any valve that fails to energize.",
                "disconnect_j16",
            ),
            instr("disconnect_j16", 3, "Disconnect J16 at ACU", "Unplug washer. Remove console. Disconnect J16 from main control.", "valve_ohms"),
            meas(
                "valve_ohms",
                4,
                "Valve coil resistance at J16",
                "Measure each suspect coil across J16-1 (common) and valve pin: Cold J16-1&2, Hot J16-1&5, Fabric Softener J16-1&6, Oxi J16-1&7. Expect 890–1090 Ω.",
                "whirlpoolTlDd5100WasherInletValveOhms",
                "J16",
                "1 & valve pin",
                ohm_branches("valve", "reconnect_j16_power", "replace_valve", "890–1090 Ω"),
                pin_details=PIN_J16_VALVE,
            ),
            instr("reconnect_j16_power", 5, "Reconnect J16 and restore power", "Reconnect J16. Reassemble panels. Restore power for Component Activation valve exercise.", "live_test_valves"),
            visual(
                "live_test_valves",
                6,
                "Valves energize in Component Activation",
                "Toggle affected valve functions in Component Activation. Does each valve in question turn on?",
                [
                    {"id": "valves_run", "label": "Valves operate", "when": {"kind": "checkpoint_yes"}, "nextStepId": "valves_verified"},
                    {"id": "valves_no_run", "label": "Ohms OK but valve does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_valves", "terminal": True, "oemOutcome": "Coils in range but no run — replace main control."},
                ],
            ),
            outcome("replace_valve", 7, "Replace valve assembly", "Replace water valve assembly when coil tens of ohms outside 890–1090 Ω."),
            outcome("valves_verified", 8, "Valves verified", "Valve resistance and Component Activation operation verified."),
            outcome("replace_acu_valves", 9, "Replace ACU", "Replace main control and verify with Service Diagnostics."),
        ],
    ),
    proc(
        "w11416787-test-03-drive-system",
        "TEST #3: Drive System (pre-test)",
        "3",
        "Drive System",
        [56],
        ["drive_motor"],
        ["motor_check", "F7E3", "F7E4", "F7E6", "F7E7", "F7E8", "F7E9", "F7EA"],
        [
            instr(
                "enter_service_diag",
                2,
                "Enter Service Mode and clear codes",
                "Activate Service Mode. Retrieve and clear F7E3, F7E4, F7E6, F7E7, F7E8, F7E9, F7EA if present.",
                "slow_agitate_test",
            ),
            visual(
                "slow_agitate_test",
                3,
                "Slow Agitate in Component Activation",
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
                "Run Spin Low Speed in Component Activation. If motor hums briefly then stops, check fault code display.",
                [
                    {"id": "spin_ok", "label": "Spin OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "drive_verified"},
                    {"id": "spin_fail", "label": "Spin fails or hums out", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_shifter_motor"},
                ],
            ),
            instr(
                "route_shifter_motor",
                5,
                "Continue to shifter or motor test",
                "Shifter-related (F7E3/F7E4) → TEST #3a Shifter. Motor circuit (F7E6–F7EA) → TEST #3b Motor.",
                "drive_deferred",
            ),
            outcome("drive_verified", 6, "Drive system OK", "Slow Agitate and Spin Low pass in Component Activation — no further drive diagnosis needed."),
            outcome("drive_deferred", 7, "Run TEST #3a or #3b", "Proceed to w11416787-test-03a-shifter or w11416787-test-03b-motor per fault code."),
        ],
    ),
    proc(
        "w11416787-test-03a-shifter",
        "TEST #3a: Drive System — Shifter",
        "3a",
        "Drive System - Shifter",
        [56, 57],
        ["drive_motor"],
        ["shifter_check", "F7E3", "F7E4", "agitate_issue", "spin_issue"],
        [
            visual(
                "shifter_component_test",
                2,
                "Spin and Agitate in Component Activation",
                "Lid closed and locked. Run Spin and Agitate under Component Activation. Did shifter engage for both?",
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
                    {"id": "free_yes", "label": "Turn freely / independently", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j3"},
                    {"id": "free_no", "label": "Locked together or bound", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_drive_slider", "terminal": True, "oemOutcome": "Replace drive — slider binds or motor/shifter locked."},
                ],
            ),
            visual("check_j3", 4, "J3 fully seated", "Verify J3 inserted fully at ACU.", [
                {"id": "j3_ok", "label": "J3 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "shifter_voltage"},
                {"id": "j3_bad", "label": "J3 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j3"},
            ]),
            instr("reseat_j3", 5, "Reseat J3 and retest", "Reconnect J3 and repeat Component Activation Spin/Agitate.", "shifter_component_test"),
            instr(
                "shifter_voltage",
                6,
                "Live shifter voltage check",
                "Restore power. AC volts J15-1 (Neutral) to J15-4 (Shifter). Command shifter ON/OFF in Component Activation (motor stopped). Expect 120 VAC.",
                "shifter_vac_present",
            ),
            visual(
                "shifter_vac_present",
                7,
                "120 VAC at shifter when commanded",
                "Is 120 VAC present at J15-1 to J15-4 when shifter commanded?",
                [
                    {"id": "vac_yes", "label": "120 VAC present", "when": {"kind": "checkpoint_yes"}, "nextStepId": "harness_continuity"},
                    {"id": "vac_no", "label": "No voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_shifter"},
                ],
            ),
            visual(
                "harness_continuity",
                8,
                "Shifter harness continuity",
                "Power off. Tilt washer. Continuity J15-1 (White) to shifter pin 3 and J15-4 (Orange) to shifter pin 1?",
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
            outcome("shifter_verified", 10, "Shifter verified", "Spin and Agitate Component Activation tests pass."),
            outcome("replace_lower_harness", 11, "Replace lower harness", "Restore harness continuity and retest."),
            outcome("replace_drive_slider", 12, "Replace drive", "Replace drive assembly for slider or bind fault."),
            outcome("replace_acu_shifter", 13, "Replace ACU", "Shifter/mechanical OK but ACU does not drive shifter — replace main control."),
        ],
    ),
    proc(
        "w11416787-test-03b-motor",
        "TEST #3b: Drive System — Motor",
        "3b",
        "Drive System - Motor",
        [57],
        ["drive_motor"],
        ["motor_check", "F1E2", "F7E3", "F7E4", "F7E6", "F7E7", "F7E8", "F7E9", "F7EA"],
        [
            visual(
                "motor_spin_tests",
                2,
                "Low/Mid/High spin in Component Activation",
                "Component Activation active. Run Low, Mid, and High Speed Spin tests. Did any speed run?",
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
                    {"id": "imp_free", "label": "Turns freely", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_j3_motor"},
                    {"id": "imp_bind", "label": "Does not turn freely", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_friction", "terminal": True, "oemOutcome": "Resolve mechanical friction or lockup before motor replacement."},
                ],
            ),
            visual("check_j3_motor", 4, "J3 fully seated at ACU", "Verify J3 fully inserted.", [
                {"id": "j3m_ok", "label": "J3 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "j3_motor_ohms"},
                {"id": "j3m_bad", "label": "J3 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j3_motor"},
            ]),
            instr("reseat_j3_motor", 5, "Reseat J3 and retest", "Reconnect J3 and repeat Component Activation spin.", "motor_spin_tests"),
            meas(
                "j3_motor_ohms",
                6,
                "Motor resistance at J3",
                "Ohms J3 1-2 and 1-3. Each expect 8–10 Ω. Much higher than 10 or less than 8 → motor/drive path.",
                "whirlpoolTlDd5100WasherMotorOhms",
                "J3",
                "1-2 & 1-3",
                ohm_branches("j3", "motor_harness_cont", "replace_drive_motor", "8–10 Ω"),
                pin_details=PIN_J3_MOTOR,
            ),
            visual(
                "motor_harness_cont",
                7,
                "Motor harness continuity J3 to drive",
                "Tilt washer. Continuity all J3 pins to drive motor connector?",
                [
                    {"id": "mh_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_connector_ohms"},
                    {"id": "mh_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_motor", "terminal": True, "oemOutcome": "Replace lower washer harness."},
                ],
            ),
            meas(
                "motor_connector_ohms",
                8,
                "Motor resistance at drive connector",
                "Disconnect motor connector at drive. Measure 2-4 (R-BR) and 2-3 (BR-BK). Expect 8–10 Ω each.",
                "whirlpoolTlDd5100WasherMotorOhms",
                "Drive motor",
                "2-4 & 2-3",
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
            instr("seat_cover", 10, "Seat motor connection cover", "Fully seat cover, reassemble, and repeat Component Activation spin.", "motor_spin_tests"),
            instr("reconnect_motor_power", 11, "Reconnect motor and restore power", "Reconnect motor harness. Reassemble. Restore power for Component Activation spin.", "live_test_motor_spin"),
            visual(
                "live_test_motor_spin",
                12,
                "Motor runs in Component Activation",
                "Command Low/Mid/High spin in Component Activation. Does motor run at commanded speed?",
                [
                    {"id": "motor_runs", "label": "Motor runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_verified"},
                    {"id": "motor_no_run", "label": "Does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_motor", "terminal": True, "oemOutcome": "Motor ohms OK but no run — replace ACU."},
                ],
            ),
            outcome("clear_friction", 13, "Clear mechanical friction", "Remove obstruction between basket/tub/impeller."),
            outcome("replace_lower_harness_motor", 14, "Replace lower harness", "Restore motor circuit continuity."),
            outcome("replace_drive_motor", 15, "Replace drive", "Motor windings open or out of range — replace drive assembly."),
            outcome("motor_verified", 16, "Motor verified", "Motor resistance and Component Activation rotation verified."),
            outcome("replace_acu_motor", 17, "Replace ACU", "Replace main control when motor and harness test good but no run."),
        ],
    ),
    proc(
        "w11416787-test-04-hmi",
        "TEST #4: HMI",
        "4",
        "HMI",
        [57],
        ["hmi_control"],
        ["hmi_check", "F2E1", "F2E2"],
        [
            visual(
                "hmi_service_test",
                2,
                "HMI Test in Service Diagnostics",
                "In Service Diagnostics, run HMI Test (Key, LED, Display, Audio, Encoder). Do keys, LEDs, display, audio, and encoder behave per screen prompts?",
                [
                    {"id": "hmi_ok", "label": "All HMI tests pass", "when": {"kind": "checkpoint_yes"}, "nextStepId": "hmi_verified"},
                    {"id": "hmi_fail", "label": "Key, LED, display, audio, or encoder failure", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j14_hmi"},
                ],
            ),
            visual(
                "check_j14_hmi",
                3,
                "J14 and HMI harness seated",
                "Power off. J14 fully seated at ACU; HMI harness connector fully seated on HMI J1. Ribbon cables connected both ends.",
                [
                    {"id": "conn_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "hmi_harness_cont"},
                    {"id": "conn_bad", "label": "Loose connector", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_connectors"},
                ],
            ),
            visual(
                "hmi_harness_cont",
                4,
                "HMI harness continuity J14 to HMI J1",
                "Continuity J14-1↔HMI J1-1 (Red), J14-3↔J1-3 (Yellow), J14-4↔J1-4 (Black)?",
                [
                    {"id": "uh_ok", "label": "Continuity passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_acu_supply"},
                    {"id": "uh_fail", "label": "Continuity fails", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_ui_harness"},
                ],
            ),
            instr("check_acu_supply", 5, "Verify ACU supply", "Run TEST #1 Main Control supply checks.", "retest_hmi"),
            instr("retest_hmi", 6, "Retest HMI in Service Diagnostics", "Reassemble, restore power, enter Service Mode, rerun HMI Test.", "replace_ui"),
            outcome("repair_connectors", 7, "Repair connections", "Reseat harness connectors and retest."),
            outcome("replace_ui_harness", 8, "Replace HMI harness", "Replace HMI harness when continuity fails."),
            outcome("replace_ui", 9, "Replace user interface", "Replace UI when harness continuity passes but HMI test fails."),
            outcome("hmi_verified", 10, "HMI verified", "Keys, LEDs, display, audio, and encoder verified in Service Diagnostics."),
        ],
    ),
    proc(
        "w11416787-test-05-temp-thermistor",
        "TEST #5: Temperature Thermistor",
        "5",
        "Temperature Thermistor",
        [58],
        ["wash_ntc"],
        ["thermistor_check", "F3E3", "temp_fault"],
        [
            instr(
                "therm_sensor_feedback",
                2,
                "Inlet Thermistor Sensor Feedback",
                "In Service Diagnostics Sensor Feedback, run Inlet Thermistor test. Cold valve opens (temp drops), then hot (temp rises).",
                "disconnect_j16_therm",
            ),
            instr("disconnect_j16_therm", 3, "Disconnect J16", "If sensor feedback fails: power off, remove J16 from ACU.", "therm_ohms"),
            meas(
                "therm_ohms",
                4,
                "Inlet thermistor J16-4 to J16-8",
                "Measure resistance at ambient. Compare to OEM R/T table (~50 kΩ @ 77°F / 25°C).",
                "whirlpoolTlDd5100WasherInletThermistorOhms",
                "J16",
                "4 & 8",
                [
                    {"id": "therm_ok", "label": "In R/T table range", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_acu_therm"},
                    {"id": "therm_bad", "label": "Open or out of range", "when": {"kind": "measurement_open"}, "nextStepId": "replace_valve_therm", "terminal": True, "oemOutcome": "Replace valve assembly (thermistor integral)."},
                    {"id": "therm_crit", "label": "Short/critical", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_valve_therm", "terminal": True, "oemOutcome": "Replace valve assembly."},
                ],
                pin_details=PIN_J16_THERM,
            ),
            outcome("replace_valve_therm", 5, "Replace valve assembly", "Thermistor open/short — valve assembly includes thermistor."),
            outcome("replace_acu_therm", 6, "Replace ACU", "Thermistor good — replace main control and rerun Sensor Feedback test."),
        ],
    ),
    proc(
        "w11416787-test-06-water-level",
        "TEST #6: Water Level",
        "6",
        "Water Level",
        [58],
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
        "w11416787-test-07-drain-recirc-pump",
        "TEST #7: Drain & Recirculation Pump",
        "7",
        "Drain & Recirculation Pump",
        [59],
        ["drain_pump"],
        ["pump_check", "drain_issue", "F9E1", "dr", "drn"],
        [
            instr("clear_obstructions", 2, "Clear drain path obstructions", "Check tub sump, hose, and filter areas. Then test drain/recirc in Component Activation.", "component_test_pumps"),
            visual(
                "component_test_pumps",
                3,
                "Drain/recirc run in Component Activation",
                "Command drain pump (and recirc if equipped) in Component Activation. Do they run?",
                [
                    {"id": "pump_live_fail", "label": "Does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j15_pump"},
                    {"id": "pump_live_ok", "label": "Runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pumps_verified"},
                ],
            ),
            visual("check_j15_pump", 4, "J15 fully seated", "Power off. J15 fully inserted at ACU?", [
                {"id": "j15p_ok", "label": "J15 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "j15_pump_ohms"},
                {"id": "j15p_bad", "label": "J15 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j15_pump"},
            ]),
            instr("reseat_j15_pump", 5, "Reseat J15 and retest", "Reconnect J15 and repeat Component Activation pump run.", "component_test_pumps"),
            meas(
                "j15_pump_ohms",
                6,
                "Drain pump resistance J15-1 to J15-2",
                "Disconnect J15. Drain J15-1↔2 expect 17.8–21.8 Ω.",
                "whirlpoolTlDd5100WasherDrainPumpOhms",
                "J15",
                "1 & 2",
                ohm_branches("drain_j15", "recirc_j15_optional", "pump_obstruction", "17.8–21.8 Ω drain"),
                pin_details=PIN_J15,
            ),
            meas(
                "recirc_j15_optional",
                7,
                "Recirc pump J15-1 to J15-3 (if equipped)",
                "If model has recirc pump, measure 26–32 Ω. Skip if not equipped.",
                "whirlpoolTlDd5100WasherRecircPumpOhms",
                "J15",
                "1 & 3",
                ohm_branches("recirc_j15", "harness_pump_cont", "pump_obstruction", "26–32 Ω"),
                pin_details=PIN_J15,
            ),
            visual(
                "harness_pump_cont",
                8,
                "Pump harness continuity",
                "Tilt washer. Continuity drain pump pins to J15-1/J15-2 and recirc to J15-1/J15-3?",
                [
                    {"id": "ph_ok", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_terminal_ohms"},
                    {"id": "ph_open", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_pump"},
                ],
            ),
            meas(
                "pump_terminal_ohms",
                9,
                "Resistance at pump motor terminals",
                "At pump: drain 17.8–21.8 Ω; recirc 26–32 Ω.",
                "whirlpoolTlDd5100WasherDrainPumpOhms",
                "Drain pump",
                "1 & 3",
                ohm_branches("drain_pump", "reconnect_pump_power", "replace_drain_pump", "17.8–21.8 Ω"),
            ),
            instr("reconnect_pump_power", 10, "Reconnect pumps and restore power", "Reconnect J15 and pump harnesses. Restore power for Component Activation drain.", "live_test_drain_pump"),
            visual(
                "live_test_drain_pump",
                11,
                "Drain pump runs in Component Activation",
                "Toggle drain pump in Component Activation. Does pump run and evacuate water?",
                [
                    {"id": "dp_run", "label": "Pump runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pumps_verified"},
                    {"id": "dp_no_run", "label": "Ohms OK but no run", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_pump"},
                ],
            ),
            outcome("pump_obstruction", 12, "Clear pump obstruction", "Tilt washer, verify pump free, clear obstructions."),
            outcome("replace_lower_harness_pump", 13, "Replace lower harness", "Restore pump circuit continuity."),
            outcome("replace_drain_pump", 14, "Replace drain pump", "Pump motor open or out of range at terminals."),
            outcome("pumps_verified", 15, "Pumps verified", "Drain/recirc resistance and Component Activation run verified."),
            outcome("replace_acu_pump", 16, "Replace ACU", "Pump good but no run — replace main control."),
        ],
    ),
    proc(
        "w11416787-test-08-lid-lock",
        "TEST #8: Lid Lock",
        "8",
        "Lid Lock",
        [59],
        ["door_lock"],
        ["lid_lock", "door_lock_check", "F5E1", "F5E3", "F5E4"],
        [
            visual(
                "lid_lock_load_control",
                2,
                "Lid Lock Service Load Control test",
                "In Service Load Control, run Lid Lock test. Does lock cycle lock and unlock?",
                [
                    {"id": "ll_fail", "label": "Unsuccessful", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_j6"},
                    {"id": "ll_ok", "label": "Lock cycles OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_verified"},
                ],
            ),
            visual("check_j6", 3, "J6 fully seated", "Power off. J6 fully inserted at ACU?", [
                {"id": "j6_ok", "label": "J6 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lid_lock_ohms"},
                {"id": "j6_bad", "label": "J6 loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "reseat_j6"},
            ]),
            instr("reseat_j6", 4, "Reseat J6 and retest", "Reconnect J6 and repeat Lid Lock Load Control test.", "lid_lock_load_control"),
            meas(
                "lid_lock_ohms",
                5,
                "Lid lock solenoid J6-2 to J6-3",
                "Remove J6. Lock solenoid expect 50–160 Ω. Lock switch J6-1↔2: locked=0 Ω, unlocked=open. Lid switch J6-2↔1: open=open circuit, closed=open circuit per table.",
                "whirlpoolTlDd5100WasherLidLockSolenoidOhms",
                "J6",
                "2 & 3",
                ohm_branches("lock_solenoid", "switch_states", "replace_lid_lock", "50–160 Ω"),
                pin_details=PIN_J6_LOCK,
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
    proc(
        "w11416787-test-09-load-and-go",
        "TEST #9: Load & Go Detergent",
        "9",
        "Load & Go Detergent",
        [60],
        ["bulk_level_switch"],
        ["bulk_dispense", "F3E5", "dispenser_check"],
        [
            instr(
                "bulk_sensor_feedback",
                2,
                "Bulk sensor Sensor Feedback",
                "In Service Mode Sensor Feedback, run Detergent Level cycle with drawer fully inserted. Screen shows detergent level percentage.",
                "bulk_pump_activation",
            ),
            visual(
                "bulk_sensor_voltage",
                3,
                "Bulk sensor J9 voltage checks",
                "Power on at console. Input J9-1↔4 expect 4.75–15.25 VDC. Analog output J9-2↔4 expect 1.4–3.10 VDC. J9 fully seated?",
                [
                    {"id": "sensor_v_ok", "label": "Voltages in range", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bulk_pump_activation"},
                    {"id": "input_v_bad", "label": "Input voltage out of range", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_bulk", "terminal": True, "oemOutcome": "Input voltage out of range — replace main control."},
                    {"id": "output_v_bad", "label": "Analog output out of range", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_bulk_sensor", "terminal": True, "oemOutcome": "Replace bulk sensor component."},
                ],
            ),
            instr(
                "bulk_pump_activation",
                4,
                "Bulk pump Component Activation",
                "In Component Activation, run Detergent Pump cycle. Detergent should dispense into basket.",
                "check_j17",
            ),
            visual(
                "check_j17",
                5,
                "J17 and extension harness",
                "Power off. J17 secure at ACU. Bulk pump extension harness connected through top?",
                [
                    {"id": "j17_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bulk_pump_ohms"},
                    {"id": "j17_bad", "label": "Loose or missing harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_bulk_harness"},
                ],
            ),
            meas(
                "bulk_pump_ohms",
                6,
                "Bulk pump resistance J17-2 to J17-3",
                "Disconnect J17. Measure resistance — expect 16–19 Ω.",
                "whirlpoolTlDd5100WasherBulkPumpOhms",
                "J17",
                "2 & 3",
                ohm_branches("bulk", "reconnect_bulk_power", "replace_bulk_pump", "16–19 Ω"),
            ),
            instr("reconnect_bulk_power", 7, "Reassemble and restore power", "Reconnect harnesses and panels. Restore power.", "live_test_bulk_pump"),
            visual(
                "live_test_bulk_pump",
                8,
                "Bulk pump runs in Component Activation",
                "Run Detergent Pump in Component Activation. Does detergent dispense?",
                [
                    {"id": "bulk_run", "label": "Detergent dispenses", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bulk_verified"},
                    {"id": "bulk_no_run", "label": "No dispense", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_bulk"},
                ],
            ),
            outcome("repair_bulk_harness", 9, "Repair bulk harness", "Connect or repair bulk pump extension harness."),
            outcome("replace_bulk_sensor", 10, "Replace bulk sensor", "Analog output voltage out of range — replace bulk sensor."),
            outcome("replace_bulk_pump", 11, "Replace bulk pump", "Pump resistance out of range — replace bulk dispense pump."),
            outcome("replace_acu_bulk", 12, "Replace ACU", "Pump and sensor good but no dispense — replace main control."),
            outcome("bulk_verified", 13, "Load & Go verified", "Bulk sensor, pump, and Component Activation dispense verified."),
        ],
    ),
]

PROCEDURE_FILES = [
    "w11416787-test-01-acu-power.json",
    "w11416787-test-02-valves.json",
    "w11416787-test-03-drive-system.json",
    "w11416787-test-03a-shifter.json",
    "w11416787-test-03b-motor.json",
    "w11416787-test-04-hmi.json",
    "w11416787-test-05-temp-thermistor.json",
    "w11416787-test-06-water-level.json",
    "w11416787-test-07-drain-recirc-pump.json",
    "w11416787-test-08-lid-lock.json",
    "w11416787-test-09-load-and-go.json",
]


def service_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11416787-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11416787",
        "title": "W11416787 — Service Mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console"],
        "description": "Three-button Service Mode entry (any buttons except POWER) × 3 rounds within 8 seconds; LCD shows service technician text.",
        "tags": ["service_diagnostic", "live_test"],
        "entryStepId": "service_diagnostic_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [20, 21],
        },
        "steps": [
            {
                "id": "service_diagnostic_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Service Mode",
                "body": (
                    "Washer in standby (plugged in, all indicators off). Choose any three buttons except POWER "
                    "and remember their order. Within 8 seconds: press and release button 1, then 2, then 3 — "
                    "repeat that same 3-button sequence two more times (3 rounds total). Success: LCD displays "
                    "\"This area is for Service Technicians only\" with navigational instructions. "
                    "Navigate Select/Enter to reach Service Diagnostics, Component Activation, and Sensor Feedback."
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


def component_activation_bundle() -> dict:
    return {
        "id": "w11416787-component-activation",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11416787",
        "title": "W11416787 — Component Activation",
        "modeKind": "component_activation",
        "uiVariants": ["console"],
        "description": "Navigate Service Mode → Service Diagnostics → Component Activation to toggle valves, pumps, motor, shifter, and bulk pump.",
        "tags": ["component_activation", "live_test", "service_diagnostic"],
        "entryStepId": "component_activation_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [21, 22],
        },
        "steps": [
            {
                "id": "component_activation_entry",
                "order": 1,
                "type": "instruction",
                "title": "Open Component Activation",
                "body": (
                    "With Service Mode active, use Left/Right keys to navigate and Select/Enter to open "
                    "Service Diagnostics, then select Component Activation. Use Select/Enter to toggle each "
                    "load on/off (valves, drain/recirc pumps, motor spin/agitate speeds, shifter, detergent pump). "
                    "Opening the lid during activation stops the action — press Back/Return to return to "
                    "Component Activation. Faults may record in Fault History even if not displayed."
                ),
                "sourceExcerpt": (
                    "Navigate to this screen through Service Mode and Service Diagnostics Mode. "
                    "Use the Component Activation Mode to selectively turn on individual components."
                ),
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


BUNDLES = [service_diagnostic_entry_bundle(), component_activation_bundle()]
BUNDLE_FILES = [
    "w11416787-service-diagnostic-entry.json",
    "w11416787-component-activation.json",
]


def write_catalog() -> None:
    catalog = {
        "manualId": "W11416787",
        "platformId": PLATFORM,
        "templateId": "washer",
        "label": "Whirlpool/Maytag 4.7/5.3 cu ft direct-drive top-load washer (WTW51/MVW51)",
        "notes": "TEST #1–9 (+3a shifter / 3b motor). Service Mode: 3 buttons × 3 within 8 sec; Component Activation via Service Diagnostics.",
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
    readme = """# whirlpool_tl_dd_5100 — W11416787 procedure seeds

**Manual:** Whirlpool & Maytag 4.7/5.3 cu ft Top Load Washer (W11416787 Rev C, direct drive)  
**Platform:** `whirlpool_tl_dd_5100` — models `WTW51*`, `MVW51*` (Whirlpool/Maytag DD)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11416787_TL_WASHER_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11416787
```

## Procedures (11)

| ID | OEM | Notes |
|----|-----|-------|
| w11416787-test-01-acu-power | TEST #1 | J1 line, diagnostic LED, J14 +12.7 VDC |
| w11416787-test-02-valves | TEST #2 | J16 valves 890–1090 Ω |
| w11416787-test-03-drive-system | TEST #3 | Component Activation pre-check |
| w11416787-test-03a-shifter | TEST #3a | Shifter J15-1↔4, slider on drive |
| w11416787-test-03b-motor | TEST #3b | BPM motor J3 8–10 Ω |
| w11416787-test-04-hmi | TEST #4 | HMI Test; J14 harness to HMI J1 |
| w11416787-test-05-temp-thermistor | TEST #5 | Inlet NTC J16-4↔8 |
| w11416787-test-06-water-level | TEST #6 | Pressure hose / Sensor Feedback |
| w11416787-test-07-drain-recirc-pump | TEST #7 | J15 drain 17.8–21.8 / recirc 26–32 Ω |
| w11416787-test-08-lid-lock | TEST #8 | J6 solenoid 50–160 Ω |
| w11416787-test-09-load-and-go | TEST #9 | Bulk sensor J9 VDC; pump J17 16–19 Ω |

## Bundles (2)

- `w11416787-service-diagnostic-entry` — LCD 3-button Service Mode entry
- `w11416787-component-activation` — Service Diagnostics → Component Activation

## WO smoke

Whirlpool `WTW5100` → `whirlpool_tl_dd_5100`; F5E3 → `w11416787-test-08-lid-lock`; F3E5 → `w11416787-test-09-load-and-go`
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
