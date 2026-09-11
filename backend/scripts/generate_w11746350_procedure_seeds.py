#!/usr/bin/env python3
"""Generate W11746350 (Whirlpool/Maytag freestanding range) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_freestanding_range"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_freestanding_range"

SOURCE = {
    "manualId": "W11746350",
    "manualTitle": "Whirlpool/Maytag Freestanding Gas & Electric Ranges (W11746350F)",
    "extractedTextFile": "backend/docs/manuals/technical-manual-w11746350-revf-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": (
        "Unplug the range or disconnect power before servicing. "
        "Resistance checks require power off and disconnected harnesses. "
        "Replace all parts and panels before operating."
    ),
    "sourceExcerpt": "Resistance checks must be made with power cord unplugged or power disconnected.",
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
    template_ids: list[str] | None = None,
) -> dict:
    if not steps:
        raise ValueError(f"{pid} must define at least one step after safety")
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    item = {
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
    if template_ids:
        item["templateIds"] = template_ids
    return item


def meas(sid, order, title, body, kid, connector, pins, branches, excerpt="", pin_details=None):
    test_point = {"connector": connector, "pins": pins, "label": title}
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
        {"id": f"{prefix}_open", "label": "Open circuit (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


PIN_P22_SENSOR = [
    {"pin": "1", "signal": "RTD", "wireColor": "—", "wireColorConfidence": "manual_only"},
    {"pin": "2", "signal": "RTD", "wireColor": "—", "wireColorConfidence": "manual_only"},
]
PIN_P8_LATCH = [
    {"pin": "5", "signal": "Latch motor", "wireColor": "—", "wireColorConfidence": "manual_only"},
    {"pin": "6", "signal": "Latch motor", "wireColor": "—", "wireColorConfidence": "manual_only"},
]
PIN_P4_BAKE = [
    {"pin": "3", "signal": "Bake element", "wireColor": "—", "wireColorConfidence": "manual_only"},
    {"pin": "4", "signal": "Bake element", "wireColor": "—", "wireColorConfidence": "manual_only"},
]


PROCEDURES = [
    proc(
        "w11746350-acu-power",
        "ACU Power & Communication",
        "ACU",
        "Electronic Control / ACU",
        [14, 29, 30],
        ["supply"],
        ["supply_issue", "no_power", "F1E1", "F1EA", "F6E1", "F9E0"],
        [
            visual(
                "check_acu_connections",
                2,
                "Inspect ACU and harness connections",
                "Power off. Inspect all connections to main control (ACU). Reseat loose connectors.",
                [
                    {"id": "conn_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "supply_voltage"},
                    {"id": "conn_bad", "label": "Loose or damaged", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_harness_acu"},
                ],
            ),
            instr("repair_harness_acu", 3, "Repair harness and retest", "Repair or replace harness/terminals, restore power, retest.", "check_acu_connections"),
            meas(
                "supply_voltage",
                4,
                "Line voltage at terminal block",
                "Confirm 120/240 VAC supply at wall outlet and terminal block per tech sheet (+10% / −15%).",
                "supplyVoltage240",
                "Terminal block",
                "L1–L2 / L1–N",
                ohm_branches("supply", "acu_verified", "replace_acu"),
            ),
            outcome("replace_acu", 5, "Replace main oven control (ACU)", "Supply good but F1E1/F1EA/F6E1 persists — replace ACU."),
            outcome("acu_verified", 6, "ACU supply verified", "Power and connections verified; clear codes in Service Diagnostics."),
        ],
    ),
    proc(
        "w11746350-hmi",
        "HMI / Touch Interface",
        "HMI",
        "Front Console & HMI",
        [26, 31, 32],
        ["supply"],
        ["hmi_check", "F2E1", "F2E2", "F2E4"],
        [
            visual(
                "inspect_hmi_harness",
                2,
                "Inspect HMI connections",
                "Power off. Inspect connections between HMI assembly and ACU. Reseat if loose.",
                [
                    {"id": "hmi_ok", "label": "Harness OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "hmi_power_check"},
                    {"id": "hmi_bad", "label": "Loose or damaged", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_hmi_harness"},
                ],
            ),
            instr("repair_hmi_harness", 3, "Repair HMI harness", "Repair harness, restore power, allow 60 sec for ACU to identify HMI.", "inspect_hmi_harness"),
            visual(
                "hmi_power_check",
                4,
                "HMI 12 VDC at ACU P3",
                "With connectors attached and power on, verify 12 VDC at ACU pin outs P3-1 to P3-2 per component chart.",
                [
                    {"id": "12v_ok", "label": "12 VDC present", "when": {"kind": "checkpoint_yes"}, "nextStepId": "hmi_verified"},
                    {"id": "12v_bad", "label": "No 12 VDC", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_hmi"},
                ],
            ),
            outcome("replace_hmi", 5, "Replace HMI assembly", "F2E1/F2E2/F2E4 persists after harness OK — replace HMI."),
            outcome("hmi_verified", 6, "HMI verified", "HMI power and connections verified."),
        ],
    ),
    proc(
        "w11746350-oven-sensor",
        "Main Oven Temperature Sensor",
        "RTD",
        "Oven Sensor",
        [12, 32, 33, 49],
        ["temp_sensor"],
        ["sensor_check", "temp_accuracy_issue", "F3E0", "F6E1"],
        [
            visual(
                "verify_room_temp",
                2,
                "Verify room-temperature failure",
                "Enter Service Diagnostics. Confirm oven sensor at room temp (50–90°F) and F3E0 displayed matches this test.",
                [
                    {"id": "code_ok", "label": "Code matches", "when": {"kind": "checkpoint_yes"}, "nextStepId": "sensor_connections"},
                    {"id": "code_no", "label": "Does not match", "when": {"kind": "checkpoint_no"}, "nextStepId": "sensor_verified"},
                ],
            ),
            visual(
                "sensor_connections",
                3,
                "Sensor harness connections",
                "Power off. Check all sensor connections on harness and ACU board.",
                [
                    {"id": "sen_conn_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "sensor_ohms"},
                    {"id": "sen_conn_bad", "label": "Loose or damaged", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_sensor_harness"},
                ],
            ),
            instr("repair_sensor_harness", 4, "Repair sensor harness", "Repair harness, reconnect sensor, retest.", "sensor_ohms"),
            meas(
                "sensor_ohms",
                5,
                "Oven RTD resistance P22-1 to P22-2",
                "Disconnect sensor from ACU. Measure between connector pins — expect 1000–1200 Ω at room temp. "
                "Also check connector to sensor casing for short to ground.",
                "whirlpoolFreestandingRangeOvenSensorOhms",
                "P22",
                "1 & 2",
                ohm_branches("rtd", "check_short_to_case", "replace_sensor"),
            ),
            visual(
                "check_short_to_case",
                6,
                "Short to sensor casing",
                "Any short from connector pins to sensor metal casing?",
                [
                    {"id": "short_yes", "label": "Short found", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_sensor"},
                    {"id": "short_no", "label": "No short", "when": {"kind": "checkpoint_no"}, "nextStepId": "trace_harness"},
                ],
            ),
            instr("trace_harness", 7, "Trace harness to ACU", "Trace wires from sensor to ACU. Replace damaged harness or sensor.", "replace_sensor"),
            outcome("replace_sensor", 8, "Replace oven temperature sensor", "RTD out of range or shorted — replace sensor or harness."),
            outcome("sensor_verified", 9, "Oven sensor verified", "RTD 1000–1200 Ω, no short — clear F3E0 in Diagnostics."),
        ],
    ),
    proc(
        "w11746350-door-latch",
        "Rear Door Latch Motor",
        "Latch",
        "Rear Door Latch",
        [12, 34, 35, 45],
        ["temp_sensor"],
        ["door_latch_check", "F5E0", "F5E1"],
        [
            visual(
                "latch_activation",
                2,
                "Component Activation — Door Latch Motor",
                "In Service Diagnostics → Component Activation → Door Latch Motor → Latch Door. "
                "Wait 15+ sec — does latch status change on screen?",
                [
                    {"id": "latch_runs", "label": "Status changes", "when": {"kind": "checkpoint_yes"}, "nextStepId": "door_switch_check"},
                    {"id": "latch_fail", "label": "No status change", "when": {"kind": "checkpoint_no"}, "nextStepId": "latch_ohms"},
                ],
            ),
            meas(
                "latch_ohms",
                3,
                "Latch motor resistance P8-5 to P8-6",
                "Power off. Disconnect latch leads. Measure P8-5 to P8-6 — expect 500–3000 Ω at 77°F (25°C).",
                "whirlpoolFreestandingRangeDoorLatchOhms",
                "P8",
                "5 & 6",
                ohm_branches("latch", "door_switch_check", "replace_latch"),
            ),
            visual(
                "door_switch_check",
                4,
                "Door position switch P3-5 to P3-6",
                "Door open = infinite Ω; door closed = 0 Ω at P3-5 to P3-6.",
                [
                    {"id": "sw_ok", "label": "Switch states correct", "when": {"kind": "checkpoint_yes"}, "nextStepId": "latch_verified"},
                    {"id": "sw_bad", "label": "Switch wrong", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_latch"},
                ],
            ),
            outcome("replace_latch", 5, "Replace door latch assembly", "Latch motor or switch out of spec — replace latch assembly."),
            outcome("latch_verified", 6, "Door latch verified", "Latch motor and switches verified — clear F5E0/F5E1."),
        ],
    ),
    proc(
        "w11746350-vent-fan",
        "Ventilation / Convection Fan",
        "Fan",
        "Ventilation Fan Assembly",
        [14, 29, 51],
        ["convection_fan"],
        ["fan_motor_check", "convection_issue", "F7E5", "F7E6"],
        [
            visual(
                "fan_runs",
                2,
                "Fan activates above temp limit",
                "Fan should run when HMI/ACU temp exceeds limit (140°F rear electric, 104°F rear gas, 165°F front). Does fan run?",
                [
                    {"id": "fan_ok", "label": "Fan runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "fan_verified"},
                    {"id": "fan_no", "label": "Fan does not run", "when": {"kind": "checkpoint_no"}, "nextStepId": "fan_ohms"},
                ],
            ),
            meas(
                "fan_ohms",
                3,
                "Convection fan motor resistance",
                "Power off. Disconnect fan motor leads. Expect ~85 Ω ±10% cold (W11746350 convection fan).",
                "whirlpoolFreestandingRangeConvectFanOhms",
                "Fan motor",
                "terminals",
                ohm_branches("fan", "check_12vdc", "replace_fan_motor"),
            ),
            visual(
                "check_12vdc",
                4,
                "12 VDC at ACU P6-5 to P6-6",
                "With power on and fan commanded, verify 12 VDC at P6-5 to P6-6.",
                [
                    {"id": "v_ok", "label": "12 VDC present", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_fan"},
                    {"id": "v_bad", "label": "No 12 VDC", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_fan_motor"},
                ],
            ),
            outcome("replace_fan_motor", 5, "Replace ventilation/convection fan", "Fan motor open or binding — replace fan assembly."),
            outcome("replace_acu_fan", 6, "Replace ACU", "Fan motor good but not commanded — replace ACU."),
            outcome("fan_verified", 7, "Fan verified", "Ventilation fan operates normally."),
        ],
    ),
    proc(
        "w11746350-bake-element",
        "Hidden Bake Element",
        "Bake",
        "Bake Element",
        [21, 41, 47],
        ["bake_element"],
        ["heating_element_check", "no_bake_heat_issue", "FEE6"],
        [
            visual(
                "bake_connections",
                2,
                "Bake element connections",
                "Power off. Check bake element connection at ACU P4 and element terminals.",
                [
                    {"id": "bake_conn_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bake_ohms"},
                    {"id": "bake_conn_bad", "label": "Loose or burnt", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_bake_conn"},
                ],
            ),
            instr("repair_bake_conn", 3, "Repair bake connections", "Reseat or repair terminals, retest.", "bake_ohms"),
            meas(
                "bake_ohms",
                4,
                "Bake element resistance P4-3 to P4-4",
                "Disconnect element. Measure cold resistance — expect 23.3 Ω ±5% (hidden bake).",
                "whirlpoolFreestandingRangeHiddenBakeOhms",
                "P4",
                "3 & 4",
                ohm_branches("bake", "bake_relay_check", "replace_bake_element"),
            ),
            visual(
                "bake_relay_check",
                5,
                "Bake relay and supply voltage",
                "Element in range. Check bake relay connection and appliance voltage at element when commanded.",
                [
                    {"id": "relay_ok", "label": "Voltage present when bake on", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bake_verified"},
                    {"id": "relay_bad", "label": "No voltage / bad relay", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_bake"},
                ],
            ),
            outcome("replace_bake_element", 6, "Replace bake element", "Bake element open or out of range."),
            outcome("replace_acu_bake", 7, "Replace ACU", "Bake element good but no heat — replace ACU/relay path."),
            outcome("bake_verified", 8, "Bake element verified", "Bake element resistance and operation verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "w11746350-broil-element",
        "Broil Element",
        "Broil",
        "Broil Element",
        [18, 41, 47],
        ["broil_element"],
        ["heating_element_check", "no_broil_heat_issue", "FEE7"],
        [
            meas(
                "broil_ohms",
                2,
                "Broil element resistance P80-7 to P80-8",
                "Power off. Disconnect broil element. Measure cold resistance — expect 10–40 Ω.",
                "broilElementOhms",
                "P80",
                "7 & 8",
                ohm_branches("broil", "broil_voltage", "replace_broil"),
            ),
            visual(
                "broil_voltage",
                3,
                "Broil relay and voltage",
                "Element in range. Verify relay connection and voltage at broil element when broil commanded.",
                [
                    {"id": "broil_v_ok", "label": "Voltage OK when broil on", "when": {"kind": "checkpoint_yes"}, "nextStepId": "broil_verified"},
                    {"id": "broil_v_bad", "label": "No voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_broil"},
                ],
            ),
            outcome("replace_broil", 4, "Replace broil element", "Broil element open or out of range."),
            outcome("replace_acu_broil", 5, "Replace ACU", "Broil element good but no heat — replace ACU."),
            outcome("broil_verified", 6, "Broil element verified", "Broil element verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "w11746350-convect-element",
        "Convection Element (gas oven)",
        "Convect",
        "Convection Fan & Element Assembly",
        [15, 41, 48],
        ["convection_fan"],
        ["heating_element_check", "convection_issue", "FEE8"],
        [
            meas(
                "convect_element_ohms",
                2,
                "Convection element resistance",
                "Power off. Disconnect convection element leads. Expect 14.5–16.1 Ω cold (914 W heated).",
                "whirlpoolFreestandingRangeConvectElementOhms",
                "Convect element",
                "terminals",
                ohm_branches("convect_el", "convect_fan_ohms", "replace_convect_element"),
            ),
            meas(
                "convect_fan_ohms",
                3,
                "Convection fan motor resistance",
                "Disconnect fan motor leads. Expect ~85 Ω ±10% cold.",
                "whirlpoolFreestandingRangeConvectFanOhms",
                "Fan motor",
                "terminals",
                ohm_branches("convect_fan", "convect_verified", "replace_convect_fan"),
            ),
            outcome("replace_convect_element", 4, "Replace convection element", "Convection element out of range."),
            outcome("replace_convect_fan", 5, "Replace convection fan motor", "Fan motor out of range."),
            outcome("convect_verified", 6, "Convection assembly verified", "Convection element and fan verified."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "w11746350-dsi-gas-valve",
        "DSI Board & Gas Regulator",
        "DSI",
        "DSI Spark Module / Gas Regulator",
        [13, 17, 43, 44],
        ["gas_valve"],
        ["gas_valve_check", "ignition_issue", "no_bake_heat_issue"],
        [
            meas(
                "regulator_ohms",
                2,
                "Gas regulator solenoid resistance",
                "Power off. Disconnect leads. Measure across solenoid terminals — 216 Ω ±10%.",
                "whirlpoolFreestandingRangeDsiValveOhms",
                "Gas regulator",
                "solenoid",
                ohm_branches("reg", "dsi_voltage", "replace_regulator"),
            ),
            visual(
                "dsi_voltage",
                3,
                "DSI input voltage and spark gap",
                "Verify 102–132 VAC L1–N at DSI. Recommended spark gap 0.125 in (3.18 mm). Visually verify spark on ignition.",
                [
                    {"id": "dsi_ok", "label": "Voltage OK, sparks", "when": {"kind": "checkpoint_yes"}, "nextStepId": "dsi_verified"},
                    {"id": "dsi_bad", "label": "No voltage or no spark", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_dsi"},
                ],
            ),
            outcome("replace_regulator", 4, "Replace gas regulator / valve coil", "Solenoid out of 216 Ω ±10% range."),
            outcome("replace_dsi", 5, "Replace DSI spark module", "DSI board or wiring fault."),
            outcome("dsi_verified", 6, "DSI / gas valve verified", "Gas valve and DSI operation verified."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "w11746350-surface-spark",
        "Surface Burner Spark Module",
        "Spark",
        "Spark Module (cooktop)",
        [49, 50],
        ["surface_ignition"],
        ["ignition_issue", "surface_burner"],
        [
            visual(
                "spark_test",
                2,
                "Cooktop spark visual test",
                "Turn one cooktop knob to LITE. Verify all burners spark. Expect ~120 VAC across spark module terminals.",
                [
                    {"id": "spark_ok", "label": "All burners spark", "when": {"kind": "checkpoint_yes"}, "nextStepId": "spark_verified"},
                    {"id": "spark_bad", "label": "No spark / weak spark", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_spark_module"},
                ],
            ),
            outcome("replace_spark_module", 3, "Replace spark module", "No spark at module — replace spark module or check wiring."),
            outcome("spark_verified", 4, "Surface spark verified", "All surface burners spark normally."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "w11746350-bridge-element",
        "Bridge / Single / Warming Cooktop Elements",
        "Cooktop",
        "Bridge / Single / Warming Zone Elements",
        [46, 47],
        ["bake_element"],
        ["heating_element_check", "surface_burner"],
        [
            meas(
                "bridge_outer_ohms",
                2,
                "Bridge element — outer section",
                "Disconnect leads. Outer elements expect 68.5 Ω ±5% cold.",
                "whirlpoolFreestandingRangeBridgeOuterOhms",
                "Bridge outer",
                "terminals",
                ohm_branches("bridge_out", "bridge_inner_ohms", "replace_bridge"),
            ),
            meas(
                "bridge_inner_ohms",
                3,
                "Bridge element — inner section",
                "Inner element expect 30.5 Ω ±5% cold.",
                "whirlpoolFreestandingRangeBridgeInnerOhms",
                "Bridge inner",
                "terminals",
                ohm_branches("bridge_in", "single_element_ohms", "replace_bridge"),
            ),
            meas(
                "single_element_ohms",
                4,
                "Single element resistance",
                "Single radiant element expect 45.7 Ω ±5% cold.",
                "whirlpoolFreestandingRangeSingleElementOhms",
                "Single element",
                "terminals",
                ohm_branches("single", "warming_ohms", "replace_single"),
            ),
            meas(
                "warming_ohms",
                5,
                "Warming zone element resistance",
                "Warming zone expect 145 Ω ±5% cold.",
                "whirlpoolFreestandingRangeWarmingZoneOhms",
                "Warming zone",
                "terminals",
                ohm_branches("warm", "cooktop_verified", "replace_warming"),
            ),
            outcome("replace_bridge", 6, "Replace bridge element", "Bridge section open or out of range."),
            outcome("replace_single", 7, "Replace single element", "Single element failed."),
            outcome("replace_warming", 8, "Replace warming zone element", "Warming zone element failed."),
            outcome("cooktop_verified", 9, "Cooktop elements verified", "Bridge/single/warming elements in spec."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "w11746350-thermal-fuse",
        "Thermal Fuse / Thermo Fuse",
        "Fuse",
        "Thermal Fuse",
        [51, 52],
        ["supply"],
        ["no_heat", "supply_issue"],
        [
            visual(
                "thermo_fuse_continuity",
                2,
                "Thermo fuse continuity",
                "Power off. Thermo fuse should be closed circuit (continuity). Opens if oven back exceeds 363°F (184°C).",
                [
                    {"id": "fuse_closed", "label": "Closed (continuity)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "fuse_verified"},
                    {"id": "fuse_open", "label": "Open circuit", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_thermo_fuse"},
                ],
            ),
            outcome("replace_thermo_fuse", 3, "Replace thermo fuse", "Thermal fuse open — replace fuse and find over-temp cause."),
            outcome("fuse_verified", 4, "Thermo fuse verified", "Thermal fuse continuity OK."),
        ],
    ),
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def service_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11746350-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11746350",
        "title": "W11746350 — Service Diagnostic mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console"],
        "description": "Settings-based Service Diagnostics entry (Option A or B).",
        "tags": ["service_diagnostic", "component_activation"],
        "entryStepId": "service_diagnostic_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [28, 29],
        },
        "steps": [
            {
                "id": "service_diagnostic_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Service Diagnostic mode",
                "body": (
                    "Option A: Settings → Info → Service & Support → code 111 111 111 (digit 1 nine times) → CONFIRM → "
                    "Service Diagnostics home.\n"
                    "Option B: Settings → Diagnostics home → Service Diagnostics Code → repeat any 3-digit sequence 3× "
                    "(e.g. 123123123) → OK.\n"
                    "Use Component Activation for load tests (Bake, Door Latch Motor, etc.)."
                ),
                "sourceExcerpt": "Enter Diagnostics mode by pressing Settings > Info > Service & Support.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


BUNDLES = [service_diagnostic_entry_bundle()]
BUNDLE_FILES = ["w11746350-service-diagnostic-entry.json"]


def write_catalog() -> None:
    catalog = {
        "manualId": "W11746350",
        "platformId": PLATFORM,
        "templateId": "electric_range",
        "label": "Whirlpool/Maytag freestanding range (W11746350 + W11174426)",
        "notes": (
            "Shared platformId whirlpool_freestanding_range for electric_range and gas_range. "
            "W11746350 Copernicus ACU (Settings diagnostics). W11174426 LCX/LCC (CANCEL×2+START). "
            "Fuel-specific procedures use templateIds."
        ),
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "templateIds": item.get("templateIds"),
                "knowledgeIds": [
                    step["measurementKnowledgeId"]
                    for step in item["steps"]
                    if step.get("measurementKnowledgeId")
                ],
                "relatedCodes": [tag for tag in item.get("tags", []) if tag.startswith("F")],
            }
            for item in PROCEDURES
        ],
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name}")


def write_readme() -> None:
    readme = """# whirlpool_freestanding_range — W11746350 / W11174426 procedure seeds

