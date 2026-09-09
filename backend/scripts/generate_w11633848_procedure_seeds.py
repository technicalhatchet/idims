#!/usr/bin/env python3
"""Generate W11633848 (Whirlpool/Amana 24\" dishwasher) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_dishwasher_acu"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W11633848",
    "manualTitle": "Amana & Whirlpool 24\" Dishwashers",
    "extractedTextFile": (
        "backend/docs/manuals/technical-manual-w11633848-revb amana and whirlpool dishwasher-extracted.txt"
    ),
    "verifiedAt": "2026-03-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dishwasher or disconnect power before servicing. Replace all parts and panels before operating.",
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
        "platformId": "whirlpool_dishwasher_acu",
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


def instr(sid: str, order: int, title: str, body: str, next_id: str, excerpt: str = "") -> dict:
    return {
        "id": sid,
        "order": order,
        "type": "instruction",
        "title": title,
        "body": body,
        "sourceExcerpt": excerpt or body,
        "requiresInput": False,
        "defaultNextStepId": next_id,
    }


def visual(
    sid: str,
    order: int,
    title: str,
    body: str,
    branches: list[dict],
    excerpt: str = "",
) -> dict:
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
) -> dict:
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


def outcome(sid: str, order: int, title: str, body: str) -> dict:
    return {
        "id": sid,
        "order": order,
        "type": "outcome",
        "title": title,
        "body": body,
        "oemOutcome": body,
        "requiresInput": False,
    }


def pass_fail_branches(
    pass_id: str,
    fail_id: str,
    *,
    pass_label: str = "Within spec",
    fail_label: str = "Out of spec / open",
) -> list[dict]:
    return [
        {
            "id": f"{pass_id}_pass",
            "label": pass_label,
            "when": {"kind": "measurement_normal"},
            "nextStepId": pass_id,
        },
        {
            "id": f"{pass_id}_warn",
            "label": "Borderline",
            "when": {"kind": "measurement_warning"},
            "nextStepId": fail_id,
        },
        {
            "id": f"{pass_id}_crit",
            "label": fail_label,
            "when": {"kind": "measurement_critical"},
            "nextStepId": fail_id,
        },
        {
            "id": f"{pass_id}_open",
            "label": "Open (OL)",
            "when": {"kind": "measurement_open"},
            "nextStepId": fail_id,
        },
    ]


def yes_no(pass_id: str, fail_id: str, *, yes_label: str = "Yes / OK", no_label: str = "No / failed") -> list[dict]:
    return [
        {"id": f"{pass_id}_yes", "label": yes_label, "when": {"kind": "checkpoint_yes"}, "nextStepId": pass_id},
        {"id": f"{pass_id}_no", "label": no_label, "when": {"kind": "checkpoint_no"}, "nextStepId": fail_id},
    ]


ACU_POWER = proc(
    "w11633848-acu-power",
    "§3-6: ACU Power & DC Supplies",
    "3-6",
    "Power Check",
    [40, 41],
    ["supply"],
    ["F1E1", "supply_issue", "voltage_check", "no_power"],
    [
        instr(
            "terminal_voltage",
            2,
            "Line voltage at terminal block",
            "Remove access panel and terminal box cover. Volts AC: black probe on white terminal screw (N), red on black screw (L1). Plug in power.",
            "terminal_120vac",
            "If 120 VAC is present, proceed to P4 check.",
        ),
        visual(
            "terminal_120vac",
            3,
            "120 VAC at terminal block?",
            "Is 120 VAC present at the dishwasher terminal block (L1 to N)?",
            yes_no("p4_voltage", "customer_power", yes_label="120 VAC present", no_label="No / low voltage"),
        ),
        instr(
            "customer_power",
            4,
            "Correct customer power",
            "Have customer correct outlet, breaker, or installation wiring before continuing ACU diagnosis.",
            "p4_voltage",
        ),
        visual(
            "p4_voltage",
            5,
            "120 VAC at P4?",
            "Power off. Remove outer door panel. At connector P4: pin 1 (L1) to pin 4 (N) with power applied — expect 120 VAC.",
            yes_no("dc_supplies", "repair_p4_harness", yes_label="120 VAC at P4", no_label="Missing at P4"),
        ),
        instr(
            "repair_p4_harness",
            6,
            "Repair terminal-to-P4 harness",
            "Check for open connection between terminal block and control P4. Repair harness or terminals as needed.",
            "dc_supplies",
        ),
        visual(
            "dc_supplies",
            7,
            "5 VDC and 13 VDC present?",
            "With power on: 5 VDC from P11A-2 or P11B-2 to P10-2 (DC GND). 13 VDC from P11-7 to P10-2. Both within ±5%?",
            yes_no("dc_ok", "isolate_loaded_supply", yes_label="Both supplies OK", no_label="Missing or low"),
        ),
        instr(
            "isolate_loaded_supply",
            8,
            "Isolate loaded-down supply",
            "Power off. Disconnect loads from control one connector at a time. Restore power and retest missing supply. Replace control if supply stays missing with all loads disconnected.",
            "replace_acu_power",
        ),
        outcome("replace_acu_power", 9, "Replace ACU", "Replace electronic control if DC supplies or P4 input failed after harness repair."),
        outcome("dc_ok", 10, "Power verified", "Incoming and on-board power supplies verified — reassemble and retest operation."),
    ],
)

TRIAC_FUSE = proc(
    "w11633848-triac-fuse",
    "§3-3: F500 Triac Load Fuse",
    "3-3",
    "Fuse Service and Resistance Check",
    [37],
    ["supply"],
    ["F1E1", "supply_issue"],
    [
        instr(
            "fuse_context",
            2,
            "TRIAC load fuse context",
            "F500 protects all TRIAC-controlled loads (fill, drain, dispenser, diverter, etc.). If any TRIAC load runs in Service Diagnostics, F500 is OK.",
            "measure_f500",
        ),
        visual(
            "measure_f500",
            3,
            "F500 resistance < 3 Ω?",
            "Power off. Measure F500 fuse on control board (accessible from top). Less than 3 Ω = good; greater than 3 Ω = open.",
            yes_no("fuse_ok", "inspect_triac_loads", yes_label="< 3 Ω (good)", no_label="> 3 Ω (open)"),
        ),
        instr(
            "inspect_triac_loads",
            4,
            "Inspect all TRIAC loads",
            "With fuse open, inspect resistance of every TRIAC load for short, open, overheating, or pinched harness. Replace failed parts before replacing control.",
            "replace_acu_fuse",
        ),
        outcome("replace_acu_fuse", 5, "Replace ACU after load repair", "Replace control if F500 open and all loads check good."),
        outcome("fuse_ok", 6, "F500 OK", "Triac fuse intact — if loads still dead, check door switch and pilot relay (K2)."),
    ],
)

DOOR_SWITCH = proc(
    "w11633848-door-switch",
    "§3-7: Door Switch Circuit",
    "3-7",
    "Door Switch Circuit",
    [41],
    ["door_gasket"],
    ["F5E1", "F5E2", "door_lock_check"],
    [
        instr(
            "door_mechanical",
            2,
            "Mechanical door checks",
            "Verify installation/leveling, latch obstructions, door seal seated, and racks not interfering with door closure.",
            "disconnect_p9",
        ),
        instr(
            "disconnect_p9",
            3,
            "Disconnect P9",
            "Power off. Remove outer door panel and toe/access panels. Verify P9 and door latch connectors seated. Disconnect P9 from control.",
            "door_closed_ohms",
        ),
        meas(
            "door_closed_ohms",
            4,
            "Door closed — P9 pins 5 & 6",
            "Ohms across P9-5 and P9-6 with door closed and strike fully latched. Expect 3 Ω or less.",
            "dishwasherDoorLatchSwitchOhms",
            "P9",
            "5 & 6 (door closed)",
            pass_fail_branches("door_open_ohms", "repair_door_harness"),
        ),
        meas(
            "door_open_ohms",
            5,
            "Door open — P9 pins 5 & 6",
            "With door open and strike removed from latch, expect infinite resistance (open circuit).",
            "dishwasherDoorLatchSwitchOhms",
            "P9",
            "5 & 6 (door open)",
            [
                {
                    "id": "door_open_pass",
                    "label": "Open circuit (OL)",
                    "when": {"kind": "measurement_open"},
                    "nextStepId": "door_13v",
                },
                {
                    "id": "door_open_fail",
                    "label": "Continuity with door open",
                    "when": {"kind": "measurement_normal"},
                    "nextStepId": "replace_door_switch",
                },
            ],
        ),
        visual(
            "door_13v",
            6,
            "13 VDC at P9-6 with door open?",
            "Reconnect P9. Power on, door open: red lead P9-6, black P13-4 (DC GND). Expect 13 VDC.",
            yes_no("live_door_diag", "replace_acu_door", yes_label="13 VDC present", no_label="Missing"),
        ),
        visual(
            "live_door_diag",
            7,
            "Door switch OK in Service Diagnostics?",
            "Run Service Diagnostics cycle. Verify door-open pause and close-resume behavior.",
            yes_no("door_verified", "replace_acu_door", yes_label="Operates correctly", no_label="Still faulty"),
        ),
        outcome("repair_door_harness", 8, "Repair door harness", "Repair loose connections or harness between door switch and P9."),
        outcome("replace_door_switch", 9, "Replace door switch/latch", "Replace door switch/latch assembly and retest."),
        outcome("replace_acu_door", 10, "Replace ACU", "Door switch and wiring good but control does not sense door — replace ACU."),
        outcome("door_verified", 11, "Door switch verified", "Door switch circuit verified — reassemble."),
    ],
)

FILL_VALVE = proc(
    "w11633848-fill-valve",
    "§3-8: Fill Valve Circuit",
    "3-8",
    "Fill Circuit",
    [42],
    ["inlet_valve"],
    ["F8E1", "F8E2", "F6E2", "fill_issue", "water_valve_check"],
    [
        instr(
            "fill_prereq",
            2,
            "Fill path prerequisites",
            "Verify supply on, adequate line, no siphoning, clean inlet screen, float down (normal). If all TRIAC loads dead, check door switch, F500, pilot relay first.",
            "disconnect_p6_fill",
        ),
        instr(
            "disconnect_p6_fill",
            3,
            "Disconnect P6",
            "Power off. Remove toe and outer door panels. Unplug P6 from control.",
            "fill_valve_ohms",
        ),
        meas(
            "fill_valve_ohms",
            4,
            "Fill valve — P6 pins 1 & 3",
            "Ohms between P6-1 and P6-3. Manual spec 1200–1600 Ω (platform band 890–1600 Ω).",
            "whirlpoolDishwasherAcuFillValveOhms",
            "P6",
            "1 & 3",
            pass_fail_branches("reconnect_p6_fill", "replace_fill_valve"),
        ),
        instr(
            "reconnect_p6_fill",
            5,
            "Reconnect P6 and restore power",
            "Reconnect P6. Reassemble panels as needed for safe live test.",
            "live_fill_voltage",
        ),
        visual(
            "live_fill_voltage",
            6,
            "120 VAC at fill valve during Service Diagnostics?",
            "Volts AC at test pads P6-1 and P6-3 during fill interval. Fill valve must remain connected for accurate reading.",
            yes_no("fill_verified", "replace_acu_fill", yes_label="120 VAC, valve energizes", no_label="No voltage"),
        ),
        outcome("replace_fill_valve", 7, "Replace fill valve", "Replace fill valve or repair harness if coil open/out of range."),
        outcome("replace_acu_fill", 8, "Replace ACU", "Fill valve and harness good but no AC output — replace control."),
        outcome("fill_verified", 9, "Fill valve verified", "Fill valve ohms and live output verified."),
    ],
)

DISPENSER = proc(
    "w11633848-dispenser",
    "§3-9: Dispenser Solenoid",
    "3-9",
    "Dispenser Circuit",
    [43],
    ["inlet_valve"],
    ["F10E1", "F10E2", "F10E3"],
    [
        instr(
            "disp_mechanical",
            2,
            "Dispenser mechanical check",
            "Clear obstructions preventing dispenser lid from opening. If all TRIAC loads dead, check door switch, F500, pilot relay.",
            "disconnect_p12",
        ),
        instr(
            "disconnect_p12",
            3,
            "Disconnect P12",
            "Power off. Remove outer door and toe panels. Unplug P12 from control.",
            "dispenser_ohms",
        ),
        visual(
            "dispenser_ohms",
            4,
            "Dispenser solenoid 310–380 Ω?",
            "Ohms between P12-5 and P12-7. Expected 310–380 Ω per strip circuit.",
            yes_no("reconnect_p12", "replace_dispenser", yes_label="310–380 Ω", no_label="Open or out of range"),
        ),
        instr(
            "reconnect_p12",
            5,
            "Reconnect P12 and restore power",
            "Reconnect P12. Restore power for Service Diagnostics live test.",
            "live_dispenser",
        ),
        visual(
            "live_dispenser",
            6,
            "Dispenser energizes in Service Diagnostics?",
            "120 VAC at P12-5 to P12-7 during dispenser interval (solenoid connected).",
            yes_no("dispenser_verified", "replace_acu_dispenser", yes_label="Energizes", no_label="No output"),
        ),
        outcome("replace_dispenser", 7, "Replace dispenser solenoid", "Replace dispenser solenoid or repair harness."),
        outcome("replace_acu_dispenser", 8, "Replace ACU", "Solenoid good but no AC drive — replace control."),
        outcome("dispenser_verified", 9, "Dispenser verified", "Dispenser solenoid verified."),
    ],
)

HEATER = proc(
    "w11633848-heater",
    "§3-10: Water Heating / Heat Dry",
    "3-10",
    "Water Heating/Heat Dry",
    [44],
    ["heater"],
    ["F4E2", "F4E3", "F7E1", "F7E2", "heating_element_check", "no_heat_dry"],
    [
        instr(
            "disconnect_p4_heater",
            2,
            "Disconnect P4",
            "Power off. Remove toe/access panels. Disconnect P4 from control.",
            "heater_ohms",
        ),
        meas(
            "heater_ohms",
            3,
            "Heater — P4 pins 2 & 3",
            "Ohms between P4-2 and P4-3. Expected 8–30 Ω including element and hi-limit in circuit.",
            "whirlpoolDishwasherAcuHeaterOhms",
            "P4",
            "2 & 3",
            pass_fail_branches("reconnect_p4_heater", "heater_open_path"),
        ),
        instr(
            "heater_open_path",
            4,
            "Isolate open heater path",
            "If open: check heater element and hi-limit thermostat continuity separately. Repair harness or replace open part.",
            "reconnect_p4_heater",
        ),
        instr(
            "reconnect_p4_heater",
            5,
            "Reconnect P4 and restore power",
            "Reconnect P4. Restore power.",
            "live_heater_voltage",
        ),
        visual(
            "live_heater_voltage",
            6,
            "120 VAC at heater during Service Diagnostics?",
            "Volts AC at P4-2 and P4-3 during heater interval.",
            yes_no("heater_verified", "replace_acu_heater", yes_label="120 VAC, heater on", no_label="No voltage"),
        ),
        outcome("replace_acu_heater", 7, "Replace ACU", "Heater circuit good but no AC output — replace control. If heat error persists, run OWI test."),
        outcome("heater_verified", 8, "Heater verified", "Heater element and drive verified."),
    ],
)

OWI_SENSOR = proc(
    "w11633848-owi-sensor",
    "§3-11: OWI / Thermistor",
    "3-11",
    "Water Sensing with OWI Sensor",
    [45],
    ["heater"],
    ["F3E1", "F3E2", "F3E3", "thermistor_check"],
    [
        instr(
            "owi_service_diag",
            2,
            "OWI in Service Diagnostics",
            "First check OWI operation during Service Diagnostics cycle (thermistor LED indicators per §2-3 notes).",
            "disconnect_p10",
        ),
        instr(
            "disconnect_p10",
            3,
            "Disconnect P10",
            "Power off. Unplug P10 from control.",
            "owi_ntc_ohms",
        ),
        meas(
            "owi_ntc_ohms",
            4,
            "OWI NTC — P10 pins 1 & 3",
            "Ohms between P10-1 and P10-3 at room temp. Platform ref: 46–52 kΩ @ 77°F; use manual R/T table for hot water.",
            "whirlpoolDishwasherAcuOwiThermistorOhms",
            "P10",
            "1 & 3",
            pass_fail_branches("owi_ground_check", "replace_owi"),
        ),
        visual(
            "owi_ground_check",
            5,
            "No short to ground on P10-1 or P10-3?",
            "Ohms from P10-1 to cabinet ground and P10-3 to ground — both should be open (no continuity).",
            yes_no("reconnect_p10", "repair_owi_harness", yes_label="No shorts", no_label="Short to ground"),
        ),
        instr(
            "reconnect_p10",
            6,
            "Reconnect P10 and restore power",
            "Reconnect P10. Restore power.",
            "live_owi_5v",
        ),
        visual(
            "live_owi_5v",
            7,
            "5 VDC on OWI during Service Diagnostics?",
            "During OWI/thermistor check interval: 5 VDC between P10-2 (GND) and P10-3.",
            yes_no("owi_verified", "replace_acu_owi", yes_label="5 VDC present", no_label="Missing"),
        ),
        outcome("replace_owi", 8, "Replace OWI sensor", "Replace OWI if NTC out of range or open. Run Service Diagnostics after install to force calibration."),
        outcome("repair_owi_harness", 9, "Repair OWI harness", "Repair or replace harness if shorted to ground."),
        outcome("replace_acu_owi", 10, "Replace ACU", "OWI and harness good but no 5 V supply — replace control."),
        outcome("owi_verified", 11, "OWI verified", "OWI thermistor and supply verified."),
    ],
)

OVERFILL_SWITCH = proc(
    "w11633848-overfill-switch",
    "§3-12: Overfill Float Switch",
    "3-12",
    "Overfill Switch Circuit",
    [46],
    ["inlet_valve"],
    ["F6E4", "F8E5", "fill_issue"],
    [
        instr(
            "overfill_prereq",
            2,
            "Overfill prerequisites",
            "Same fill-path checks as §3-8. Inspect leak pan for water and float freedom.",
            "disconnect_p6_overfill",
        ),
        instr(
            "disconnect_p6_overfill",
            3,
            "Disconnect P6",
            "Power off. Unplug P6 from control.",
            "overfill_valve_ohms",
        ),
        meas(
            "overfill_valve_ohms",
            4,
            "Fill valve — P6 pins 7 & 9",
            "Ohms between P6-7 and P6-9. Expected 890–1600 Ω.",
            "whirlpoolDishwasherAcuFillValveOhms",
            "P6",
            "7 & 9",
            pass_fail_branches("float_down_ohms", "replace_fill_valve_overfill"),
        ),
        meas(
            "float_down_ohms",
            5,
            "Float down — P6 pins 4 & 6",
            "Float in normal (down) position: ohms P6-4 to P6-6. Expect 3 Ω or less.",
            "dishwasherFloatSwitchOhms",
            "P6",
            "4 & 6 (float down)",
            pass_fail_branches("float_up_ohms", "repair_float_switch"),
        ),
        meas(
            "float_up_ohms",
            6,
            "Float up — P6 pins 4 & 6",
            "Raise float (up position): expect open circuit between P6-4 and P6-6.",
            "dishwasherFloatSwitchOhms",
            "P6",
            "4 & 6 (float up)",
            [
                {
                    "id": "float_up_pass",
                    "label": "Open (OL)",
                    "when": {"kind": "measurement_open"},
                    "nextStepId": "reconnect_p6_overfill",
                },
                {
                    "id": "float_up_fail",
                    "label": "Continuity with float up",
                    "when": {"kind": "measurement_normal"},
                    "nextStepId": "replace_float_switch",
                },
            ],
        ),
        instr(
            "reconnect_p6_overfill",
            7,
            "Reconnect P6 and restore power",
            "Reconnect P6. Restore power.",
            "live_overfill_fill",
        ),
        visual(
            "live_overfill_fill",
            8,
            "Fill valve energizes in Service Diagnostics?",
            "120 VAC between P10-1 and P6-9 during fill interval (valve connected).",
            yes_no("overfill_verified", "replace_acu_overfill", yes_label="Energizes", no_label="No output"),
        ),
        outcome("replace_fill_valve_overfill", 9, "Replace fill valve", "Replace fill valve if coil failed."),
        outcome("repair_float_switch", 10, "Repair float harness", "Repair harness or connections to float switch."),
        outcome("replace_float_switch", 11, "Replace float switch", "Replace overfill/float switch assembly."),
        outcome("replace_acu_overfill", 12, "Replace ACU", "Components good but no fill drive — replace control."),
        outcome("overfill_verified", 13, "Overfill circuit verified", "Fill valve and float switch verified."),
    ],
)

DIVERTER_MOTOR = proc(
    "w11633848-diverter-motor",
    "§3-13: Diverter Motor",
    "3-13",
    "Diverter Motor",
    [47],
    ["circulation_pump"],
    ["F9E1", "F10E5", "wash_issue"],
    [
        instr(
            "diverter_listen",
            2,
            "Diverter in Service Diagnostics",
            "Run Service Diagnostics — listen for spray zone changes or inspect diverter shaft rotation. Verify diverter disk installed.",
            "disconnect_p6_diverter",
        ),
        instr(
            "disconnect_p6_diverter",
            3,
            "Disconnect P6 / measure at P7",
            "Power off. Unplug P6. Measure diverter motor at P7-4 and P7-6 (use P10-1 test pad for P7-4 per manual).",
            "diverter_motor_ohms",
        ),
        visual(
            "diverter_motor_ohms",
            4,
            "Diverter motor 600–1800 Ω?",
            "Ohms between P7-4 and P7-6. Expected 600–1800 Ω.",
            yes_no("reconnect_p6_diverter", "replace_diverter", yes_label="600–1800 Ω", no_label="Open or out of range"),
        ),
        instr(
            "reconnect_p6_diverter",
            5,
            "Reconnect P6 and restore power",
            "Reconnect P6. Restore power.",
            "live_diverter",
        ),
        visual(
            "live_diverter",
            6,
            "Diverter rotates in Service Diagnostics?",
            "120 VAC at P6-4 and P6-6 during diverter interval; motor must be connected.",
            yes_no("diverter_motor_verified", "replace_acu_diverter", yes_label="Rotates", no_label="No drive/rotation"),
        ),
        outcome("replace_diverter", 7, "Replace diverter assembly", "Replace diverter motor assembly if open/out of range."),
        outcome("replace_acu_diverter", 8, "Replace ACU", "Motor good but no AC output — replace control. If error persists, run diverter sensor test."),
        outcome("diverter_motor_verified", 9, "Diverter motor verified", "Diverter motor verified."),
    ],
)

DIVERTER_SENSOR = proc(
    "w11633848-diverter-sensor",
    "§3-14: Diverter Position Sensor",
    "3-14",
    "Diverter Position Optical Sensor",
    [48],
    ["circulation_pump"],
    ["F9E1", "F10E5", "wash_issue"],
    [
        instr(
            "sensor_prereq",
            2,
            "Confirm diverter motor first",
            "If diverter does not route water between zones, complete §3-13 diverter motor test first.",
            "harness_continuity",
        ),
        visual(
            "harness_continuity",
            3,
            "Position switch harness continuity OK?",
            "Power off. Verify diverter position switch and P11 connectors seated. Check harness continuity switch to P11.",
            yes_no("live_position_sensor", "repair_diverter_harness", yes_label="Continuity OK", no_label="Harness fault"),
        ),
        visual(
            "live_position_sensor",
            4,
            "Position voltage varies 0–8–10 V in Service Diagnostics?",
            "Power on. DC volts: red P11-2, black P10-2. Run Service Diagnostics — voltage should pulse 0 V to 8–10 V as diverter reaches each position.",
            yes_no("sensor_verified", "replace_diverter_sensor", yes_label="Varies correctly", no_label="Stuck at 0 or 8–10 V"),
        ),
        outcome("repair_diverter_harness", 5, "Repair harness", "Repair or replace diverter position switch harness."),
        outcome("replace_diverter_sensor", 6, "Replace diverter assembly", "Replace diverter assembly if sensor does not detect positions."),
        outcome("sensor_verified", 7, "Diverter sensor verified", "Diverter position sensor verified."),
        outcome("replace_acu_sensor", 8, "Replace ACU", "If motor and sensor good but fault persists, replace control."),
    ],
)

WASH_MOTOR = proc(
    "w11633848-wash-motor",
    "§3-15: Wash Motor (SSM)",
    "3-15",
    "Global Wash Motor SSM",
    [49],
    ["circulation_pump"],
    ["F4E3", "F7E1", "wash_issue", "pump_check"],
    [
        instr(
            "wash_prereq",
            2,
            "Wash path prerequisites",
            "Inspect sump, coarse filter, spray arms. Run Service Diagnostics wash-motor interval first.",
            "disconnect_p5_wash",
        ),
        instr(
            "disconnect_p5_wash",
            3,
            "Disconnect P5",
            "Power off. Unplug P5 from control.",
            "wash_motor_ohms",
        ),
        meas(
            "wash_motor_ohms",
            4,
            "Wash motor — P5 pins 1 & 2",
            "Ohms P5-1 to P5-2. Manual SSM spec 6.7–8.7 Ω @ 25°C (platform band 5–15 Ω).",
            "whirlpoolDishwasherAcuWashMotorOhms",
            "P5",
            "1 & 2",
            pass_fail_branches("wash_fuse_check", "replace_wash_motor"),
        ),
        visual(
            "wash_fuse_check",
            5,
            "F501 wash fuse < 3 Ω (if equipped)?",
            "Some models: verify wash motor fuse F501 < 3 Ω. If > 3 Ω, replace control.",
            yes_no("reconnect_p5_wash", "replace_acu_wash_fuse", yes_label="Fuse OK or N/A", no_label="F501 open"),
        ),
        instr(
            "reconnect_p5_wash",
            6,
            "Reconnect P5 and restore power",
            "Reconnect P5. Restore power.",
            "live_wash_motor",
        ),
        visual(
            "live_wash_motor",
            7,
            "Wash motor runs in Service Diagnostics?",
            "120 VAC at P5-1 and P5-2 during wash interval.",
            yes_no("wash_verified", "replace_acu_wash", yes_label="Runs", no_label="No run / no voltage"),
        ),
        outcome("replace_wash_motor", 8, "Replace wash motor", "Replace wash motor if winding failed."),
        outcome("replace_acu_wash_fuse", 9, "Replace ACU (F501)", "Replace control if F501 open."),
        outcome("replace_acu_wash", 10, "Replace ACU", "Motor good but no AC output — replace control."),
        outcome("wash_verified", 11, "Wash motor verified", "Wash motor circuit verified."),
    ],
)

DRAIN_MOTOR = proc(
    "w11633848-drain-motor",
    "§3-16: Drain Motor",
    "3-16",
    "Drain Motor with SSM",
    [50],
    ["drain_pump"],
    ["F9E1", "F9E2", "F8E4", "drain_issue", "pump_check"],
    [
        instr(
            "drain_mechanical",
            2,
            "Drain path mechanical check",
            "Verify drain hose, disposal plug, check valve, filter. Run Service Diagnostics drain interval first.",
            "disconnect_p5_drain",
        ),
        instr(
            "disconnect_p5_drain",
            3,
            "Disconnect P5",
            "Power off. Unplug P5 from control.",
            "drain_motor_ohms",
        ),
        meas(
            "drain_motor_ohms",
            4,
            "Drain motor — P5 pins 3 & 4",
            "Ohms P5-3 to P5-4. Procedure spec 27–33 Ω (platform band 15–60 Ω).",
            "whirlpoolDishwasherAcuDrainMotorOhms",
            "P5",
            "3 & 4",
            pass_fail_branches("reconnect_p5_drain", "replace_drain_motor"),
        ),
        instr(
            "reconnect_p5_drain",
            5,
            "Reconnect P5 and restore power",
            "Reconnect P5. Restore power.",
            "live_drain_motor",
        ),
        visual(
            "live_drain_motor",
            6,
            "Drain motor runs in Service Diagnostics?",
            "120 VAC at P5-3 and P5-4 during drain interval (motor connected).",
            yes_no("drain_verified", "replace_acu_drain", yes_label="Runs", no_label="No run / no voltage"),
        ),
        outcome("replace_drain_motor", 7, "Replace drain motor", "Replace drain pump if winding failed or impeller damaged."),
        outcome("replace_acu_drain", 8, "Replace ACU", "Motor good but no AC output — replace control."),
        outcome("drain_verified", 9, "Drain motor verified", "Drain motor verified."),
    ],
)

DC_FAN = proc(
    "w11633848-dc-fan",
    "§3-17: DC Fan Motor",
    "3-17",
    "DC Fan Motor",
    [51],
    ["heater"],
    ["F10E3"],
    [
        instr(
            "fan_service_diag",
            2,
            "Fan in Service Diagnostics",
            "On fan-equipped models: DC fan runs during Service Diagnostics step 4. Skip if model has no fan.",
            "disconnect_p14",
        ),
        instr(
            "disconnect_p14",
            3,
            "Disconnect P14",
            "Power off. Unplug P14 from control.",
            "fan_ohms",
        ),
        visual(
            "fan_ohms",
            4,
            "Fan motor 31–41 kΩ?",
            "Ohms between P14-1 and P14-2. Expected 31–41 kΩ.",
            yes_no("reconnect_p14", "replace_fan", yes_label="31–41 kΩ", no_label="Open or out of range"),
        ),
        instr(
            "reconnect_p14",
            5,
            "Reconnect P14 and restore power",
            "Reconnect P14. Restore power.",
            "live_fan",
        ),
        visual(
            "live_fan",
            6,
            "5 VDC and fan spins in Service Diagnostics?",
            "During fan interval: 5 VDC ±5% at P14-1 and P14-2; fan spins.",
            yes_no("fan_verified", "replace_acu_fan", yes_label="Runs", no_label="No spin / no voltage"),
        ),
        outcome("replace_fan", 7, "Replace fan assembly", "Replace DC fan motor assembly."),
        outcome("replace_acu_fan", 8, "Replace ACU", "Fan good but no DC drive — replace control."),
        outcome("fan_verified", 9, "DC fan verified", "DC fan verified."),
    ],
)


def diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11633848-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_dishwasher_acu",
        "manualId": "W11633848",
        "title": "W11633848 — Service Diagnostics cycle entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter Service Diagnostics (1-2-3 × 3 key sequence); cycle starts when door closes.",
        "tags": ["service_diagnostic", "fault_codes", "live_test"],
        "entryStepId": "prep_standby",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [21, 22],
        },
        "steps": [
            {
                "id": "prep_standby",
                "order": 1,
                "type": "instruction",
                "title": "Standby mode",
                "body": "Dishwasher plugged in, control in standby (no cycle running).",
                "sourceExcerpt": "To invoke the Service Diagnostics cycle, perform the following while in Standby.",
                "requiresInput": False,
                "defaultNextStepId": "keypad_entry",
            },
            {
                "id": "keypad_entry",
                "order": 2,
                "type": "instruction",
                "title": "1-2-3 key entry sequence",
                "body": (
                    "Press any 3 keys in the sequence 1-2-3-1-2-3-1-2-3 with no more than 1 second between key presses. "
                    "All LEDs turn on for 5 seconds (display test), then off 1 second before error history. "
                    "The Service Diagnostics cycle starts when the door is closed. "
                    "Press START/RESUME to rapid-advance one interval. Door open pauses; close door to resume."
                ),
                "sourceExcerpt": "Press any 3 keys in the sequence 1-2-3-1-2-3-1-2-3... The Service Diagnostics cycle will start when the door is closed.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    ACU_POWER,
    TRIAC_FUSE,
    DOOR_SWITCH,
    FILL_VALVE,
    DISPENSER,
    HEATER,
    OWI_SENSOR,
    OVERFILL_SWITCH,
    DIVERTER_MOTOR,
    DIVERTER_SENSOR,
    WASH_MOTOR,
    DRAIN_MOTOR,
    DC_FAN,
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLES = [diagnostic_entry_bundle()]
BUNDLE_FILES = ["w11633848-service-diagnostic-entry.json"]


def write_catalog() -> None:
    w11633848_entries = [
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
            "relatedCodes": [tag for tag in item.get("tags", []) if tag.startswith("F")],
        }
        for item in PROCEDURES
    ]
    catalog_path = OUT / "procedureCatalog.json"
    existing = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.is_file() else {}
    w11480208_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w11480208-")
    ]
    catalog = {
        "manualId": "W11633848",
        "platformId": "whirlpool_dishwasher_acu",
        "templateId": "dishwasher",
        "label": 'Whirlpool/Maytag/KitchenAid ACU dishwasher (W11633848 + W11480208)',
        "notes": (
            "W11633848 Amana/Whirlpool 24\" + W11480208 filtration dishwasher (WDT740). "
            "Filtration manual uses P12 door, P11 overfill, P6 diverter, VSM motor pinouts."
        ),
        "plannedProcedures": w11633848_entries + w11480208_entries,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {catalog_path.name} "
        f"({len(w11633848_entries)} W11633848 + {len(w11480208_entries)} W11480208)"
    )


def write_readme() -> None:
    readme = OUT / "README.md"
    readme.write_text(
        """# whirlpool_dishwasher_acu procedure seeds

Manual **W11633848** (Amana & Whirlpool 24\" dishwashers).

Regenerate:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11633848
```

Extraction: `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11633848_DISHWASHER_EXTRACTION.md`
""",
        encoding="utf-8",
    )
    print("Wrote README.md")


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

    for script_name in (
        "attach_w11633848_diagnostic_effects.py",
        "attach_w11633848_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
