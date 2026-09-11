#!/usr/bin/env python3
"""Generate Samsung FL WF6000R washer (WF45T/WF45R/WF22R) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_fl_washer_wf6000r"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-FL-WF6000R-WASHER",
    "manualTitle": "Samsung Front-Load Washer WF6000R Family (WF45T/WF45R/WF22R)",
    "extractedTextFile": "backend/docs/manuals/samsung fl washer wf45t6000-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the washer or disconnect power before servicing. Discharge PBA terminals per manual. Replace all parts before operating.",
    "sourceExcerpt": "Make sure to disconnect the power plug before servicing.",
    "requiresInput": False,
}


def proc(pid, title, oem_num, oem_title, pages, component_ids, tags, steps):
    if not steps:
        raise ValueError(f"{pid} must define steps")
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    return {
        "id": pid,
        "version": "1.0.0",
        "title": title,
        "platformId": "samsung_fl_washer_wf6000r",
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
        {"id": f"{prefix}_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_crit", "label": "Critical", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


PROCEDURES = [
    proc(
        "samsungwf6000r-motor-circuit",
        "§4-3: Washing motor (3C)",
        "4-3",
        "Washing Motor Error 3C",
        [30, 32],
        ["drive_motor"],
        ["3C", "3E", "motor_check", "spin_issue", "wont_spin"],
        [
            visual("motor_overload", 2, "Rule out overload (3E)", "Too much laundry can display 3E — redistribute load before motor diagnosis.", cp_yes_no("load_ok", "disconnect_motor", "redistribute_load", "redistribute_load_out", "Redistribute load and retest."), "3E is displayed because overloading occurs."),
            instr("disconnect_motor", 3, "Disconnect motor connector", "Disconnect motor harness. Inspect stator cover and coil for foreign material or damage.", "motor_ohms"),
            meas("motor_ohms", 4, "Motor winding resistance", "Measure any two of three motor terminals. Expected 6.0 Ω @ 25°C per §4-3 3C.", "samsungFlWf6000rWasherMotorOhms", "Motor", "Any two of three", ohm_branches("motor", "hall_sensor_ohms", "replace_motor", "~6.0 Ω")),
            meas("hall_sensor_ohms", 5, "Hall sensor resistance", "At main PCB motor connector: pins 1–3 and 1–4 expect approx. 2–4 MΩ.", "samsungFlWf6000rWasherHallSensorOhms", "Motor hall", "1–3 & 1–4", ohm_branches("hall", "reconnect_motor", "replace_hall", "2–4 MΩ")),
            instr("reconnect_motor", 6, "Reconnect motor — restore power", "Reconnect motor harness. Restore power for Smart Install manual check step 8 (dehydration/spin).", "live_motor_check"),
            visual("live_motor_check", 7, "Motor runs in manual check", "In Smart Install manual mode, advance to dehydration test. Does drum spin?", cp_yes_no("motor_runs", "motor_ok", "suspect_pba", "suspect_pba_out", "Motor ohms OK but no run — replace main PBA or check inverter comm (AC6).")),
            outcome("redistribute_load_out", 8, "Redistribute load", "Correct load size and balance before condemning motor."),
            outcome("replace_motor", 9, "Replace motor", "Replace motor when windings open or out of OEM range."),
            outcome("replace_hall", 10, "Replace hall sensor", "Replace hall sensor when out of 2–4 MΩ range."),
            outcome("motor_ok", 11, "Motor verified", "Motor resistance, hall sensor, and live spin verified."),
            outcome("suspect_pba_out", 12, "Suspect main/inverter PBA", "Replace PBA after confirming motor and harness."),
        ],
    ),
    proc(
        "samsungwf6000r-wash-heater",
        "§4-3: Wash heater (HC, HC1)",
        "4-3",
        "Heater Error HC",
        [30, 32],
        ["wash_heater", "wash_ntc"],
        ["HC", "HC1", "no_heat", "heating_element_check"],
        [
            instr("heater_access", 2, "Access heater terminals", "Disconnect power. Access wash heater at tub front (terminals A and B per §4-3 TYPE 1).", "heater_in_circuit"),
            meas("heater_in_circuit", 3, "Heater A–B resistance (TYPE 1)", "Measure between A and B. Expected 16.05 ± 0.65 Ω.", "samsungFlWf6000rWasherHeaterInCircuitOhms", "Heater", "A & B", ohm_branches("hc_ab", "heater_ok_in_circuit", "bench_heater", "~16 Ω")),
            instr("bench_heater", 4, "Bench heater element", "Remove heater per §3. Measure element: 27.1 Ω (1900 W) or 26.2 Ω (2000 W).", "heater_bench"),
            meas("heater_bench", 5, "Heater bench ohms", "Measure heater element resistance.", "samsungFlWf6000rWasherHeaterOhms", "Heater element", "Terminals", ohm_branches("hc_bench", "check_thermistor", "replace_heater", "27.1/26.2 Ω")),
            instr("check_thermistor", 6, "TYPE 2 — wash thermistor", "If heater ohms OK, check wash thermistor at back of tub (§4-3 TYPE 2).", "thermistor_ohms"),
            meas("thermistor_ohms", 7, "Wash thermistor @ room", "Expected ~12 kΩ at room temperature.", "samsungFlWf6000rWasherThermistorOhms", "Thermistor", "Connector", ohm_branches("ntc", "heater_path_ok", "replace_thermistor", "~12 kΩ")),
            outcome("heater_ok_in_circuit", 8, "Heater in-circuit OK", "A–B in range — if HC persists, replace wash thermistor."),
            outcome("replace_heater", 9, "Replace heater", "Replace wash heater when open or out of range."),
            outcome("replace_thermistor", 10, "Replace thermistor", "Replace wash thermistor when out of range."),
            outcome("heater_path_ok", 11, "Heater path verified", "Heater and thermistor in spec — inspect wiring; replace PBA if fault remains."),
        ],
    ),
    proc(
        "samsungwf6000r-wash-thermistor",
        "§4-3: Wash temperature sensor (TC1)",
        "4-3",
        "Temperature Sensor Error TC1",
        [30, 32],
        ["wash_ntc"],
        ["TC1", "thermistor"],
        [
            instr("tc1_connector", 2, "Check thermistor connector", "Verify washing heater temperature sensor connector seated. Rule out frozen hose in winter.", "tc1_ohms"),
            meas("tc1_ohms", 3, "Wash thermistor resistance", "Measure at thermistor connector — ~12 kΩ at room temp.", "samsungFlWf6000rWasherThermistorOhms", "Thermistor", "Connector", ohm_branches("tc1", "tc1_verified", "replace_tc1_ntc", "~12 kΩ")),
            outcome("replace_tc1_ntc", 4, "Replace thermistor", "Replace washing temperature sensor when faulty."),
            outcome("tc1_verified", 5, "Thermistor OK", "TC1 path verified — suspect main PBA if code returns."),
        ],
    ),
    proc(
        "samsungwf6000r-door-lock",
        "§4-3: Door lock and switch (DC, DC1)",
        "4-3",
        "Door Error DC / DC1",
        [30, 32],
        ["door_lock"],
        ["DC", "DC1", "DC3", "DDC", "door_lock_check"],
        [
            visual("dc_boil_check", 2, "DC during Boil cycle?", "If DC occurs during Boil cycle, verify door fully closed and not caught.", cp_yes_no("door_closed", "door_type_check", "close_door", "close_door_out", "Close door securely and retest.")),
            visual("door_type_check", 3, "Door switch type", "TYPE 1 door switch (pins 1–3 ~175 Ω) or TYPE 2 lock switch (pins 2–3 60–90 Ω with slider pushed)?", [
                {"id": "type1", "label": "TYPE 1 door switch", "when": {"kind": "checkpoint_yes"}, "nextStepId": "door_switch_ohms"},
                {"id": "type2", "label": "TYPE 2 lock switch", "when": {"kind": "checkpoint_no"}, "nextStepId": "door_lock_ohms"},
            ]),
            meas("door_switch_ohms", 4, "TYPE 1 door switch (pins 1–3)", "Approximately 175 Ω.", "samsungFlWf6000rWasherDoorSwitchOhms", "Door switch", "1 & 3", ohm_branches("ds", "door_verified", "replace_door_switch", "~175 Ω")),
            meas("door_lock_ohms", 4, "TYPE 2 lock switch (pins 2–3)", "Push slider — expect 60–90 Ω.", "samsungFlWf6000rWasherDoorLockOhms", "Door lock", "2 & 3", ohm_branches("dl", "lock_motor_ohms", "replace_door_lock", "60–90 Ω")),
            meas("lock_motor_ohms", 5, "Add-door lock motor (1–2)", "For DDC/DC3: lock motor 46.57 ± 15 Ω at pins 1–2.", "samsungFlWf6000rWasherDoorLockMotorOhms", "Lock motor", "1 & 2", ohm_branches("lm", "door_verified", "replace_lock_module", "46.57 ± 15 Ω")),
            outcome("close_door_out", 6, "Close door", "Ensure door closed and laundry not caught."),
            outcome("replace_door_switch", 7, "Replace door switch", "Replace faulty door switch."),
            outcome("replace_door_lock", 8, "Replace door lock", "Replace door lock assembly."),
            outcome("replace_lock_module", 9, "Replace lock module", "Replace add-door lock module when motor out of range."),
            outcome("door_verified", 10, "Door circuit OK", "Door switch/lock in spec — inspect main PBA door sensing if code persists."),
        ],
    ),
    proc(
        "samsungwf6000r-water-level-sensor",
        "§4-3: Water level sensor (1C)",
        "4-3",
        "Water Level Sensor 1C",
        [30],
        ["water_level_sensor"],
        ["1C", "fill_issue"],
        [
            visual("wls_hose", 2, "Level sensor hose", "Check hose to water level sensor — not folded, cut, or damaged. Verify correct material code sensor installed.", cp_yes_no("hose_ok", "wls_frequency", "fix_hose", "fix_hose_out", "Correct hose routing and sensor part.")),
            meas("wls_frequency", 3, "Level sensor frequency", "Connect sensor and connector. Measure frequency on pink and orange wires — approx. 25.5 kHz with no load.", "samsungFlWf6000rWasherWaterLevelFrequency", "Level sensor", "Pink & Orange", ohm_branches("wls", "wls_verified", "replace_wls", "~25.5 kHz")),
            outcome("fix_hose_out", 4, "Fix hose/sensor install", "Correct hose and sensor installation."),
            outcome("replace_wls", 5, "Replace level sensor", "Replace water level sensor; replace PBA if fault persists."),
            outcome("wls_verified", 6, "Level sensor OK", "Frequency and connections verified."),
        ],
    ),
    proc(
        "samsungwf6000r-drain-pump",
        "§4-3: Drain / leakage (LC, 5C)",
        "4-3",
        "Water Leakage / Drain Error",
        [30, 31],
        ["drain_pump"],
        ["LC", "5C", "drain_issue", "leak_check"],
        [
            visual("leak_inspection", 2, "Leak inspection", "Check base, hoses, valves, tub connections, and drain bellows for foreign material or leaks.", cp_yes_no("no_leak", "drain_motor_check", "repair_leak", "repair_leak_out", "Repair leak source and clear drain bellows.")),
            visual("drain_motor_check", 3, "Drain motor operation", "Verify drain motor/pump operates during natural drain. Clear bellows of wires/coins. Rule out winter freeze.", cp_yes_no("pump_runs", "drain_verified", "replace_drain_pump", "replace_pump_out", "Replace drain pump or motor when inoperative.")),
            outcome("repair_leak_out", 4, "Repair leak path", "Correct hose, valve, or tub leak; clear bellows obstruction."),
            outcome("replace_pump_out", 5, "Replace drain pump", "Replace drain pump motor assembly."),
            outcome("drain_verified", 6, "Drain path OK", "No leak; drain motor operates — retest LC/5C."),
        ],
    ),
    proc(
        "samsungwf6000r-inlet-valves",
        "§4-3: Inlet valves (4C, Co/Ho manual check)",
        "4-3",
        "Water Supply Error 4C",
        [29, 30],
        ["inlet_valve"],
        ["4C", "4C2", "fill_issue", "water_valve_check", "no_fill"],
        [
            visual("hose_routing", 2, "Hose routing", "Verify cold/hot hoses not reversed (4C2). Check detergent drawer transparent hose not folded or torn.", cp_yes_no("hoses_ok", "smart_install_valves", "fix_hoses", "fix_hoses_out", "Correct hose engagement and drawer hose routing.")),
            instr("smart_install_valves", 3, "Smart Install valve tests", "Enter Smart Install manual check. Steps Co (cold) and Ho (hot) exercise inlet valves. Drum must be empty.", "valve_visual"),
            visual("valve_visual", 4, "Valves operate in manual check", "Do cold and hot valves open and fill when commanded in manual check?", cp_yes_no("valves_run", "inlet_verified", "check_supply", "check_supply_out", "Verify taps open, screens clean, harness to valves; replace valve assembly.")),
            outcome("fix_hoses_out", 5, "Fix hose routing", "Correct hot/cold hose engagement and drawer hose."),
            outcome("check_supply_out", 6, "Check water supply", "Open taps, clean mesh filters, verify pressure and hose routing."),
            outcome("inlet_verified", 7, "Inlet valves OK", "Valves operate in Smart Install — supply and harness verified."),
        ],
    ),
    proc(
        "samsungwf6000r-communication",
        "§4-3: PBA communication (AC, AC3–AC6)",
        "4-3",
        "Communication Error AC",
        [29, 30],
        ["main_control", "inverter"],
        ["AC", "AC3", "AC4", "AC5", "AC6", "hmi_check"],
        [
            instr("comm_harness", 2, "Inspect sub/main harness", "AC: verify wire connections between sub and main PBAs. Check for moisture on sub PBA.", "comm_modules"),
            visual("comm_modules", 3, "Module-specific comm fault", "AC3 DR module, AC4 Wi-Fi, AC5 LCD, or AC6 inverter? Inspect that module harness and soldering.", cp_yes_no("harness_ok", "comm_power_cycle", "repair_harness", "repair_harness_out", "Repair harness or replace affected module/PBA.")),
            visual("comm_power_cycle", 4, "Comm restored after power cycle?", "After reconnecting harnesses and power cycle, does washer run without AC codes?", cp_yes_no("comm_ok", "comm_path_ok", "replace_pba", "replace_pba_out", "Replace main or inverter PBA per fault code.")),
            outcome("repair_harness_out", 5, "Repair harness/module", "Correct loose connections or replace comm module."),
            outcome("replace_pba_out", 6, "Replace PBA", "Replace main or inverter PBA per fault code."),
            outcome("comm_path_ok", 7, "Communication OK", "Harness and PBA communication verified."),
        ],
    ),
    proc(
        "samsungwf6000r-overflow",
        "§4-3: Overflow (OC)",
        "4-3",
        "Overflow Error OC",
        [29, 32],
        ["water_level_sensor"],
        ["OC", "overflow"],
        [
            visual("oc_hose", 2, "Level sensor hose", "Inspect hose to water level sensor — torn, hole, or frozen. Defrost if winter.", cp_yes_no("hose_intact", "oc_spin_retry", "repair_hose", "repair_hose_out", "Repair or replace level sensor hose; defrost if frozen.")),
            instr("oc_spin_retry", 3, "Restart after spin", "Restart cycle after spin. If OC remains, replace water level sensor.", "oc_verified"),
            outcome("repair_hose_out", 4, "Repair hose", "Correct hose damage or freezing condition."),
            outcome("oc_verified", 5, "Overflow resolved", "OC cleared — monitor level sensor if recurrence."),
        ],
    ),
    proc(
        "samsungwf6000r-power-supply",
        "§4-1: Power / voltage (9C1, 9C2)",
        "4-1",
        "Power Error 9C1/9C2",
        [28, 29],
        ["supply", "main_control"],
        ["9C1", "9C2", "no_power"],
        [
            visual("supply_voltage", 2, "Supply voltage", "Verify outlet voltage during Boil operation. Check for under/over voltage, shared outlet, or extension cord drop.", cp_yes_no("supply_ok", "ac_connector", "fix_supply", "fix_supply_out", "Correct supply — dedicated 120 V circuit; no undersized extension.")),
            visual("ac_connector", 3, "AC connector / motor short", "Inspect AC connector for short. Check motor connector for short to ground.", cp_yes_no("no_short", "pba_ok", "replace_motor_pba", "replace_motor_pba_out", "Replace motor and main PBA if motor shorted; PBA only if motor clean.")),
            outcome("fix_supply_out", 4, "Fix supply", "Correct installation and supply voltage."),
            outcome("replace_motor_pba_out", 5, "Replace motor and/or PBA", "Replace shorted motor and PBA per §4-1 9C1/9C2."),
            outcome("pba_ok", 6, "Power path OK", "Supply and connectors verified — replace PBA if 9C persists."),
        ],
    ),
    proc(
        "samsungwf6000r-unbalance",
        "§4-3: Unbalance (UV, UB)",
        "4-3",
        "Unbalance Error UV",
        [32],
        ["drive_motor"],
        ["UV", "UB", "unbalance", "vibration"],
        [
            visual("load_type", 2, "Load type and size", "Check laundry mix — single heavy item, tangled sheets, or small load can cause UV/UB.", cp_yes_no("load_balanced", "unbalance_ok", "rebalance_load", "rebalance_out", "Pause, redistribute or remove items, press Start to continue.")),
            visual("hall_path", 3, "Hall sensor after rebalance", "If UV repeats on balanced load, suspect hall sensor or motor — run motor circuit procedure.", cp_yes_no("uv_cleared", "unbalance_ok", "run_motor_proc", "run_motor_out", "Proceed to §4-3 3C motor/hall diagnosis.")),
            outcome("rebalance_out", 4, "Rebalance load", "Educate consumer on load size; redistribute and continue cycle."),
            outcome("run_motor_out", 5, "Motor/hall diagnosis", "Run samsungwf6000r-motor-circuit when UV persists on balanced loads."),
            outcome("unbalance_ok", 6, "Unbalance resolved", "Load rebalance cleared UV — no part replacement."),
        ],
    ),
    proc(
        "samsungwf6000r-mems-sensor",
        "§4-1: MEMS PBA (8C, 8C1, 8C2)",
        "4-1",
        "Mems PBA Error 8C",
        [28, 30],
        ["main_control"],
        ["8C", "8C1", "8C2"],
        [
            instr("mems_harness", 2, "Inspect MEMS harness", "Check wire connections to MEMS PBA per §4-1. Look for loose connectors or harness damage.", "mems_visual"),
            visual("mems_visual", 3, "MEMS connections secure?", "All MEMS PBA connectors seated and harness intact?", cp_yes_no("mems_ok", "mems_verified", "replace_mems", "replace_mems_out", "Replace MEMS PBA assembly.")),
            outcome("replace_mems_out", 4, "Replace MEMS PBA", "Replace MEMS PBA when connections verified but 8C persists."),
            outcome("mems_verified", 5, "MEMS path OK", "Harness verified — replace MEMS PBA if code returns."),
        ],
    ),
    proc(
        "samsungwf6000r-hmi-switch",
        "§4-1: Switch error (BC2)",
        "4-1",
        "Switch Error BC2",
        [27, 29],
        ["main_control"],
        ["BC2", "hmi_check"],
        [
            visual("stuck_button", 2, "Stuck button check", "Verify no button pressed >30 s. Check control panel deformation and sub PBA screw torque.", cp_yes_no("buttons_free", "bc2_verified", "repair_panel", "repair_panel_out", "Relieve panel deformation or replace sub PBA/control panel.")),
            outcome("repair_panel_out", 3, "Repair panel/PBA", "Correct mechanical bind or replace sub PBA when switch stuck."),
            outcome("bc2_verified", 4, "Switch path OK", "No stuck buttons — replace sub PBA if BC2 persists."),
        ],
    ),
]


def smart_install_entry_bundle() -> dict:
    return {
        "id": "samsungwf6000r-smart-install-entry",
        "version": "1.0.0",
        "platformId": "samsung_fl_washer_wf6000r",
        "manualId": SOURCE["manualId"],
        "title": "Samsung WF6000R — Smart Install entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter Smart Install (AS) for automatic/manual component checks and diagnostic code display.",
        "tags": ["service_diagnostic", "smart_install"],
        "entryStepId": "si_prep",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [29]},
        "steps": [
            instr("si_prep", 1, "Standby — empty drum", "Washer standby. Drum empty. Set scheduled time to 17:00 for Smart Install path per manual.", "si_enter"),
            instr("si_enter", 2, "Enter Smart Install", "Press Start/Pause for 7 seconds after scheduled time setup. Display shows AS when Smart Install is active.", "@continue", "Press Start/Pause for 7 seconds."),
        ],
    }


def manual_check_bundle() -> dict:
    return {
        "id": "samsungwf6000r-manual-check-mode",
        "version": "1.0.0",
        "platformId": "samsung_fl_washer_wf6000r",
        "manualId": SOURCE["manualId"],
        "title": "Samsung WF6000R — Manual check mode",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "Manual Smart Install — press Delay End to step components; Spin advances steps.",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "mc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [29]},
        "steps": [
            instr("mc_enter", 1, "Enter manual check", "From AS display: press Delay End to enter manual mode. Press Spin to advance: 1 door lock, 2 drain, 3 prep valve, Co cold, Ho hot, 6 water shot/heater/rinse, 7 drain, 8 spin, 9 dry heater/fan, 10 door.", "@continue"),
        ],
    }


def diagnostic_code_bundle() -> dict:
    return {
        "id": "samsungwf6000r-diagnostic-code-check",
        "version": "1.0.0",
        "platformId": "samsung_fl_washer_wf6000r",
        "manualId": SOURCE["manualId"],
        "title": "Samsung WF6000R — Diagnostic code display",
        "modeKind": "fault_codes",
        "uiVariants": ["any"],
        "description": "Review stored diagnostic codes (up to 7 digits) from Smart Install.",
        "tags": ["fault_codes", "error_code"],
        "entryStepId": "dc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [29]},
        "steps": [
            instr("dc_enter", 1, "Diagnostic information display", "From AS: press first bottom-right button → CR display → jog dial CW for up to 7 stored codes (latest first).", "@continue"),
        ],
    }


BUNDLES = [smart_install_entry_bundle(), manual_check_bundle(), diagnostic_code_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]

CODE_TAGS = {
    "DC", "AC", "OC", "LC", "HC", "TC1", "UB", "UV", "BC2", "DDC", "DC3",
    "9C1", "9C2", "4C", "4C2", "5C", "8C", "8C1", "8C2", "3E",
}


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "samsung_fl_washer_wf6000r",
        "templateId": "washer",
        "label": "Samsung FL washer WF6000R (WF45T/WF45R/WF22R)",
        "notes": "Smart Install §4-2 + corrective actions §4-3. Motor 6.0 Ω @ connector (not TL 19.3 Ω).",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [t for t in item.get("tags", []) if t[0].isdigit() or t in CODE_TAGS],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# Samsung FL washer WF6000R — OEM procedures

**Platform:** `samsung_fl_washer_wf6000r`
**Manual:** `SAMSUNG-FL-WF6000R-WASHER` (WF45T/WF45R/WF22R/WF20T)
**Extraction:** `knowledge/pattern-catalog/SAMSUNG_FL_WF6000R_WASHER_EXTRACTION.md`
**Measurements:** `knowledge/seed/measurement-knowledge-batch42.json`

Regenerate: `python backend/scripts/generate_samsung_fl_wf6000r_washer_procedure_seeds.py`
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)
    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        (OUT / filename).write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {filename}")
    for item, filename in zip(BUNDLES, BUNDLE_FILES, strict=True):
        (BUNDLE_OUT / filename).write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote bundles/{filename}")
    write_catalog()
    write_readme()
    for script in (
        "attach_samsung_fl_wf6000r_washer_diagnostic_effects.py",
        "attach_samsung_fl_wf6000r_washer_service_modes.py",
        "attach_samsung_fl_wf6000r_procedure_diagrams.py",
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
