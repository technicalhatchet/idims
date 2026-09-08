#!/usr/bin/env python3
"""Generate W8178558 (Whirlpool Duet Sport washer) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_duet_sport"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W8178558",
    "manualTitle": "Whirlpool Duet Sport Front-Load Washer (Job Aid L-78)",
    "extractedTextFile": "backend/docs/manuals/jobaid-8178558-l-78 whirlpool fl washer 2013 era-extracted.txt",
    "verifiedAt": "2026-03-08",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the washer or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "WARNING — Electrical Shock Hazard. Disconnect power before accessing. Replace all parts and panels before operating.",
    "requiresInput": False,
}

NTC_RT_TABLE = (
    "OEM R/T table (TH2): 35.9k Ω @ 32°F (0°C); 9.7k Ω @ 86°F (30°C); "
    "6.6k Ω @ 104°F (40°C); 4.6k Ω @ 122°F (50°C); 3.2k Ω @ 140°F (60°C); "
    "2.3k Ω @ 158°F (70°C); 1k Ω @ 203°F (95°C)."
)


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
        "platformId": "whirlpool_duet_sport",
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


def pin_detail(
    pin: str,
    signal: str,
    wire: str | None = None,
    confidence: str = "verified",
) -> dict:
    detail: dict = {"pin": pin, "signal": signal}
    if wire:
        detail["wireColor"] = wire
        detail["wireColorConfidence"] = confidence
    return detail


PIN_VCH7_COLD = [
    pin_detail("1", "Cold valve coil +"),
    pin_detail("3", "Cold valve coil −"),
]
PIN_VCH7_HOT = [
    pin_detail("5", "Hot valve coil +"),
    pin_detail("7", "Hot valve coil −"),
]
PIN_DP2 = [
    pin_detail("1", "Drain pump"),
    pin_detail("2", "Drain pump return"),
]
PIN_DL3_LOCK = [
    pin_detail("1", "Door lock solenoid"),
    pin_detail("3", "Door lock solenoid return"),
]
PIN_DL3_UNLOCK = [
    pin_detail("2", "Door unlock solenoid"),
    pin_detail("3", "Door unlock solenoid return"),
]
PIN_DS2 = [
    pin_detail("3", "Door switch"),
    pin_detail("1", "Door switch return"),
]
PIN_TH2 = [
    pin_detail("1", "Wash NTC"),
    pin_detail("2", "Wash NTC return"),
]
PIN_HE2 = [
    pin_detail("1", "Wash heater"),
    pin_detail("2", "Wash heater return"),
]
PIN_DI6_MOTOR = [
    pin_detail("1", "Dispenser motor"),
    pin_detail("3", "Dispenser motor return"),
]
PIN_DI6_SWITCH = [
    pin_detail("5", "Dispenser contact"),
    pin_detail("6", "Dispenser contact return"),
]
PIN_MOTOR = [
    pin_detail("1", "Motor winding"),
    pin_detail("2", "Motor winding"),
    pin_detail("3", "Motor winding"),
]
PIN_MS2 = [
    pin_detail("1", "Drive motor harness"),
    pin_detail("2", "Drive motor harness return"),
]
PIN_PR6_SUDS = [
    pin_detail("1", "Pressure switch — suds detect"),
    pin_detail("2", "Pressure switch — suds detect return"),
]


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


PROCEDURES = [
    proc(
        "w8178558-motor-circuit",
        "§5-8: Drive Motor Circuit",
        "5-8",
        "Drive Motor",
        [78],
        ["drive_motor"],
        ["motor_check", "spin_issue", "wont_spin", "F25", "F28", "F06"],
        [
            visual(
                "shipping_bolts_removed",
                2,
                "Shipping bolts removed",
                "Confirm all shipping bolts are removed. Bolts left installed can cause F25 motor tach faults and no-spin complaints.",
                [
                    {"id": "bolts_removed_yes", "label": "Shipping bolts removed", "when": {"kind": "checkpoint_yes"}, "nextStepId": "basket_free_spin"},
                    {"id": "bolts_still_installed", "label": "Shipping bolts still installed", "when": {"kind": "checkpoint_no"}, "terminal": True, "oemOutcome": "Remove shipping bolts and retest before motor or MCU replacement."},
                ],
                "Remove all shipping bolts before operating. Failure to remove shipping bolts can cause motor tach errors.",
            ),
            visual(
                "basket_free_spin",
                3,
                "Drum turns freely",
                "Verify the drum turns freely by hand. Mechanical drag can mimic motor or MCU faults (F25, F31).",
                [
                    {"id": "drum_free_yes", "label": "Drum turns freely", "when": {"kind": "checkpoint_yes"}, "nextStepId": "disconnect_motor_connector"},
                    {"id": "drum_binding", "label": "Drum does not turn freely", "when": {"kind": "checkpoint_no"}, "nextStepId": "mechanical_binding", "terminal": True, "oemOutcome": "Resolve mechanical binding (belt, bearing, foreign object) before electrical motor diagnosis."},
                ],
            ),
            instr(
                "disconnect_motor_connector",
                4,
                "Disconnect motor 5-wire connector",
                "Refer to job aid §4-23 for motor access. Disconnect the 5-wire connector from the drive motor.",
                "motor_resistance",
            ),
            meas(
                "motor_resistance",
                5,
                "Motor winding resistance at motor connector",
                "Set ohmmeter to R×1. Measure between motor pins 1-2, 2-3, and 1-3. Each pair should read approximately 6 Ω on Duet Sport belt-drive motors.",
                "whirlpoolDuetSportWasherMotorOhms",
                "Motor",
                "1-2, 2-3, 1-3",
                ohm_branches("motor", "ms2_optional", "replace_motor", "~6 Ω all pairs"),
                "Pins 1 and 2, Pins 2 and 3, Pins 1 and 3 — approximately 6 Ω each.",
                pin_details=PIN_MOTOR,
            ),
            visual(
                "ms2_optional",
                6,
                "Optional — measure at CCU MS2 (harness path)",
                "If fault persists with good motor ohms at the component, disconnect MS2 at the CCU and verify harness continuity to the motor connector. Optional: re-measure motor windings through the harness path.",
                [
                    {"id": "ms2_skip", "label": "Skip — proceed to MCU/harness check", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_mcu_harness"},
                    {"id": "ms2_check", "label": "MS2/harness checked — motor path OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "check_mcu_harness"},
                ],
                "MS2 — Drive Motor at CCU (schematic §7-1).",
            ),
            instr(
                "check_mcu_harness",
                7,
                "Motor OK — inspect MCU and harness",
                "Motor windings measure normal. Inspect motor-to-MCU harness orientation and connections. F28 indicates CCU–MCU serial comm; F06 indicates MCU internal fault. Verify MI3 connector at MCU and belt tension.",
                "reconnect_motor_harness",
                "F28 CCU–MCU serial comm; F06 MCU internal fault.",
            ),
            instr(
                "reconnect_motor_harness",
                8,
                "Reconnect motor harness and restore power",
                "Reconnect the 5-wire motor connector. Reassemble panels as needed. Plug in or restore power for Manual Diagnostic Test motor exercise (§6-7).",
                "live_test_motor_rotation",
            ),
            visual(
                "live_test_motor_rotation",
                9,
                "Motor runs in Manual Diagnostic Test",
                "During Manual Diagnostic Test (§6-7), advance to the wash-speed reversing step (10 min) and spin ramp step. Does the drum reverse at wash speed and ramp to maximum spin?",
                [
                    {"id": "motor_runs_yes", "label": "Motor reverses and spins", "when": {"kind": "checkpoint_yes"}, "nextStepId": "motor_verified"},
                    {"id": "motor_runs_no", "label": "Motor does not run correctly", "when": {"kind": "checkpoint_no"}, "nextStepId": "suspect_mcu_ccu", "terminal": True, "oemOutcome": "Motor ohms good but does not run — suspect MCU, CCU, or harness (F28/F06)."},
                ],
                "Drum executes reversing movement at wash speed; drum rotates CCW and ramps to maximum speed.",
            ),
            outcome("remove_shipping_bolts", 10, "Remove shipping bolts", "Remove shipping bolts and retest."),
            outcome("mechanical_binding", 11, "Resolve mechanical binding", "Correct belt, bearing, or obstruction before repeating motor test."),
            outcome("replace_motor", 12, "Replace drive motor", "Replace drive motor when any winding pair is open or out of OEM range."),
            outcome("motor_verified", 13, "Motor circuit verified", "Motor resistance and live rotation verified — reassemble and verify customer complaint."),
            outcome("suspect_mcu_ccu", 14, "Suspect MCU/CCU/harness", "Replace MCU or CCU per F06/F28 after confirming motor and harness."),
        ],
    ),
    proc(
        "w8178558-drain-pump",
        "§5-6: Drain Pump Circuit",
        "5-6",
        "Drain Pump",
        [76],
        ["drain_pump"],
        ["drain_issue", "pump_check", "wont_drain", "F21", "Sd"],
        [
            visual(
                "precheck_filter_sd",
                2,
                "Coin trap clear and Sd ruled out",
                "Check the drain pump filter (coin trap) and drain hose for obstructions. Rule out Sd (oversuds) — use HE detergent only; run rinse/spin if suds suspected.",
                [
                    {"id": "precheck_ok", "label": "Filter/hose clear; Sd not suspected", "when": {"kind": "checkpoint_yes"}, "nextStepId": "disconnect_pump_connector"},
                    {"id": "precheck_bad", "label": "Obstruction or Sd issue found", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_drain_path", "terminal": True, "oemOutcome": "Clear coin trap, drain hose, or correct oversuds condition; retest before pump replacement."},
                ],
                "Sd oversuds can precede F21 — rule out detergent first.",
            ),
            instr(
                "disconnect_pump_connector",
                3,
                "Disconnect drain pump connector",
                "Refer to job aid §4-17 for pump access. Disconnect the wire connector from the drain pump.",
                "pump_at_component",
            ),
            meas(
                "pump_at_component",
                4,
                "Drain pump resistance at component",
                "Set ohmmeter to R×1. Measure across drain pump terminals. Expected approximately 12.3 Ω.",
                "whirlpoolDuetSportWasherDrainPumpOhms",
                "Drain pump",
                "1 & 2",
                ohm_branches("pump_comp", "disconnect_dp2", "replace_pump", "~12.3 Ω"),
            ),
            instr(
                "disconnect_dp2",
                5,
                "Disconnect DP2 at CCU",
                "Remove top/rear access. Disconnect drain pump connector DP2 from the CCU.",
                "pump_at_ccu",
            ),
            meas(
                "pump_at_ccu",
                6,
                "Drain pump resistance at DP2",
                "Set ohmmeter to R×1. Measure across DP2 pins 1 and 2. Expected approximately 12.3 Ω.",
                "whirlpoolDuetSportWasherDrainPumpOhms",
                "DP2",
                "1 & 2",
                ohm_branches("pump_ccu", "reconnect_pump_harness", "replace_pump_or_harness", "~12.3 Ω"),
                pin_details=PIN_DP2,
            ),
            instr(
                "reconnect_pump_harness",
                7,
                "Reconnect DP2 and restore power",
                "Reconnect DP2 at the CCU. Reassemble panels. Plug in or restore power for Manual Diagnostic Test drain step (§6-7).",
                "live_test_drain_pump",
            ),
            visual(
                "live_test_drain_pump",
                8,
                "Drain pump runs in Manual Diagnostic Test",
                "During Manual Diagnostic Test, advance to the drain pump ON step (4 min). Does the drain pump run and evacuate water?",
                [
                    {"id": "pump_runs_yes", "label": "Pump runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_verified"},
                    {"id": "pump_runs_no", "label": "Pump does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "suspect_ccu_pump", "terminal": True, "oemOutcome": "Pump ohms good but does not run — suspect CCU or harness."},
                ],
                "Drain Pump is on (4 min) — Manual Overview Test Program §6-7.",
            ),
            outcome("clear_drain_path", 9, "Clear drain path", "Service filter, hose, and suds condition; retest."),
            outcome("replace_pump", 10, "Replace drain pump", "Replace drain pump when open or out of range at component."),
            outcome("replace_pump_or_harness", 11, "Replace pump or harness", "Pump good at component but fault at DP2 — replace pump or harness."),
            outcome("pump_verified", 12, "Drain pump verified", "Pump resistance and live run verified."),
            outcome("suspect_ccu_pump", 13, "Suspect CCU/harness", "Replace CCU or harness when pump ohms good but no run."),
        ],
    ),
    proc(
        "w8178558-inlet-valves",
        "§5-1: Water Inlet Valve Solenoids",
        "5-1",
        "Inlet Valve Solenoids",
        [71],
        ["inlet_valve"],
        ["water_valve_check", "fill_issue", "no_fill", "F20", "F27"],
        [
            visual(
                "faucet_psi_ok",
                2,
                "Water supply and PSI OK",
                "Verify both hot and cold faucets are open, fill hoses are unobstructed, inlet screens are clear, and household water pressure is 20–100 PSI. F20 occurs if no fill in 6 minutes.",
                [
                    {"id": "supply_ok", "label": "Supply OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "disconnect_valve_coils"},
                    {"id": "supply_bad", "label": "Supply issue found", "when": {"kind": "checkpoint_no"}, "nextStepId": "correct_supply", "terminal": True, "oemOutcome": "Open faucets, clear screens, correct PSI, and verify pressure switch hose to tub before valve replacement."},
                ],
            ),
            instr(
                "disconnect_valve_coils",
                3,
                "Disconnect solenoid connectors at valve",
                "Refer to job aid §4-6 for inlet valve access. Disconnect solenoid connectors from cold and hot valve terminals.",
                "valve_at_component",
            ),
            meas(
                "valve_at_component",
                4,
                "Inlet valve coil resistance at component",
                "Set ohmmeter to R×100. Measure cold and hot solenoid terminals. Each coil should read 750–850 Ω.",
                "whirlpoolDuetSportWasherInletValveOhms",
                "Inlet valve",
                "Cold & hot coils",
                ohm_branches("valve_comp", "disconnect_vch7", "replace_valve", "750–850 Ω"),
            ),
            instr(
                "disconnect_vch7",
                5,
                "Disconnect VCH7 at CCU",
                "Disconnect inlet valve solenoid connector VCH7 from the CCU.",
                "valve_cold_ccu",
            ),
            meas(
                "valve_cold_ccu",
                6,
                "Cold valve VCH7 pins 1 & 3",
                "Set ohmmeter to R×100. Measure VCH7 pins 1 and 3 (cold). Expected 750–850 Ω.",
                "whirlpoolDuetSportWasherInletValveOhms",
                "VCH7",
                "1 & 3 (cold)",
                ohm_branches("valve_cold", "valve_hot_ccu", "replace_valve", "750–850 Ω"),
                pin_details=PIN_VCH7_COLD,
            ),
            meas(
                "valve_hot_ccu",
                7,
                "Hot valve VCH7 pins 5 & 7",
                "Measure VCH7 pins 5 and 7 (hot). Expected 750–850 Ω.",
                "whirlpoolDuetSportWasherInletValveOhms",
                "VCH7",
                "5 & 7 (hot)",
                ohm_branches("valve_hot", "reconnect_valve_harness", "replace_valve", "750–850 Ω"),
                pin_details=PIN_VCH7_HOT,
            ),
            instr(
                "reconnect_valve_harness",
                8,
                "Reconnect VCH7 and restore power",
                "Reconnect VCH7 at the CCU. Reassemble panels. Plug in or restore power for Manual Diagnostic Test fill steps (§6-7).",
                "live_test_inlet_valves",
            ),
            visual(
                "live_test_inlet_valves",
                9,
                "Valves fill in Manual Diagnostic Test",
                "During Manual Diagnostic Test fill steps, do cold and hot inlet valves energize and fill the tub as expected?",
                [
                    {"id": "valves_run_yes", "label": "Valves energize and fill", "when": {"kind": "checkpoint_yes"}, "nextStepId": "valve_verified"},
                    {"id": "valves_run_no", "label": "Valve does not energize", "when": {"kind": "checkpoint_no"}, "nextStepId": "suspect_ccu_valve", "terminal": True, "oemOutcome": "Valve ohms good but no fill — suspect CCU or harness."},
                ],
                "Fill by cold/hot water inlet valve — Manual Overview Test Program §6-7.",
            ),
            outcome("correct_supply", 10, "Correct water supply", "Restore water supply and pressure switch plumbing; retest."),
            outcome("replace_valve", 11, "Replace inlet valve", "Replace inlet valve assembly when coil open or out of range."),
            outcome("valve_verified", 12, "Inlet valves verified", "Valve resistance and live fill verified."),
            outcome("suspect_ccu_valve", 13, "Suspect CCU/harness", "Replace CCU or harness when valve ohms good but no energize."),
        ],
    ),
    proc(
        "w8178558-door-lock",
        "§5-5: Door Lock / Switch Circuit",
        "5-5",
        "Door Switch",
        [75],
        ["door_lock"],
        ["door_lock_check", "F22", "F26", "F29"],
        [
            instr(
                "disconnect_dl3",
                2,
                "Disconnect DL3 at CCU",
                "Refer to job aid §4-14 for door switch access. Disconnect door lock/unlock solenoids connector DL3 from the CCU.",
                "lock_solenoid_ohms",
            ),
            meas(
                "lock_solenoid_ohms",
                3,
                "Door lock solenoid DL3 pins 1 & 3",
                "Set ohmmeter to R×1. Measure DL3 pins 1 and 3 (lock solenoid). Expected 60 Ω.",
                "whirlpoolDuetSportWasherDoorLockSolenoidOhms",
                "DL3",
                "1 & 3 (lock)",
                ohm_branches("lock_sol", "unlock_solenoid_ohms", "replace_door_lock", "60 Ω"),
                pin_details=PIN_DL3_LOCK,
            ),
            meas(
                "unlock_solenoid_ohms",
                4,
                "Door unlock solenoid DL3 pins 2 & 3",
                "Measure DL3 pins 2 and 3 (unlock solenoid). Expected 60 Ω.",
                "whirlpoolDuetSportWasherDoorLockSolenoidOhms",
                "DL3",
                "2 & 3 (unlock)",
                ohm_branches("unlock_sol", "disconnect_ds2", "replace_door_lock", "60 Ω"),
                pin_details=PIN_DL3_UNLOCK,
            ),
            instr(
                "disconnect_ds2",
                5,
                "Disconnect DS2 at CCU",
                "Disconnect door switch connector DS2 from the CCU.",
                "door_switch_checkpoint",
            ),
            visual(
                "door_switch_checkpoint",
                6,
                "Door switch DS2 — closed = 0 Ω",
                "With ohmmeter on DS2 pins 3 and 1: does the door switch read 0 Ω (continuity) when the door is fully closed, and open (OL) when the door is open?",
                [
                    {"id": "ds2_ok", "label": "0 Ω closed / OL open", "when": {"kind": "checkpoint_yes"}, "nextStepId": "door_lock_verified"},
                    {"id": "ds2_bad", "label": "Switch fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_door_switch", "terminal": True, "oemOutcome": "Replace door lock/switch assembly when DS2 does not read 0 Ω closed."},
                ],
                "Door Closed = 0 Ω; Door Open = infinite — DS2 pins 3 and 1.",
            ),
            outcome("replace_door_lock", 7, "Replace door lock", "Replace door lock assembly when lock or unlock solenoid open or out of range."),
            outcome("replace_door_switch", 8, "Replace door switch", "Replace door lock/switch assembly for DS2 fault (F26)."),
            outcome("door_lock_verified", 9, "Door lock circuit verified", "DL3 solenoids and DS2 door switch within OEM spec."),
        ],
    ),
    proc(
        "w8178558-wash-heater",
        "§5-7: Wash Heater (Ht models)",
        "5-7",
        "Temperature Sensor & Heater",
        [77],
        ["wash_heater"],
        ["heating_element_check", "no_heat", "F23", "F24"],
        [
            visual(
                "ht_model_check",
                2,
                "Duet Sport Ht model with heater",
                "This procedure applies to Duet Sport Ht models equipped with a tub heater. Base Sport models may not have HE2 — skip if no heater is installed.",
                [
                    {"id": "ht_yes", "label": "Ht model — heater equipped", "when": {"kind": "checkpoint_yes"}, "nextStepId": "disconnect_he2"},
                    {"id": "ht_no", "label": "No heater equipped", "when": {"kind": "checkpoint_no"}, "nextStepId": "no_heater_outcome", "terminal": True, "oemOutcome": "No wash heater on this model — investigate other causes of heat complaints."},
                ],
            ),
            instr(
                "disconnect_he2",
                3,
                "Disconnect heater at component",
                "Refer to job aid §4-22. Disconnect the wire connector from the heater.",
                "heater_at_component",
            ),
            meas(
                "heater_at_component",
                4,
                "Wash heater resistance at component",
                "Set ohmmeter to R×1. Measure across heater terminals. Expected 10–15 Ω.",
                "whirlpoolDuetSportWasherHeaterOhms",
                "Heater",
                "1 & 2",
                ohm_branches("heater_comp", "disconnect_he2_ccu", "replace_heater", "10–15 Ω"),
            ),
            instr(
                "disconnect_he2_ccu",
                5,
                "Disconnect HE2 at CCU",
                "Disconnect heater connector HE2 from the CCU.",
                "heater_at_ccu",
            ),
            meas(
                "heater_at_ccu",
                6,
                "Wash heater HE2 pins 1 & 2",
                "Set ohmmeter to R×1. Measure HE2 pins 1 and 2. Expected 10–15 Ω.",
                "whirlpoolDuetSportWasherHeaterOhms",
                "HE2",
                "1 & 2",
                ohm_branches("heater_ccu", "heater_verified", "replace_heater_or_harness", "10–15 Ω"),
                pin_details=PIN_HE2,
            ),
            outcome("no_heater_outcome", 7, "No heater equipped", "Not an Ht model — no HE2 heater circuit to test."),
            outcome("replace_heater", 8, "Replace wash heater", "Replace heater when open or out of range at component (F23)."),
            outcome("replace_heater_or_harness", 9, "Replace heater or harness", "Heater good at component but fault at HE2 — replace heater or harness."),
            outcome("heater_verified", 10, "Wash heater verified", "Heater resistance within OEM range — verify heat with Manual Diagnostic Test on Ht models."),
        ],
    ),
    proc(
        "w8178558-wash-ntc",
        "§5-7: Wash NTC (TH2)",
        "5-7",
        "Temperature Sensor",
        [77],
        ["wash_ntc"],
        ["thermistor", "heating_element_check", "F24"],
        [
            instr(
                "disconnect_th2_component",
                2,
                "Disconnect NTC at component",
                "Refer to job aid §4-22. Disconnect the wire connector from the water temperature sensor.",
                "ntc_at_component",
            ),
            meas(
                "ntc_at_component",
                3,
                "Wash NTC at sensor terminals",
                f"Set ohmmeter to R×1K. Measure across sensor terminals and compare to ambient temperature. {NTC_RT_TABLE}",
                "whirlpoolDuetSportWasherWashNtcOhms",
                "Wash NTC",
                "Sensor pins",
                ohm_branches("ntc_comp", "disconnect_th2_ccu", "replace_ntc", "Within R/T table"),
            ),
            instr(
                "disconnect_th2_ccu",
                4,
                "Disconnect TH2 at CCU",
                "Disconnect temperature sensor connector TH2 from the CCU.",
                "ntc_at_ccu",
            ),
            meas(
                "ntc_at_ccu",
                5,
                "Wash NTC TH2 pins 1 & 2",
                f"Set ohmmeter to R×1K. Measure TH2 pins 1 and 2. Compare reading to OEM R/T table at ambient. {NTC_RT_TABLE}",
                "whirlpoolDuetSportWasherWashNtcOhms",
                "TH2",
                "1 & 2",
                [
                    {"id": "ntc_ccu_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": "replace_ntc_or_harness", "terminal": True, "oemOutcome": "Replace wash temperature sensor or harness (F24)."},
                    {"id": "ntc_ccu_bad", "label": "Out of R/T range", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_ntc", "terminal": True, "oemOutcome": "Replace wash temperature sensor (F24)."},
                    {"id": "ntc_ccu_warn", "label": "Marginal / warning", "when": {"kind": "measurement_warning"}, "nextStepId": "replace_ntc", "terminal": True, "oemOutcome": "Replace wash temperature sensor when out of range (F24)."},
                    {"id": "ntc_ccu_pass", "label": "Within R/T table", "when": {"kind": "measurement_normal"}, "nextStepId": "ntc_verified"},
                ],
                pin_details=PIN_TH2,
            ),
            outcome("replace_ntc", 6, "Replace wash NTC", "Replace water temperature sensor."),
            outcome("replace_ntc_or_harness", 7, "Replace NTC or harness", "NTC good at component but open at TH2 — replace sensor or harness."),
            outcome("ntc_verified", 8, "Wash NTC verified", "TH2 resistance within OEM R/T table at ambient."),
        ],
    ),
    proc(
        "w8178558-pressure-switch",
        "§5-2: Pressure Switch (F20)",
        "5-2",
        "Pressure Switch",
        [72],
        ["water_level_sensor"],
        ["fill_issue", "no_fill", "F20", "Sd"],
        [
            visual(
                "hose_routing_ok",
                2,
                "Pressure hose and tub connection OK",
                "Verify the pressure switch hose is connected to the tub, air trap is clear, and hose is not kinked, pinched, or leaking. F20 if pressure switch does not trip within 6 minutes of fill.",
                [
                    {"id": "hose_ok", "label": "Hose routing OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "disconnect_pr6"},
                    {"id": "hose_bad", "label": "Hose/trap issue", "when": {"kind": "checkpoint_no"}, "nextStepId": "service_hose_trap", "terminal": True, "oemOutcome": "Clear air trap, repair hose routing, replace leaking hose; retest fill."},
                ],
            ),
            instr(
                "disconnect_pr6",
                3,
                "Disconnect pressure switch hose",
                "Refer to job aid §4-7. Disconnect wire connector and hose from the pressure switch.",
                "blow_hose_checkpoint",
            ),
            visual(
                "blow_hose_checkpoint",
                4,
                "Blow hose — contacts close at each level",
                "Set ohmmeter to R×1. Touch leads to pressure switch pins per OEM chart while blowing into the hose inlet to activate the diaphragm. Each level should read 0 Ω while activated: Empty pins 4&6; Suds Detect pins 1&2; L1 pins 4&5; Overflow pins 3&4.",
                [
                    {"id": "levels_ok", "label": "All levels close (0 Ω) when activated", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pr6_suds_checkpoint"},
                    {"id": "levels_bad", "label": "Level contact fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_pressure_switch", "terminal": True, "oemOutcome": "Replace pressure switch when level contacts fail to close."},
                ],
                "Blow into hose inlet to activate diaphragm — 0 Ω for each measurement while activated.",
            ),
            instr(
                "pr6_suds_checkpoint",
                5,
                "Disconnect PR6 at CCU",
                "Disconnect pressure switch connector PR6 from the CCU.",
                "pr6_pins_1_2",
            ),
            visual(
                "pr6_pins_1_2",
                6,
                "PR6 pins 1 & 2 — suds detect (0 Ω)",
                "With ohmmeter on PR6 pins 1 and 2, does the suds-detect level read 0 Ω when the pressure switch diaphragm is activated (blow into hose or simulate suds level)?",
                [
                    {"id": "pr6_ok", "label": "0 Ω when activated", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pressure_switch_verified"},
                    {"id": "pr6_bad", "label": "Does not close", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_pressure_switch", "terminal": True, "oemOutcome": "Replace pressure switch — PR6 suds level not tripping (F20)."},
                ],
                "Connector PR6 pins 1 and 2 should indicate 0 Ω.",
            ),
            outcome("service_hose_trap", 7, "Service hose and trap", "Clear pressure hose and air trap; retest fill."),
            outcome("replace_pressure_switch", 8, "Replace pressure switch", "Replace pressure switch assembly."),
            outcome("pressure_switch_verified", 9, "Pressure switch verified", "Hose path and PR6 level contacts OK — investigate inlet valves if F20 persists."),
        ],
    ),
    proc(
        "w8178558-dispenser-motor",
        "§5-4: Detergent Dispenser Motor",
        "5-4",
        "Detergent Dispenser Motor & Switch",
        [74],
        ["dosing_pump"],
        ["dispenser_check", "F30"],
        [
            instr(
                "disconnect_dispenser_motor",
                2,
                "Disconnect motor and switch at component",
                "Refer to job aid §4-13. Disconnect the two wire connectors from the dispenser motor and switch terminals.",
                "dispenser_at_component",
            ),
            meas(
                "dispenser_at_component",
                3,
                "Dispenser motor at component terminals",
                "Set ohmmeter to R×100. Motor terminals should read 1400 Ω; switch terminals should read 0 Ω.",
                "whirlpoolDuetSportWasherDispenserMotorOhms",
                "Dispenser motor",
                "Motor terminals",
                ohm_branches("disp_comp", "disconnect_di6", "replace_dispenser_motor", "1400 Ω motor"),
            ),
            instr(
                "disconnect_di6",
                4,
                "Disconnect DI6 at CCU",
                "Disconnect detergent dispenser connector DI6 from the CCU.",
                "dispenser_motor_ccu",
            ),
            meas(
                "dispenser_motor_ccu",
                5,
                "Dispenser motor DI6 pins 1 & 3",
                "Set ohmmeter to R×1. Measure DI6 pins 1 and 3 (motor). Expected 1400 Ω.",
                "whirlpoolDuetSportWasherDispenserMotorOhms",
                "DI6",
                "1 & 3 (motor)",
                ohm_branches("disp_motor", "dispenser_switch_checkpoint", "replace_dispenser_motor", "1400 Ω"),
                pin_details=PIN_DI6_MOTOR,
            ),
            visual(
                "dispenser_switch_checkpoint",
                6,
                "Dispenser switch DI6 pins 5 & 6 = 0 Ω",
                "Measure DI6 pins 5 and 6 (dispenser contact switch). Expected 0 Ω when contact is made.",
                [
                    {"id": "switch_ok", "label": "0 Ω (contact made)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "dispenser_verified"},
                    {"id": "switch_bad", "label": "Open or fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_dispenser_asm", "terminal": True, "oemOutcome": "Replace dispenser assembly when switch does not read 0 Ω."},
                ],
                "Switch Pins 5 & 6 = 0 Ω at CCU.",
            ),
            outcome("replace_dispenser_motor", 7, "Replace dispenser motor", "Replace dispenser motor when open or out of range (F30)."),
            outcome("replace_dispenser_asm", 8, "Replace dispenser assembly", "Replace detergent dispenser assembly."),
            outcome("dispenser_verified", 9, "Dispenser motor verified", "DI6 motor and switch within OEM spec."),
        ],
    ),
    proc(
        "w8178558-interlock-switch",
        "§5-8: Interlock Switch (NC ground)",
        "5-8",
        "Interlock Switch",
        [78],
        ["supply"],
        ["voltage_check", "ground_check"],
        [
            instr(
                "access_interlock",
                2,
                "Access interlock switch",
                "Refer to job aid §4-25 for interlock switch access. Unplug washer or disconnect power.",
                "disconnect_interlock",
            ),
            instr(
                "disconnect_interlock",
                3,
                "Disconnect interlock terminals",
                "Disconnect the wire connectors from either interlock switch terminals (front S1 or rear S2 ground switch).",
                "interlock_nc_checkpoint",
            ),
            visual(
                "interlock_nc_checkpoint",
                4,
                "NC interlock — open pressed, 0 Ω released",
                "Set ohmmeter to R×1. Touch leads to the two interlock switch terminals. Meter should indicate open circuit (OL) with the actuator button pushed in, and closed circuit (0 Ω) with the actuator button out (normal cabinet position).",
                [
                    {"id": "interlock_ok", "label": "OL pressed / 0 Ω released", "when": {"kind": "checkpoint_yes"}, "nextStepId": "interlock_verified"},
                    {"id": "interlock_bad", "label": "Switch fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_interlock", "terminal": True, "oemOutcome": "Replace interlock switch when NC contact does not open/close per spec."},
                ],
                "Open circuit with actuator pushed in; closed circuit (0 Ω) with actuator button out.",
            ),
            outcome("replace_interlock", 5, "Replace interlock switch", "Replace front or rear interlock (ground) switch."),
            outcome("interlock_verified", 6, "Interlock switch verified", "NC interlock operates correctly for grounding system."),
        ],
    ),
]

PROCEDURE_FILES = [
    "w8178558-motor-circuit.json",
    "w8178558-drain-pump.json",
    "w8178558-inlet-valves.json",
    "w8178558-door-lock.json",
    "w8178558-wash-heater.json",
    "w8178558-wash-ntc.json",
    "w8178558-pressure-switch.json",
    "w8178558-dispenser-motor.json",
    "w8178558-interlock-switch.json",
]


def diagnostic_history_entry_bundle() -> dict:
    return {
        "id": "w8178558-diagnostic-history-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_duet_sport",
        "manualId": "W8178558",
        "title": "W8178558 — Service history & Diagnostic Test entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter service mode with error history display, then automated Diagnostic Test (§6-5).",
        "tags": ["service_diagnostic", "fault_codes", "live_test"],
        "entryStepId": "prep_empty_drum",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [83, 84],
        },
        "steps": [
            {
                "id": "prep_empty_drum",
                "order": 1,
                "type": "instruction",
                "title": "Prepare washer",
                "body": "Washer must be empty and control in OFF state (indicators off). Close the door before starting the touchpad sequence.",
                "sourceExcerpt": "The washer must be empty and the control must be in the OFF state before pressing the touchpad sequence.",
                "requiresInput": False,
                "defaultNextStepId": "history_touchpad_entry",
            },
            {
                "id": "history_touchpad_entry",
                "order": 2,
                "type": "instruction",
                "title": "Touchpad entry — 4 sec × 3 pattern (§6-5)",
                "body": (
                    "Select any one key (except PAUSE/CANCEL) and use the same key for the entire sequence. "
                    "Press and hold 4 seconds → release 4 seconds → press and hold 4 seconds → release 4 seconds → "
                    "press and hold 4 seconds. On release, all console LED lights turn on for 5 seconds. "
                    "Stored failure codes display on status lights (most recent first); press the same key to advance. "
                    "When history is finished, the control advances to the automated Diagnostic Test. "
                    "Press PAUSE/CANCEL to exit service mode."
                ),
                "sourceExcerpt": "Press/hold 4 seconds — Release for 4 seconds — (repeat 3 holds). This program recalls the most recent failure code first.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


def manual_diagnostic_test_bundle() -> dict:
    return {
        "id": "w8178558-manual-diagnostic-test",
        "version": "1.0.0",
        "platformId": "whirlpool_duet_sport",
        "manualId": "W8178558",
        "title": "W8178558 — Manual Diagnostic Test entry",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "Enter Manual Diagnostic Test mode and navigate component exercise steps (§6-7).",
        "tags": ["live_test", "motor_check", "pump_check", "water_valve_check"],
        "entryStepId": "manual_prep_empty",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [85, 86],
        },
        "steps": [
            {
                "id": "manual_prep_empty",
                "order": 1,
                "type": "instruction",
                "title": "Prepare for Manual Diagnostic Test",
                "body": "Washer must be empty and control OFF. Close the door.",
                "requiresInput": False,
                "defaultNextStepId": "manual_touchpad_entry",
            },
            {
                "id": "manual_touchpad_entry",
                "order": 2,
                "type": "instruction",
                "title": "Manual test entry — 4 sec × 4 pattern (§6-7)",
                "body": (
                    "Select any one key (except PAUSE/CANCEL). Press and hold 4 seconds → release 4 seconds → "
                    "press and hold 4 seconds → release 4 seconds → press and hold 4 seconds → release 4 seconds → "
                    "press and hold 4 seconds, then release. Program loops continuously; press the same key to advance "
                    "each step. Press PAUSE/CANCEL to exit. Steps include door lock, fill/valves, dispenser, motor "
                    "reversing (10 min), drain pump (4 min), and spin ramp."
                ),
                "sourceExcerpt": "MANUAL DIAGNOSTIC TEST — Press/hold 4 sec, release 4 sec (four hold cycles).",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


BUNDLES = [
    diagnostic_history_entry_bundle(),
    manual_diagnostic_test_bundle(),
]

BUNDLE_FILES = [
    "w8178558-diagnostic-history-entry.json",
    "w8178558-manual-diagnostic-test.json",
]


def write_catalog() -> None:
    catalog = {
        "manualId": "W8178558",
        "platformId": "whirlpool_duet_sport",
        "templateId": "washer",
        "label": "Whirlpool Duet Sport CCU/MCU belt-drive washer (Job Aid 8178558)",
        "notes": "Job Aid uses diagnostic sections (§5-x, §6-x), not W11169652-style TEST # labels.",
        "plannedProcedures": [
            {
                "id": pid,
                "oemSection": proc_data["source"]["oemTestNumber"],
                "title": proc_data["title"],
                "status": "generated",
                "knowledgeIds": [
                    step["measurementKnowledgeId"]
                    for step in proc_data["steps"]
                    if step.get("measurementKnowledgeId")
                ],
                "relatedCodes": [tag for tag in proc_data.get("tags", []) if tag.startswith("F") or tag == "Sd"],
            }
            for proc_data, pid in zip(PROCEDURES, [p["id"] for p in PROCEDURES], strict=True)
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

    effects_script = ROOT / "backend" / "scripts" / "attach_w8178558_diagnostic_effects.py"
    subprocess.run([sys.executable, str(effects_script)], check=True, cwd=ROOT)

    service_modes_script = ROOT / "backend" / "scripts" / "attach_w8178558_service_modes.py"
    subprocess.run([sys.executable, str(service_modes_script)], check=True, cwd=ROOT)

    registry_script = ROOT / "backend" / "scripts" / "generate_procedure_registry.py"
    subprocess.run([sys.executable, str(registry_script)], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
