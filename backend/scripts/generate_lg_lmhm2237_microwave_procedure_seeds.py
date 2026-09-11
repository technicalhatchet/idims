#!/usr/bin/env python3
"""Generate LG LMHM2237BD over-the-range microwave procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "lg_microwave_otr"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "LG-LMHM2237-MICROWAVE",
    "manualTitle": "LG LMHM2237BD Over-the-Range Microwave Service Manual",
    "extractedTextFile": "backend/docs/manuals/LMHM2237BD-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power and discharge HV",
    "body": (
        "Unplug the microwave or disconnect power before servicing. "
        "Discharge the high-voltage capacitor before touching any HV component. "
        "Never operate the unit with interlock switches bypassed."
    ),
    "sourceExcerpt": "DISCONNECT THE POWER SUPPLY CORD FROM THE OUTLET WHENEVER REMOVING THE OUTER CASE.",
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
        "platformId": "lg_microwave_otr",
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


PCB_THERMISTOR = proc(
    "lgotrmw-pcb-thermistor",
    "§6-3: PCB Thermistor (F-1 / F-2)",
    "6-3-thermistor",
    "Self diagnosis — PCB thermistor",
    [12, 13],
    ["thermal_cutout"],
    ["F-1", "F-2", "F1", "F2", "no_heat", "thermistor_check"],
    [
        visual(
            "self_test_result",
            2,
            "Service test result for thermistor?",
            (
                "Enter service test (Defrost weight/time 2 sec → TEST). "
                "Unit checks PCB thermistor and humidity sensor. "
                "Did display show F-1 (thermistor short) or F-2 (thermistor open)?"
            ),
            yes_no("inspect_thermistor", "thermistor_pass"),
            "F-1 PCB thermistor short; F-2 PCB thermistor open.",
        ),
        outcome("thermistor_pass", 3, "Thermistor path verified", "Service test PASS — PCB thermistor circuit normal."),
        visual(
            "inspect_thermistor",
            4,
            "Cabinet thermistor harness OK?",
            "Inspect cabinet thermistor and harness at PCB. Repair open/shorted harness if found.",
            yes_no("replace_pcb", "repair_harness"),
        ),
        instr("repair_harness", 5, "Repair thermistor harness", "Repair or replace thermistor harness and retest service mode.", "self_test_result"),
        outcome("replace_pcb", 6, "Replace thermistor or PCB", "Replace cabinet thermistor or main PCB (EBR75341201) per fault."),
    ],
)

HUMIDITY_SENSOR = proc(
    "lgotrmw-humidity-sensor",
    "§6-3: Humidity Sensor (F-4)",
    "6-3-humidity",
    "Self diagnosis — humidity sensor",
    [12, 13],
    ["supply"],
    ["F-4", "F4", "sensor_check", "humidity_sensor"],
    [
        visual(
            "humidity_test",
            2,
            "Service test shows F-4?",
            (
                "Enter service test (Defrost weight/time 2 sec → TEST). "
                "Did display show F-4 (humidity sensor open or short)?"
            ),
            yes_no("inspect_humidity", "humidity_pass"),
            "F-4 Humidity sensor open or short.",
        ),
        outcome("humidity_pass", 3, "Humidity sensor verified", "Service test PASS — humidity sensor circuit normal."),
        visual(
            "inspect_humidity",
            4,
            "Humidity sensor connector seated?",
            "Inspect humidity sensor connector and wiring at PCB. Reseat or repair harness.",
            yes_no("replace_humidity", "repair_connector"),
        ),
        instr("repair_connector", 5, "Repair humidity harness", "Repair connector or harness and retest service mode.", "humidity_test"),
        outcome("replace_humidity", 6, "Replace humidity sensor or PCB", "Replace humidity sensor assembly or main PCB (EBR75341201)."),
    ],
)

DOOR_INTERLOCK = proc(
    "lgotrmw-door-interlock",
    "§9-2: Door Interlock Switches",
    "9-2",
    "Interlock continuity test",
    [29, 30],
    ["door_interlock"],
    ["door_switch_check", "safety_switch", "no_heat", "no_power"],
    [
        visual(
            "primary_open",
            2,
            "Primary switch open with door open?",
            "Disconnect primary switch leads. COM–NO must read open circuit with door open.",
            yes_no("primary_closed", "adjust_primary"),
        ),
        instr("adjust_primary", 3, "Adjust or replace primary switch", "Adjust latch board (§9-1) or replace primary interlock switch.", "primary_open"),
        meas(
            "primary_closed",
            4,
            "Primary switch closed with door shut",
            "With door closed, COM–NO on primary switch should read closed circuit.",
            "microwaveDoorInterlockSwitchOhms",
            "Primary interlock",
            "COM-NO",
            pass_fail_branches("secondary_open", "adjust_primary"),
            "When the door is closed, the meter should indicate a closed circuit.",
        ),
        visual(
            "secondary_open",
            5,
            "Secondary switch open with door open?",
            "COM–NO on secondary switch must read open with door open.",
            yes_no("secondary_closed", "adjust_secondary"),
        ),
        instr("adjust_secondary", 6, "Adjust or replace secondary switch", "Adjust latch board or replace secondary interlock switch.", "secondary_open"),
        meas(
            "secondary_closed",
            7,
            "Secondary switch closed with door shut",
            "With door closed, COM–NO on secondary must read closed circuit.",
            "microwaveDoorInterlockSwitchOhms",
            "Secondary interlock",
            "COM-NO",
            pass_fail_branches("monitor_open", "adjust_secondary"),
        ),
        visual(
            "monitor_open",
            8,
            "Monitor switch closed with door open?",
            "COM–NC on monitor switch must read closed circuit with door open.",
            yes_no("monitor_closed", "replace_monitor"),
        ),
        instr("replace_monitor", 9, "Replace monitor switch", "Replace interlock monitor switch (NC must close when door opens).", "monitor_open"),
        meas(
            "monitor_closed",
            10,
            "Monitor switch open with door shut",
            "With door closed, COM–NC on monitor must read open circuit.",
            "microwaveDoorInterlockSwitchOhms",
            "Monitor interlock",
            "COM-NC",
            pass_fail_branches("interlock_verified", "replace_monitor"),
        ),
        outcome("interlock_verified", 11, "Interlock switches verified", "All three interlock switches operate per OEM sequence."),
    ],
)

LINE_POWER = proc(
    "lgotrmw-line-power",
    "§6-4: No Display / Dead Unit",
    "6-4-dead",
    "No display or dead",
    [14, 15],
    ["line_fuse"],
    ["no_power", "fuse_check", "supply_issue"],
    [
        visual(
            "key_beep",
            2,
            "Key press produces beep or display activity?",
            "Push any key — is there beeping or display response?",
            yes_no("pcb_check", "connector_check"),
        ),
        instr("pcb_check", 3, "Check PCB", "Inspect main PCB — unit responds to keys but may have display fault.", "key_beep"),
        visual(
            "connector_check",
            4,
            "PCB connectors seated?",
            "Verify all PCB connectors are connected. Reseat if loose.",
            yes_no("cord_continuity", "reseat_connectors"),
        ),
        instr("reseat_connectors", 5, "Reseat connectors", "Reconnect PCB connectors and retest.", "connector_check"),
        visual(
            "cord_continuity",
            6,
            "Power cord continuity OK?",
            "Continuity test: Line (L) to pin 1, Neutral (N) to pin 3 at power connector.",
            yes_no("line_fuse_test", "repair_cord"),
        ),
        instr("repair_cord", 7, "Repair power cord", "Repair or replace power cord.", "cord_continuity"),
        meas(
            "line_fuse_test",
            8,
            "Line fuse continuity",
            "Continuity between both ends of the line fuse.",
            "microwaveLineFuseOhms",
            "Line fuse",
            "both ends",
            pass_fail_branches("noise_filter_test", "replace_line_fuse"),
        ),
        instr("replace_line_fuse", 9, "Replace line fuse", "Replace blown line fuse; find root cause before energizing.", "line_fuse_test"),
        meas(
            "noise_filter_test",
            10,
            "Noise filter coil resistance",
            "Measure noise filter L(1)–L(2) and N(1)–N(2) coils — spec less than 1 Ω.",
            "lgMicrowaveOtrNoiseFilterCoilOhms",
            "Noise filter",
            "L1-L2 / N1-N2",
            pass_fail_branches("power_verified", "replace_noise_filter"),
            "Nmornal: L(1)-L(2)(coil):Less than 1 ohm",
        ),
        instr("replace_noise_filter", 11, "Replace noise filter", "Replace noise filter assembly.", "noise_filter_test"),
        outcome("power_verified", 12, "Line power path verified", "Fuse and noise filter OK — suspect main PCB (EBR75341201) if still dead."),
    ],
)

NO_HEAT = proc(
    "lgotrmw-no-heat",
    "§6-4: No Heat / No Cook",
    "6-4-no-heat",
    "No heat troubleshooting",
    [18, 21],
    ["magnetron"],
    ["no_heat", "magnetron_check", "door_switch_check"],
    [
        visual(
            "door_cycle",
            2,
            "Unit operates after door open/close ×3?",
            "Repeat door open and close at least three times. Does product operate after power on?",
            yes_no("thermal_cutout", "door_interlock_path"),
        ),
        instr("door_interlock_path", 3, "Run door interlock procedure", "Complete §9-2 door interlock continuity and latch adjustment.", "door_cycle"),
        meas(
            "thermal_cutout",
            4,
            "Thermal cutout continuity (TAB1–TAB2)",
            "Continuity between TAB1 and TAB2 on thermal cutout.",
            "microwaveThermalCutoutOhms",
            "Thermal cutout",
            "TAB1-TAB2",
            pass_fail_branches("latch_continuity", "replace_cutout"),
            "Is there any beeping sound in the continuity test between TAB1 and TAB2?",
        ),
        instr("replace_cutout", 5, "Replace thermal cutout", "Replace open thermal cutout; verify vent path and fan.", "thermal_cutout"),
        visual(
            "latch_continuity",
            6,
            "Latch board continuity (door closed)?",
            "With door closed and power off, continuity across latch board secondary switch.",
            yes_no("relay_voltage", "adjust_latch"),
        ),
        instr("adjust_latch", 7, "Adjust latch board", "Adjust latch board per §9-1/9-2.", "latch_continuity"),
        visual(
            "relay_voltage",
            8,
            "Relay 2 voltage over 8 V during EZ-ON?",
            "While operating under EZ-ON start, is voltage across D35 over 8 V?",
            yes_no("no_heat_hv_path", "replace_relay2"),
        ),
        instr("replace_relay2", 9, "Replace Relay 2", "Replace Relay 2 on PCB.", "relay_voltage"),
        outcome(
            "no_heat_hv_path",
            10,
            "Continue HV component tests",
            "Door switches and relay OK — run HV transformer, capacitor, diode, magnetron, and HV fuse procedures (§10).",
        ),
    ],
)

HV_TRANSFORMER = proc(
    "lgotrmw-hv-transformer",
    "§10: High-Voltage Transformer",
    "10-transformer",
    "HV transformer resistance",
    [30, 31],
    ["magnetron"],
    ["no_heat", "magnetron_check", "high_voltage_safety"],
    [
        visual(
            "xformer_connector",
            2,
            "HV transformer connector seated?",
            "Verify connector to HV transformer is connected.",
            yes_no("primary_ohms", "reseat_xformer"),
        ),
        instr("reseat_xformer", 3, "Reseat transformer connector", "Reconnect HV transformer leads.", "xformer_connector"),
        meas(
            "primary_ohms",
            4,
            "Transformer primary winding",
            "Remove leads. Primary winding 0.2–0.5 Ω (Rx1).",
            "lgMicrowaveOtrHvTransformerPrimaryOhms",
            "HV transformer",
            "primary",
            pass_fail_branches("secondary_ohms", "replace_xformer"),
            "Primary winding: 0.2 ~ 0.5 Ohm",
        ),
        meas(
            "secondary_ohms",
            5,
            "Transformer secondary winding",
            "Secondary winding 50–120 Ω.",
            "lgMicrowaveOtrHvTransformerSecondaryOhms",
            "HV transformer",
            "secondary",
            pass_fail_branches("filament_ohms", "replace_xformer"),
            "Secondary: 50 ~ 120 Ohm",
        ),
        visual(
            "filament_ohms",
            6,
            "Filament winding ~0 Ω?",
            "Filament winding should read approximately 0 Ω.",
            yes_no("xformer_verified", "replace_xformer"),
            "Filament winding: 0 ohm",
        ),
        outcome("replace_xformer", 7, "Replace HV transformer", "Replace high-voltage transformer."),
        outcome("xformer_verified", 8, "HV transformer verified", "Transformer windings within OEM spec."),
    ],
)

HV_CAPACITOR = proc(
    "lgotrmw-hv-capacitor",
    "§10: High-Voltage Capacitor",
    "10-capacitor",
    "HV capacitor test",
    [31, 32],
    ["hv_capacitor"],
    ["no_heat", "hv_capacitor_check", "high_voltage_safety"],
    [
        visual(
            "cap_connector",
            2,
            "HV capacitor connector seated?",
            "Verify connector to HV capacitor assembly.",
            yes_no("cap_leakage", "reseat_cap"),
        ),
        instr("reseat_cap", 3, "Reseat capacitor connector", "Reconnect HV capacitor leads.", "cap_connector"),
        visual(
            "cap_leakage",
            4,
            "Capacitor terminal-to-terminal leakage OK?",
            "Rx1000: terminal-to-terminal momentarily infinite, then ~10 MΩ. Terminal-to-case must be infinite.",
            yes_no("cap_verified", "replace_cap"),
            "Momentarily Infinite and then soon reach 10 mega. ohms",
        ),
        outcome("replace_cap", 5, "Replace HV capacitor", "Replace high-voltage capacitor."),
        outcome("cap_verified", 6, "HV capacitor verified", "Capacitor leakage test within OEM limits."),
    ],
)

HV_DIODE = proc(
    "lgotrmw-hv-diode",
    "§10: High-Voltage Diode",
    "10-diode",
    "HV diode check",
    [31, 32],
    ["magnetron"],
    ["no_heat", "hv_diode_check", "high_voltage_safety"],
    [
        visual(
            "diode_connector",
            2,
            "HV diode connector seated?",
            "Verify connector to HV diode assembly.",
            yes_no("diode_check", "reseat_diode"),
        ),
        instr("reseat_diode", 3, "Reseat diode connector", "Reconnect HV diode leads.", "diode_connector"),
        meas(
            "diode_check",
            4,
            "HV diode forward / reverse",
            "Forward continuity (Rx1000) then reverse — reverse must be open.",
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
    "lgotrmw-magnetron",
    "§10: Magnetron",
    "10-magnetron",
    "Magnetron resistance",
    [30, 31],
    ["magnetron"],
    ["no_heat", "magnetron_check", "high_voltage_safety"],
    [
        visual(
            "mag_connector",
            2,
            "Magnetron connector seated?",
            "Verify lead wire to magnetron is connected. Gasket in good condition.",
            yes_no("filament_ohms", "reseat_mag"),
        ),
        instr("reseat_mag", 3, "Reseat magnetron lead", "Reconnect magnetron filament lead.", "mag_connector"),
        meas(
            "filament_ohms",
            4,
            "Magnetron filament resistance",
            "Filament terminal less than 1 Ω (Rx1). Filament to chassis must be infinite (Rx1000).",
            "microwaveMagnetronFilamentOhms",
            "Magnetron",
            "filament",
            pass_fail_branches("mag_verified", "replace_magnetron"),
            "Normal: Less than 1 ohm",
        ),
        outcome("replace_magnetron", 5, "Replace magnetron", "Replace magnetron; verify waveguide and gasket; leakage test after repair."),
        outcome("mag_verified", 6, "Magnetron verified", "Magnetron filament within spec."),
    ],
)

HV_FUSE = proc(
    "lgotrmw-hv-fuse",
    "§10: High-Voltage Fuse",
    "10-hv-fuse",
    "HV fuse continuity",
    [32, 33],
    ["line_fuse"],
    ["no_heat", "fuse_check", "high_voltage_safety"],
    [
        meas(
            "hv_fuse_ohms",
            2,
            "HV fuse resistance",
            "Remove leads. HV fuse should read under 10 Ω.",
            "lgMicrowaveOtrHvFuseOhms",
            "HV fuse",
            "both ends",
            pass_fail_branches("hv_fuse_verified", "replace_hv_fuse"),
            "Normal : under 10ohm",
        ),
        instr("replace_hv_fuse", 3, "Replace HV fuse", "Replace blown HV fuse; inspect door switches and HV circuit before energizing.", "hv_fuse_ohms"),
        outcome("hv_fuse_verified", 4, "HV fuse verified", "HV fuse continuity OK."),
    ],
)

KEYPAD = proc(
    "lgotrmw-keypad",
    "§6-4: Keypad Failure",
    "6-4-keypad",
    "Keypad / touch failure",
    [16, 18],
    ["supply"],
    ["hmi_check", "touch_issue"],
    [
        visual(
            "start_ezon_only",
            2,
            "Only START and EZ-ON keys work (door closed)?",
            "With door closed, do only START and EZ-ON keys operate?",
            yes_no("latch_beep", "full_keypad_ok"),
        ),
        outcome("full_keypad_ok", 3, "Keypad operates", "All keys respond — keypad path verified."),
        visual(
            "latch_beep",
            4,
            "Latch board continuity (door closed)?",
            "Continuity across secondary switch on latch board with door closed.",
            yes_no("door_sense_voltage", "adjust_latch_keypad"),
        ),
        instr("adjust_latch_keypad", 5, "Adjust latch board", "Adjust latch board per §9-1/9-2.", "latch_beep"),
        visual(
            "door_sense_voltage",
            6,
            "Door sense voltage over 4 V (door open)?",
            "With door open, CN3 Pin1–Pin2 door sensing voltage over 4 V?",
            yes_no("keypad_connector", "repair_door_sense"),
        ),
        instr("repair_door_sense", 7, "Repair door sense circuit", "Repair door sensing harness or replace PCB.", "door_sense_voltage"),
        visual(
            "keypad_connector",
            8,
            "Keypad FPC connector seated?",
            "Verify KEY CONNECTOR FPC is properly engaged on plastic fastener.",
            yes_no("replace_keypad", "reseat_keypad"),
        ),
        instr("reseat_keypad", 9, "Reseat keypad connector", "Reseat touch key FPC connector.", "keypad_connector"),
        outcome("replace_keypad", 10, "Replace keypad", "Replace touch key board / membrane."),
    ],
)

TURNTABLE = proc(
    "lgotrmw-turntable",
    "§10: Turntable Motor",
    "10-turntable",
    "Turntable motor",
    [22, 23],
    ["magnetron"],
    ["motor_check"],
    [
        visual(
            "turntable_runs",
            2,
            "Turntable motor operates?",
            "Start cook cycle — does turntable rotate?",
            yes_no("turntable_verified", "lamp_check"),
        ),
        outcome("turntable_verified", 3, "Turntable OK", "Turntable motor operates normally."),
        visual(
            "lamp_check",
            4,
            "Oven lamp on with door closed?",
            "With door closed, does oven lamp turn on?",
            yes_no("motor_ohms", "adjust_primary_latch"),
        ),
        instr("adjust_primary_latch", 5, "Adjust primary latch", "Adjust primary latch board per §9-1.", "lamp_check"),
        meas(
            "motor_ohms",
            6,
            "Turntable motor resistance",
            "Disconnect leads. Motor approximately 2.5–3.5 kΩ.",
            "lgMicrowaveOtrTurntableMotorOhms",
            "Turntable motor",
            "terminals",
            pass_fail_branches("turntable_motor_ok", "replace_turntable"),
        ),
        outcome("replace_turntable", 7, "Replace turntable motor", "Replace turntable motor."),
        outcome("turntable_motor_ok", 8, "Motor OK — check PCB relay", "Motor ohms OK — check RY1 relay and PCB if still no rotation."),
    ],
)


def self_test_bundle() -> dict:
    return {
        "id": "lgotrmw-self-test-entry",
        "version": "1.0.0",
        "platformId": "lg_microwave_otr",
        "manualId": "LG-LMHM2237-MICROWAVE",
        "title": "LMHM2237 — Self-test mode entry (§6-3)",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Humidity sensor and PCB thermistor self-diagnosis — F-1/F-2/F-4 or PASS.",
        "tags": ["F-1", "F-2", "F-4", "F1", "F2", "F4", "service_diagnostic"],
        "entryStepId": "self_test_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [12, 13],
        },
        "steps": [
            {
                "id": "self_test_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter self-test mode",
                "body": (
                    "Press Defrost weight/time for 2 seconds. Unit displays TEST and beeps once. "
                    "The unit checks PCB humidity sensor and PCB thermistor for short or open. "
                    "If faulted, unit beeps and displays F-1, F-2, or F-4. "
                    "If normal, unit beeps and displays PASS. "
                    "Press Clear to return to standby."
                ),
                "sourceExcerpt": "Press Defrost weight/time for 2 seconds , unit will display TEST",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    PCB_THERMISTOR,
    HUMIDITY_SENSOR,
    DOOR_INTERLOCK,
    LINE_POWER,
    NO_HEAT,
    HV_TRANSFORMER,
    HV_CAPACITOR,
    HV_DIODE,
    MAGNETRON,
    HV_FUSE,
    KEYPAD,
    TURNTABLE,
]

BUNDLES = [self_test_bundle()]


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
        "manualId": "LG-LMHM2237-MICROWAVE",
        "platformId": "lg_microwave_otr",
        "templateId": "microwave",
        "label": "LG LMHM2237BD over-the-range microwave",
        "notes": "First microwave platform in procedure layer. Self-test §6-3; interlock §9-2; HV components §10.",
        "plannedProcedures": entries,
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name} ({len(entries)} procedures)")


def write_readme() -> None:
    readme = OUT / "README.md"
    readme.write_text(
        """# lg_microwave_otr procedure seeds

Manual **LG-LMHM2237-MICROWAVE** (LMHM2237BD service manual).

Regenerate:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual LG-LMHM2237-MICROWAVE
```

Extraction: `frontend/components/diagnostics/knowledge/pattern-catalog/MICROWAVE_OTR_BATCH_EXTRACTION.md` (LG section)
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
        "attach_lg_lmhm2237_microwave_diagnostic_effects.py",
        "attach_lg_lmhm2237_microwave_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
