#!/usr/bin/env python3
"""Generate Samsung WD53/WD80 all-in-one laundry combo procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_laundry_combo"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-LAUNDRY-COMBO-WD53",
    "manualTitle": "Samsung All-in-One Laundry Combo WD53/WD80 (WD53DBA900HZA1)",
    "extractedTextFile": "backend/docs/manuals/samsung aio wd53dba900hza1-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the combo or disconnect power before servicing. Discharge PBA terminals per manual.",
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
        "platformId": "samsung_laundry_combo",
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
        "samsungwd53-water-level-sensor",
        "§4-4: Water level sensor (1C)",
        "4-4",
        "Water Level Sensor 1C",
        [55, 57],
        ["water_level_sensor"],
        ["1C", "fill_issue"],
        [
            visual("wls_hose", 2, "Level sensor hose and terminals", "Check hose not punctured, folded, or clogged. Verify correct material-code sensor installed.", cp_yes_no("hose_ok", "wls_frequency", "fix_hose", "fix_hose_out", "Repair hose routing or replace incorrect sensor part.")),
            meas("wls_frequency", 3, "Level sensor frequency", "Connect sensor and connector. Measure frequency Pink–Orange — approx. 25.5 kHz with no load.", "samsungLaundryComboWaterLevelFrequency", "Level sensor", "Pink & Orange", ohm_branches("wls", "wls_verified", "replace_wls", "~25.5 kHz")),
            outcome("fix_hose_out", 4, "Fix hose/sensor", "Correct hose and sensor installation."),
            outcome("replace_wls", 5, "Replace level sensor", "Replace water level sensor; replace PBA if 1C persists."),
            outcome("wls_verified", 6, "Level sensor OK", "Frequency and connections verified."),
        ],
    ),
    proc(
        "samsungwd53-motor-circuit",
        "§4-4: Washing motor (3C)",
        "4-4",
        "Washing Motor Error 3C",
        [55, 57],
        ["drive_motor"],
        ["3C", "3C1", "3C2", "3C3", "3C4", "3E", "motor_check", "spin_issue"],
        [
            visual("motor_overload", 2, "Rule out overload (3C1)", "3C1 displays when overloading due to too much laundry — redistribute load before motor diagnosis.", cp_yes_no("load_ok", "disconnect_motor", "redistribute_load", "redistribute_load_out", "Redistribute load and retest.")),
            instr("disconnect_motor", 3, "Inspect motor connector", "Check motor connector seated. Inspect stator cover and coil for moisture or foreign material.", "motor_ohms"),
            meas("motor_ohms", 4, "Motor winding resistance", "Disconnect connector. Measure any two of three motor terminals — 6.0 Ω @ 25°C per §4-4 3C.", "samsungLaundryComboMotorOhms", "Motor", "Any two of three", ohm_branches("motor", "reconnect_motor", "replace_motor", "~6.0 Ω")),
            instr("reconnect_motor", 5, "Reconnect motor", "Reconnect harness. Use Smart Install manual check step 8 (dehydration) to verify spin.", "live_motor_check"),
            visual("live_motor_check", 6, "Motor runs in manual check", "Does drum spin in Smart Install dehydration test?", cp_yes_no("motor_runs", "motor_ok", "suspect_pba", "suspect_pba_out", "Replace main/inverter PBA after confirming motor and harness.")),
            outcome("redistribute_load_out", 7, "Redistribute load", "Correct load size before condemning motor."),
            outcome("replace_motor", 8, "Replace motor", "Replace motor when windings open or out of OEM range."),
            outcome("motor_ok", 9, "Motor verified", "Motor ohms and live spin verified."),
            outcome("suspect_pba_out", 10, "Suspect PBA", "Replace PBA when motor checks pass but 3C remains."),
        ],
    ),
    proc(
        "samsungwd53-inlet-valves",
        "§4-4: Inlet valves (4C, Co/Ho manual check)",
        "4-4",
        "Water Supply Error 4C",
        [47, 55],
        ["inlet_valve"],
        ["4C", "4C2", "fill_issue", "water_valve_check"],
        [
            visual("hose_routing", 2, "Hose routing", "Verify cold/hot hoses not reversed (4C2). Check detergent drawer pressure hose not folded or torn.", cp_yes_no("hoses_ok", "smart_install_valves", "fix_hoses", "fix_hoses_out", "Correct hose engagement and drawer hose routing.")),
            instr("smart_install_valves", 3, "Smart Install valve tests", "Enter Smart Install manual check. Steps Co (cold) and Ho (hot) exercise inlet valves. Drum must be empty.", "valve_visual"),
            visual("valve_visual", 4, "Valves operate in manual check", "Do cold and hot valves open when commanded?", cp_yes_no("valves_run", "inlet_verified", "check_supply", "check_supply_out", "Verify taps open, screens clean; replace valve assembly.")),
            outcome("fix_hoses_out", 5, "Fix hose routing", "Correct hot/cold engagement and drawer hose."),
            outcome("check_supply_out", 6, "Check water supply", "Open taps, clean mesh filters, verify pressure."),
            outcome("inlet_verified", 7, "Inlet valves OK", "Valves operate in Smart Install."),
        ],
    ),
    proc(
        "samsungwd53-drain-pump",
        "§4-4: Drain pump (5C) / §4-5 pump motor",
        "4-4",
        "Drain Error 5C",
        [55, 59],
        ["drain_pump"],
        ["5C", "drain_issue", "condensate"],
        [
            visual("pump_debris", 2, "Pump and bellows", "Check drain bellows for foreign material. Verify pump wiring connections. Rule out winter freeze.", cp_yes_no("pump_clear", "pump_ohms", "clear_pump", "clear_pump_out", "Remove debris from pump housing and bellows.")),
            meas("pump_ohms", 3, "Drain pump resistance", "Measure pump motor — 330 Ω per §4-5 #7.", "samsungLaundryComboDrainPumpOhms", "Drain pump", "Motor terminals", ohm_branches("pump", "pump_run_check", "replace_pump_out", "~330 Ω")),
            visual("pump_run_check", 4, "Pump runs", "Natural drain or Smart Install step 7 — pump operates?", cp_yes_no("pump_runs", "drain_verified", "replace_pump_out", "replace_pump_out", "Replace drain pump motor.")),
            outcome("clear_pump_out", 5, "Clear pump", "Remove obstruction and retest."),
            outcome("replace_pump_out", 6, "Replace drain pump", "Replace pump when open or inoperative."),
            outcome("drain_verified", 7, "Drain OK", "Pump resistance and operation verified."),
        ],
    ),
    proc(
        "samsungwd53-communication",
        "§4-4: PBA communication (AC, AC3–AC6)",
        "4-4",
        "Communication Error AC",
        [47, 55],
        ["main_control", "inverter"],
        ["AC", "AC3", "AC4", "AC5", "AC6", "hmi_check"],
        [
            instr("comm_harness", 2, "Inspect sub/main harness", "AC: verify wire connections between sub and main PBAs. Check for moisture on sub PBA.", "comm_modules"),
            visual("comm_modules", 3, "Module-specific comm fault", "AC3 DR module, AC4 Wi-Fi, AC5 LCD, or AC6 inverter? Inspect that module harness.", cp_yes_no("harness_ok", "comm_power_cycle", "repair_harness", "repair_harness_out", "Repair harness or replace affected module/PBA.")),
            visual("comm_power_cycle", 4, "Comm restored after power cycle?", "After reconnecting harnesses and power cycle, does combo run without AC codes?", cp_yes_no("comm_ok", "comm_path_ok", "replace_pba", "replace_pba_out", "Replace main or inverter PBA per fault code.")),
            outcome("repair_harness_out", 5, "Repair harness/module", "Correct loose connections or replace comm module."),
            outcome("replace_pba_out", 6, "Replace PBA", "Replace main or inverter PBA per fault code."),
            outcome("comm_path_ok", 7, "Communication OK", "Harness and PBA communication verified."),
        ],
    ),
    proc(
        "samsungwd53-door-lock",
        "§4-4: Door lock and switch (DC, DC1, dC1)",
        "4-4",
        "Door Error DC / DC1",
        [50, 56],
        ["door_lock"],
        ["DC", "DC1", "dC1", "dC2", "dC", "door_lock_check"],
        [
            visual("dc_boil_check", 2, "DC during Boil cycle?", "If DC occurs during Boil cycle, verify door fully closed and not caught.", cp_yes_no("door_closed", "door_type_check", "close_door", "close_door_out", "Close door securely and retest.")),
            visual("door_type_check", 3, "Door switch type", "TYPE 1 door switch (pins 1–3 ~175 Ω) or TYPE 2/3 lock switch (pins 2–3 with slider pushed)?", [
                {"id": "type1", "label": "TYPE 1 door switch", "when": {"kind": "checkpoint_yes"}, "nextStepId": "door_switch_ohms"},
                {"id": "type23", "label": "TYPE 2/3 lock switch", "when": {"kind": "checkpoint_no"}, "nextStepId": "door_lock_ohms"},
            ]),
            meas("door_switch_ohms", 4, "TYPE 1 door switch (pins 1–3)", "Approximately 175 Ω.", "samsungLaundryComboDoorSwitchOhms", "Door switch", "1 & 3", ohm_branches("ds", "door_verified", "replace_door_switch", "~175 Ω")),
            meas("door_lock_ohms", 4, "TYPE 2/3 lock switch (pins 2–3)", "Push slider — TYPE 2: 60–90 Ω; TYPE 3: 65–75 Ω.", "samsungLaundryComboDoorLockOhms", "Door lock", "2 & 3", ohm_branches("dl", "door_cam_check", "replace_door_lock", "60–90 Ω")),
            visual("door_cam_check", 5, "CAM and lever door", "Check CAM status, lever door, and door sagging per §4-2 dC1.", cp_yes_no("cam_ok", "door_verified", "replace_lock_switch", "replace_lock_switch_out", "Replace door lock switch when CAM/lever OK but dC1 persists.")),
            outcome("close_door_out", 6, "Close door", "Ensure door closed and laundry not caught."),
            outcome("replace_door_switch", 7, "Replace door switch", "Replace faulty door switch."),
            outcome("replace_door_lock", 8, "Replace door lock", "Replace door lock assembly."),
            outcome("replace_lock_switch_out", 9, "Replace lock switch", "Replace door lock switch when mechanical path OK."),
            outcome("door_verified", 10, "Door circuit OK", "Door switch/lock in spec — inspect main PBA if code persists."),
        ],
    ),
    proc(
        "samsungwd53-wash-heater",
        "§4-4: Wash heater (HC, HC1)",
        "4-4",
        "Heater Error HC",
        [45, 56],
        ["wash_heater", "wash_ntc"],
        ["HC", "HC1", "no_heat", "heating_element_check"],
        [
            instr("heater_access", 2, "Access heater terminals", "Disconnect power. Access wash heater at tub front (terminals A and B per §4-4 TYPE 1).", "heater_in_circuit"),
            meas("heater_in_circuit", 3, "Heater A–B resistance (TYPE 1)", "Measure between A and B. Expected 16.05 ± 0.65 Ω.", "samsungLaundryComboWashHeaterInCircuitOhms", "Heater", "A & B", ohm_branches("hc_ab", "heater_ok_in_circuit", "bench_heater", "~16 Ω")),
            instr("bench_heater", 4, "Bench heater element", "Remove heater per §3. Measure element: 27.1 Ω (1900 W) or 26.2 Ω (2000 W).", "heater_bench"),
            meas("heater_bench", 5, "Heater bench ohms", "Measure heater element resistance.", "samsungLaundryComboWashHeaterOhms", "Heater element", "Terminals", ohm_branches("hc_bench", "check_thermistor", "replace_heater", "27.1/26.2 Ω")),
            instr("check_thermistor", 6, "TYPE 2 — wash thermistor", "If heater ohms OK, check wash thermistor at back of tub (§4-4 TYPE 2).", "thermistor_ohms"),
            meas("thermistor_ohms", 7, "Wash thermistor @ room", "Expected ~12 kΩ at room temperature.", "samsungLaundryComboWashThermistorOhms", "Thermistor", "Connector", ohm_branches("ntc", "heater_path_ok", "replace_thermistor", "~12 kΩ")),
            outcome("heater_ok_in_circuit", 8, "Heater in-circuit OK", "A–B in range — if HC persists, replace wash thermistor."),
            outcome("replace_heater", 9, "Replace heater", "Replace wash heater when open or out of range."),
            outcome("replace_thermistor", 10, "Replace thermistor", "Replace wash thermistor when out of range."),
            outcome("heater_path_ok", 11, "Heater path verified", "Heater and thermistor in spec."),
        ],
    ),
    proc(
        "samsungwd53-wash-thermistor",
        "§4-4: Wash temperature sensor (TC1)",
        "4-4",
        "Temperature Sensor Error TC1",
        [49, 57],
        ["wash_ntc"],
        ["TC1", "thermistor"],
        [
            instr("tc1_connector", 2, "Check thermistor connector", "Verify washing heater temperature sensor connector seated. Rule out frozen hose in winter.", "tc1_ohms"),
            meas("tc1_ohms", 3, "Wash thermistor resistance", "Measure at thermistor connector — ~12 kΩ at room temp.", "samsungLaundryComboWashThermistorOhms", "Thermistor", "Connector", ohm_branches("tc1", "tc1_verified", "replace_tc1_ntc", "~12 kΩ")),
            outcome("replace_tc1_ntc", 4, "Replace thermistor", "Replace washing temperature sensor when faulty."),
            outcome("tc1_verified", 5, "Thermistor OK", "TC1 path verified."),
        ],
    ),
    proc(
        "samsungwd53-overflow",
        "§4-4: Overflow (OC)",
        "4-4",
        "Overflow Error OC",
        [49, 57],
        ["water_level_sensor", "inlet_valve"],
        ["OC", "overflow"],
        [
            visual("oc_valve", 2, "Continuous fill check", "Check for stuck inlet valve or frozen supply causing continuous water.", cp_yes_no("valve_ok", "oc_hose", "service_valve", "service_valve_out", "Replace inlet valve or clear obstruction.")),
            visual("oc_hose", 3, "Level sensor hose", "Inspect hose — torn, hole, or frozen. Defrost if winter.", cp_yes_no("hose_intact", "oc_verified", "repair_hose", "repair_hose_out", "Repair hose or replace level sensor.")),
            outcome("service_valve_out", 4, "Service inlet valve", "Clear foreign material or replace stuck valve."),
            outcome("repair_hose_out", 5, "Repair hose", "Correct hose damage or freezing."),
            outcome("oc_verified", 6, "Overflow resolved", "OC path addressed."),
        ],
    ),
    proc(
        "samsungwd53-unbalance",
        "§4-4: Unbalance (UB, UB1)",
        "4-4",
        "Unbalance Error UB",
        [49, 58],
        ["drive_motor"],
        ["UB", "UB1", "unbalance", "vibration"],
        [
            visual("load_type", 2, "Load type and size", "Check laundry mix — single heavy item or tarpaulin cover (UB1) can trigger unbalance.", cp_yes_no("load_balanced", "unbalance_ok", "rebalance_load", "rebalance_out", "Pause, redistribute or remove items, press Start.")),
            outcome("rebalance_out", 3, "Rebalance load", "Educate consumer on load size; redistribute and continue."),
            outcome("unbalance_ok", 4, "Unbalance resolved", "UB cleared after load correction."),
        ],
    ),
    proc(
        "samsungwd53-mems-sensor",
        "§4-4: MEMS sensor (8C, 8C1, 8C2)",
        "4-4",
        "Mems Error 8C",
        [49, 58],
        ["main_control"],
        ["8C", "8C1", "8C2"],
        [
            visual("mems_vibration", 2, "Excessive vibration", "Check unit for excessive vibration per §4-4 8C1.", cp_yes_no("vibration_ok", "mems_wiring", "level_unit", "level_unit_out", "Level machine and reduce vibration source.")),
            visual("mems_wiring", 3, "MEMS harness", "Check wire connections to main PBA. Rule out disconnection.", cp_yes_no("wiring_ok", "mems_verified", "replace_pba", "replace_pba_out", "Replace main PBA when 8C persists.")),
            outcome("level_unit_out", 4, "Level unit", "Correct installation level and vibration."),
            outcome("replace_pba_out", 5, "Replace main PBA", "Replace main PBA when wiring intact but 8C persists."),
            outcome("mems_verified", 6, "MEMS path OK", "Vibration and connections verified."),
        ],
    ),
    proc(
        "samsungwd53-power-supply",
        "§4-4: Power (9C1, 9C2, 9C5)",
        "4-4",
        "Power Error 9C",
        [48, 58],
        ["supply", "main_control"],
        ["9C1", "9C2", "9C5", "9C9", "no_power"],
        [
            visual("supply_voltage", 2, "Supply voltage", "Verify operating voltage during Sanitize/Boil. Check extension cord drop and shared outlet.", cp_yes_no("supply_ok", "ac_connector", "fix_supply", "fix_supply_out", "Correct dedicated circuit; no undersized extension.")),
            visual("ac_connector", 3, "AC connector / motor short", "Inspect AC connector for short. Check motor connector for short to ground (9C5).", cp_yes_no("no_short", "pba_ok", "replace_motor_pba", "replace_motor_pba_out", "Replace motor and main PBA if motor shorted.")),
            outcome("fix_supply_out", 4, "Fix supply", "Correct installation and supply voltage."),
            outcome("replace_motor_pba_out", 5, "Replace motor and/or PBA", "Replace shorted motor and PBA per §4-4 9C."),
            outcome("pba_ok", 6, "Power path OK", "Supply and connectors verified."),
        ],
    ),
    proc(
        "samsungwd53-hmi-check",
        "§4-4: Switch error (BC2, bC2)",
        "4-4",
        "Switch Error BC2",
        [50, 52],
        ["user_interface"],
        ["BC2", "bC2", "hmi_check"],
        [
            visual("stuck_button", 2, "Stuck button / panel moisture", "Verify no button pressed >30 s. Check water on window panel and rear PCB connector.", cp_yes_no("buttons_free", "bc2_verified", "repair_panel", "repair_panel_out", "Dry panel, relieve deformation, or replace sub PBA.")),
            outcome("repair_panel_out", 3, "Repair panel/PBA", "Correct mechanical bind or replace sub PBA."),
            outcome("bc2_verified", 4, "Switch path OK", "No stuck buttons — replace sub PBA if BC2 persists."),
        ],
    ),
    proc(
        "samsungwd53-leak-check",
        "§4-4: Water leakage (LC)",
        "4-4",
        "Water Leakage LC",
        [49, 57],
        ["drain_pump"],
        ["LC", "leak_check", "drain_issue"],
        [
            visual("bellows_check", 2, "Drain bellows", "Check draining bellows for underwear, wires, coins. Remove foreign material.", cp_yes_no("bellows_clear", "leak_inspection", "clear_bellows", "clear_bellows_out", "Clear bellows obstruction.")),
            visual("leak_inspection", 3, "Leak source", "Inspect base, hoses, valves, tub, diaphragm, and drain motor for leaks.", cp_yes_no("no_leak", "leak_verified", "repair_leak", "repair_leak_out", "Repair leak path or replace drain motor.")),
            outcome("clear_bellows_out", 4, "Clear bellows", "Remove foreign material from drain bellows."),
            outcome("repair_leak_out", 5, "Repair leak", "Correct hose, tub, or pump leak."),
            outcome("leak_verified", 6, "Leak path OK", "No leak found — retest LC."),
        ],
    ),
    proc(
        "samsungwd53-heat-pump-thermistors",
        "§4-5: Heat pump thermistors (tC, TC5–TCB)",
        "4-5",
        "Heat Pump Thermistor Tests",
        [50, 59],
        ["compressor", "condenser"],
        ["tC", "TC5", "TC7", "TC8", "TCA", "TCB", "TCH", "heat_pump_dry"],
        [
            instr("clean_filter", 2, "Clean condenser filter", "Clean case filter first when tC displays per §4-2.", "duct_thermistor"),
            meas("duct_thermistor", 3, "Duct / discharge thermistor", "50 kΩ ± 7% @ 25°C (2P pins 1–2).", "samsungLaundryComboDuctThermistorOhms", "Duct thermistor", "2P 1–2", ohm_branches("duct", "eva_thermistor", "replace_duct_ntc", "50 kΩ")),
            meas("eva_thermistor", 4, "EVA IN / EVA OUT thermistor", "10 kΩ ± 3% @ 25°C (4P pins 1–2 / 3–4).", "samsungLaundryComboEvaThermistorOhms", "EVA thermistors", "1–2 / 3–4", ohm_branches("eva", "comp_top_thermistor", "replace_eva_ntc", "10 kΩ")),
            meas("comp_top_thermistor", 5, "Compressor top thermistor", "200 kΩ ± 3% @ 25°C (2P pins 1–2).", "samsungLaundryComboCompTopThermistorOhms", "Comp top NTC", "2P 1–2", ohm_branches("cta", "heater_thermistor", "replace_comp_ntc", "200 kΩ")),
            meas("heater_thermistor", 6, "Dry heater thermistor", "238.23 kΩ ± 7.5% @ 25°C (4P pins 1–4).", "samsungLaundryComboHeaterThermistorOhms", "Heater NTC", "4P 1–4", ohm_branches("htb", "hp_ntc_verified", "replace_heater_ntc", "238 kΩ")),
            outcome("replace_duct_ntc", 7, "Replace duct/discharge NTC", "Replace duct or discharge thermistor."),
            outcome("replace_eva_ntc", 8, "Replace EVA NTC", "Replace EVA IN or OUT thermistor."),
            outcome("replace_comp_ntc", 9, "Replace comp top NTC", "Replace compressor top thermistor."),
            outcome("replace_heater_ntc", 10, "Replace heater NTC", "Replace dry heater thermistor."),
            outcome("hp_ntc_verified", 11, "Heat pump NTCs OK", "All thermistors in spec — inspect harness and inverter PBA."),
        ],
    ),
    proc(
        "samsungwd53-dry-heater",
        "§4-5: Dry heater element (#5)",
        "4-5",
        "Dry Heater Resistance",
        [59],
        ["heating_element"],
        ["no_heat", "heat_pump_dry", "dryer_no_heat"],
        [
            instr("dry_heater_access", 2, "Access dry heater", "Disconnect power. Access heat pump dry heater at 3P connector pins 1–3.", "dry_heater_ohms"),
            meas("dry_heater_ohms", 3, "Dry heater resistance", "Expected 35.6–39.4 Ω.", "samsungLaundryComboDryHeaterOhms", "Dry heater", "3P 1–3", ohm_branches("dh", "dry_heater_ok", "replace_dry_heater", "35.6–39.4 Ω")),
            outcome("replace_dry_heater", 4, "Replace dry heater", "Replace dry heater element when open or out of range."),
            outcome("dry_heater_ok", 5, "Dry heater OK", "Dry heater element in spec."),
        ],
    ),
    proc(
        "samsungwd53-compressor",
        "§4-2: BLDC compressor (3CA, HC)",
        "4-2",
        "Compressor / Inverter 3CA",
        [50, 52],
        ["compressor", "inverter"],
        ["3CA", "3CA1", "3CA2", "3CA3", "3CA4", "3CA5", "3CA6", "3CA7", "3CA8", "HC", "compressor", "heat_pump_dry"],
        [
            instr("comp_harness", 2, "Compressor harness", "Check wire terminals between PBA connector and compressor. Look for short circuit on PBA.", "comp_fan_check"),
            visual("comp_fan_check", 3, "Compressor / inverter fan", "Apply DC 12 V to compressor fan (Red–Black) and inverter frame fan per §4-5 #8–9. Fans run?", cp_yes_no("fans_run", "comp_overload_check", "replace_fan", "replace_fan_out", "Replace fan motor or harness.")),
            visual("comp_overload_check", 4, "Rule out overload (3CA1)", "3CA1 can display from too much laundry in dry — reduce load and retest.", cp_yes_no("load_ok", "suspect_inverter", "reduce_load", "reduce_load_out", "Reduce dry load and retest.")),
            visual("suspect_inverter", 5, "Inverter PBA / compressor", "If harness and fans OK but 3CA/HC persists, replace inverter PBA or compressor per §4-2.", cp_yes_no("cleared", "compressor_ok", "replace_inverter", "replace_inverter_out", "Replace inverter PBA or BLDC compressor.")),
            outcome("replace_fan_out", 6, "Replace fan", "Replace compressor or inverter cooling fan."),
            outcome("reduce_load_out", 7, "Reduce load", "Correct overload condition before condemning compressor."),
            outcome("replace_inverter_out", 8, "Replace inverter/compressor", "Replace inverter PBA or BLDC compressor assembly."),
            outcome("compressor_ok", 9, "Compressor path OK", "Harness, fans, and load verified."),
        ],
    ),
    proc(
        "samsungwd53-filter-check",
        "§4-2: Filter and cover magnets (NC, NC2, NC3)",
        "4-2",
        "Filter / Cover NC",
        [51, 52],
        ["lint_filter"],
        ["NC", "NC2", "NC3"],
        [
            visual("filter_inserted", 2, "Dryer filter inserted", "NC: insert dryer filter. Verify magnet inside filter module.", cp_yes_no("filter_ok", "cover_check", "insert_filter", "insert_filter_out", "Insert filter and press Start.")),
            visual("cover_check", 3, "Heat exchanger cover / dehumidifying kit", "NC2: heat exchanger protective cover. NC3: dehumidifying kit. Verify magnets present.", cp_yes_no("covers_ok", "filter_verified", "install_covers", "install_covers_out", "Install missing cover or kit with magnet.")),
            outcome("insert_filter_out", 4, "Insert filter", "Install dryer lint filter correctly."),
            outcome("install_covers_out", 5, "Install covers", "Install heat exchanger cover or dehumidifying kit."),
            outcome("filter_verified", 6, "Covers OK", "Filter and covers detected — suspect PBA if NC persists."),
        ],
    ),
    proc(
        "samsungwd53-foam-detection",
        "§4-2: Foam detection (ULC)",
        "4-2",
        "Foam ULC",
        [51],
        ["main_control"],
        ["ULC"],
        [
            visual("foam_clear", 2, "Remove foam", "Remove foam inside dryer. Run dehumidification course.", cp_yes_no("foam_clear", "touch_sensor", "clear_foam", "clear_foam_out", "Remove foam and retest.")),
            visual("touch_sensor", 3, "Touch sensor clean", "Check touch sensor inside dryer for water or magnetic substance.", cp_yes_no("sensor_clean", "ulc_verified", "replace_pba", "replace_pba_out", "Replace PBA if ULC persists after cleaning.")),
            outcome("clear_foam_out", 4, "Clear foam", "Remove foam and run dehumidification course."),
            outcome("replace_pba_out", 5, "Replace PBA", "Replace PBA when cleaning does not clear ULC."),
            outcome("ulc_verified", 6, "ULC resolved", "Foam cleared and sensor clean."),
        ],
    ),
    proc(
        "samsungwd53-auto-open-door",
        "§4-2: Auto-open door (DC5)",
        "4-2",
        "Auto-Open Door DC5",
        [51],
        ["door_lock"],
        ["DC5"],
        [
            visual("door_clearance", 2, "Door clearance", "Ensure enough space for auto-open door. Wait for function to complete.", cp_yes_no("clearance_ok", "dc5_verified", "clear_obstruction", "clear_obstruction_out", "Clear obstruction blocking door swing.")),
            outcome("clear_obstruction_out", 3, "Clear obstruction", "Provide door swing clearance and retest."),
            outcome("dc5_verified", 4, "Auto-open OK", "Door opens automatically — inspect door component or PBA if DC5 returns."),
        ],
    ),
    proc(
        "samsungwd53-system-fault",
        "§4-4: System error (SF)",
        "4-4",
        "System Error SF",
        [49],
        ["main_control"],
        ["SF"],
        [
            instr("sf_power_cycle", 2, "Power cycle", "Unplug 1 minute. SF = microcontroller operation fail per §4-4.", "sf_retest"),
            visual("sf_retest", 3, "SF cleared?", "After power cycle, does combo run without SF?", cp_yes_no("sf_cleared", "sf_ok", "replace_pcb", "replace_pcb_out", "Replace Assy PCB per manual.")),
            outcome("replace_pcb_out", 4, "Replace Assy PCB", "Replace main PCB assembly when SF persists."),
            outcome("sf_ok", 5, "System OK", "SF cleared after power cycle."),
        ],
    ),
]


def smart_install_entry_bundle() -> dict:
    return {
        "id": "samsungwd53-smart-install-entry",
        "version": "1.0.0",
        "platformId": "samsung_laundry_combo",
        "manualId": SOURCE["manualId"],
        "title": "Samsung WD53 — Smart Install entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter Smart Install (AS) from Hidden Mode or Product Care Self Clean+ tap sequence.",
        "tags": ["service_diagnostic", "smart_install"],
        "entryStepId": "si_prep",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [52, 54]},
        "steps": [
            instr("si_prep", 1, "Standby — empty drum", "Combo standby. Drum empty. Access Hidden Mode or Product Care.", "si_enter"),
            instr("si_enter", 2, "Enter Smart Install", "Hidden Mode → Smart Install, OR Product Care → Self Clean+ tap 25× (tabs within 1 s). Password: washerdryer.1! Display shows AS with Micom/LCD versions.", "@continue", "Smart Install active when AS displays."),
        ],
    }


def manual_check_bundle() -> dict:
    return {
        "id": "samsungwd53-manual-check-mode",
        "version": "1.0.0",
        "platformId": "samsung_laundry_combo",
        "manualId": SOURCE["manualId"],
        "title": "Samsung WD53 — Manual check mode",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "Manual Smart Install — press Start Manual mode to advance each component test.",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "mc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [54, 56]},
        "steps": [
            instr("mc_enter", 1, "Enter manual check", "From AS: Start Manual mode. Each press advances: 1 door lock, 2 drain, 3 prep valve, Co cold, Ho hot, 6 water shot/heater/rinse, 7 drain, 8 spin, 9 dry heater/fan, 10 door. OK(Ot)=pass; nG=fail.", "@continue"),
        ],
    }


def diagnostic_code_bundle() -> dict:
    return {
        "id": "samsungwd53-diagnostic-code-check",
        "version": "1.0.0",
        "platformId": "samsung_laundry_combo",
        "manualId": SOURCE["manualId"],
        "title": "Samsung WD53 — Diagnostic code display",
        "modeKind": "fault_codes",
        "uiVariants": ["any"],
        "description": "Review stored diagnostic codes (up to 7 digits) from Smart Install.",
        "tags": ["fault_codes", "error_code"],
        "entryStepId": "dc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [54, 56]},
        "steps": [
            instr("dc_enter", 1, "Diagnostic information display", "From AS: press first bottom-right button → CR appears. Turn jog dial CW — up to 7 stored codes display.", "@continue"),
        ],
    }


BUNDLES = [smart_install_entry_bundle(), manual_check_bundle(), diagnostic_code_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]

CODE_TAGS = {
    "DC", "AC", "OC", "LC", "HC", "TC1", "UB", "BC2", "bC2", "dC", "dC1", "dC2",
    "9C1", "9C2", "9C5", "9C9", "4C", "4C2", "5C", "8C", "8C1", "8C2", "3E", "SF",
    "NC", "NC2", "NC3", "ULC", "DC5", "tC", "TC5", "TC7", "TC8", "TCA", "TCB", "TCH",
}


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "samsung_laundry_combo",
        "templateId": "aio_laundry",
        "label": "Samsung all-in-one laundry combo WD53/WD80",
        "notes": "§4-3 Smart Install + §4-4 wash corrective actions + §4-5 heat-pump Ω. Motor 6.0 Ω @ connector.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [t for t in item.get("tags", []) if t[0].isdigit() or t in CODE_TAGS or t[0].isalpha() and t[1:2].isdigit()],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# Samsung all-in-one laundry combo WD53 (`samsung_laundry_combo`)

**Manual:** SAMSUNG-LAUNDRY-COMBO-WD53 — samsung aio wd53dba900hza1.pdf
**Platform:** `samsung_laundry_combo` — WD53DBA*, WD8000DK heat-pump combo
**Template:** `aio_laundry`
**Extraction:** `knowledge/pattern-catalog/SAMSUNG_LAUNDRY_COMBO_WD53_EXTRACTION.md`
**Measurements:** `knowledge/seed/measurement-knowledge-batch43.json`

Regenerate: `python backend/scripts/generate_samsung_laundry_combo_wd53_procedure_seeds.py`
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
        "attach_samsung_laundry_combo_wd53_diagnostic_effects.py",
        "attach_samsung_laundry_combo_wd53_service_modes.py",
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
