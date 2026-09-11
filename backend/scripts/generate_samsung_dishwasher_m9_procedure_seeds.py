#!/usr/bin/env python3
"""Generate SAMSUNG-DISHWASHER-M9 (DW80M9 premium) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_dishwasher_m9"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-DISHWASHER-M9",
    "manualTitle": "Samsung Premium Dishwasher DW80M9 Series",
    "extractedTextFile": "backend/docs/manuals/samsung-dishwasher-svc manual diff-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

PLATFORM = "samsung_dishwasher_m9"

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Disconnect circuit breaker or power cable before servicing electrical parts. Reconnect panels before operating.",
    "sourceExcerpt": "Make sure to disconnect the circuit breaker or power cable before servicing.",
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
        "platformId": PLATFORM,
        "componentIds": component_ids,
        "tags": tags,
        "source": {**SOURCE, "oemTestNumber": oem_num, "oemTestTitle": oem_title, "pages": pages},
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }


def instr(sid, order, title, body, nxt, excerpt=""):
    return {
        "id": sid,
        "order": order,
        "type": "instruction",
        "title": title,
        "body": body,
        "sourceExcerpt": excerpt or body,
        "requiresInput": False,
        "defaultNextStepId": nxt,
    }


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


def outcome(sid, order, title, body):
    return {
        "id": sid,
        "order": order,
        "type": "outcome",
        "title": title,
        "body": body,
        "oemOutcome": body,
        "requiresInput": False,
    }


def ohm_branches(prefix, pass_id, fail_id, pass_label="In range"):
    return [
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_id},
        {"id": f"{prefix}_warn", "label": "Borderline", "when": {"kind": "measurement_warning"}, "nextStepId": fail_id},
        {"id": f"{prefix}_crit", "label": "Out of spec", "when": {"kind": "measurement_critical"}, "nextStepId": fail_id},
        {"id": f"{prefix}_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_id},
    ]


def yes_no(pass_id, fail_id, yes_label="Yes / OK", no_label="No / fault"):
    return [
        {"id": f"{pass_id}_yes", "label": yes_label, "when": {"kind": "checkpoint_yes"}, "nextStepId": pass_id},
        {"id": f"{pass_id}_no", "label": no_label, "when": {"kind": "checkpoint_no"}, "nextStepId": fail_id},
    ]


PROCEDURES = [
    proc(
        "samsungdwm9-power-supply",
        "No Power & Power Relay Check",
        "4-3",
        "No Power / Power Relay",
        [52, 53],
        ["supply", "main_control"],
        ["supply_issue", "voltage_check", "no_power"],
        [
            visual(
                "outlet_120vac",
                2,
                "120 VAC at outlet?",
                "Measure voltage at power outlet. Normal: AC 120 V.",
                yes_no("cn101_voltage", "fix_outlet", yes_label="120 VAC present", no_label="No / low voltage"),
            ),
            instr("fix_outlet", 3, "Correct customer power", "Connect to proper 120 V source or repair outlet wiring.", "cn101_voltage"),
            visual(
                "cn101_voltage",
                4,
                "120 VAC at CN101?",
                "Measure between live and neutral at CN101 on main PBA. Normal: AC 120 V.",
                yes_no("sub_connectors", "repair_power_harness", yes_label="120 V at CN101", no_label="Missing at CN101"),
            ),
            instr("repair_power_harness", 5, "Repair power harness", "Check and replace power cable or CN101 connections.", "sub_connectors"),
            instr(
                "sub_connectors",
                6,
                "Inspect Sub / Touch / Main harness",
                "Reseat Sub PBA, Touch PBA, CN101, and CN802 main-to-sub connectors. Check for condensation on CN103 and CON100.",
                "relay_drive",
            ),
            visual(
                "relay_drive",
                7,
                "Power relay drive 10.5–13 V with door closed?",
                "Measure CN402 pin 7 to pin 2 on main PBA. Door open or before cycle: ~1 V. After door closed and cycle started: 10.5–13 V.",
                yes_no("relay_output", "replace_main_pba", yes_label="Drive voltage OK", no_label="No drive signal"),
            ),
            visual(
                "relay_output",
                8,
                "Power relay output 110–120 V?",
                "With cycle started, measure Power Relay pin 3 to CN101 pin 1 (neutral). Normal: 110–120 VAC while operating.",
                yes_no("door_for_relay", "replace_main_pba", yes_label="Relay output OK", no_label="No output"),
            ),
            visual(
                "door_for_relay",
                9,
                "Door switch enables 12 V relay line?",
                "White wire door switch: OFF when door open, ON when closed. Faulty door switch blocks Power and Heater relays.",
                yes_no("power_ok", "replace_door_switch_pwr", yes_label="Door switch OK", no_label="Door switch fault"),
            ),
            outcome("replace_door_switch_pwr", 10, "Replace door switch", "Replace door sensing switch when relay line blocked."),
            outcome("replace_main_pba", 11, "Replace main PBA", "Replace main PBA when harness and door switch good but relay fails."),
            outcome("power_ok", 12, "Power path verified", "Incoming power and relay path verified."),
        ],
    ),
    proc(
        "samsungdwm9-thermistor",
        "§4-3: Water Thermistor (tC)",
        "4-3",
        "Thermistor Check",
        [50, 51],
        ["thermistor"],
        ["tC", "HC", "HC1", "temperature_sensor"],
        [
            instr("thermistor_connector", 2, "Inspect CN503 thermistor", "Check CN503 pin 4 water thermistor connector seated. Reconnect if loose.", "thermistor_voltage"),
            visual(
                "thermistor_voltage",
                3,
                "Thermistor voltage 0.05–4.95 V?",
                "With power on, measure voltage across thermistor at CN503 pin 4. Normal: 0.05–4.95 V.",
                yes_no("thermistor_ohms", "replace_thermistor", yes_label="In range", no_label="Out of range"),
            ),
            meas(
                "thermistor_ohms",
                4,
                "Thermistor resistance",
                "Power off. Disconnect connector. Measure resistance — ~49 kΩ @ 25°C per OEM table.",
                "samsungDishwasherM9ThermistorOhms",
                "CN503",
                "4",
                ohm_branches("therm", "thermistor_ok", "replace_thermistor"),
            ),
            outcome("replace_thermistor", 5, "Replace thermistor", "Replace thermistor when out of spec."),
            outcome("thermistor_ok", 6, "Thermistor OK", "Thermistor verified — if tC/HC persists, check heater and main PBA."),
        ],
    ),
    proc(
        "samsungdwm9-heater",
        "§4-3: Heater Operation (HC / HC1)",
        "4-3",
        "Heater Check",
        [47, 48],
        ["heater"],
        ["HC", "HC1", "no_heat"],
        [
            instr("hot_water", 2, "Hot water & tub level", "Verify inlet on hot supply, drain hose installed, tub water level OK. Low level blocks heater in safety program.", "heater_ohms"),
            meas(
                "heater_ohms",
                3,
                "Heater element resistance",
                "Power off. Measure between heater terminals (or heater relay red to power relay black/yellow). Normal: 12.14–14.16 Ω.",
                "samsungDishwasherM9HeaterOhms",
                "Heater",
                "Element",
                ohm_branches("heat", "heater_connections", "replace_heater"),
            ),
            visual(
                "heater_connections",
                4,
                "Heater connectors seated?",
                "Reconnect heater connectors. Verify heater relay connections on main PBA.",
                yes_no("heater_smart_install", "replace_heater", yes_label="Connections OK", no_label="Loose / damaged"),
            ),
            visual(
                "heater_smart_install",
                5,
                "Heater heats in Smart Install step 3?",
                "Manual step 3: C-pump 10 s then heater. Temperature should rise ≥2°C or reach 73°C; HC1 if no rise in 10 min.",
                yes_no("heater_voltage", "check_thermistor", yes_label="Temperature rises", no_label="No heat / HC1"),
            ),
            instr("check_thermistor", 6, "Verify thermistor", "Run samsungdwm9-thermistor — faulty thermistor can cause HC/HC1.", "heater_voltage"),
            visual(
                "heater_voltage",
                7,
                "110–120 V at heater relay while operating?",
                "Measure heater relay red wire to CN101 white (neutral) during Smart Install heater step.",
                yes_no("heater_ok", "replace_main_pba_heat", yes_label="Voltage present", no_label="No voltage"),
            ),
            outcome("replace_heater", 8, "Replace heater", "Replace heater assembly when element open."),
            outcome("replace_main_pba_heat", 9, "Replace main PBA", "Replace main PBA when element good but no relay voltage."),
            outcome("heater_ok", 10, "Heater path OK", "Heater operational."),
        ],
    ),
    proc(
        "samsungdwm9-circulation-motor",
        "§4-3: Circulation Pump (3C)",
        "4-3",
        "Circulation Pump Check",
        [46, 48],
        ["wash_motor"],
        ["3C", "PC", "wash_issue", "motor_check"],
        [
            instr("motor_clear", 2, "Clear circulation path", "Remove foreign material from circulation hose and pump. Reseat circulation pump connector.", "motor_ohms"),
            meas(
                "motor_ohms",
                3,
                "Circulation pump coil",
                "Disconnect connector. Measure coil resistance. Normal: approx. 5.8 Ω ±10%.",
                "samsungDishwasherM9CirculationMotorOhms",
                "CN901",
                "U/V/W",
                ohm_branches("motor", "inverter_led", "replace_motor", "~5.8 Ω"),
            ),
            visual(
                "inverter_led",
                4,
                "Main PBA red LED on during C-pump run?",
                "During Smart Install step 3 or manual step 2, main PBA operating LED should be fully on. Faulty: replace inverter PBA.",
                yes_no("nozzle_spray", "replace_inverter", yes_label="LED on / pump runs", no_label="LED off / 3C"),
            ),
            visual(
                "nozzle_spray",
                5,
                "Nozzle injects water in Smart Install?",
                "Step 3: BLDC 2400 RPM alternation nozzles spray at each position for 10 s.",
                yes_no("motor_ok", "replace_motor", yes_label="Sprays normally", no_label="No spray"),
            ),
            outcome("replace_inverter", 6, "Replace inverter PBA", "Replace inverter PBA when coil good but drive fails (3C/AC6)."),
            outcome("replace_motor", 7, "Replace circulation pump", "Replace circulation pump when coil open or spray fails after clearing passages."),
            outcome("motor_ok", 8, "Circulation OK", "Motor and nozzle path verified."),
        ],
    ),
    proc(
        "samsungdwm9-door-switch",
        "§4-3: Door Sensing Switch",
        "4-3",
        "Cycle does not start",
        [52],
        ["door_latch"],
        ["dC", "dC1", "door_switch_check"],
        [
            instr("door_mechanical", 2, "Door closure", "Verify door latched completely, racks not interfering, unit level.", "door_voltage"),
            visual(
                "door_voltage",
                3,
                "White wire door voltage correct?",
                "Measure white wire switch: Normal 10.5–13 V when door open; <1 V when door closed.",
                yes_no("door_continuity", "reconnect_door", yes_label="Voltages OK", no_label="Wrong voltage"),
            ),
            instr("reconnect_door", 4, "Reconnect door switch", "Reconnect door sensing switch connectors.", "door_continuity"),
            visual(
                "door_continuity",
                5,
                "Blue wire door switch continuity?",
                "Power off, connector removed: SHORT when door open; OPEN when door closed.",
                yes_no("door_ok", "replace_door_switch", yes_label="Continuity OK", no_label="Failed switch"),
            ),
            outcome("replace_door_switch", 6, "Replace door switch", "Replace door sensing switch when continuity or voltage fails."),
            outcome("door_ok", 7, "Door switch OK", "Door circuit verified — if cycle still won't start, check power relay and main PBA."),
        ],
    ),
    proc(
        "samsungdwm9-fill-valve",
        "§4-3: Fill Valve & Flow Meter (4C)",
        "4-3",
        "Water supply check",
        [45, 47],
        ["inlet_valve"],
        ["4C", "4C5", "4E", "fill_issue"],
        [
            visual(
                "supply_tap",
                2,
                "Water supply open and pressure OK?",
                "Faucet open; pressure >0.5 bar (20 psi). Inlet hose and aqua-stop filter clear.",
                yes_no("valve_connector", "fix_supply", yes_label="Supply OK", no_label="Low pressure / closed valve"),
            ),
            instr("fix_supply", 3, "Correct water supply", "Open valve, clear inlet filter/aqua-stop, verify adequate pressure.", "valve_connector"),
            instr("valve_connector", 4, "Inspect CN401 water valve", "Check CN401 pin 6 water valve connector seated; inspect flow meter at CN503 pin 11.", "valve_ohms"),
            meas(
                "valve_ohms",
                5,
                "Inlet valve coil",
                "Disconnect connector. Normal: approx. 990 Ω ±10% (890–1089 Ω).",
                "samsungDishwasherM9FillValveOhms",
                "CN401",
                "6",
                ohm_branches("valve", "fill_smart_install", "replace_valve"),
            ),
            visual(
                "fill_smart_install",
                6,
                "Water fills in Smart Install step 2?",
                "Auto step 2 supplies 4.5 L. 4C if pulses <10 in 20 s or level not reached in 5 min (inspection) / 60 min (normal).",
                yes_no("flow_meter", "replace_valve", yes_label="Fills normally", no_label="4C / no fill"),
            ),
            visual(
                "flow_meter",
                7,
                "Flow meter pulses during fill?",
                "CN503 pin 11 flow meter detects pulses during fill. 4C5 if 200 pulses when valve should be off.",
                yes_no("fill_ok", "replace_flow_meter", yes_label="Pulses normal", no_label="No / false pulses"),
            ),
            outcome("replace_valve", 8, "Replace inlet valve", "Replace water valve and assy guide water-sub when coil open or valve stuck."),
            outcome("replace_flow_meter", 9, "Replace flow meter / case brake", "Replace case brake or flow meter when pulse detection fails."),
            outcome("fill_ok", 10, "Fill path OK", "Fill and flow meter verified."),
        ],
    ),
    proc(
        "samsungdwm9-drain-pump",
        "§4-3: Drain Pump (5C)",
        "4-3",
        "Drain check",
        [46, 48],
        ["drain_pump"],
        ["5C", "drain_issue"],
        [
            instr("drain_hose", 2, "Drain path", "Inspect drain hose, air gap, and filter for obstruction.", "drain_connector"),
            instr("drain_connector", 3, "Inspect drain pump connector", "Check CN401 pin 2 AC drain and CN902 BLDC drain connectors.", "drain_ohms"),
            meas(
                "drain_ohms",
                4,
                "Drain pump coil",
                "Disconnect connector. Normal: approx. 88 Ω ±7%.",
                "samsungDishwasherM9DrainPumpOhms",
                "Drain pump",
                "Coil",
                ohm_branches("drain", "drain_smart_install", "replace_drain_pump"),
            ),
            visual(
                "drain_smart_install",
                5,
                "Drain pump runs in Smart Install?",
                "Step 1/4/6: drain pump cycles (14 s on / 2 s off pattern). 5C if pump stuck or not draining.",
                yes_no("pump_foreign", "replace_drain_pump", yes_label="Drains normally", no_label="5C / stuck"),
            ),
            instr("pump_foreign", 6, "Clear pump obstruction", "Remove foreign object from drain pump impeller. Re-test drain.", "drain_ok"),
            outcome("replace_drain_pump", 7, "Replace drain pump", "Replace drain pump or inverter PBA when pump fails after clearing obstruction."),
            outcome("drain_ok", 8, "Drain OK", "Drain pump and path verified."),
        ],
    ),
    proc(
        "samsungdwm9-dispenser",
        "§4-3: Detergent Dispenser",
        "4-3",
        "Detergent is not dispensed",
        [51, 52],
        ["dispenser"],
        ["dispenser_check"],
        [
            visual("detergent_loaded", 2, "Detergent in dispenser?", "Confirm detergent loaded and dispenser not blocked.", yes_no("disp_connector", "load_detergent", yes_label="Loaded", no_label="Empty / blocked")),
            instr("load_detergent", 3, "Load detergent and clear obstruction", "Add detergent; rearrange racks so dispenser can open.", "disp_connector"),
            instr("disp_connector", 4, "Inspect CN401 dispenser", "Reconnect dispenser connector CN401 pin 4.", "disp_ohms"),
            meas(
                "disp_ohms",
                5,
                "Dispenser solenoid",
                "Disconnect connector. Normal: approx. 0.7–3 kΩ.",
                "samsungDishwasherM9DispenserOhms",
                "CN401",
                "4",
                ohm_branches("disp", "disp_operate", "replace_dispenser"),
            ),
            visual(
                "disp_operate",
                6,
                "Dispenser operates 130 s in Smart Install?",
                "Auto step 3 runs dispenser actuator 130 seconds.",
                yes_no("disp_ok", "replace_main_pba_disp", yes_label="Operates", no_label="No movement"),
            ),
            outcome("replace_dispenser", 7, "Replace dispenser", "Replace dispenser when solenoid open."),
            outcome("replace_main_pba_disp", 8, "Replace main PBA", "Replace main PBA when 110–120 V missing at CN401/CN101 during operate."),
            outcome("disp_ok", 9, "Dispenser OK", "Dispenser circuit verified."),
        ],
    ),
    proc(
        "samsungdwm9-dry-system",
        "§4-3: Dry Fan, Actuator & Auto Door (FC / dC3)",
        "4-3",
        "Dry is not satisfied",
        [51, 52],
        ["fan_motor", "vent"],
        ["FC", "dC3", "dry_issue"],
        [
            visual("rinse_aid", 2, "Rinse aid sufficient?", "Rinse refill icon off; dispenser has rinse aid.", yes_no("fan_connector", "refill_rinse", yes_label="OK", no_label="Refill needed")),
            instr("refill_rinse", 3, "Refill rinse aid", "Fill rinse aid dispenser and retest dry performance.", "fan_connector"),
            instr("fan_connector", 4, "Inspect dry fan and actuator", "Reconnect dry fan (CN401 pin 10 / CN301 BLDC) and thermal actuator CN401 pin 5.", "fan_ohms"),
            meas(
                "fan_ohms",
                5,
                "Dry fan motor coil",
                "Disconnect connector. Normal: approx. 150 Ω.",
                "samsungDishwasherM9DryFanOhms",
                "CN401",
                "10",
                ohm_branches("fan", "actuator_ohms", "replace_fan", "~150 Ω"),
            ),
            meas(
                "actuator_ohms",
                6,
                "Thermal actuator",
                "Disconnect connector. Normal: approx. 1.45 kΩ.",
                "samsungDishwasherM9ThermalActuatorOhms",
                "CN401",
                "5",
                ohm_branches("act", "dry_smart_install", "replace_actuator", "~1.45 kΩ"),
            ),
            visual(
                "dry_smart_install",
                7,
                "Fan and auto door in Smart Install step 5?",
                "Step 5: auto door actuator runs; fan 30 s. FC if fan <3000 RPM; dC3 if door not sensed open after retry.",
                yes_no("dry_ok", "replace_main_pba_dry", yes_label="Fan and door OK", no_label="FC / dC3"),
            ),
            outcome("replace_fan", 8, "Replace dry fan", "Replace dry fan motor assembly."),
            outcome("replace_actuator", 9, "Replace thermal actuator", "Replace thermal actuator when open."),
            outcome("replace_main_pba_dry", 10, "Replace main PBA", "Replace main PBA when 120 V relay drive missing during dry operate."),
            outcome("dry_ok", 11, "Dry system OK", "Dry fan and auto door path verified."),
        ],
    ),
    proc(
        "samsungdwm9-leak-sensor",
        "§4-3: Leak Sensor (LC)",
        "4-3",
        "Leakage Check",
        [47, 48],
        ["leak_sensor"],
        ["LC", "leak_check"],
        [
            instr("leak_visual", 2, "Inspect for water leakage", "Check shutter and base for water traces. Normal: no leakage trace.", "leak_sensor_check"),
            visual(
                "leak_sensor_check",
                3,
                "Leak sensor reads >3 V after dry?",
                "CN503 pin 2 leakage input: LC when ≤3 V for 3 s. After 3 min drain, sensor should read >3 V if dry.",
                yes_no("find_leak", "leak_ok", yes_label="Sensor dry / >3 V", no_label="Still ≤3 V wet"),
            ),
            instr("find_leak", 4, "Locate and repair leak", "Find leak at hose, door, sump seals, heater, or pump joints. Repair and dry base.", "leak_ok"),
            outcome("leak_ok", 5, "Leak resolved", "No active leak; sensor dry. Replace main PBA only if leak repaired but LC persists."),
        ],
    ),
    proc(
        "samsungdwm9-overflow",
        "§4-3: Overflow Sensor (OC)",
        "4-3",
        "OC overflow",
        [36, 37],
        ["float_switch"],
        ["OC", "overfill"],
        [
            instr("overflow_drain", 2, "Drain tub", "Unit performs 3× 3 min drain on OC. Verify tub not overfilled.", "overflow_sensor"),
            visual(
                "overflow_sensor",
                3,
                "Overflow sensor >3 V when tub empty?",
                "CN503 pin 1 overflow: OC when ≤3 V for 5 s. Should read >3 V when tub empty after drain.",
                yes_no("valve_stuck", "overflow_ok", yes_label=">3 V dry", no_label="Still ≤3 V"),
            ),
            visual(
                "valve_stuck",
                4,
                "Inlet valve stuck open?",
                "Check water valve shuts off; case brake/flow meter not falsely indicating fill (4C5).",
                yes_no("replace_overflow", "overflow_ok", yes_label="Valve shuts off", no_label="Valve stuck / case brake fault"),
            ),
            outcome("replace_overflow", 5, "Replace valve or case brake", "Replace inlet valve or case brake/flow meter when OC persists with empty tub."),
            outcome("overflow_ok", 6, "Overflow cleared", "Overflow condition resolved."),
        ],
    ),
    proc(
        "samsungdwm9-distributor",
        "§4-3: Distributor Motor (PC)",
        "4-3",
        "Half load / PC cam position",
        [48, 49],
        ["diverter_motor"],
        ["PC", "diverter_check"],
        [
            instr("dist_connector", 2, "Inspect distributor motor", "Check CN401 pin 3 distributor motor and micro switch connectors on CN501.", "dist_ohms"),
            meas(
                "dist_ohms",
                3,
                "Distributor motor coil",
                "Disconnect connector. Normal: approx. 3.6–4.0 kΩ.",
                "samsungDishwasherM9DistributorMotorOhms",
                "CN401",
                "3",
                ohm_branches("dist", "micro_switch", "replace_distributor"),
            ),
            visual(
                "micro_switch",
                4,
                "Micro switch toggles ON/OFF?",
                "Service test: brown/violet micro switch SHORT when ON, OPEN when OFF. NG if stuck either state 120 s. Do not supply water during test.",
                yes_no("dist_smart_install", "replace_micro_switch", yes_label="Switch toggles", no_label="Stuck ON/OFF"),
            ),
            visual(
                "dist_smart_install",
                5,
                "Half load operates in Smart Install?",
                "Step 1 moves vane during drain; step 3 alternates nozzle positions. PC if position not detected in 2 min.",
                yes_no("dist_ok", "replace_distributor", yes_label="Positions detected", no_label="PC fault"),
            ),
            outcome("replace_micro_switch", 6, "Replace micro switch", "Replace position sensing micro switch when stuck."),
            outcome("replace_distributor", 7, "Replace distributor motor", "Replace distributor motor, cam assy, or valve distributor when PC persists."),
            outcome("dist_ok", 8, "Distributor OK", "Distributor and half-load path verified."),
        ],
    ),
    proc(
        "samsungdwm9-vane-motor",
        "§4-3: Lower Vane Motor (7C)",
        "4-3",
        "Motor vane check",
        [49, 50],
        ["diverter_motor"],
        ["7C", "diverter_check"],
        [
            instr("vane_connector", 2, "Inspect vane motor and sensor", "Check CN401 pins 7–8 vane relays and CN501 pin 3 reset sensor connectors.", "vane_ohms"),
            meas(
                "vane_ohms",
                3,
                "Vane motor coil",
                "Disconnect connector. Red/Black (CCW) and White/Black (CW). Normal: approx. 1.625–1.796 kΩ.",
                "samsungDishwasherM9VaneMotorOhms",
                "Vane motor",
                "Red-Black / White-Black",
                ohm_branches("vane", "vane_sensor", "replace_vane_motor"),
            ),
            visual(
                "vane_sensor",
                4,
                "Sensor vane reads 0 V on / 5 V off?",
                "Service test: brown/black sensor vane 0 V when sensor on, 5 V when off. Vane must move back and forth at bottom alternation.",
                yes_no("vane_smart_install", "replace_sensor_vane", yes_label="Sensor toggles", no_label="Sensor stuck"),
            ),
            visual(
                "vane_smart_install",
                5,
                "Vane resets in Smart Install step 1/3?",
                "7C if reset not sensed in 10 s (×3), 25 s, or full cycle <21 s. Vane parks before bottom nozzle spray.",
                yes_no("vane_ok", "replace_vane_motor", yes_label="Vane resets OK", no_label="7C fault"),
            ),
            outcome("replace_sensor_vane", 6, "Replace sensor vane", "Replace sensor vane for position sensing when stuck."),
            outcome("replace_vane_motor", 7, "Replace vane motor / motion assy", "Replace motor vane or motion assy when 7C persists."),
            outcome("vane_ok", 8, "Vane OK", "Lower vane motor and sensor verified."),
        ],
    ),
    proc(
        "samsungdwm9-communication",
        "§4-3: PBA Communication (AC / AC6)",
        "4-3",
        "AC / AC6 communication",
        [36, 37, 50],
        ["main_control"],
        ["AC", "AC6", "communication"],
        [
            instr("comm_harness", 2, "Inspect CN802 sub comms", "Check CN802 main-to-sub harness (pins 4–5 TX/RX, 1/3/9 5V/12V) and inverter CN903/CN904.", "comm_smart_install"),
            visual(
                "comm_smart_install",
                3,
                "Comms stable in Service Inspection?",
                "AC: main↔sub fails 24 s (6 s in test mode). AC6: no inverter response 3 s ×3 then 2 min relay off.",
                yes_no("sub_pba", "replace_sub_wire", yes_label="Stable", no_label="AC / AC6"),
            ),
            instr("replace_sub_wire", 4, "Replace sub-wire", "If AC persists after reseating CN802/CN101, replace sub-wire harness.", "sub_pba"),
            visual(
                "sub_pba",
                5,
                "Sub PBA and inverter seated?",
                "Reseat sub PBA and inverter PBA connectors. Check for corrosion or damaged pins.",
                yes_no("comm_ok", "replace_sub_pba", yes_label="Connectors OK", no_label="Damaged board/harness"),
            ),
            outcome("replace_sub_pba", 6, "Replace sub or inverter PBA", "Replace failed sub PBA or inverter PBA."),
            outcome("replace_main_comm", 7, "Replace main PBA", "Replace main PBA when harness good but comms fail."),
            outcome("comm_ok", 8, "Communication OK", "PBA communication verified."),
        ],
    ),
    proc(
        "samsungdwm9-hmi-check",
        "§4-3: Touch Panel & Sub PBA (bC2 / bC3)",
        "4-3",
        "Key input check",
        [46, 47],
        ["user_interface"],
        ["bC2", "bC3", "bE-2", "bE-3", "hmi_check"],
        [
            instr("hmi_connectors", 2, "Inspect sub PBA connectors", "Reconnect CN103 display control module and CON100 touch module. Check for condensation.", "condensation_check"),
            visual(
                "condensation_check",
                3,
                "No condensation on PBA?",
                "CN103 and CON100 must be dry. Remove moisture if present.",
                yes_no("stuck_button", "replace_control_panel", yes_label="Dry", no_label="Condensation present"),
            ),
            visual(
                "stuck_button",
                4,
                "Stuck button or object on panel?",
                "bC2/bE-2 when button held ≥30 s. Remove object; verify touch panel not damaged.",
                yes_no("version_display", "replace_control_panel", yes_label="Panel clear", no_label="Stuck key"),
            ),
            instr(
                "version_display",
                5,
                "Version display test (n1)",
                "In AS: Hi-Temp cycles n1. Normal=Sub PBA version, Heavy=Touch IC SW, Delicate=Model option, Express=Inverter SW, Rinse=WiFi module.",
                "hmi_ok",
            ),
            outcome("replace_control_panel", 6, "Replace control panel assy", "Replace display control module, touch module, or sub-wire when bC2/bC3 or condensation fault."),
            outcome("hmi_ok", 7, "HMI OK", "Touch panel and sub PBA verified."),
        ],
    ),
    proc(
        "samsungdwm9-voltage-abnormal",
        "§4-1: Abnormal Supply Voltage (9C1 / 9C2)",
        "4-1",
        "9C1 / 9C2 voltage fault",
        [36, 38],
        ["supply"],
        ["9C1", "9C2", "supply_issue"],
        [
            visual(
                "line_voltage",
                2,
                "Line voltage stable 108–132 V?",
                "9C1/9C2 occur on blackout or high/low DC link voltage. Measure outlet under load.",
                yes_no("customer_supply", "check_panel", yes_label="Voltage stable", no_label="High/low/brownout"),
            ),
            instr("customer_supply", 3, "Correct supply", "Verify dedicated 15 A circuit, no shared loads, stable utility power. Retry after power restored.", "line_voltage"),
            visual(
                "check_panel",
                4,
                "Control panel powers on normally?",
                "If supply good but unit pauses with 9C, inspect CN101/CN802 and main PBA after surge event.",
                yes_no("voltage_ok", "replace_main_pba_9c", yes_label="Normal power-up", no_label="Still pauses"),
            ),
            outcome("replace_main_pba_9c", 5, "Replace main PBA", "Replace main PBA when supply verified stable but 9C1/9C2 persists."),
            outcome("voltage_ok", 6, "Supply OK", "Line voltage normal — if fault recurs, log brownout events."),
        ],
    ),
]


def smart_install_bundle() -> dict:
    return {
        "id": "samsungdwm9-smart-install-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "Samsung DW80M9 — Smart Install entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter Service Inspection Mode (Smart Install) for automatic/manual component inspection.",
        "tags": ["service_diagnostic", "smart_install"],
        "entryStepId": "si_prep",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [39, 40]},
        "steps": [
            instr("si_prep", 1, "Power on — set 17 h timer", "Power on dishwasher and set timer for 17 hours.", "si_enter"),
            instr(
                "si_enter",
                2,
                "Enter Smart Install",
                "Press Hi-Temp Wash key for at least 7 seconds. Display shows AS when Smart Install is active.",
                "@continue",
                "Power On → 17 h timer → Hi-Temp Wash 7 s.",
            ),
        ],
    }


def manual_check_bundle() -> dict:
    return {
        "id": "samsungdwm9-manual-check-mode",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "Samsung DW80M9 — Manual check mode",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "Manual Smart Install steps 1–7 (drain/fill, nozzle, heater, dispenser, fan, drain, auto door).",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "mc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [41, 42]},
        "steps": [
            instr(
                "mc_enter",
                1,
                "Enter manual mode",
                "From AS: press Auto to cycle manual steps 1–7. Press Start to run selected step. Normal/Heavy/Delicate keys adjust RPM and alternation in step 2.",
                "@continue",
            ),
        ],
    }


def inspection_code_bundle() -> dict:
    return {
        "id": "samsungdwm9-inspection-code-display",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "Samsung DW80M9 — Inspection code display",
        "modeKind": "fault_codes",
        "uiVariants": ["any"],
        "description": "Review stored inspection codes (n2) — up to 7 codes in EEPROM.",
        "tags": ["fault_codes", "error_code"],
        "entryStepId": "ic_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [43, 44]},
        "steps": [
            instr(
                "ic_enter",
                1,
                "Inspection code display (n2)",
                "While AS displays: press Hi-Temp Wash to cycle n1→n2→n3…. In n2, press Normal (Eco) to loop C00→C10→… Heavy shows sub-codes. Hold operation button 7 s to clear all codes.",
                "@continue",
            ),
        ],
    }


BUNDLES = [smart_install_bundle(), manual_check_bundle(), inspection_code_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]

CODE_TAGS = {
    "4C", "4C5", "4E", "5C", "3C", "PC", "7C", "tC", "HC", "HC1", "LC", "OC",
    "AC", "AC6", "bC2", "bC3", "bE-2", "bE-3", "dC", "dC1", "dC3", "FC", "9C1", "9C2",
}


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "dishwasher",
        "label": "Samsung premium dishwasher DW80M9 (DW80M9960, DW80M9550, DW80M9990)",
        "notes": "§4-2 Service Inspection Mode + §4-3 check-code troubleshooting. BLDC wash/drain via inverter PBA.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "knowledgeIds": [
                    s["measurementKnowledgeId"]
                    for s in item["steps"]
                    if s.get("measurementKnowledgeId")
                ],
                "relatedCodes": [t for t in item.get("tags", []) if t in CODE_TAGS],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print("Wrote procedureCatalog.json")


def write_readme() -> None:
    (OUT / "README.md").write_text(
        """# Samsung premium dishwasher (`samsung_dishwasher_m9`)

Manual **SAMSUNG-DISHWASHER-M9** — DW80M9 Waterwall / Auto Door Open family.

Regenerate:

```bash
python backend/scripts/generate_samsung_dishwasher_m9_procedure_seeds.py
```

Extraction: `frontend/components/diagnostics/knowledge/pattern-catalog/SAMSUNG_DISHWASHER_M9_EXTRACTION.md`

Smoke: `/solomon/procedures/dev` — Samsung + DW80M9960US / DW80M9550US.
""",
        encoding="utf-8",
    )


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

    crop_script = ROOT / "backend/scripts/crop_samsung_dishwasher_m9_procedure_figures.py"
    if crop_script.exists():
        subprocess.run([sys.executable, str(crop_script)], check=True, cwd=ROOT)

    for script_name in (
        "attach_samsung_dishwasher_m9_diagnostic_effects.py",
        "attach_samsung_dishwasher_m9_service_modes.py",
        "attach_samsung_dishwasher_m9_procedure_diagrams.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
