#!/usr/bin/env python3
"""Generate W10322959 (Whirlpool Jazz French door refrigerator) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_jazz_french_door"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_jazz_french_door"

SOURCE = {
    "manualId": "W10322959",
    "manualTitle": "Whirlpool Jazz French Door Refrigerator (W10322959B, 19–22 cu ft)",
    "extractedTextFile": "backend/docs/manuals/techsheet-w10322959-revb whirlpool FD fridge 2013-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the refrigerator or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Disconnect power before servicing. Replace all parts and panels before operating.",
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


def ohm_branches(prefix, pass_next, fail_next, pass_label="In range"):
    return [
        {"id": f"{prefix}_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


def select_test_step(test_num: str, test_name: str, next_id: str) -> dict:
    return instr(
        f"select_test_{test_num}",
        2,
        f"Select Service Test {test_num}",
        (
            f"In Service Test Mode (S-E), use Freezer UP/DOWN keys until freezer display shows {test_num}. "
            f"Refrigerator display blank until test is activated."
        ),
        next_id,
        f"Service Test {test_num} — {test_name}",
    )


PROCEDURES = [
    proc(
        "w10322959-test-01-defrost",
        "Service Test 1: Defrost thermostat & heater",
        "1",
        "Defrost Thermostat & Defrost Circuit Test",
        [1],
        ["defrost_heater", "defrost_thermostat"],
        ["frost_buildup", "defrost_heater", "defrost_thermostat", "no_defrost"],
        [
            select_test_step("1", "Defrost thermostat & heater", "activate_defrost_test"),
            instr(
                "activate_defrost_test",
                3,
                "Activate test 1",
                "Press Refrigerator UP to activate. Defrost heater energizes. Observe heat and thermostat state on display.",
                "bimetal_display",
                "Press Refrigerator Temperature UP /+ key to activate test.",
            ),
            visual(
                "bimetal_display",
                4,
                "Defrost thermostat display",
                "Freezer shows 1. Refrigerator shows O (thermostat open) or S (shorted/closed). Does display match expected state for evaporator temperature?",
                [
                    {"id": "bimetal_ok", "label": "Display matches expected state", "when": {"kind": "checkpoint_yes"}, "nextStepId": "deactivate_test_1"},
                    {"id": "bimetal_bad", "label": "Unexpected state or no heat", "when": {"kind": "checkpoint_no"}, "nextStepId": "deactivate_test_1"},
                ],
            ),
            instr(
                "deactivate_test_1",
                5,
                "Deactivate test 1",
                "Press Refrigerator UP to deactivate test before leaving test 1. Test must be OFF to select another test.",
                "power_off_heater_ohms",
            ),
            instr(
                "power_off_heater_ohms",
                6,
                "Disconnect power for ohms",
                "Unplug refrigerator for resistance checks on defrost heater and bimetal.",
                "heater_ohms",
            ),
            meas(
                "heater_ohms",
                7,
                "Defrost heater resistance",
                "Measure defrost heater — 19 cu 33 Ω, 22 cu 30 Ω, 20/25 cu 28 Ω @ 115 VAC.",
                "whirlpoolJazzFdDefrostHeaterOhms",
                "heater",
                "terminals",
                ohm_branches("heater", "bimetal_ohms", "replace_heater", "28–33 Ω"),
            ),
            meas(
                "bimetal_ohms",
                8,
                "Defrost thermostat (bimetal) resistance",
                "Closed above 42°F (few Ω); open below 12°F (OL). Must be closed when evaporator frosted.",
                "whirlpoolJazzFdDefrostBimetalOhms",
                "bimetal",
                "terminals",
                ohm_branches("bimetal", "defrost_ok", "replace_bimetal", "Closed (few Ω)"),
            ),
            outcome("replace_heater", 9, "Replace defrost heater", "Replace evaporator heater when open or out of spec."),
            outcome("replace_bimetal", 10, "Replace defrost thermostat", "Replace defrost bimetal when open at frosted evaporator or stuck closed."),
            outcome("defrost_ok", 11, "Defrost circuit verified", "Service test 1, heater ohms, and bimetal verified."),
        ],
    ),
    proc(
        "w10322959-test-02-compressor",
        "Service Test 2: Compressor & condenser fan",
        "2",
        "Compressor/Condenser Fan Test",
        [1],
        ["compressor", "condenser_fan"],
        ["not_cooling", "compressor_check", "condenser_fan", "sealed_system"],
        [
            select_test_step("2", "Compressor/condenser fan", "activate_comp_test"),
            instr(
                "activate_comp_test",
                3,
                "Activate test 2",
                "Press Refrigerator UP to toggle compressor/condenser fan ON (O) or OFF (F). Freezer displays 2.",
                "comp_runs",
            ),
            visual(
                "comp_runs",
                4,
                "Compressor and condenser fan run",
                "With test activated ON (refrigerator O), do compressor and condenser fan operate normally?",
                cp_yes_no("comp_ok", "deactivate_test_2", "comp_fail", "bench_compressor", "Compressor or condenser fan does not run — bench test windings and start device."),
            ),
            instr(
                "deactivate_test_2",
                5,
                "Deactivate test 2",
                "Toggle to OFF (F) before selecting another test.",
                "comp_verified",
            ),
            instr(
                "bench_compressor",
                6,
                "Disconnect power for compressor ohms",
                "Unplug unit. Access compressor terminals and relay/capacitor.",
                "run_winding_ohms",
            ),
            meas(
                "run_winding_ohms",
                7,
                "Compressor run winding (EM2Y60)",
                "Run winding 4.75 Ω ±8% between run and common.",
                "whirlpoolJazzFdCompressorRunOhms",
                "compressor",
                "run ↔ common",
                ohm_branches("run", "start_winding_ohms", "replace_compressor", "4.75 Ω ±8%"),
            ),
            meas(
                "start_winding_ohms",
                8,
                "Compressor start winding",
                "Start winding 6.1 Ω ±8% @ 77°F. Run capacitor 12 µfd ±10%.",
                "whirlpoolJazzFdCompressorStartOhms",
                "compressor",
                "start ↔ common",
                ohm_branches("start", "check_relay_cap", "replace_compressor", "6.1 Ω ±8%"),
            ),
            instr(
                "check_relay_cap",
                9,
                "Check relay and run capacitor",
                "Verify TSD2/5sP overload/relay and 12 µfd run capacitor. LRA 10.8 A; FLA 1.60 A per spec.",
                "comp_verified",
            ),
            outcome("replace_compressor", 10, "Replace compressor or start device", "Replace compressor, relay, or run capacitor when windings or start path failed."),
            outcome("comp_verified", 11, "Compressor path verified", "Service test 2 and compressor circuit verified."),
        ],
    ),
    proc(
        "w10322959-test-03-evap-fan",
        "Service Test 3: Evaporator / freezer fan",
        "3",
        "Evaporator/Freezer Fan Test",
        [1],
        ["evap_fan"],
        ["frost_buildup", "evap_fan", "airflow", "not_cooling"],
        [
            select_test_step("3", "Evaporator/freezer fan", "activate_fan_test"),
            instr(
                "activate_fan_test",
                3,
                "Activate test 3",
                "Press Refrigerator UP to toggle freezer fan ON (O) or OFF (F). Freezer displays 3.",
                "fan_runs",
            ),
            visual(
                "fan_runs",
                4,
                "Evaporator fan operation",
                "Inspect evaporator/freezer fan for proper rotation and airflow. Blade fully seated on shaft (2800 RPM spec).",
                cp_yes_no("fan_ok", "deactivate_test_3", "replace_fan", "replace_fan_out", "Replace evaporator fan motor or repair harness."),
            ),
            instr(
                "deactivate_test_3",
                5,
                "Deactivate test 3",
                "Toggle fan OFF (F) before leaving test 3.",
                "fan_verified",
            ),
            outcome("replace_fan_out", 6, "Replace evaporator fan", "Replace freezer fan motor when it does not run in service test 3."),
            outcome("fan_verified", 7, "Evaporator fan verified", "Freezer fan operates correctly in service test 3."),
        ],
    ),
    proc(
        "w10322959-test-04-ff-thermistor",
        "Service Test 4: Fresh food thermistor",
        "4",
        "Fresh Food Thermistor Test",
        [1],
        ["thermistor"],
        ["thermistor_check", "weak_cooling_ff", "sensor_fault"],
        [
            select_test_step("4", "Fresh food thermistor", "activate_ff_ntc"),
            instr(
                "activate_ff_ntc",
                3,
                "Activate test 4",
                "Press Refrigerator UP to run FF thermistor circuit test. Freezer displays 4.",
                "ff_ntc_result",
            ),
            visual(
                "ff_ntc_result",
                4,
                "FF thermistor service test result",
                "Refrigerator display: P=Pass, O=Open, S=Short. What does the display show?",
                [
                    {"id": "ff_pass", "label": "P (Pass)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "deactivate_test_4"},
                    {"id": "ff_open", "label": "O (Open)", "when": {"kind": "checkpoint_no"}, "nextStepId": "deactivate_test_4"},
                    {"id": "ff_short", "label": "S (Short)", "when": {"kind": "checkpoint_no"}, "nextStepId": "deactivate_test_4"},
                ],
            ),
            instr(
                "deactivate_test_4",
                5,
                "Deactivate test 4",
                "Deactivate test before selecting another test number.",
                "bench_ff_ntc",
            ),
            instr(
                "bench_ff_ntc",
                6,
                "Bench FF thermistor ohms",
                "Disconnect power. Measure fresh food thermistor — 10 kΩ @ 77°F; 29.5 kΩ @ 36°F; 86.3 kΩ @ 0°F.",
                "ff_ntc_ohms",
            ),
            meas(
                "ff_ntc_ohms",
                7,
                "Fresh food thermistor resistance",
                "Measure at control harness or sensor — 10,000 Ω ±1.8% @ 77°F.",
                "whirlpoolJazzFdThermistorOhms",
                "FF NTC",
                "sensor ↔ ground",
                ohm_branches("ff_ntc", "ff_ntc_ok", "replace_ff_ntc", "~10 kΩ @ 77°F"),
            ),
            outcome("replace_ff_ntc", 8, "Replace FF thermistor", "Replace fresh food thermistor or repair harness when open, short, or out of range."),
            outcome("ff_ntc_ok", 9, "FF thermistor verified", "Service test 4 and bench ohms verified for fresh food thermistor."),
        ],
    ),
    proc(
        "w10322959-test-05-fz-thermistor",
        "Service Test 5: Freezer thermistor",
        "5",
        "Freezer Thermistor Test",
        [1],
        ["thermistor"],
        ["thermistor_check", "not_cooling", "sensor_fault"],
        [
            select_test_step("5", "Freezer thermistor", "activate_fz_ntc"),
            instr(
                "activate_fz_ntc",
                3,
                "Activate test 5",
                "Press Refrigerator UP to run FZ thermistor circuit test. Freezer displays 5.",
                "fz_ntc_result",
            ),
            visual(
                "fz_ntc_result",
                4,
                "FZ thermistor service test result",
                "Refrigerator display: P=Pass, O=Open, S=Short. What does the display show?",
                [
                    {"id": "fz_pass", "label": "P (Pass)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "deactivate_test_5"},
                    {"id": "fz_open", "label": "O (Open)", "when": {"kind": "checkpoint_no"}, "nextStepId": "deactivate_test_5"},
                    {"id": "fz_short", "label": "S (Short)", "when": {"kind": "checkpoint_no"}, "nextStepId": "deactivate_test_5"},
                ],
            ),
            instr(
                "deactivate_test_5",
                5,
                "Deactivate test 5",
                "Deactivate test before selecting another test number.",
                "bench_fz_ntc",
            ),
            instr(
                "bench_fz_ntc",
                6,
                "Bench FZ thermistor ohms",
                "Disconnect power. Measure freezer thermistor — same R/T table as FF (10 kΩ @ 77°F).",
                "fz_ntc_ohms",
            ),
            meas(
                "fz_ntc_ohms",
                7,
                "Freezer thermistor resistance",
                "Measure at control harness or sensor — 10,000 Ω ±1.8% @ 77°F.",
                "whirlpoolJazzFdThermistorOhms",
                "FZ NTC",
                "sensor ↔ ground",
                ohm_branches("fz_ntc", "fz_ntc_ok", "replace_fz_ntc", "~10 kΩ @ 77°F"),
            ),
            outcome("replace_fz_ntc", 8, "Replace FZ thermistor", "Replace freezer thermistor or repair harness when open, short, or out of range."),
            outcome("fz_ntc_ok", 9, "FZ thermistor verified", "Service test 5 and bench ohms verified for freezer thermistor."),
        ],
    ),
    proc(
        "w10322959-test-06-damper",
        "Service Test 6: Fresh food damper",
        "6",
        "Open Damper Test",
        [1],
        ["damper_motor"],
        ["damper_check", "weak_cooling_ff", "airflow"],
        [
            select_test_step("6", "Damper open/close", "activate_damper_test"),
            instr(
                "activate_damper_test",
                3,
                "Activate test 6",
                "Press Refrigerator UP to toggle damper OPEN (O) or CLOSED (C). Allow 1 minute per position change.",
                "damper_open",
            ),
            visual(
                "damper_open",
                4,
                "Damper opens",
                "After 1 minute, does damper move to open position (refrigerator O)?",
                cp_yes_no("open_ok", "damper_close", "damper_fail", "damper_fail_out", "Damper does not move — check motor, linkage, or control output."),
            ),
            visual(
                "damper_close",
                5,
                "Damper closes",
                "Toggle to closed (C). After 1 minute, does damper fully close?",
                cp_yes_no("close_ok", "deactivate_test_6", "damper_fail", "damper_fail_out", "Damper stuck open or closed — replace damper assembly."),
            ),
            instr(
                "deactivate_test_6",
                6,
                "Deactivate test 6",
                "Leave damper test deactivated before exiting Service Test Mode.",
                "damper_verified",
            ),
            outcome("damper_fail_out", 7, "Replace damper", "Replace electric damper control when it fails to open/close in service test 6."),
            outcome("damper_verified", 8, "Damper verified", "Damper opens and closes correctly in service test 6."),
        ],
    ),
    proc(
        "w10322959-test-07-ff-performance",
        "Service Test 7: FF performance offset",
        "7",
        "FF Performance Adjustment",
        [1],
        ["control_board"],
        ["calibration", "weak_cooling_ff"],
        [
            select_test_step("7", "FF performance adjustment", "ff_offset_info"),
            instr(
                "ff_offset_info",
                3,
                "Adjust FF performance offset",
                (
                    "Service Test 7 adjusts fresh food performance ±1° per step. "
                    "WARMER ← (1 2 3 4 (5) 6 7 8 9) → COLDER using Refrigerator UP/DOWN. "
                    "Default is 5. Last value saves when refrigerator door closes. "
                    "Use only when cabinet temps verified normal and complaint is mild FF offset."
                ),
                "ff_offset_done",
                "Adjustments of Service Test 7 will alter the performance of the unit.",
            ),
            outcome("ff_offset_done", 4, "FF offset documented", "Record FF performance offset if adjusted. Re-check food temps after 24 hr."),
        ],
    ),
    proc(
        "w10322959-test-08-fz-performance",
        "Service Test 8: FZ performance offset",
        "8",
        "FZ Performance Adjustment",
        [1],
        ["control_board"],
        ["calibration", "not_cooling"],
        [
            select_test_step("8", "FZ performance adjustment", "fz_offset_info"),
            instr(
                "fz_offset_info",
                3,
                "Adjust FZ performance offset",
                (
                    "Service Test 8 adjusts freezer performance ±1° per step. "
                    "WARMER ← (1 2 3 4 (5) 6 7 8 9) → COLDER using Refrigerator UP/DOWN. "
                    "Default is 5. Last value saves when refrigerator door closes."
                ),
                "fz_offset_done",
                "Adjustments of Service Test 8 will alter the performance of the unit.",
            ),
            outcome("fz_offset_done", 4, "FZ offset documented", "Record FZ performance offset if adjusted. Re-check freezer temps after 24 hr."),
        ],
    ),
    proc(
        "w10322959-test-09-defrost-interval",
        "Service Test 9: Defrost interval",
        "9",
        "Defrost Adjustment",
        [1],
        ["control_board"],
        ["defrost", "frost_buildup", "calibration"],
        [
            select_test_step("9", "Defrost interval", "defrost_interval"),
            visual(
                "defrost_interval",
                3,
                "Adaptive vs fixed defrost",
                "Press Refrigerator UP to toggle: A=Adaptive (default) or F=Fixed 6-hour defrost. Freezer displays 9. Which mode is required?",
                [
                    {"id": "adaptive", "label": "A — Adaptive (field default)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "defrost_interval_ok"},
                    {"id": "fixed", "label": "F — Fixed 6 hr (diagnostic)", "when": {"kind": "checkpoint_no"}, "nextStepId": "defrost_interval_ok"},
                ],
            ),
            instr(
                "defrost_interval_ok",
                4,
                "Adaptive defrost reference",
                (
                    "Adaptive defrost: 15 min optimum; board terminates at 25 min if bimetal stuck. "
                    "4 hr continuous compressor run resets interval to 8 hr and initiates defrost. "
                    "Close door to save setting and exit Service Test Mode."
                ),
                "interval_documented",
            ),
            outcome("interval_documented", 5, "Defrost interval set", "Defrost interval mode confirmed or adjusted per complaint."),
        ],
    ),
    proc(
        "w10322959-programming-mode",
        "Programming mode (P-E): Program code",
        "P-E",
        "Programming Mode",
        [1],
        ["control_board"],
        ["control_board", "no_power", "program_code", "wont_run"],
        [
            instr(
                "enter_programming",
                2,
                "Enter Programming Mode (P-E)",
                (
                    "Hold fresh food door light switch closed. Press Freezer DOWN 3 times within 10 seconds. "
                    "Release door switch — display shows P-E. Press Freezer DOWN once more to confirm entry."
                ),
                "read_program_code",
                "Press Freezer Temperature DOWN /- Key pad 3 times consecutively.",
            ),
            instr(
                "read_program_code",
                3,
                "Validate program code",
                "Control displays current program code. Compare to code on serial plate after word CODE. Unit will NOT run with program code OO.",
                "code_match",
            ),
            visual(
                "code_match",
                4,
                "Program code matches serial plate",
                "Does displayed program code match the serial plate?",
                [
                    {"id": "code_ok", "label": "Matches — close door to exit", "when": {"kind": "checkpoint_yes"}, "nextStepId": "programming_ok"},
                    {"id": "code_wrong", "label": "Mismatch or OO", "when": {"kind": "checkpoint_no"}, "nextStepId": "set_program_code"},
                ],
            ),
            instr(
                "set_program_code",
                5,
                "Set program code",
                "Use Freezer and Refrigerator UP keys to advance digit. Press Freezer DOWN until code flashes (saved). Close door to exit. Repeat if incorrect.",
                "programming_ok",
                "The unit will NOT run with a Program Code of OO.",
            ),
            outcome("programming_ok", 6, "Program code verified", "Program code validated or corrected. All control functions off during P-E except damper holds position."),
        ],
    ),
]


def service_test_entry_bundle() -> dict:
    return {
        "id": "w10322959-service-test-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "W10322959 — Service Test Mode (S-E) entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter Jazz Service Test Mode for component tests 1–9.",
        "tags": ["service_test", "service_diagnostic", "control_board"],
        "entryStepId": "se_enter",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [1],
        },
        "steps": [
            instr(
                "se_enter",
                1,
                "Enter Service Test Mode",
                (
                    "Hold refrigerator door light switch closed. Press Refrigerator UP 3 times within 10 seconds. "
                    "Release door switch — display shows S-E. Press Refrigerator UP once more to confirm. "
                    "Software version displays 3 seconds; freezer then shows first test number. "
                    "Close door to exit at any time."
                ),
                "@continue",
                "Press Refrigerator Temperature UP /+ keypad 3 times consecutively.",
            ),
        ],
    }


def forced_defrost_entry_bundle() -> dict:
    return {
        "id": "w10322959-forced-defrost-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "W10322959 — Forced Defrost (F-d) entry",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "Enter forced defrost for manual evaporator defrost (short run — field use).",
        "tags": ["forced_defrost", "defrost", "frost_buildup"],
        "entryStepId": "fd_enter",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [1],
        },
        "steps": [
            instr(
                "fd_enter",
                1,
                "Enter Forced Defrost Mode",
                (
                    "Hold refrigerator door light switch closed. Press Refrigerator DOWN 3 times within 10 seconds. "
                    "Release switch — display shows F-d. Press Refrigerator DOWN once more to confirm. "
                    "Default short run period (S). Do not use Long (L) factory test in field. "
                    "Press Refrigerator DOWN again to start defrost; close door. Exit anytime before confirm by closing door."
                ),
                "@continue",
                "Press Refrigerator Temperature DOWN /- keypad 3 times consecutively.",
            ),
        ],
    }


BUNDLES = [service_test_entry_bundle(), forced_defrost_entry_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Whirlpool Jazz French door refrigerator (W10322959)",
        "notes": "S-E service tests 1–9; F-d forced defrost; P-E programming. No display fault codes — EM2Y60 compressor.",
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
                "relatedCodes": [],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print("Wrote procedureCatalog.json")


def write_readme() -> None:
    readme = """# whirlpool_jazz_french_door — W10322959 procedure seeds