**Manuals:** W11746350F (Copernicus ACU) + W11174426 Rev B (LCX/LCC)  
**Platform:** `whirlpool_freestanding_range` — dual registry `electric_range` + `gas_range`  
**Extraction:** `WHIRLPOOL_W11746350_FREESTANDING_RANGE_EXTRACTION.md`, `WHIRLPOOL_W11174426_FREESTANDING_RANGE_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/generate_w11746350_procedure_seeds.py
python backend/scripts/generate_w11174426_procedure_seeds.py
```

## W11746350 procedures (12)

| ID | Fuel | OEM focus |
|----|------|-----------|
| w11746350-acu-power | both | ACU supply F1E1/F1EA/F6E1 |
| w11746350-hmi | both | Touch HMI F2Ex |
| w11746350-oven-sensor | both | RTD 1000–1200 Ω P22 |
| w11746350-door-latch | both | Latch 500–3000 Ω P8 |
| w11746350-vent-fan | both | Fan F7E5/F7E6 |
| w11746350-bake-element | electric | Hidden bake 23.3 Ω ±5% |
| w11746350-broil-element | electric | Broil 10–40 Ω |
| w11746350-convect-element | gas | Convect 14.5–16.1 Ω |
| w11746350-dsi-gas-valve | gas | DSI/regulator 216 Ω |
| w11746350-surface-spark | gas | Cooktop spark module |
| w11746350-bridge-element | electric | Bridge/single/warming Ω |
| w11746350-thermal-fuse | both | Thermo fuse continuity |

**Bundle:** `w11746350-service-diagnostic-entry`
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")
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
        "attach_w11746350_diagnostic_effects.py",
        "attach_w11746350_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
