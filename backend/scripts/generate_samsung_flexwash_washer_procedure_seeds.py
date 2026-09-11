#!/usr/bin/env python3
"""Generate Samsung FlexWash WV55M9600 dual-load washer procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_flexwash"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-FLEXWASH-WASHER",
    "manualTitle": "Samsung FlexWash WV55M9600 Dual-Load Washer",
    "extractedTextFile": "backend/docs/manuals/wv55m9600av-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the washer or disconnect power before servicing. Discharge PBA terminals per manual.",
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
        "platformId": "samsung_flexwash",
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
        "samsungflexwash-water-level-sensor",
        "§4-3: Water level sensor (1C)",
        "4-3",
        "Water Level Sensor 1C",
        [35, 37],
        ["water_level_sensor"],
        ["1C", "fill_issue"],
        [
            visual(
                "wls_hose",
                2,
                "Level sensor hose and terminals",
                "Check air hose not punctured, folded, or clogged. Verify sensor terminal connections and correct part code.",
                cp_yes_no("hose_ok", "wls_frequency", "fix_hose", "fix_hose_out", "Repair hose routing or replace incorrect sensor part."),
            ),
            instr(
                "wls_frequency",
                3,
                "Frequency check",
                "Connect sensor and connector. Measure frequency Pink–Orange — approx 25.3 kHz without water load.",
                "wls_verified",
            ),
            outcome("fix_hose_out", 4, "Fix hose/sensor", "Correct hose and sensor installation."),
            outcome("wls_verified", 5, "Level sensor OK", "Frequency and connections verified — replace PBA if 1C persists."),
        ],
    ),
    proc(
        "samsungflexwash-motor-circuit",
        "§4-3: Lower DD motor (3C)",
        "4-3",
        "Lower Washing Motor 3C",
        [37, 38],
        ["drive_motor"],
        ["3C", "motor_check", "spin_issue"],
        [
            instr(
                "disconnect_motor",
                2,
                "Inspect lower motor connector",
                "Check motor connector seated. Inspect stator cover and coil for moisture or foreign material. Verify IPM terminal on main PBA connected.",
                "motor_ohms",
            ),
            meas(
                "motor_ohms",
                3,
                "Lower motor winding resistance",
                "Disconnect connector. Measure Blue-White, White-Red, Red-Blue pairs — equal ~15 Ω.",
                "samsungFlexWashMotorOhms",
                "Lower DD motor",
                "Blue-White / White-Red / Red-Blue",
                ohm_branches("motor", "reconnect_motor", "replace_motor", "~15 Ω equal"),
            ),
            instr(
                "reconnect_motor",
                4,
                "Reconnect motor",
                "Reconnect harness. Use Smart Install manual check step 8 (dehydration) to verify lower drum spin.",
                "live_motor_check",
            ),
            visual(
                "live_motor_check",
                5,
                "Motor runs in manual check",
                "Does lower drum spin in Smart Install dehydration test?",
                cp_yes_no("motor_runs", "motor_ok", "suspect_inverter", "suspect_inverter_out", "Replace inverter PBA or main PBA after confirming motor and harness."),
            ),
            outcome("replace_motor", 6, "Replace motor", "Replace lower DD motor when windings open or out of OEM range."),
            outcome("motor_ok", 7, "Motor verified", "Lower motor ohms and live spin verified."),
            outcome("suspect_inverter_out", 8, "Suspect inverter/main PBA", "Replace inverter PBA (AC6 path) or main PBA when motor checks pass but 3C remains."),
        ],
    ),
    proc(
        "samsungflexwash-upper-motor",
        "§4-3: Upper washer motor (3C)",
        "4-3",
        "Upper Washing Motor 3C",
        [36, 38],
        ["drive_motor"],
        ["3C", "motor_check", "flexwash_upper"],
        [
            instr(
                "upper_motor_inspect",
                2,
                "Inspect upper motor",
                "Check upper motor connector and spin net engagement. Rule out overload from too much laundry.",
                "upper_motor_ohms",
            ),
            visual(
                "upper_motor_ohms",
                3,
                "Upper motor winding resistance",
                "Disconnect connector. Any two of three motor terminals should read 7.6–8.4 Ω at 25°C.",
                cp_yes_no("upper_ohms_ok", "upper_motor_ok", "replace_upper_motor", "replace_upper_motor_out", "Replace upper washer motor."),
            ),
            outcome("replace_upper_motor_out", 4, "Replace upper motor", "Replace upper motor when windings open or out of range."),
            outcome("upper_motor_ok", 5, "Upper motor OK", "Upper motor and harness verified."),
        ],
    ),
    proc(
        "samsungflexwash-inlet-valves",
        "§4-3: Water supply (4C, 4C2)",
        "4-3",
        "Water Supply 4C",
        [37, 39],
        ["inlet_valve"],
        ["4C", "4C2", "fill_issue", "water_valve_check"],
        [
            visual(
                "supply_precheck",
                2,
                "Supply, hoses, and routing",
                "Verify taps open, hoses not kinked/frozen. For 4C2: confirm hot/cold hoses not swapped; Wool/Lingerie water must not exceed 50°C.",
                cp_yes_no("supply_ok", "valve_ohms", "fix_supply", "fix_supply_out", "Correct water supply routing and pressure."),
            ),
            meas(
                "valve_ohms",
                3,
                "Inlet valve resistance",
                "Measure inlet valve coil A–B — 16.05 ± 0.65 Ω.",
                "samsungFlexWashInletValveOhms",
                "Inlet valve",
                "Coil A-B",
                ohm_branches("valve", "smart_install_valves", "replace_valve_out", "16.05 ± 0.65 Ω"),
            ),
            instr(
                "smart_install_valves",
                4,
                "Smart Install valve test",
                "Enter Smart Install manual check. Co and Ho steps exercise cold and hot valves.",
                "valve_visual",
            ),
            visual(
                "valve_visual",
                5,
                "Valves operate",
                "Do cold and hot valves open in manual check?",
                cp_yes_no("valves_run", "inlet_verified", "replace_valve_out", "replace_valve_out", "Replace valve assembly or PBA relay."),
            ),
            outcome("fix_supply_out", 6, "Fix supply", "Open taps, clear filters, verify hose orientation."),
            outcome("replace_valve_out", 7, "Replace inlet valve", "Replace valve when coil open or inoperative."),
            outcome("inlet_verified", 8, "Inlet OK", "Supply and valves verified."),
        ],
    ),
    proc(
        "samsungflexwash-drain-pump",
        "§4-3: Drain pump (5C)",
        "4-3",
        "Drain Pump 5C",
        [37, 39],
        ["drain_pump"],
        ["5C", "drain_issue"],
        [
            visual(
                "pump_debris",
                2,
                "Pump housing",
                "Check drain pump for foreign material. Verify wiring connections on main PBA and pump ASSY.",
                cp_yes_no("pump_clear", "pump_ohms", "clear_pump", "clear_pump_out", "Remove debris from pump housing."),
            ),
            meas(
                "pump_ohms",
                3,
                "Main drain pump resistance",
                "Measure main (lower) drain pump motor — 13–16.5 Ω. Upper bubble pump (if equipped) is separate: 40–50 Ω.",
                "samsungFlexWashDrainPumpOhms",
                "Drain pump",
                "Motor terminals",
                ohm_branches("pump", "pump_run_check", "replace_pump_out", "13–16.5 Ω"),
            ),
            visual(
                "pump_run_check",
                4,
                "Pump runs",
                "Natural drain test — pump operates?",
                cp_yes_no("pump_runs", "drain_verified", "replace_pump_out", "replace_pump_out", "Replace drain pump motor."),
            ),
            outcome("clear_pump_out", 5, "Clear pump", "Remove obstruction and retest."),
            outcome("replace_pump_out", 6, "Replace drain pump", "Replace pump when open or inoperative."),
            outcome("drain_verified", 7, "Drain OK", "Pump resistance and operation verified."),
        ],
    ),
    proc(
        "samsungflexwash-communication",
        "§4-3: Sub/main PBA communication (AC)",
        "4-3",
        "Communication AC",
        [31, 38],
        ["main_control"],
        ["AC", "hmi_check"],
        [
            instr(
                "comm_harness",
                2,
                "Sub/main harness",
                "Verify wire connections and contacts between sub and main PBAs. Check for moisture on sub PBA.",
                "comm_verified",
            ),
            visual(
                "comm_verified",
                3,
                "Comm restored?",
                "After harness repair and power cycle, does AC clear?",
                cp_yes_no("comm_ok", "comm_path_ok", "replace_pba", "replace_pba_out", "Replace main PBA communication circuit."),
            ),
            outcome("replace_pba_out", 4, "Replace PBA", "Replace main PBA when communication circuit failed."),
            outcome("comm_path_ok", 5, "Communication OK", "Harness and PBA communication verified."),
        ],
    ),
    proc(
        "samsungflexwash-wifi-communication",
        "§4-3: WiFi module communication (AC4)",
        "4-3",
        "WiFi Communication AC4",
        [31, 32],
        ["main_control"],
        ["AC4", "hmi_check"],
        [
            instr(
                "wifi_harness",
                2,
                "WiFi module harness",
                "Verify connector between WiFi module and main PBA. Reseat harness; inspect for faulty soldering on module.",
                "wifi_verified",
            ),
            visual(
                "wifi_verified",
                3,
                "AC4 cleared?",
                "After harness repair and power cycle, does AC4 clear?",
                cp_yes_no("wifi_ok", "wifi_path_ok", "replace_wifi", "replace_wifi_out", "Replace WiFi module or main PBA."),
            ),
            outcome("replace_wifi_out", 4, "Replace WiFi module", "Replace WiFi module when harness intact but AC4 persists."),
            outcome("wifi_path_ok", 5, "WiFi comm OK", "WiFi module communication verified."),
        ],
    ),
    proc(
        "samsungflexwash-inverter-communication",
        "§4-3: Inverter PBA communication (AC6)",
        "4-3",
        "Inverter Communication AC6",
        [31, 41],
        ["inverter"],
        ["AC6", "motor_check"],
        [
            instr(
                "inverter_harness",
                2,
                "Inverter CN804 harness",
                "Verify connector between inverter PBA and main PBA (CN804). Reseat TX/RX lines; inspect inverter PBA soldering.",
                "inverter_verified",
            ),
            visual(
                "inverter_verified",
                3,
                "AC6 cleared?",
                "After harness repair and power cycle, does AC6 clear?",
                cp_yes_no("inv_ok", "inv_path_ok", "replace_inverter", "replace_inverter_out", "Replace inverter PBA."),
            ),
            outcome("replace_inverter_out", 4, "Replace inverter PBA", "Replace inverter PBA when communication circuit failed."),
            outcome("inv_path_ok", 5, "Inverter comm OK", "Inverter PBA communication verified."),
        ],
    ),
    proc(
        "samsungflexwash-interload-communication",
        "§4-3: Upper-lower PBA communication (AC7)",
        "4-3",
        "Inter-Load Communication AC7",
        [31, 33],
        ["main_control"],
        ["AC7", "flexwash", "flexwash_upper"],
        [
            instr(
                "ac7_harness",
                2,
                "Upper-lower interconnect",
                "Verify CN803 harness between upper washer sub PBA and lower main PBA. Check TX_OWM/RX_OWM and power lines.",
                "ac7_verified",
            ),
            visual(
                "ac7_verified",
                3,
                "AC7 cleared?",
                "After reseating interconnect harness and power cycle, does AC7 clear?",
                cp_yes_no("ac7_ok", "ac7_path_ok", "replace_main", "replace_main_out", "Replace main PBA on affected compartment."),
            ),
            outcome("replace_main_out", 4, "Replace main PBA", "Replace main PBA when AC7 persists with good harness."),
            outcome("ac7_path_ok", 5, "Inter-load comm OK", "Upper-lower PCB communication verified."),
        ],
    ),
    proc(
        "samsungflexwash-hmi-check",
        "§4-3: Control panel (BC2)",
        "4-3",
        "Switch Check BC2",
        [33, 38],
        ["user_interface"],
        ["BC2", "hmi_check"],
        [
            visual(
                "button_gap",
                2,
                "Button gap check",
                "Gap required between control panel buttons and tact switches — stuck button triggers BC2 after ~30 s. Loosen over-tightened sub PBA screws.",
                cp_yes_no("gap_ok", "hmi_verified", "loosen_screws", "loosen_screws_out", "Loosen service screws; replace main PBA if IC fault."),
            ),
            outcome("loosen_screws_out", 3, "Adjust panel", "Loosen service screws and verify button free play."),
            outcome("hmi_verified", 4, "HMI OK", "Control panel and tact switches verified."),
        ],
    ),
    proc(
        "samsungflexwash-door-lock",
        "§4-3: Lower door lock (DC, DC1)",
        "4-3",
        "Lower Door Lock DC",
        [38, 40],
        ["door_lock"],
        ["dC", "DC", "DC1", "door_lock_check"],
        [
            visual(
                "door_closed",
                2,
                "Door fully closed",
                "Ensure lower door closed with no laundry caught. During Boil cycle, pressure may trigger false DC — verify door seal.",
                cp_yes_no("door_ok", "reed_ohms", "close_door", "close_door_out", "Close door and clear debris from lock tray."),
            ),
            instr(
                "reed_ohms",
                3,
                "Reed switch (White–Green)",
                "Approx 0.2 Ω at reed switch in door-closed state.",
                "lock_motor_ohms",
            ),
            instr(
                "lock_motor_ohms",
                4,
                "Lock motor (Black–Brown)",
                "34–51 Ω at lock motor in lock/unlock state.",
                "lock_contact_ohms",
            ),
            instr(
                "lock_contact_ohms",
                5,
                "Lock/unlock contacts",
                "Lock White–Red and Unlock White–Blue — approx 0.2 Ω in each state.",
                "door_verified",
            ),
            outcome("close_door_out", 6, "Close door", "Secure door and clear obstruction."),
            outcome("door_verified", 7, "Door circuit OK", "Lower door lock circuit verified — inspect main PBA if code persists."),
        ],
    ),
    proc(
        "samsungflexwash-upper-door",
        "§4-3: Upper compartment door (DC4, DC1)",
        "4-3",
        "Upper Door DC4",
        [33, 39],
        ["door_lock"],
        ["DC4", "DC1", "flexwash_upper", "door_lock_check"],
        [
            visual(
                "upper_door_closed",
                2,
                "Upper inner door closed",
                "Close upper compartment inner door. Press START/PAUSE after closing.",
                cp_yes_no("upper_door_ok", "upper_switch", "close_upper", "close_upper_out", "Close upper inner door completely."),
            ),
            visual(
                "upper_switch",
                3,
                "Upper door switch",
                "ASSY SWITCH-TACT: resistance ~0–0.3 Ω when pressed. Upper door lock switch pins 1–3: ~175 Ω.",
                cp_yes_no("switch_ok", "upper_door_verified", "replace_upper_lock", "replace_upper_lock_out", "Replace upper door lock/switch assembly."),
            ),
            outcome("close_upper_out", 4, "Close upper door", "Secure upper compartment door."),
            outcome("replace_upper_lock_out", 5, "Replace upper lock", "Replace upper door lock switch when out of spec."),
            outcome("upper_door_verified", 6, "Upper door OK", "Upper door and switch verified."),
        ],
    ),
    proc(
        "samsungflexwash-wash-heater",
        "§4-3: Wash heater (HC, HC1)",
        "4-3",
        "Heater Check HC",
        [39, 41],
        ["wash_heater", "wash_ntc"],
        ["HC", "HC1", "no_heat", "heating_element_check"],
        [
            visual(
                "heater_wiring",
                2,
                "Heater connections",
                "Verify wire connections to wash heater.",
                cp_yes_no("heater_wired", "heater_ohms", "repair_wiring", "repair_wiring_out", "Repair heater wiring."),
            ),
            meas(
                "heater_ohms",
                3,
                "Heater resistance",
                "Measure heater A–B — 26.2–27.1 Ω depending on wattage variant.",
                "samsungFlexWashHeaterOhms",
                "Wash heater",
                "A-B",
                ohm_branches("heater", "heater_verified", "replace_heater_out", "26.2–27.1 Ω"),
            ),
            instr(
                "heater_thermistor",
                4,
                "Thermistor follow-up",
                "If heater ohms OK, replace wash thermistor (TYPE 2) at back of tub.",
                "heater_verified",
            ),
            outcome("repair_wiring_out", 5, "Repair wiring", "Correct heater harness connections."),
            outcome("replace_heater_out", 6, "Replace heater", "Replace wash heater when open or out of range."),
            outcome("heater_verified", 7, "Heater path OK", "Heater/thermistor service completed."),
        ],
    ),
    proc(
        "samsungflexwash-wash-thermistor",
        "§4-3: Wash temperature sensor (TC1)",
        "4-3",
        "Temperature Sensor TC1",
        [41, 43],
        ["wash_ntc"],
        ["TC1", "thermistor"],
        [
            visual(
                "tc_connectors",
                2,
                "Thermistor connectors",
                "Check washing heater temperature sensor connector. Rule out winter freeze. Type 1: ~40–55 kΩ; Type 2: ~10–15 kΩ at room temp.",
                cp_yes_no("conn_ok", "tc_verified", "replace_ntc", "replace_ntc_out", "Replace faulty wash thermistor."),
            ),
            outcome("replace_ntc_out", 3, "Replace thermistor", "Replace washing temperature sensor per active TC1."),
            outcome("tc_verified", 4, "Thermistor OK", "Sensor connections verified."),
        ],
    ),
    proc(
        "samsungflexwash-inverter-thermal",
        "§4-3: Inverter over-temperature (TC4)",
        "4-3",
        "Inverter Thermal TC4",
        [41, 43],
        ["inverter"],
        ["TC4", "motor_check"],
        [
            visual(
                "tc4_cooling",
                2,
                "Inverter cooling",
                "TC4 occurs when inverter PBA motor driver temperature is high or IPM thermistor open/short.",
                cp_yes_no("cool_ok", "tc4_verified", "replace_inverter_tc4", "replace_inverter_tc4_out", "Replace inverter PBA (lower) or main PBA (upper)."),
            ),
            outcome("replace_inverter_tc4_out", 3, "Replace inverter/main PBA", "Replace inverter PBA on lower; main PBA on upper per manual."),
            outcome("tc4_verified", 4, "TC4 resolved", "Inverter thermal path addressed."),
        ],
    ),
    proc(
        "samsungflexwash-leak-check",
        "§4-3: Water leakage (LC, LC1)",
        "4-3",
        "Water Leakage LC",
        [32, 40],
        ["drain_pump"],
        ["LC", "LC1", "leak_check", "drain_issue"],
        [
            visual(
                "leak_inspection",
                2,
                "Leak source",
                "Inspect tub, hoses, valve connections, drain pump filter cover, and detergent drawer hoses. Upper LC1: detergent overflow or exterior cleaned with water.",
                cp_yes_no("no_leak", "leak_verified", "repair_leak", "repair_leak_out", "Repair leak path or replace drain motor."),
            ),
            outcome("repair_leak_out", 3, "Repair leak", "Correct hose, tub, or pump leak."),
            outcome("leak_verified", 4, "Leak path OK", "No leak found — retest LC."),
        ],
    ),
    proc(
        "samsungflexwash-overflow",
        "§4-3: Overflow (OC)",
        "4-3",
        "Overflow OC",
        [32, 40],
        ["water_level_sensor", "inlet_valve"],
        ["OC", "overflow"],
        [
            visual(
                "oc_valve",
                2,
                "Continuous fill check",
                "Check for frozen or obstructed inlet valve causing continuous water supply.",
                cp_yes_no("valve_ok", "oc_level_sensor", "service_valve", "service_valve_out", "Replace inlet valve or clear obstruction."),
            ),
            instr(
                "oc_level_sensor",
                3,
                "Water level sensor hose",
                "If inlet path OK, inspect level sensor hose for fold, cut, or damage. Replace sensor if degraded.",
                "oc_verified",
            ),
            outcome("service_valve_out", 4, "Service inlet valve", "Clear foreign material or replace stuck valve."),
            outcome("oc_verified", 5, "Overflow resolved", "OC path addressed — monitor fill."),
        ],
    ),
    proc(
        "samsungflexwash-unbalance",
        "§4-3: Unbalance (UB)",
        "4-3",
        "Unbalance UB",
        [33, 41],
        ["drive_motor"],
        ["UB", "spin_issue"],
        [
            visual(
                "load_balance",
                2,
                "Load distribution",
                "Redistribute laundry evenly. Single heavy items may trigger UB. Educate customer to pause, reposition, or remove items.",
                cp_yes_no("load_ok", "ub_verified", "redistribute", "redistribute_out", "Redistribute load and verify level."),
            ),
            outcome("redistribute_out", 3, "Redistribute load", "Balance load and confirm unit level."),
            outcome("ub_verified", 4, "Unbalance resolved", "UB cleared after load correction."),
        ],
    ),
    proc(
        "samsungflexwash-power-supply",
        "§4-3: Power (9C1, 9C2)",
        "4-3",
        "Power Check 9C",
        [30, 40],
        ["supply", "main_control"],
        ["9C1", "9C2", "no_power"],
        [
            visual(
                "voltage_check",
                2,
                "Supply voltage",
                "Verify operating voltage during Boil. Check for plug receptacle extension causing voltage drop (up to 10 V on 1 m cord).",
                cp_yes_no("supply_ok", "power_verified", "fix_supply", "fix_supply_out", "Correct outlet and dedicated circuit."),
            ),
            outcome("fix_supply_out", 3, "Fix supply", "Correct installation voltage and wiring."),
            outcome("power_verified", 4, "Power OK", "Supply verified — replace main PBA if 9C persists."),
        ],
    ),
    proc(
        "samsungflexwash-mems-sensor",
        "§4-3: MEMS sensor (8C, 8C1, 8C2)",
        "4-3",
        "MEMS PBA 8C",
        [33, 35],
        ["main_control"],
        ["8C", "8C1", "8C2"],
        [
            visual(
                "mems_wiring",
                2,
                "MEMS harness",
                "Check wire connections to MEMS PBA (CN502). Rule out disconnection.",
                cp_yes_no("wiring_ok", "mems_verified", "replace_mems", "replace_mems_out", "Replace MEMS PBA."),
            ),
            outcome("replace_mems_out", 3, "Replace MEMS PBA", "Replace MEMS PBA when wiring intact but 8C persists."),
            outcome("mems_verified", 4, "MEMS OK", "MEMS connections verified."),
        ],
    ),
    proc(
        "samsungflexwash-system-fault",
        "§4-3: System fault (SF)",
        "4-3",
        "System Fault SF",
        [33, 35],
        ["main_control"],
        ["SF", "no_power", "control_board"],
        [
            visual(
                "sf_power_cycle",
                2,
                "Power cycle",
                "SF indicates microcontroller operation fail. Power cycle once; if SF returns immediately, main PCB replacement required.",
                cp_yes_no("sf_cleared", "sf_resolved", "replace_main_sf", "replace_main_sf_out", "Replace main PCB assembly."),
            ),
            outcome("replace_main_sf_out", 3, "Replace main PCB", "Replace Assy PCB per manual."),
            outcome("sf_resolved", 4, "SF cleared", "System fault cleared after power cycle."),
        ],
    ),
]


def smart_install_bundle() -> dict:
    return {
        "id": "samsungflexwash-smart-install-entry",
        "version": "1.0.0",
        "platformId": "samsung_flexwash",
        "manualId": SOURCE["manualId"],
        "title": "Samsung FlexWash — Smart Install entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter Smart Install (AS) from standby with scheduled time 17:00.",
        "tags": ["service_diagnostic", "smart_install"],
        "entryStepId": "si_prep",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [36]},
        "steps": [
            instr("si_prep", 1, "Standby — empty drums", "Both drums empty. Set scheduled time to 17:00.", "si_enter"),
            instr(
                "si_enter",
                2,
                "Enter Smart Install",
                "Press Start/Pause for 7 seconds. Display shows AS when Smart Install is active.",
                "@continue",
                "Standby → schedule 17:00 → Start/Pause 7 s.",
            ),
        ],
    }


def manual_check_bundle() -> dict:
    return {
        "id": "samsungflexwash-manual-check-mode",
        "version": "1.0.0",
        "platformId": "samsung_flexwash",
        "manualId": SOURCE["manualId"],
        "title": "Samsung FlexWash — Manual check mode",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "Manual Smart Install — press Delay End to advance component tests.",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "mc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [36]},
        "steps": [
            instr(
                "mc_enter",
                1,
                "Enter manual check",
                "From AS: press Delay End. Each press advances: 1 door lock, 2 drain, 3 prep valve, Co cold, Ho hot, 6 water shot/heater/rinse, 7 drain, 8 spin, 9 dry heater/fan, 10 door. OK(Ot) = pass; nG = fail.",
                "@continue",
            ),
        ],
    }


def diagnostic_code_bundle() -> dict:
    return {
        "id": "samsungflexwash-diagnostic-code-check",
        "version": "1.0.0",
        "platformId": "samsung_flexwash",
        "manualId": SOURCE["manualId"],
        "title": "Samsung FlexWash — Diagnostic code display",
        "modeKind": "fault_codes",
        "uiVariants": ["any"],
        "description": "Review stored diagnostic codes (up to 7 digits) from Smart Install.",
        "tags": ["fault_codes", "error_code"],
        "entryStepId": "dc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [36]},
        "steps": [
            instr(
                "dc_enter",
                1,
                "Diagnostic information display",
                "From AS: press bottom-right button → CR appears. Turn jog dial CW — up to 7 stored codes display (latest first). Models without jog dial: press 3rd button from bottom-left to cycle codes.",
                "@continue",
            ),
        ],
    }


BUNDLES = [smart_install_bundle(), manual_check_bundle(), diagnostic_code_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "samsung_flexwash",
        "templateId": "washer",
        "label": "Samsung FlexWash WV55M9600 dual-load washer",
        "notes": "§4-2 Test Mode + §4-3 corrective actions. Upper + lower compartments; AC7/DC4 FlexWash-specific.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [
                    t
                    for t in item.get("tags", [])
                    if t[0].isdigit()
                    or t in ("dC", "DC", "AC", "OC", "LC", "HC", "UB", "SF", "AC4", "AC6", "AC7", "BC2", "DC4", "TC4", "4C2")
                ],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


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
    for script in (
        "attach_samsung_flexwash_washer_diagnostic_effects.py",
        "attach_samsung_flexwash_washer_service_modes.py",
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