**Manual:** Whirlpool Jazz French Door Refrigerator (W10322959B, 19–22 cu ft)  
**Platform:** `whirlpool_jazz_french_door` — WRF53/54/55/56/98/99, KRMF55, KRFF5, GI5F  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_JAZZ_FD_W10322959_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10322959
```

## Procedures (10)

| ID | OEM | Notes |
|----|-----|-------|
| w10322959-test-01-defrost | S-E 1 | Defrost bimetal O/S + heater ohms |
| w10322959-test-02-compressor | S-E 2 | Compressor/condenser fan + EM2Y60 ohms |
| w10322959-test-03-evap-fan | S-E 3 | Evaporator fan run check |
| w10322959-test-04-ff-thermistor | S-E 4 | FF NTC P/O/S + bench ohms |
| w10322959-test-05-fz-thermistor | S-E 5 | FZ NTC P/O/S + bench ohms |
| w10322959-test-06-damper | S-E 6 | Damper O/C toggle (1 min) |
| w10322959-test-07-ff-performance | S-E 7 | FF offset 1–9 (instruction) |
| w10322959-test-08-fz-performance | S-E 8 | FZ offset 1–9 (instruction) |
| w10322959-test-09-defrost-interval | S-E 9 | Adaptive vs fixed 6 hr |
| w10322959-programming-mode | P-E | Program code validate/set |

## Bundles (2)

- `w10322959-service-test-entry` — door switch + Fridge UP ×3 → S-E
- `w10322959-forced-defrost-entry` — door switch + Fridge DOWN ×3 → F-d

## WO smoke

Whirlpool `WRF535SWHZ` → `whirlpool_jazz_french_door`; heavy frost → `w10322959-test-01-defrost`
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")
    print("Wrote README.md")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)

    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        path = OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {filename}")

    for item, filename in zip(BUNDLES, BUNDLE_FILES, strict=True):
        path = BUNDLE_OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote bundles/{filename}")

    write_catalog()
    write_readme()

    for script in (
        "attach_w10322959_jazz_fridge_diagnostic_effects.py",
        "attach_w10322959_jazz_fridge_service_modes.py",
    ):
        path = ROOT / "backend" / "scripts" / script
        if path.exists():
            subprocess.run([sys.executable, str(path)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: global validate reported errors (may include other platforms).", file=sys.stderr)


if __name__ == "__main__":
    main()
