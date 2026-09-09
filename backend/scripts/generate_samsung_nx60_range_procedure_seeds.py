#!/usr/bin/env python3
"""Generate Samsung NX60T8311S / NE63 slide-in range procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_range_nx60"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-NX60-RANGE",
    "manualTitle": "Samsung NX60T8311S Slide-In Gas Range",
    "extractedTextFile": "backend/docs/manuals/samsung range nx60t8311s-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power and gas",
    "body": "Turn off gas supply and disconnect electrical power before servicing. Use appropriate PPE for live voltage checks.",
    "sourceExcerpt": "Turn off the gas supply before working on/servicing the appliance. Disconnect power before working on electrical parts.",
    "requiresInput": False,
}


def proc(pid, title, oem_num, oem_title, pages, component_ids, tags, steps, template_ids=None):
    if not steps:
        raise ValueError(f"{pid} must define steps")
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    item = {
        "id": pid,
        "version": "1.0.0",
        "title": title,
        "platformId": "samsung_range_nx60",
        "componentIds": component_ids,
        "tags": tags,
        "source": {**SOURCE, "oemTestNumber": oem_num, "oemTestTitle": oem_title, "pages": pages},
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }
    if template_ids:
        item["templateIds"] = template_ids
    return item


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
        "samsungnx60-power",
        "§4-2: No power / no display",
        "4-2",
        "Control parts — no display",
        [68, 74],
        ["supply", "main_control"],
        ["no_power", "display_dead", "supply_issue"],
        [
            instr(
                "apply_power_check",
                2,
                "Restore power for voltage test",
                "Plug in cord or reset breaker. Measure input voltage at plug — 120 VAC L–N.",
                "board_voltage",
            ),
            meas(
                "board_voltage",
                3,
                "Main PCB supply voltage",
                "CNP100 on Main PCB pin 5–7 — 120 VAC with power applied.",
                "supplyVoltage120",
                "CNP100",
                "5 ↔ 7",
                ohm_branches("pwr", "harness_ok", "replace_cord", "120 VAC"),
            ),
            visual(
                "harness_ok",
                4,
                "Harness and display connections",
                "Verify CN220/CN430 display harness and CN100 sub↔main connections seated.",
                cp_yes_no("harness_yes", "display_5v", "harness_no", "repair_harness", "Repair or replace loose harness."),
            ),
            meas(
                "display_5v",
                5,
                "Display 5 V supply",
                "CN430 pins 1–2 — 5 VDC on Sub PCB when powered.",
                "supplyVoltage120",
                "CN430",
                "1 ↔ 2 (5 VDC)",
                ohm_branches("5v", "power_ok", "replace_sub_pcb", "5 V present"),
            ),
            outcome("replace_cord", 6, "Replace cord", "Replace power cord or restore supply when L–N not 120 VAC."),
            outcome("repair_harness", 7, "Repair harness", "Reconnect or replace display/main harness."),
            outcome("replace_sub_pcb", 8, "Replace Sub PCB", "Replace Sub PCB or LED display assembly when 5 V missing."),
            outcome("power_ok", 9, "Power path OK", "Supply and board feed verified."),
        ],
    ),
    proc(
        "samsungnx60-oven-sensor",
        "§4-1: Oven temperature sensor (C-20 / C-21)",
        "4-1",
        "Failure display — oven sensor",
        [59, 62],
        ["thermistor"],
        ["C-20", "C-21", "sensor_check", "temp_accuracy_issue"],
        [
            instr(
                "disconnect_sensor",
                2,
                "Access oven sensor",
                "Open back cover. Disconnect oven sensor harness from Sub PCB CN100.",
                "sensor_ohms",
            ),
            meas(
                "sensor_ohms",
                3,
                "Oven sensor resistance",
                "Measure sensor leads or CN100 pins 11–13 — 1080 Ω at room temperature.",
                "samsungNx60OvenSensorOhms",
                "CN100",
                "11 ↔ 13",
                ohm_branches("sensor", "harness_check", "replace_sensor", "1080 Ω"),
            ),
            visual(
                "harness_check",
                4,
                "Sensor harness integrity",
                "Inspect harness from sensor to CN100 for damage. Reconnect if loose.",
                cp_yes_no("harness_good", "sensor_ok", "repair_harness", "repair_harness_out", "Repair or replace sensor harness."),
            ),
            outcome("replace_sensor", 5, "Replace oven sensor", "Replace oven temperature sensor when out of range."),
            outcome("repair_harness_out", 6, "Repair harness", "Repair damaged harness or terminals between sensor and CN100."),
            outcome("sensor_ok", 7, "Sensor verified", "Oven sensor resistance and harness verified."),
        ],
    ),
    proc(
        "samsungnx60-heater-relays",
        "§4-1: Heater relays — DLB / bake / broil (C-21)",
        "4-1",
        "C-21 oven heating over — relay check",
        [61, 62],
        ["main_control", "heater"],
        ["C-21", "no_heat", "relay_check"],
        [
            instr(
                "access_relays",
                2,
                "Access relay terminals",
                "Power off. Remove Assy Display PCB access. Locate DLB TB200–TB201, broil TB202–TB203, bake TB204–TB205.",
                "dlb_relay",
            ),
            meas(
                "dlb_relay",
                3,
                "DLB relay contacts",
                "Measure DLB relay contacts TB200–TB201 — open (∞ Ω) when de-energized.",
                "samsungNx60HeaterRelayContactsOhms",
                "TB200",
                "TB200 ↔ TB201",
                ohm_branches("dlb", "broil_relay", "replace_pcb_dlb", "Open (∞ Ω)"),
            ),
            meas(
                "broil_relay",
                4,
                "Broil relay contacts",
                "TB202–TB203 — open (∞ Ω) when relay off.",
                "samsungNx60HeaterRelayContactsOhms",
                "TB202",
                "TB202 ↔ TB203",
                ohm_branches("broil", "bake_relay", "replace_pcb_broil", "Open (∞ Ω)"),
            ),
            meas(
                "bake_relay",
                5,
                "Bake relay contacts",
                "TB204–TB205 — open (∞ Ω) when relay off.",
                "samsungNx60HeaterRelayContactsOhms",
                "TB204",
                "TB204 ↔ TB205",
                ohm_branches("bake", "relays_ok", "replace_pcb_bake", "Open (∞ Ω)"),
            ),
            outcome("replace_pcb_dlb", 6, "Replace Main PCB", "DLB relay welded or shorted — replace Main PCB."),
            outcome("replace_pcb_broil", 7, "Replace Main PCB", "Broil relay fault — replace Main PCB."),
            outcome("replace_pcb_bake", 8, "Replace Main PCB", "Bake relay fault — replace Main PCB."),
            outcome("relays_ok", 9, "Relays OK", "DLB, broil, and bake relay contacts verified open at rest."),
        ],
    ),
    proc(
        "samsungnx60-door-lock",
        "§4-1: Door lock motor (C-d1)",
        "4-1",
        "C-d1 door locking information",
        [63, 64],
        ["door_lock"],
        ["C-d1", "door_latch_check"],
        [
            instr(
                "disconnect_lock",
                2,
                "Isolate lock motor",
                "Disconnect power. Disconnect harness from lock motor. Check lock switch COM–NO.",
                "lock_motor_ohms",
            ),
            meas(
                "lock_motor_ohms",
                3,
                "Lock motor coil resistance",
                "Lock motor coil — 1750–1950 Ω at room temperature.",
                "samsungNx60DoorLockMotorOhms",
                "Lock motor",
                "coil",
                ohm_branches("lock", "lock_voltage", "replace_lock", "1750–1950 Ω"),
            ),
            instr(
                "lock_voltage",
                4,
                "Lock motor voltage",
                "Restore power. Command door lock. Measure AC 120 V at lock motor harness when activated.",
                "lock_ok",
            ),
            outcome("replace_lock", 5, "Replace lock motor", "Replace lock motor or micro switch when coil out of range."),
            outcome("lock_ok", 6, "Door lock OK", "Lock motor resistance and voltage verified."),
        ],
    ),
    proc(
        "samsungnx60-touch-comm",
        "§4-1: Sub ↔ touch communication (C-F2)",
        "4-1",
        "C-F2 touch communication",
        [65],
        ["display_panel", "main_control"],
        ["C-F2", "hmi_check"],
        [
            visual(
                "touch_tail",
                2,
                "Touch film tail connection",
                "Verify touch film tail fully seated on Sub PCB connector.",
                cp_yes_no("tail_ok", "comm_cleared", "reconnect_tail", "replace_sub", "Reconnect touch film tail."),
            ),
            visual(
                "comm_cleared",
                3,
                "C-F2 cleared",
                "After reseat or Sub PCB replacement, is C-F2 cleared?",
                cp_yes_no("comm_yes", "comm_ok", "replace_touch", "replace_touch_out", "Replace Assy Touch panel."),
            ),
            outcome("replace_sub", 4, "Replace Sub PCB", "Replace Sub PCB when tail connected but C-F2 persists."),
            outcome("replace_touch_out", 5, "Replace touch panel", "Replace Assy Touch when Sub PCB verified."),
            outcome("comm_ok", 6, "Communication OK", "Sub ↔ touch communication restored."),
        ],
    ),
    proc(
        "samsungnx60-cooling-fan",
        "§4-1: Display cooling fan (C-A2)",
        "4-1",
        "C-A2 ambient temperature very hot",
        [66],
        ["convection_fan"],
        ["C-A2", "fan_motor_check"],
        [
            instr(
                "broil_hi",
                2,
                "Command broil for fan test",
                "Operate oven in Broil Hi. Cooling fan should spin to cool display PCB.",
                "fan_spin",
            ),
            visual(
                "fan_spin",
                3,
                "Cooling fan rotation",
                "Is cooling fan rotating? Check white–yellow conductors for AC 120 V.",
                cp_yes_no("fan_yes", "fan_ok", "replace_fan", "replace_fan_out", "Replace cooling fan."),
            ),
            visual(
                "fan_wiring",
                4,
                "Fan wiring seated",
                "Verify cooling fan wire connected to housing.",
                cp_yes_no("wire_yes", "fan_ok", "connect_fan", "connect_fan_out", "Connect fan to housing."),
            ),
            outcome("replace_fan_out", 5, "Replace cooling fan", "Replace cooling fan when voltage present but not spinning."),
            outcome("connect_fan_out", 6, "Connect fan wiring", "Secure fan harness to housing."),
            outcome("fan_ok", 7, "Cooling fan OK", "Display cooling fan verified."),
        ],
    ),
    proc(
        "samsungnx60-oven-vent",
        "§4-1: Oven vent blocked (C-24)",
        "4-1",
        "C-24 oven vent blocked",
        [67],
        ["main_control"],
        ["C-24"],
        [
            visual(
                "vent_clear",
                2,
                "Vent and cover air clear",
                "Open oven door 60+ seconds. Check oven vent and cover air for foil or blockage.",
                cp_yes_no("vent_ok", "ignition_ok", "clear_vent", "clear_vent_out", "Remove blockage from vent."),
            ),
            visual(
                "ignition_ok",
                3,
                "Broil delayed ignition",
                "Check delayed ignition of broil burner and HSI condition.",
                cp_yes_no("ign_ok", "vent_path_ok", "service_burner", "service_burner_out", "Service broil burner and HSI."),
            ),
            outcome("clear_vent_out", 4, "Clear vent", "Remove aluminum foil or debris blocking oven vent."),
            outcome("service_burner_out", 5, "Service burner", "Replace or repair broil burner and HSI."),
            outcome("vent_path_ok", 6, "Vent OK", "Oven vent path clear and ignition normal."),
        ],
    ),
    proc(
        "samsungnx60-bake-ignitor",
        "§4-4: Bake burner HSI",
        "4-4",
        "Oven burner will not light — bake HSI",
        [83, 84],
        ["igniter"],
        ["igniter_check", "ignition_issue", "no_heat"],
        [
            instr(
                "gas_supply",
                2,
                "Confirm gas supply",
                "Turn on cooktop burners to verify gas supply. Open gas valve if needed.",
                "bake_hsi_ohms",
            ),
            meas(
                "bake_hsi_ohms",
                3,
                "Bake HSI resistance",
                "Power off. Measure bake hot surface ignitor — 40–400 Ω.",
                "samsungNx60OvenIgnitorOhms",
                "Bake HSI",
                "terminals",
                ohm_branches("bake_hsi", "bake_hsi_glow", "replace_bake_hsi", "40–400 Ω"),
            ),
            visual(
                "bake_hsi_glow",
                4,
                "Bake HSI glow",
                "Power on. Verify HSI heats/glows. Check 120 V at T504–T505.",
                cp_yes_no("glow_yes", "bake_ign_ok", "replace_bake_hsi2", "replace_pcb", "Replace bake HSI."),
            ),
            outcome("replace_bake_hsi", 5, "Replace bake HSI", "Replace bake hot surface ignitor."),
            outcome("replace_bake_hsi2", 6, "Replace bake HSI", "HSI not glowing — replace ignitor."),
            outcome("replace_pcb", 7, "Replace Main PCB", "HSI good but no voltage — replace Main PCB."),
            outcome("bake_ign_ok", 8, "Bake ignitor OK", "Bake HSI resistance and operation verified."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "samsungnx60-broil-ignitor",
        "§4-4: Broil burner HSI",
        "4-4",
        "Oven burner will not light — broil HSI",
        [83, 84],
        ["igniter"],
        ["igniter_check", "ignition_issue", "no_heat"],
        [
            instr(
                "broil_gas",
                2,
                "Confirm gas supply",
                "Verify cooktop burners light. Open gas supply valve.",
                "broil_hsi_ohms",
            ),
            meas(
                "broil_hsi_ohms",
                3,
                "Broil HSI resistance",
                "Power off. Measure broil hot surface ignitor — 40–400 Ω.",
                "samsungNx60OvenIgnitorOhms",
                "Broil HSI",
                "terminals",
                ohm_branches("broil_hsi", "broil_hsi_glow", "replace_broil_hsi", "40–400 Ω"),
            ),
            visual(
                "broil_hsi_glow",
                4,
                "Broil HSI glow",
                "Power on. Verify broil HSI glows. Check 120 V at T504–T503.",
                cp_yes_no("broil_glow_yes", "broil_ign_ok", "replace_broil_hsi2", "replace_pcb_broil", "Replace broil HSI."),
            ),
            outcome("replace_broil_hsi", 5, "Replace broil HSI", "Replace broil hot surface ignitor."),
            outcome("replace_broil_hsi2", 6, "Replace broil HSI", "Broil HSI not glowing — replace ignitor."),
            outcome("replace_pcb_broil", 7, "Replace Main PCB", "No voltage to broil HSI — replace Main PCB."),
            outcome("broil_ign_ok", 8, "Broil ignitor OK", "Broil HSI verified."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "samsungnx60-safety-valve",
        "§4-4: Oven gas safety valve",
        "4-4",
        "Safety valve current check",
        [83, 84],
        ["gas_valve", "igniter"],
        ["gas_valve_check", "ignition_issue"],
        [
            instr(
                "valve_test_setup",
                2,
                "Ignition sequence",
                "Start bake or broil. Confirm HSI glowing before clamping safety valve circuit.",
                "valve_amps",
            ),
            meas(
                "valve_amps",
                3,
                "Safety valve current",
                "Clamp safety valve terminal — 3.3–3.6 A when HSI glowing.",
                "samsungNx60GasSafetyValveAmps",
                "Safety valve",
                "terminal",
                ohm_branches("valve", "valve_ok", "replace_valve", "3.3–3.6 A"),
            ),
            instr(
                "valve_voltage",
                4,
                "Valve supply voltage",
                "Verify 120 VAC at TB201–TB204 (bake) or TB201–CN202 (broil) during call.",
                "valve_ok",
            ),
            outcome("replace_valve", 5, "Replace safety valve", "Replace oven gas safety valve when current low with good HSI."),
            outcome("valve_ok", 6, "Safety valve OK", "Safety valve current and voltage verified."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "samsungnx60-convection-fan",
        "§4-3: Convection fan motor",
        "4-3",
        "Convection fan not spinning",
        [70, 87],
        ["convection_fan"],
        ["fan_motor_check", "convection_issue"],
        [
            instr(
                "disconnect_fan",
                2,
                "Access fan motor",
                "Power off. Disconnect convection fan motor leads.",
                "fan_ohms",
            ),
            meas(
                "fan_ohms",
                3,
                "Fan motor resistance",
                "Measure across fan motor terminals — 25–30 Ω.",
                "samsungNx60ConvectionFanOhms",
                "Fan motor",
                "terminals",
                ohm_branches("fan", "fan_harness", "replace_fan_motor", "25–30 Ω"),
            ),
            visual(
                "fan_harness",
                4,
                "Fan harness and relay",
                "Check CN204 pin 1 harness and SSR200/RY204 relay on Main PCB.",
                cp_yes_no("fan_harness_ok", "fan_motor_ok", "repair_fan_harness", "replace_pcb_fan", "Repair fan harness."),
            ),
            outcome("replace_fan_motor", 5, "Replace fan motor", "Replace convection fan motor when out of range."),
            outcome("repair_fan_harness", 6, "Repair harness", "Reconnect or replace fan harness."),
            outcome("replace_pcb_fan", 7, "Replace Main PCB", "Replace Main PCB when motor and harness good but no run."),
            outcome("fan_motor_ok", 8, "Convection fan OK", "Convection fan motor verified."),
        ],
    ),
    proc(
        "samsungnx60-oven-lamp",
        "§4-3: Oven lamp",
        "4-3",
        "Oven lamp not working",
        [70, 87],
        ["heater"],
        ["light_check"],
        [
            visual(
                "lockout_off",
                2,
                "Control lockout off",
                "Hold lock keypad 3+ seconds with door open to disable control lockout.",
                cp_yes_no("lock_off", "bulb_check", "unlock", "unlock_out", "Disable control lock."),
            ),
            visual(
                "bulb_check",
                3,
                "Bulb condition",
                "Remove lamp cover. Replace with 40 W appliance bulb if burned out.",
                cp_yes_no("bulb_ok", "socket_ohms", "replace_bulb", "replace_bulb_out", "Replace 40 W appliance bulb."),
            ),
            meas(
                "socket_ohms",
                4,
                "Lamp socket resistance",
                "Bulb removed. Measure across socket — open (∞ Ω) normal.",
                "samsungNx60OvenLampSocketOhms",
                "Lamp socket",
                "terminals",
                ohm_branches("lamp", "lamp_ok", "replace_socket", "Open (∞ Ω)"),
            ),
            outcome("unlock_out", 5, "Unlock controls", "Disable door lock / child lock feature."),
            outcome("replace_bulb_out", 6, "Replace bulb", "Install 40 W appliance bulb."),
            outcome("replace_socket", 7, "Replace socket", "Replace oven lamp ballast/socket or harness CN205."),
            outcome("lamp_ok", 8, "Oven lamp OK", "Oven lamp circuit verified."),
        ],
    ),
    proc(
        "samsungnx60-hmi-touch",
        "§4-2: Touch keypad",
        "4-2",
        "Touch control keypads not working",
        [70, 75],
        ["display_panel"],
        ["hmi_check"],
        [
            visual(
                "child_lock",
                2,
                "Child lock / Sabbath off",
                "Hold lock key 3+ s to clear child lock. Bake+1 (Sabbath) 3+ s to exit Sabbath mode.",
                cp_yes_no("lock_clear", "cn701_check", "clear_lock", "clear_lock_out", "Clear lock or Sabbath mode."),
            ),
            visual(
                "cn701_check",
                3,
                "CN701 touch tail",
                "Verify Sub PCB CN701 and touch film tail CNS701/CN701 fully connected.",
                cp_yes_no("cn_ok", "touch_ok", "reseat_tail", "replace_sub_touch", "Reseat touch film tail."),
            ),
            outcome("clear_lock_out", 4, "Clear lock modes", "Disable child lock or Sabbath before further HMI service."),
            outcome("reseat_tail", 5, "Reseat tail", "Reconnect touch film tail securely."),
            outcome("replace_sub_touch", 6, "Replace Sub PCB / touch", "Replace Sub PCB or Assy Touch when harness verified."),
            outcome("touch_ok", 7, "Touch OK", "Touch keypad operation verified."),
        ],
    ),
    proc(
        "samsungnx60-spark-module",
        "§4-3: Cooktop spark module",
        "4-3",
        "No cooktop burners will light",
        [71, 78],
        ["surface_ignition"],
        ["ignition_issue", "surface_burner"],
        [
            instr(
                "power_gas",
                2,
                "Power and gas supply",
                "Verify 120 VAC to range and gas supply valve open.",
                "spark_voltage",
            ),
            instr(
                "spark_voltage",
                3,
                "Spark module voltage",
                "Check each surface burner terminal on spark module for voltage when knob turned.",
                "spark_ok",
            ),
            outcome("replace_spark", 4, "Replace spark module", "Replace spark module when no voltage to burner terminals."),
            outcome("spark_ok", 5, "Spark module OK", "Spark module output verified."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "samsungnx60-bake-element",
        "§4-4: Bake element (electric NE63)",
        "4-4",
        "Electric bake element — NE63 family",
        [84],
        ["bake_element"],
        ["no_bake_heat_issue", "heating_element_check"],
        [
            instr(
                "disconnect_bake",
                2,
                "Disconnect bake element",
                "Power off. Access bake element terminals.",
                "bake_ohms",
            ),
            meas(
                "bake_ohms",
                3,
                "Bake element resistance",
                "Measure bake element terminals — verify continuity per element wattage.",
                "bakeElementOhms",
                "Bake element",
                "terminals",
                ohm_branches("bake_el", "bake_el_ok", "replace_bake_el", "In range"),
            ),
            outcome("replace_bake_el", 4, "Replace bake element", "Replace open or shorted bake element."),
            outcome("bake_el_ok", 5, "Bake element OK", "Bake element resistance verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "samsungnx60-broil-element",
        "§4-4: Broil element (electric NE63)",
        "4-4",
        "Electric broil element — NE63 family",
        [84],
        ["broil_element"],
        ["no_broil_heat_issue", "heating_element_check"],
        [
            instr(
                "disconnect_broil",
                2,
                "Disconnect broil element",
                "Power off. Access broil element terminals.",
                "broil_ohms",
            ),
            meas(
                "broil_ohms",
                3,
                "Broil element resistance",
                "Measure broil element terminals — verify continuity per element wattage.",
                "broilElementOhms",
                "Broil element",
                "terminals",
                ohm_branches("broil_el", "broil_el_ok", "replace_broil_el", "In range"),
            ),
            outcome("replace_broil_el", 4, "Replace broil element", "Replace open or shorted broil element."),
            outcome("broil_el_ok", 5, "Broil element OK", "Broil element resistance verified."),
        ],
        template_ids=["electric_range"],
    ),
]


def error_recall_bundle() -> dict:
    return {
        "id": "samsungnx60-error-recall-entry",
        "version": "1.0.0",
        "platformId": "samsung_range_nx60",
        "manualId": SOURCE["manualId"],
        "title": "Samsung NX60 — Error history recall",
        "modeKind": "fault_codes",
        "uiVariants": ["any"],
        "description": "Display stored failure codes before service (§4-1).",
        "tags": ["fault_codes", "error_code", "C-20", "C-21"],
        "entryStepId": "er_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [57]},
        "steps": [
            instr(
                "er_enter",
                1,
                "Enter error history",
                "Clock → 1,2,3,4 (Timer OFF) → Start/Set → hold Clock + 1 for 3 s. Error codes display.",
                "er_scroll",
            ),
            instr(
                "er_scroll",
                2,
                "Scroll stored codes",
                "Press 0 to display latest 5 error codes. Press Off/Clear to exit.",
                "@continue",
            ),
        ],
    }


def sub_line_test_bundle() -> dict:
    return {
        "id": "samsungnx60-sub-line-test-entry",
        "version": "1.0.0",
        "platformId": "samsung_range_nx60",
        "manualId": SOURCE["manualId"],
        "title": "Samsung NX60 — Sub-line test mode",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Hidden key Sub-Line-Test for PCB line diagnostics (§4-1 hidden key table).",
        "tags": ["service_diagnostic", "hmi_test"],
        "entryStepId": "slt_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [58]},
        "steps": [
            instr(
                "slt_enter",
                1,
                "Enter sub-line test",
                "8311 UI: hold Keep Warm + Num4 for 0.6 s (Keep Warm ∧ + Num4).",
                "slt_wire",
            ),
            instr(
                "slt_wire",
                2,
                "Wire test (optional)",
                "Wire-Test: Keep Warm + Num6 for 0.6 s. AD-Display: Cooking Time + ∧ for 5 s.",
                "@continue",
            ),
        ],
    }


BUNDLES = [error_recall_bundle(), sub_line_test_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    code_tags = ("C-20", "C-21", "C-d1", "C-F2", "C-A2", "C-24")
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "samsung_range_nx60",
        "templateId": "gas_range",
        "label": "Samsung NX60T8311S / NE63 slide-in range",
        "notes": "Dual template: gas_range (NX60*) + electric_range (NE63*). §4-1 error codes + component resistance checks.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [t for t in item.get("tags", []) if t in code_tags],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# Samsung NX60 slide-in range (`samsung_range_nx60`)

**Manual:** SAMSUNG-NX60-RANGE — NX60T8311S* gas / NE63* electric slide-in  
**Platform:** `samsung_range_nx60` — NX60*, NE63*  
**Extraction:** `knowledge/pattern-catalog/SAMSUNG_NX60_RANGE_EXTRACTION.md`

17 procedures + 2 service-mode bundles (error recall + sub-line test).

Regenerate: `python backend/scripts/generate_samsung_nx60_range_procedure_seeds.py`
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
        "attach_samsung_nx60_range_diagnostic_effects.py",
        "attach_samsung_nx60_range_service_modes.py",
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
