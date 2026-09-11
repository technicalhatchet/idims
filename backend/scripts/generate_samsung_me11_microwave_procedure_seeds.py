#!/usr/bin/env python3
"""Generate Samsung ME11/ME21 OTR microwave procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_microwave_otr"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-ME11-MICROWAVE",
    "manualTitle": "Samsung ME11A7510DSAA Over-the-Range Microwave Service Manual",
    "extractedTextFile": "backend/docs/manuals/Samsung ME11A7510DSAA microwave-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power and discharge HV",
    "body": (
        "Unplug the microwave or disconnect power before servicing. "
        "Discharge the high-voltage capacitor and vent run capacitor before touching HV or blower circuits. "
        "Never operate the unit with interlock switches bypassed."
    ),
    "sourceExcerpt": "Before touching any oven components or wiring, always unplug the oven and discharge the high voltage capacitor.",
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
        "platformId": "samsung_microwave_otr",
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


def yes_no(pass_id, fail_id, yes_label="Yes / OK", no_label="No / failed"):
    return [
        {"id": f"{pass_id}_yes", "label": yes_label, "when": {"kind": "checkpoint_yes"}, "nextStepId": pass_id},
        {"id": f"{pass_id}_no", "label": no_label, "when": {"kind": "checkpoint_no"}, "nextStepId": fail_id},
    ]


def pass_fail_branches(pass_id, fail_id):
    return [
        {"id": f"{pass_id}_pass", "label": "Within spec", "when": {"kind": "measurement_normal"}, "nextStepId": pass_id},
        {"id": f"{pass_id}_warn", "label": "Borderline", "when": {"kind": "measurement_warning"}, "nextStepId": fail_id},
        {"id": f"{pass_id}_crit", "label": "Out of spec", "when": {"kind": "measurement_critical"}, "nextStepId": fail_id},
        {"id": f"{pass_id}_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_id},
    ]


DOOR_INTERLOCK = proc(
    "samsungotrmw-door-interlock",
    "§4-6: Door Interlock Switches",
    "4-6",
    "Interlock continuity and latch adjustment",
    [24, 25],
    ["door_interlock"],
    ["door_switch_check", "safety_switch", "no_heat", "no_power", "C-F0"],
    [
        visual(
            "primary_open",
            2,
            "Primary switch open with door open?",
            "Disconnect primary switch leads. With door open, primary interlock must read open circuit (∞).",
            yes_no("primary_closed", "adjust_latch"),
            "Primary Interlock switch ∞ when Door Open, 0 when Door Closed.",
        ),
        instr("adjust_latch", 3, "Adjust latch body", "Adjust latch body per §4-6 — no door play; gap ≤0.5 mm when closed.", "primary_open"),
        meas(
            "primary_closed",
            4,
            "Primary switch closed with door shut",
            "With door closed, primary interlock should read closed circuit (0 Ω).",
            "microwaveDoorInterlockSwitchOhms",
            "Primary interlock",
            "COM-NO",
            pass_fail_branches("monitor_nc_open", "adjust_latch"),
        ),
        visual(
            "monitor_nc_open",
            5,
            "Monitor COM-NC closed with door open?",
            "Monitor interlock COM-NC must read closed circuit (0 Ω) with door open.",
            yes_no("monitor_nc_closed", "replace_monitor"),
        ),
        instr("replace_monitor", 6, "Replace monitor switch", "Replace monitor interlock and related switches per NOTE 1.", "monitor_nc_open"),
        meas(
            "monitor_nc_closed",
            7,
            "Monitor COM-NC open with door shut",
            "With door closed, monitor COM-NC must read open circuit (∞).",
            "microwaveDoorInterlockSwitchOhms",
            "Monitor interlock",
            "COM-NC",
            pass_fail_branches("secondary_open", "replace_monitor"),
        ),
        visual(
            "secondary_open",
            8,
            "Door sensing switch open with door open?",
            "Secondary (door sensing) switch must read open with door open.",
            yes_no("secondary_closed", "adjust_latch"),
        ),
        meas(
            "secondary_closed",
            9,
            "Door sensing switch closed with door shut",
            "With door closed, door sensing (secondary) switch should read closed circuit.",
            "microwaveDoorInterlockSwitchOhms",
            "Door sensing switch",
            "COM-NO",
            pass_fail_branches("interlock_verified", "adjust_latch"),
        ),
        outcome("interlock_verified", 10, "Interlock switches verified", "All interlock switches operate per OEM §4-6 table."),
    ],
)

LINE_POWER = proc(
    "samsungotrmw-line-power",
    "§5-1: Dead Unit (No Display)",
    "5-1-dead",
    "Oven is dead — no display",
    [31, 32],
    ["line_fuse"],
    ["no_power", "fuse_check", "supply_issue"],
    [
        visual(
            "fuse_ok",
            2,
            "Line fuse continuity OK?",
            "If fuse is blown, replace primary, door sensing, power relay, and monitor switch together per §1-1 NOTE 12.",
            yes_no("harness_check", "replace_interlock_set"),
            "Fuse is OK → check harness; fuse blown by monitor → replace switch set.",
        ),
        instr(
            "replace_interlock_set",
            3,
            "Replace fuse and interlock set",
            "Replace line fuse and all interlock/monitor/relay parts per adjustment §4-6.",
            "fuse_ok",
        ),
        visual(
            "harness_check",
            4,
            "Harness and connectors seated?",
            "Check for open or loose lead wire harness and PCB connectors.",
            yes_no("magnetron_tco", "repair_harness"),
        ),
        instr("repair_harness", 5, "Repair harness", "Repair or replace open harness; reseat PCB connectors.", "harness_check"),
        meas(
            "magnetron_tco",
            6,
            "Magnetron thermal cutout continuity",
            "Continuity across magnetron thermal cutout — normally closed.",
            "microwaveThermalCutoutOhms",
            "Magnetron TCO",
            "both terminals",
            pass_fail_branches("pcb_suspect", "replace_mag_tco"),
            "Open thermal cutout (Magnetron) — check fan motor when defective.",
        ),
        instr("replace_mag_tco", 7, "Replace magnetron TCO", "Replace open magnetron thermal cutout; verify cooling fan.", "magnetron_tco"),
        outcome(
            "pcb_suspect",
            8,
            "Suspect main PCB or LVT",
            "Fuse, harness, and magnetron TCO OK — check low-voltage transformer and main PCB (Ass'y PCB).",
        ),
    ],
)

NO_HEAT = proc(
    "samsungotrmw-no-heat",
    "§5-1: No Heat (Timer Runs, No Oscillation)",
    "5-1-no-heat",
    "No microwave oscillation",
    [32, 33],
    ["magnetron"],
    ["no_heat", "magnetron_check", "door_switch_check"],
    [
        visual(
            "latch_alignment",
            2,
            "Door and latch switches aligned?",
            "Off-alignment of latch switches prevents oscillation — adjust per §4-6.",
            yes_no("magnetron_tco_heat", "door_interlock_path"),
        ),
        instr("door_interlock_path", 3, "Run door interlock procedure", "Complete §4-6 door interlock continuity and latch adjustment.", "latch_alignment"),
        meas(
            "magnetron_tco_heat",
            4,
            "Magnetron thermal cutout closed?",
            "Magnetron TCO should read continuity — opens at 302°F (150°C).",
            "microwaveThermalCutoutOhms",
            "Magnetron TCO",
            "both terminals",
            pass_fail_branches("relay_check", "replace_mag_tco_heat"),
        ),
        instr("replace_mag_tco_heat", 5, "Replace magnetron TCO", "Replace open magnetron thermal cutout.", "magnetron_tco_heat"),
        visual(
            "relay_check",
            6,
            "Power relay contacts OK?",
            "Check continuity of power relay contacts after START — open or loose relay wiring causes no heat.",
            yes_no("hv_path", "replace_relay_pcb"),
        ),
        instr("replace_relay_pcb", 7, "Replace relay or PCB", "Replace power relay (RY200/RY201) or main PCB if relay defective.", "relay_check"),
        outcome(
            "hv_path",
            8,
            "Continue HV component tests",
            "Interlock and relay OK — run HV transformer, capacitor, diode, and magnetron procedures (§4-1–§4-4).",
        ),
    ],
)

HV_TRANSFORMER = proc(
    "samsungotrmw-hv-transformer",
    "§4-1: High-Voltage Transformer",
    "4-1",
    "HV transformer resistance",
    [23, 24],
    ["magnetron"],
    ["no_heat", "magnetron_check", "high_voltage_safety"],
    [
        visual(
            "xformer_leads",
            2,
            "Transformer leads disconnected?",
            "Remove connectors from transformer terminals before measuring.",
            yes_no("primary_ohms", "disconnect_xformer"),
        ),
        instr("disconnect_xformer", 3, "Disconnect transformer leads", "Remove HV transformer leads and retest.", "xformer_leads"),
        meas(
            "primary_ohms",
            4,
            "Transformer primary winding",
            "Primary winding approx. 0.41–0.48 Ω at 20°C (model-dependent high/low tap).",
            "samsungMe11HvTransformerPrimaryOhms",
            "HV transformer",
            "primary",
            pass_fail_branches("secondary_ohms", "replace_xformer"),
            "Primary Approx. 0.410 Ω + 2% (High) / 0.475 Ω + 2% (Low).",
        ),
        meas(
            "secondary_ohms",
            5,
            "Transformer secondary winding",
            "Secondary approx. 123.5 Ω ±2% or 131.0 Ω ±2%.",
            "samsungMe11HvTransformerSecondaryOhms",
            "HV transformer",
            "secondary",
            pass_fail_branches("filament_check", "replace_xformer"),
            "Secondary Approx. 123.5 Ω + 2% or 131.0 Ω ± 2%.",
        ),
        visual(
            "filament_check",
            6,
            "Filament winding shows continuity?",
            "Filament winding should show continuity.",
            yes_no("xformer_verified", "replace_xformer"),
            "Filament Shows Continuity.",
        ),
        outcome("replace_xformer", 7, "Replace HV transformer", "Replace high-voltage transformer; check diode and magnetron when HV transformer replaced."),
        outcome("xformer_verified", 8, "HV transformer verified", "Transformer windings within OEM spec."),
    ],
)

HV_CAPACITOR = proc(
    "samsungotrmw-hv-capacitor",
    "§4-3: High-Voltage Capacitor",
    "4-3",
    "HV capacitor leakage test",
    [23, 24],
    ["hv_capacitor"],
    ["no_heat", "hv_capacitor_check", "high_voltage_safety"],
    [
        visual(
            "cap_discharged",
            2,
            "Capacitor fully discharged?",
            "Discharge HV capacitor before testing.",
            yes_no("cap_leakage", "discharge_cap"),
        ),
        instr("discharge_cap", 3, "Discharge capacitor", "Safely discharge HV capacitor and retest.", "cap_discharged"),
        visual(
            "cap_leakage",
            4,
            "Capacitor terminal leakage OK?",
            "Highest resistance scale: momentary continuity then ~9 MΩ terminal-to-terminal. Terminal-to-chassis infinite.",
            yes_no("cap_verified", "replace_cap"),
            "Normal capacitor shows continuity briefly then 9 MΩ; shorted shows continuous continuity.",
        ),
        outcome("replace_cap", 5, "Replace HV capacitor", "Replace shorted or failed high-voltage capacitor."),
        outcome("cap_verified", 6, "HV capacitor verified", "Capacitor leakage test within OEM limits."),
    ],
)

HV_DIODE = proc(
    "samsungotrmw-hv-diode",
    "§4-4: High-Voltage Diode",
    "4-4",
    "HV diode check",
    [24, 25],
    ["magnetron"],
    ["no_heat", "hv_diode_check", "high_voltage_safety"],
    [
        visual(
            "diode_isolated",
            2,
            "HV diode isolated from circuit?",
            "Disconnect diode leads before testing.",
            yes_no("diode_check", "isolate_diode"),
        ),
        instr("isolate_diode", 3, "Isolate diode", "Disconnect HV diode leads.", "diode_isolated"),
        meas(
            "diode_check",
            4,
            "HV diode forward / reverse",
            "Use 9V+ meter: infinite one direction, several hundred kΩ the other.",
            "microwaveHVDiodeCheck",
            "HV diode",
            "anode-cathode",
            pass_fail_branches("diode_verified", "replace_diode"),
        ),
        outcome("replace_diode", 5, "Replace HV diode", "Replace high-voltage diode."),
        outcome("diode_verified", 6, "HV diode verified", "Diode blocks in reverse direction."),
    ],
)

MAGNETRON = proc(
    "samsungotrmw-magnetron",
    "§4-2: Magnetron",
    "4-2",
    "Magnetron filament resistance",
    [23, 24],
    ["magnetron"],
    ["no_heat", "magnetron_check", "high_voltage_safety"],
    [
        visual(
            "mag_isolated",
            2,
            "Magnetron leads disconnected?",
            "Isolate magnetron from circuit before measuring.",
            yes_no("filament_ohms", "disconnect_mag"),
        ),
        instr("disconnect_mag", 3, "Disconnect magnetron leads", "Disconnect magnetron filament leads.", "mag_isolated"),
        meas(
            "filament_ohms",
            4,
            "Magnetron filament resistance",
            "Filament terminals ≤1 Ω; filament to case must read open.",
            "microwaveMagnetronFilamentOhms",
            "Magnetron",
            "filament",
            pass_fail_branches("mag_verified", "replace_magnetron"),
            "Continuity across magnetron filament terminals should indicate one ohm or less.",
        ),
        outcome(
            "replace_magnetron",
            5,
            "Replace magnetron",
            "Replace magnetron; verify waveguide gasket; perform leakage test after repair.",
        ),
        outcome("mag_verified", 6, "Magnetron verified", "Magnetron filament within OEM spec."),
    ],
)

VENT_MOTOR = proc(
    "samsungotrmw-vent-motor",
    "§4-7: Vent Exhaust Blower Motor",
    "4-7",
    "Vent blower and run capacitor",
    [25, 26],
    ["supply"],
    ["motor_check", "vent_issue"],
    [
        instr(
            "remove_from_wall",
            2,
            "Remove unit from installation",
            "Vent blower requires microwave removed from wall for full service.",
            "cap_discharge",
        ),
        visual(
            "cap_discharge",
            3,
            "Run capacitor discharged?",
            "Discharge run capacitor behind magnetron before testing.",
            yes_no("blower_ohms", "discharge_run_cap"),
        ),
        instr("discharge_run_cap", 4, "Discharge run capacitor", "Discharge run capacitor safely.", "cap_discharge"),
        meas(
            "blower_ohms",
            5,
            "Blower winding resistance (via cap leads)",
            "Disconnect one cap lead. Continuity across cap wires ~94 Ω.",
            "samsungMe11VentBlowerOhms",
            "Vent blower",
            "run-capacitor leads",
            pass_fail_branches("vent_verified", "replace_vent_motor"),
            "Continuity test across the 2 wires should be approximately 94 ohms.",
        ),
        outcome("replace_vent_motor", 6, "Replace vent blower", "Replace vent exhaust blower motor and verify run capacitor."),
        outcome("vent_verified", 7, "Vent blower verified", "Blower windings within OEM spec."),
    ],
)

HUMIDITY_SENSOR = proc(
    "samsungotrmw-humidity-sensor",
    "§4-14 / C-10: Humidity (Gas) Sensor",
    "4-14",
    "Sensor quick test and heater check",
    [30, 35],
    ["supply"],
    ["C-10", "sensor_check", "humidity_sensor"],
    [
        visual(
            "quick_test_result",
            2,
            "Quick test display 15–185?",
            "Standby: hold Auto Defrost + Popcorn — normal range 15–185. ≥213 = open/unplugged; <6 = shorted.",
            yes_no("sensor_connected", "sensor_heater_ohms"),
            "15-185 Normal; 213 or Higher failed; Less then 6 shorted.",
        ),
        visual(
            "sensor_connected",
            3,
            "Sensor connector seated at CN250?",
            "Inspect gas sensor connector and housing in vent area (top left cavity).",
            yes_no("replace_sensor", "reseat_sensor"),
        ),
        instr("reseat_sensor", 4, "Reseat sensor connector", "Connect sensor wire properly and retest quick test.", "quick_test_result"),
        meas(
            "sensor_heater_ohms",
            5,
            "Sensor heater terminals (H) ~30 Ω",
            "Only Black and Red heater leads — do NOT ohm White/Orange sensor terminals.",
            "samsungMe11HumiditySensorHeaterOhms",
            "CN250",
            "H Black-Red",
            pass_fail_branches("replace_pcb_sensor", "replace_sensor_heater"),
            "Only heater terminals (H; Black and Red leads) can be checked with ohmmeter (30Ω).",
        ),
        outcome("replace_sensor", 6, "Replace humidity sensor", "Replace cooking sensor assembly."),
        outcome("replace_sensor_heater", 7, "Replace sensor — heater failed", "Replace sensor — heater out of spec."),
        outcome("replace_pcb_sensor", 8, "Replace PCB", "Sensor circuit OK — replace main PCB if fault persists (C-10)."),
    ],
)

TEMP_SENSOR = proc(
    "samsungotrmw-temp-sensor",
    "C-20: Temperature Sensor Error",
    "C-20",
    "Temp sensor harness and substrate",
    [34, 35],
    ["thermal_cutout"],
    ["C-20", "thermistor_check", "no_heat"],
    [
        visual(
            "c20_display",
            2,
            "Display shows C-20?",
            "Temp sensor error — check sensor unit and connection between sensor terminal and substrate.",
            yes_no("inspect_sensor", "retest_after_cool"),
            "C-20 Temp Sensor Error — short circuit is black wire.",
        ),
        visual(
            "inspect_sensor",
            3,
            "Sensor harness and connector OK?",
            "Inspect temp sensor unit, connector, and substrate connection. Black wire indicates short.",
            yes_no("replace_temp_sensor", "repair_harness_temp"),
        ),
        instr("repair_harness_temp", 4, "Repair temp sensor harness", "Repair harness or connector and retest.", "inspect_sensor"),
        outcome("replace_temp_sensor", 5, "Replace temp sensor or PCB", "Replace temperature sensor or main PCB."),
        instr(
            "retest_after_cool",
            6,
            "Cool down and retest",
            "For C-21 abnormal temp — allow unit to cool and re-operate.",
            "c20_display",
        ),
    ],
)

KEYPAD_TOUCH = proc(
    "samsungotrmw-keypad-touch",
    "C-F2 / C-d0: Touch and Key Failure",
    "5-3-3",
    "Touch film and keypad",
    [31, 37],
    ["supply"],
    ["C-F2", "C-d0", "hmi_check", "touch_issue"],
    [
        visual(
            "key_sequence",
            2,
            "Key input in correct sequence?",
            "Oven does not accept key input if sequence wrong — refer to operation procedure.",
            yes_no("touch_film_tail", "key_sequence_ok"),
        ),
        outcome("key_sequence_ok", 3, "Key sequence OK", "Keys entered in proper sequence — continue touch checks."),
        visual(
            "touch_film_tail",
            4,
            "Touch film tail connected on assy display?",
            "C-F2: check touch film connection on assy display (CNS850).",
            yes_no("display_harness", "reassembly_touch_film"),
        ),
        instr("reassembly_touch_film", 5, "Reassemble touch film tail", "Reassembly touch film tail per §5-3-3.", "touch_film_tail"),
        visual(
            "display_harness",
            6,
            "Main PCB to assy display harness connected?",
            "Check harness on assy display and main PCB (CN370 sub-main comm).",
            yes_no("replace_door", "repair_harness_touch"),
        ),
        instr("repair_harness_touch", 7, "Repair display harness", "Connect harness properly and retest.", "display_harness"),
        outcome("replace_door", 8, "Replace assy door or PCB", "Replace door assembly (touch film) or main PCB for C-F2/C-d0."),
    ],
)

PCB_COMM = proc(
    "samsungotrmw-pcb-comm",
    "C-F0 / C-F1: PCB Communication",
    "5-3-2",
    "Main and sub PCB communication",
    [36, 41],
    ["supply"],
    ["C-F0", "C-F1", "hmi_check"],
    [
        visual(
            "display_connected",
            2,
            "Main PCB connected to assy display?",
            "C-F0: verify main PCB disconnect state — connect PCB to assy display.",
            yes_no("cn01_short", "connect_display"),
        ),
        instr("connect_display", 3, "Connect display PCB", "Connect main PCB to assy display (CN370 / CN01).", "display_connected"),
        visual(
            "cn01_short",
            4,
            "CN01 connector solder shorts?",
            "Check display CN01 and main PCB CN01 for foreign substance or slight solder short.",
            yes_no("replace_pcb_comm", "clean_connector"),
        ),
        instr("clean_connector", 5, "Clean connector area", "Remove foreign substance from connector soldering.", "cn01_short"),
        outcome("replace_pcb_comm", 6, "Replace PCB", "Replace main or sub PCB (C-F0 / C-F1 PBA defect)."),
    ],
)

THERMAL_CUTOUT = proc(
    "samsungotrmw-thermal-cutout",
    "§4-8: Thermal Cutouts (TCO)",
    "4-8",
    "Cavity, hood, bottom, and magnetron TCO",
    [26, 28],
    ["thermal_cutout"],
    ["no_heat", "thermal_cutout", "C-21"],
    [
        meas(
            "cavity_tco",
            2,
            "Cavity / flame sensor TCO (248°F)",
            "Oven thermal cutout on cavity top — non-resettable; should read closed unless tripped.",
            "microwaveThermalCutoutOhms",
            "Cavity TCO",
            "both terminals",
            pass_fail_branches("magnetron_tco_tco", "replace_cavity_tco"),
        ),
        instr("replace_cavity_tco", 3, "Replace cavity TCO", "Replace open cavity/flame sensor thermal cutout.", "cavity_tco"),
        meas(
            "magnetron_tco_tco",
            4,
            "Magnetron TCO (302°F resettable)",
            "Magnetron TCO normally closed; opens at 302°F, resets at 140°F.",
            "microwaveThermalCutoutOhms",
            "Magnetron TCO",
            "both terminals",
            pass_fail_branches("hood_tco_note", "replace_magnetron_tco"),
        ),
        instr("replace_magnetron_tco", 5, "Replace magnetron TCO", "Replace magnetron thermal cutout.", "magnetron_tco_tco"),
        visual(
            "hood_tco_note",
            6,
            "Hood TCO normally open at room temp?",
            "Hood TCO reads open at room temperature — closes at 158°F to energize vent fan.",
            yes_no("bottom_tco", "hood_tco_ok"),
            "Normally open when checked with ohmmeter at room temp.",
        ),
        visual(
            "bottom_tco",
            7,
            "Bottom TCO closed at room temp?",
            "Bottom TCO (248°F non-resettable) should read closed unless fire condition opened it.",
            yes_no("tco_verified", "replace_bottom_tco"),
        ),
        instr("replace_bottom_tco", 8, "Replace bottom TCO", "Replace open bottom thermal cutout.", "bottom_tco"),
        outcome("hood_tco_ok", 9, "Hood TCO normal", "Hood TCO open at room temp is expected."),
        outcome("tco_verified", 10, "TCOs verified", "Thermal cutout circuits within expected states."),
    ],
)

TURNTABLE = proc(
    "samsungotrmw-turntable",
    "§3-7: Turntable Drive Motor",
    "3-7",
    "Turntable motor",
    [18, 19],
    ["magnetron"],
    ["motor_check"],
    [
        visual(
            "turntable_runs",
            2,
            "Turntable motor operates during cook?",
            "Start cook cycle — does turntable rotate?",
            yes_no("turntable_verified", "wiring_check"),
        ),
        outcome("turntable_verified", 3, "Turntable OK", "Turntable motor operates normally."),
        visual(
            "wiring_check",
            4,
            "Turntable motor wiring connected?",
            "Check open or loose wiring of turntable motor at CN202 T-TABLE relay path.",
            yes_no("replace_turntable", "repair_wiring"),
        ),
        instr("repair_wiring", 5, "Repair turntable wiring", "Reconnect turntable motor leads.", "wiring_check"),
        outcome("replace_turntable", 6, "Replace turntable motor", "Replace drive motor; remount coupler in correct position."),
    ],
)


def sensor_quick_test_bundle() -> dict:
    return {
        "id": "samsungotrmw-sensor-quick-test",
        "version": "1.0.0",
        "platformId": "samsung_microwave_otr",
        "manualId": "SAMSUNG-ME11-MICROWAVE",
        "title": "ME11 — Sensor quick test entry (§4-14)",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Humidity/gas sensor quick test — Auto Defrost + Popcorn hold; 15–185 normal.",
        "tags": ["C-10", "sensor_check", "humidity_sensor", "service_diagnostic"],
        "entryStepId": "sensor_quick_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [30],
        },
        "steps": [
            {
                "id": "sensor_quick_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter sensor quick test",
                "body": (
                    "Unit plugged in at least 5 minutes. From standby (clock displayed), "
                    "touch and hold Auto Defrost and Popcorn pads together. "
                    "Observe diagnostic number: 15–185 = normal (verify with detection test); "
                    "213 or higher = sensor open, unplugged, wiring, or smart board; "
                    "less than 6 = shorted sensor or smart board."
                ),
                "sourceExcerpt": "With 2 fingers touch and hold Auto Defrost and Popcorn pads at the same time by standby mode.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    DOOR_INTERLOCK,
    LINE_POWER,
    NO_HEAT,
    HV_TRANSFORMER,
    HV_CAPACITOR,
    HV_DIODE,
    MAGNETRON,
    VENT_MOTOR,
    HUMIDITY_SENSOR,
    TEMP_SENSOR,
    KEYPAD_TOUCH,
    PCB_COMM,
    THERMAL_CUTOUT,
    TURNTABLE,
]

BUNDLES = [sensor_quick_test_bundle()]


def write_catalog() -> None:
    entries = [
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
            "relatedCodes": [
                tag
                for tag in item.get("tags", [])
                if tag.startswith("F") or tag.startswith("C")
            ],
        }
        for item in PROCEDURES
    ]
    catalog = {
        "manualId": "SAMSUNG-ME11-MICROWAVE",
        "platformId": "samsung_microwave_otr",
        "templateId": "microwave",
        "label": "Samsung ME11/ME21 over-the-range microwave",
        "notes": "§4 alignment; §5 troubleshooting; C-* information codes; sensor quick test §4-14.",
        "plannedProcedures": entries,
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name} ({len(entries)} procedures)")


def write_readme() -> None:
    readme = OUT / "README.md"
    readme.write_text(
        """# samsung_microwave_otr procedure seeds

Manual **SAMSUNG-ME11-MICROWAVE** (ME11A7510DSAA service manual; ME21* same platform).

Regenerate:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual SAMSUNG-ME11-MICROWAVE
```

Extraction: `frontend/components/diagnostics/knowledge/pattern-catalog/SAMSUNG_ME11_MICROWAVE_EXTRACTION.md`
""",
        encoding="utf-8",
    )
    print("Wrote README.md")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)

    for item in PROCEDURES:
        path = OUT / f"{item['id']}.json"
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")

    for item in BUNDLES:
        path = BUNDLE_OUT / f"{item['id']}.json"
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote bundles/{path.name}")

    write_catalog()
    write_readme()

    for script_name in (
        "attach_samsung_me11_microwave_diagnostic_effects.py",
        "attach_samsung_me11_microwave_service_modes.py",
        "crop_samsung_me11_microwave_procedure_figures.py",
        "attach_samsung_me11_microwave_procedure_diagrams.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
