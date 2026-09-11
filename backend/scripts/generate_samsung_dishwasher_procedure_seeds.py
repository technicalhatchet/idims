#!/usr/bin/env python3
"""Generate SAMSUNG-DISHWASHER (DW80R5060/R5061/T5040) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_dishwasher"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-DISHWASHER",
    "manualTitle": "Samsung Dishwasher DW80R5060/R5061/T5040",
    "extractedTextFile": "backend/docs/manuals/samsung-dishwasher-svc manual-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dishwasher or disconnect power before servicing. Replace panels before operating.",
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
        "platformId": "samsung_dishwasher",
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
        "samsungdw-power-supply",
        "§4-1: Main PBA Power & DC Supplies",
        "4-1",
        "Power Check",
        [47, 48],
        ["supply"],
        ["supply_issue", "voltage_check", "no_power"],
        [
            visual(
                "outlet_120vac",
                2,
                "120 VAC at outlet?",
                "Measure voltage at the power outlet. Normal: AC 120 V.",
                yes_no("cn101_voltage", "fix_outlet", yes_label="120 VAC present", no_label="No / low voltage"),
            ),
            instr("fix_outlet", 3, "Correct customer power", "Connect to proper 120 V source or repair outlet wiring.", "cn101_voltage"),
            visual(
                "cn101_voltage",
                4,
                "120 VAC at CN101?",
                "Measure between black and white wires of CN101 on main PBA. Normal: AC 120 V.",
                yes_no("dc_5v", "repair_power_harness", yes_label="120 V at CN101", no_label="Missing at CN101"),
            ),
            instr("repair_power_harness", 5, "Repair power harness", "Check and replace power cable or terminal connections to main PBA.", "dc_5v"),
            visual(
                "dc_5v",
                6,
                "5 VDC present?",
                "Measure CN302 pin 4 (orange) to CN301 pin 6 (brown). Normal: 4.5–5.5 V.",
                yes_no("dc_12v", "replace_main_pba", yes_label="4.5–5.5 V", no_label="Missing / low"),
            ),
            visual(
                "dc_12v",
                7,
                "9–12 V rail present?",
                "Measure CN301 pin 9 (blue) to pin 11 (blue). Power On: 9.5–12.5 V. Power Off: 5.5–7.0 V.",
                yes_no("power_ok", "replace_main_pba", yes_label="Within spec", no_label="Out of spec"),
            ),
            outcome("replace_main_pba", 8, "Replace main PBA", "Replace main PBA assembly when DC supplies fail after harness repair."),
            outcome("power_ok", 9, "Power verified", "Incoming and on-board DC supplies verified."),
        ],
    ),
    proc(
        "samsungdw-thermistor",
        "§4-1: Water Thermistor (tC)",
        "4-1",
        "Temperature Sensor Check",
        [47, 48],
        ["thermistor"],
        ["tC", "HC", "HC1", "temperature_sensor"],
        [
            instr("thermistor_connector", 2, "Inspect CN505 thermistor", "Check CN505 connector seated (pins 5–6 water thermistor). Reconnect if loose.", "thermistor_voltage"),
            visual(
                "thermistor_voltage",
                3,
                "Thermistor voltage 0.2–4.5 V?",
                "With power on, measure voltage across thermistor at CN505. Normal: 0.2–4.5 V.",
                yes_no("thermistor_ohms", "replace_thermistor", yes_label="0.2–4.5 V", no_label="Out of range"),
            ),
            meas(
                "thermistor_ohms",
                4,
                "Thermistor resistance",
                "Power off. Disconnect connector. Measure resistance across thermistor — ~49 kΩ @ 25°C (77°F) per OEM table.",
                "samsungDishwasherThermistorOhms",
                "CN505",
                "5–6",
                ohm_branches("therm", "thermistor_ok", "replace_thermistor"),
            ),
            outcome("replace_thermistor", 5, "Replace thermistor", "Replace thermistor or Assy Sensor ECS when out of spec."),
            outcome("thermistor_ok", 6, "Thermistor OK", "Thermistor verified — if tC/HC persists, check heater and main PBA."),
        ],
    ),
    proc(
        "samsungdw-heater",
        "§4-1: Heater Operation (HC / HC1)",
        "4-1",
        "Heater Check",
        [37, 38, 47],
        ["heater"],
        ["HC", "HC1", "no_heat"],
        [
            instr("hot_water", 2, "Hot water supply", "Verify inlet hose connected to hot water supply. Check water level in tub and drain hose installation.", "heater_smart_install"),
            visual(
                "heater_smart_install",
                3,
                "Heater heats in Smart Install step 3?",
                "In Smart Install Manual Mode step 3: circulation pump runs 10 s then heater operates. Temperature should rise ≥2°C within 30 s after alternation cycle; HC1 if no rise in 10 min.",
                yes_no("heater_wiring", "check_thermistor", yes_label="Temperature rises", no_label="No heat / HC1"),
            ),
            instr("check_thermistor", 4, "Verify thermistor", "Run samsungdw-thermistor procedure — faulty thermistor can cause HC/HC1.", "heater_wiring"),
            visual(
                "heater_wiring",
                5,
                "Heater bracket and connections?",
                "Inspect heater nut torqued into bracket-heater, both heater connectors seated, no scale or open at heater terminals.",
                yes_no("replace_heater", "heater_ok", yes_label="Connections OK", no_label="Heater damaged / loose"),
            ),
            outcome("replace_heater", 6, "Replace heater", "Replace heater assembly when connections good but no heat in Smart Install."),
            outcome("heater_ok", 7, "Heater path OK", "Heater operational — if fault persists, replace main PBA."),
        ],
    ),
    proc(
        "samsungdw-circulation-motor",
        "§4-1: Circulation Motor & Nozzle",
        "4-1",
        "Nozzle does not inject water",
        [48, 49],
        ["wash_motor"],
        ["PC", "wash_issue", "motor_check"],
        [
            instr("motor_connector", 2, "Inspect motor connectors", "Check circulation motor connector and startup condenser connector seated.", "motor_ohms"),
            meas(
                "motor_ohms",
                3,
                "Circulation motor coil",
                "Disconnect connector. Measure coil resistance. Normal: approx. 5.8 Ω.",
                "samsungDishwasherCirculationMotorOhms",
                "Circulation motor",
                "Coil",
                ohm_branches("motor", "nozzle_clear", "replace_motor", "~5.8 Ω"),
            ),
            instr("nozzle_clear", 4, "Clear water passages", "Remove foreign material from water passages and verify nozzles rotate freely.", "nozzle_spray"),
            visual(
                "nozzle_spray",
                5,
                "Nozzle injects water in Smart Install?",
                "Smart Install step 2/3: circulation pump and alternation nozzles spray normally?",
                yes_no("motor_ok", "replace_motor", yes_label="Sprays normally", no_label="No spray"),
            ),
            outcome("replace_motor", 6, "Replace circulation motor", "Replace circulation motor when coil open or spray fails after clearing passages."),
            outcome("motor_ok", 7, "Circulation OK", "Motor and nozzle path verified."),
        ],
    ),
    proc(
        "samsungdw-door-switch",
        "§4-1: Door Sensing Switch",
        "4-1",
        "Cycle does not start",
        [48, 49],
        ["door_latch"],
        ["door_switch_check"],
        [
            instr("door_mechanical", 2, "Door closure", "Verify door latched completely, racks not interfering, unit level.", "door_voltage"),
            visual(
                "door_voltage",
                3,
                "Door switch voltage correct?",
                "Blue wire switch: Power On door open 9.5–12.5 V; Power Off door open 5.5–7.0 V; door closed <2 V.",
                yes_no("door_continuity", "reconnect_door", yes_label="Voltages OK", no_label="Wrong voltage"),
            ),
            instr("reconnect_door", 4, "Reconnect door switch", "Reconnect door sensing switch connectors on blue wire circuit.", "door_continuity"),
            visual(
                "door_continuity",
                5,
                "Door switch continuity?",
                "Power off, connector removed: OPEN when door open; SHORT when door closed.",
                yes_no("door_ok", "replace_door_switch", yes_label="Continuity OK", no_label="Failed switch"),
            ),
            outcome("replace_door_switch", 6, "Replace door switch", "Replace door sensing switch when continuity fails."),
            outcome("door_ok", 7, "Door switch OK", "Door circuit verified — if cycle still won't start, replace main PBA."),
        ],
    ),
    proc(
        "samsungdw-fill-valve",
        "§4-1: Fill Valve & Flow Meter (4C)",
        "4-1",
        "4E(4C) water supply",
        [35, 36, 38],
        ["inlet_valve"],
        ["4C", "4C5", "4E", "fill_issue"],
        [
            visual(
                "supply_tap",
                2,
                "Water supply open and pressure OK?",
                "Faucet open; pressure 20–120 psi. Inlet hose and aqua-stop filter clear.",
                yes_no("valve_connector", "fix_supply", yes_label="Supply OK", no_label="Low pressure / closed valve"),
            ),
            instr("fix_supply", 3, "Correct water supply", "Open valve, clear inlet filter/aqua-stop, verify adequate pressure.", "valve_connector"),
            instr("valve_connector", 4, "Inspect CN202 valve", "Check water valve connector CN202 pin 3 circuit seated; inspect flow meter at CN505 pin 12.", "fill_smart_install"),
            visual(
                "fill_smart_install",
                5,
                "Water fills in Smart Install step 2?",
                "Smart Install Auto step 2 supplies 4.5 L. 4C if pulses <10 in 20 s or level not reached in 60 min.",
                yes_no("flow_meter", "replace_valve", yes_label="Fills normally", no_label="4C / no fill"),
            ),
            visual(
                "flow_meter",
                6,
                "Flow meter pulses during fill?",
                "Case brake/flow meter detects pulses during fill. 4C5 if 200 pulses detected when valve should be off.",
                yes_no("fill_ok", "replace_flow_meter", yes_label="Pulses normal", no_label="No / false pulses"),
            ),
            outcome("replace_valve", 7, "Replace inlet valve", "Replace water valve when supply good but no fill."),
            outcome("replace_flow_meter", 8, "Replace flow meter / case brake", "Replace case brake or flow meter sensor when pulse detection fails."),
            outcome("fill_ok", 9, "Fill path OK", "Fill and flow meter verified."),
        ],
    ),
    proc(
        "samsungdw-drain-pump",
        "§4-1: Drain Pump (5C)",
        "4-1",
        "5C drain fault",
        [35, 38, 40],
        ["drain_pump"],
        ["5C", "drain_issue"],
        [
            instr("drain_hose", 2, "Drain path", "Inspect drain hose, air gap, and filter for obstruction.", "drain_connector"),
            instr("drain_connector", 3, "Inspect CN203 drain pump", "Check CN203 pin 3 AC drain pump connector. Inspect O-ring on pump housing.", "drain_smart_install"),
            visual(
                "drain_smart_install",
                4,
                "Drain pump runs in Smart Install?",
                "Smart Install step 1/4/6: drain pump cycles (14 s on / 2 s off pattern). 5C if pump stuck or not draining.",
                yes_no("pump_foreign", "replace_drain_pump", yes_label="Drains normally", no_label="5C / stuck"),
            ),
            instr("pump_foreign", 5, "Clear pump obstruction", "Remove foreign object from drain pump impeller. Re-test drain.", "drain_ok"),
            outcome("replace_drain_pump", 6, "Replace drain pump", "Replace drain pump or inverter PBA when pump fails after clearing obstruction."),
            outcome("drain_ok", 7, "Drain OK", "Drain pump and path verified."),
        ],
    ),
    proc(
        "samsungdw-dispenser",
        "§4-1: Detergent Dispenser",
        "4-1",
        "Detergent is not dispensed",
        [49, 50],
        ["dispenser"],
        ["dispenser_check"],
        [
            visual("detergent_loaded", 2, "Detergent in dispenser?", "Confirm detergent loaded and dispenser not blocked by large items.", yes_no("disp_connector", "load_detergent", yes_label="Loaded", no_label="Empty / blocked")),
            instr("load_detergent", 3, "Load detergent and clear obstruction", "Add detergent; rearrange racks so dispenser can open.", "disp_connector"),
            instr("disp_connector", 4, "Inspect dispenser connector", "Reconnect dispenser connector CN202 pin 5.", "disp_ohms"),
            meas(
                "disp_ohms",
                5,
                "Dispenser solenoid",
                "Disconnect connector. Measure resistance. Normal: approx. 2.3 kΩ.",
                "samsungDishwasherDispenserOhms",
                "CN202",
                "5",
                ohm_branches("disp", "disp_operate", "replace_dispenser", "~2.3 kΩ"),
            ),
            visual(
                "disp_operate",
                6,
                "Dispenser operates 130 s in Smart Install?",
                "Auto step 3 runs dispenser actuator 130 seconds.",
                yes_no("disp_ok", "replace_main_pba_disp", yes_label="Operates", no_label="No movement"),
            ),
            outcome("replace_dispenser", 7, "Replace dispenser", "Replace dispenser when solenoid open."),
            outcome("replace_main_pba_disp", 8, "Replace main PBA", "Replace main PBA when 120 V missing at CN101/CN202 during operate."),
            outcome("disp_ok", 9, "Dispenser OK", "Dispenser circuit verified."),
        ],
    ),
    proc(
        "samsungdw-dry-system",
        "§4-1: Dry Fan & Thermal Actuator (FC / dC3)",
        "4-1",
        "Dry is not satisfied",
        [50, 51],
        ["fan_motor", "vent"],
        ["FC", "dC3", "dry_issue"],
        [
            visual("rinse_aid", 2, "Rinse aid sufficient?", "Rinse refill LED off; dispenser has rinse aid.", yes_no("fan_connector", "refill_rinse", yes_label="OK", no_label="Refill needed")),
            instr("refill_rinse", 3, "Refill rinse aid", "Fill rinse aid dispenser and retest dry performance.", "fan_connector"),
            instr("fan_connector", 4, "Inspect dry fan and actuator", "Reconnect dry fan motor and thermal actuator connectors (CN201/CN302).", "fan_ohms"),
            meas(
                "fan_ohms",
                5,
                "Dry fan motor coil",
                "Disconnect connector. Normal: approx. 150 Ω.",
                "samsungDishwasherDryFanOhms",
                "Dry fan",
                "Coil",
                ohm_branches("fan", "actuator_ohms", "replace_fan", "~150 Ω"),
            ),
            meas(
                "actuator_ohms",
                6,
                "Thermal actuator",
                "Disconnect connector. Normal: approx. 1.45 kΩ.",
                "samsungDishwasherThermalActuatorOhms",
                "CN201",
                "9",
                ohm_branches("act", "dry_smart_install", "replace_actuator", "~1.45 kΩ"),
            ),
            visual(
                "dry_smart_install",
                7,
                "Fan and auto door in Smart Install step 5?",
                "Step 5: auto door actuator runs; fan 30 s. FC if fan <3000 RPM; dC3 if door not sensed open.",
                yes_no("dry_ok", "replace_main_pba_dry", yes_label="Fan and door OK", no_label="FC / dC3"),
            ),
            outcome("replace_fan", 8, "Replace dry fan", "Replace dry fan motor assembly."),
            outcome("replace_actuator", 9, "Replace thermal actuator", "Replace thermal actuator when open."),
            outcome("replace_main_pba_dry", 10, "Replace main PBA", "Replace main PBA when 120 V relay drive missing during dry operate."),
            outcome("dry_ok", 11, "Dry system OK", "Dry fan and auto door path verified."),
        ],
    ),
    proc(
        "samsungdw-leak-sensor",
        "§4-1: Leak Sensor (LC)",
        "4-1",
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
                "CN505 pin 3 leakage input: LC when ≤3 V for 3 s. After 3 min drain, sensor should read >3 V if dry.",
                yes_no("find_leak", "leak_ok", yes_label="Sensor dry / >3 V", no_label="Still ≤3 V wet"),
            ),
            instr("find_leak", 4, "Locate and repair leak", "Find leak at hose, door, sump seals, heater, or pump joints. Repair and dry base.", "leak_ok"),
            outcome("leak_ok", 5, "Leak resolved", "No active leak; sensor dry. Replace main PBA only if leak repaired but LC persists."),
        ],
    ),
    proc(
        "samsungdw-overflow",
        "§4-1: Overflow Sensor (OC)",
        "4-1",
        "OC overflow",
        [35, 37],
        ["float_switch"],
        ["OC", "overfill"],
        [
            instr("overflow_drain", 2, "Drain tub", "Unit performs 3× 3 min drain on OC. Verify tub not overfilled.", "overflow_sensor"),
            visual(
                "overflow_sensor",
                3,
                "Overflow sensor >3 V when tub empty?",
                "CN505 pin 1 overflow: OC when ≤3 V for 5 s. Should read >3 V when tub empty after drain.",
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
        "samsungdw-distributor",
        "§4-1: Distributor Motor (PC)",
        "4-1",
        "PC cam position",
        [35, 38],
        ["diverter_motor"],
        ["PC", "diverter_check"],
        [
            instr("dist_connector", 2, "Inspect distributor motor", "Check CN202 pin 7 distributor motor connector and cam/vane position.", "dist_smart_install"),
            visual(
                "dist_smart_install",
                3,
                "Vane alternates in Smart Install?",
                "Step 1 moves vane during drain; step 2/3 alternates nozzle positions. PC if position not detected in 2 min.",
                yes_no("cam_position", "replace_distributor", yes_label="Positions detected", no_label="PC fault"),
            ),
            visual(
                "cam_position",
                4,
                "Cam and vane mechanically correct?",
                "Verify cam location correct and vane parks before bottom nozzle spray.",
                yes_no("dist_ok", "replace_distributor", yes_label="Mechanical OK", no_label="Cam/vane fault"),
            ),
            outcome("replace_distributor", 5, "Replace distributor motor", "Replace distributor motor or synchronous motor when PC persists."),
            outcome("dist_ok", 6, "Distributor OK", "Distributor and vane path verified."),
        ],
    ),
    proc(
        "samsungdw-communication",
        "§4-1: PBA Communication (AC / AC6)",
        "4-1",
        "AC / AC6 communication",
        [34, 35],
        ["main_control"],
        ["AC", "AC6", "communication"],
        [
            instr("comm_harness", 2, "Inspect CN401 sub comms", "Check CN401 main-to-sub harness (pins 4–5 TX/RX) and inverter PBA connection.", "comm_smart_install"),
            visual(
                "comm_smart_install",
                3,
                "Comms stable in test mode?",
                "AC: main↔sub fails 24 s (6 s in test mode). AC6: no inverter response 3 s ×3.",
                yes_no("sub_pba", "replace_main_comm", yes_label="Stable", no_label="AC / AC6"),
            ),
            visual(
                "sub_pba",
                4,
                "Sub PBA and inverter seated?",
                "Reseat sub PBA and inverter PBA connectors. Check for corrosion or damaged pins.",
                yes_no("comm_ok", "replace_sub_pba", yes_label="Connectors OK", no_label="Damaged board/harness"),
            ),
            outcome("replace_sub_pba", 5, "Replace sub or inverter PBA", "Replace failed sub PBA or inverter PBA."),
            outcome("replace_main_comm", 6, "Replace main PBA", "Replace main PBA when harness good but comms fail."),
            outcome("comm_ok", 7, "Communication OK", "PBA communication verified."),
        ],
    ),
    proc(
        "samsungdw-hmi-check",
        "§4-1: Touch Panel & Sub PBA (bC2 / bC3)",
        "4-1",
        "LED or Input Key Fail",
        [51, 52],
        ["user_interface"],
        ["bC2", "bC3", "hmi_check"],
        [
            instr("hmi_connectors", 2, "Inspect sub PBA connectors", "Reconnect sub PBA and touch panel harnesses.", "hmi_led_test"),
            visual(
                "hmi_led_test",
                3,
                "LED and key test pass?",
                "Hi-Temp+Sanitize+Power → all LEDs. Normal–Sanitize → each LED. Delay Start ×8 cycles LEDs. Start → 1234. Auto → version.",
                yes_no("stuck_button", "replace_sub_pba_hmi", yes_label="All tests pass", no_label="LED/key fail"),
            ),
            visual(
                "stuck_button",
                4,
                "Stuck button or object on panel?",
                "bC2 when button held ≥30 s. Remove object; verify touch panel not damaged.",
                yes_no("hmi_ok", "replace_sub_pba_hmi", yes_label="Panel clear", no_label="bC2 / bC3 persists"),
            ),
            outcome("replace_sub_pba_hmi", 5, "Replace sub PBA / touch panel", "Replace sub PBA or touch button PBA when bC2/bC3 or LED test fails."),
            outcome("hmi_ok", 6, "HMI OK", "Touch panel and sub PBA verified."),
        ],
    ),
]


def smart_install_bundle() -> dict:
    return {
        "id": "samsungdw-smart-install-entry",
        "version": "1.0.0",
        "platformId": "samsung_dishwasher",
        "manualId": SOURCE["manualId"],
        "title": "Samsung DW80 — Smart Install entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter Smart Install (AS) for automatic/manual component inspection.",
        "tags": ["service_diagnostic", "smart_install"],
        "entryStepId": "si_prep",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [38, 39]},
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
        "id": "samsungdw-manual-check-mode",
        "version": "1.0.0",
        "platformId": "samsung_dishwasher",
        "manualId": SOURCE["manualId"],
        "title": "Samsung DW80 — Manual check mode",
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
                "From AS: press Auto to cycle manual steps 1–7. Press Start to run selected step. Normal/Heavy keys adjust pump RPM and alternation in step 2.",
                "@continue",
            ),
        ],
    }


def inspection_code_bundle() -> dict:
    return {
        "id": "samsungdw-inspection-code-display",
        "version": "1.0.0",
        "platformId": "samsung_dishwasher",
        "manualId": SOURCE["manualId"],
        "title": "Samsung DW80 — Inspection code display",
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
    "4C", "4C5", "4E", "5C", "PC", "tC", "HC", "HC1", "LC", "OC",
    "AC", "AC6", "bC2", "bC3", "dC3", "FC",
}


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "samsung_dishwasher",
        "templateId": "dishwasher",
        "label": "Samsung dishwasher DW80/DW82 (DW80R5060, DW80R5061, DW80T5040)",
        "notes": "§4 Smart Install + check-code troubleshooting. Heater bench Ω deferred (missing from PDF extract).",
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
        """# Samsung dishwasher (`samsung_dishwasher`)

Manual **SAMSUNG-DISHWASHER** — DW80R5060/R5061/T5040 family.

Regenerate:

```bash
python backend/scripts/generate_samsung_dishwasher_procedure_seeds.py
```

Extraction: `frontend/components/diagnostics/knowledge/pattern-catalog/SAMSUNG_DISHWASHER_EXTRACTION.md`

Smoke: `/solomon/procedures/dev` — Samsung + DW80R5060.
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

    for script_name in (
        "attach_samsung_dishwasher_diagnostic_effects.py",
        "attach_samsung_dishwasher_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
