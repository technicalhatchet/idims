#!/usr/bin/env python3
"""Generate W11480208 (Whirlpool filtration dishwasher WDT740) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_dishwasher_acu"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W11480208",
    "manualTitle": 'Whirlpool/JennAir/KitchenAid/Maytag 24" Filtration Dishwasher',
    "extractedTextFile": (
        "backend/docs/manuals/technical-manual-w11480208-revd WDT740SALB0-extracted.txt"
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


DOOR_SWITCH = proc(
    "w11480208-door-switch",
    "§3-8: Door Switch Circuit (P12)",
    "3-8",
    "Door Switch Circuit",
    [50, 51],
    ["door_gasket"],
    ["F5E1", "F5E2", "door_lock_check"],
    [
        instr(
            "door_mechanical",
            2,
            "Mechanical door checks",
            "Verify installation/leveling, latch obstructions, door seal seated, and racks not interfering with door closure.",
            "disconnect_p12",
        ),
        instr(
            "disconnect_p12",
            3,
            "Disconnect P12",
            "Power off. Remove outer door and toe panels. Verify P12 and door latch connectors seated. Disconnect P12 from control.",
            "door_closed_ohms",
        ),
        meas(
            "door_closed_ohms",
            4,
            "Door closed — P12 pins 9 & 11",
            "Ohms across P12-9 and P12-11 with door closed and strike fully latched. Expect 3 Ω or less.",
            "dishwasherDoorLatchSwitchOhms",
            "P12",
            "9 & 11 (door closed)",
            pass_fail_branches("door_open_ohms", "repair_door_harness"),
        ),
        meas(
            "door_open_ohms",
            5,
            "Door open — P12 pins 9 & 11",
            "With door open and strike removed from latch, expect infinite resistance (open circuit).",
            "dishwasherDoorLatchSwitchOhms",
            "P12",
            "9 & 11 (door open)",
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
            "13 VDC at P11-7 with door open?",
            "Reconnect P12. Power on, door open: red lead P11-7, black P10-2 (DC GND). Expect 13 VDC.",
            yes_no("live_door_diag", "replace_acu_door", yes_label="13 VDC present", no_label="Missing"),
        ),
        visual(
            "live_door_diag",
            7,
            "Door switch OK in Service Diagnostics?",
            "Run Service Diagnostics cycle (Key #2 after entry). Verify door-open pause and close-resume behavior.",
            yes_no("door_verified", "replace_acu_door", yes_label="Operates correctly", no_label="Still faulty"),
        ),
        outcome("repair_door_harness", 8, "Repair door harness", "Repair loose connections or harness between door switch and P12."),
        outcome("replace_door_switch", 9, "Replace door switch/latch", "Replace door switch/latch assembly and retest."),
        outcome("replace_acu_door", 10, "Replace ACU", "Door switch and wiring good but control does not sense door — replace ACU."),
        outcome("door_verified", 11, "Door switch verified", "Door switch circuit verified — reassemble."),
    ],
)

HEATER = proc(
    "w11480208-heater",
    "§3-11: Water Heating / Heat Dry",
    "3-11",
    "Water Heating/Heat Dry",
    [53, 54],
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
            "Ohms between P4-2 and P4-3. W11480208 spec 10–40 Ω including element and hi-limit in circuit.",
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
        outcome("replace_acu_heater", 7, "Replace ACU", "Heater circuit good but no AC output — replace control. If heat error persists, run OWI test (W11633848 procedure)."),
        outcome("heater_verified", 8, "Heater verified", "Heater element and drive verified."),
    ],
)

OVERFILL_SWITCH = proc(
    "w11480208-overfill-switch",
    "§3-13: Overfill Float Switch (P11)",
    "3-13",
    "Overfill Switch Circuit",
    [55, 56],
    ["inlet_valve"],
    ["F6E4", "F8E4", "fill_issue"],
    [
        instr(
            "overfill_prereq",
            2,
            "Overfill prerequisites",
            "Inspect leak pan for water. Verify float moves freely. Empty pan if water present and find leak source before continuing.",
            "disconnect_p11",
        ),
        instr(
            "disconnect_p11",
            3,
            "Disconnect P11",
            "Power off. Remove toe and outer door panels. Unplug P11 from control.",
            "float_down_ohms",
        ),
        meas(
            "float_down_ohms",
            4,
            "Float down — P11 pins 6 & 7",
            "Float in normal (down) position with assembly installed: ohms P11-6 to P11-7. Expect 3 Ω or less.",
            "dishwasherFloatSwitchOhms",
            "P11",
            "6 & 7 (float down)",
            pass_fail_branches("float_up_ohms", "repair_float_switch"),
        ),
        meas(
            "float_up_ohms",
            5,
            "Float up — P11 pins 6 & 7",
            "Raise Styrofoam floater (up position): expect open circuit between P11-6 and P11-7.",
            "dishwasherFloatSwitchOhms",
            "P11",
            "6 & 7 (float up)",
            [
                {
                    "id": "float_up_pass",
                    "label": "Open (OL)",
                    "when": {"kind": "measurement_open"},
                    "nextStepId": "live_overfill_13v",
                },
                {
                    "id": "float_up_fail",
                    "label": "Continuity with float up",
                    "when": {"kind": "measurement_normal"},
                    "nextStepId": "replace_float_switch",
                },
            ],
        ),
        visual(
            "live_overfill_13v",
            6,
            "13 VDC at P11-6 & P11-7 (P11 unplugged)?",
            "Power on with P11 disconnected from board. DC volts P11-6 to P11-7 — expect 13 VDC.",
            yes_no("overfill_verified", "replace_acu_overfill", yes_label="13 VDC present", no_label="Missing"),
        ),
        outcome("repair_float_switch", 7, "Repair float harness", "Repair harness or connections to overfill switch."),
        outcome("replace_float_switch", 8, "Replace float assembly", "Replace overfill/float switch assembly."),
        outcome("replace_acu_overfill", 9, "Replace ACU", "Float switch good but no 13 V supply — replace control."),
        outcome("overfill_verified", 10, "Overfill circuit verified", "Overfill float switch verified — reconnect P11 and retest."),
    ],
)

DIVERTER_MOTOR = proc(
    "w11480208-diverter-motor",
    "§3-14: Diverter Motor (P6)",
    "3-14",
    "Diverter Motor",
    [56, 57],
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
            "Disconnect P6",
            "Power off. Unplug P6 from control. Measure diverter motor at P6-4 and P6-6.",
            "diverter_motor_ohms",
        ),
        meas(
            "diverter_motor_ohms",
            4,
            "Diverter motor — P6 pins 4 & 6",
            "Ohms between P6-4 and P6-6. W11480208 spec 1100–1400 Ω.",
            "whirlpoolDishwasherFiltrationDiverterMotorOhms",
            "P6",
            "4 & 6",
            pass_fail_branches("reconnect_p6_diverter", "replace_diverter"),
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
        outcome("replace_acu_diverter", 8, "Replace ACU", "Motor good but no AC output — replace control. If error persists, run diverter sensor test (W11633848)."),
        outcome("diverter_motor_verified", 9, "Diverter motor verified", "Diverter motor verified."),
    ],
)

WASH_MOTOR_VSM = proc(
    "w11480208-wash-motor-vsm",
    "§3-17: Wash Motor (Variable Speed)",
    "3-17",
    "Global Wash Motor VSM",
    [59, 60],
    ["circulation_pump"],
    ["F4E3", "F7E1", "wash_issue", "pump_check"],
    [
        instr(
            "wash_prereq",
            2,
            "Wash path prerequisites",
            "Inspect sump, coarse filter, spray arms. Run Service Diagnostics wash-motor interval first.",
            "disconnect_p5_vsm",
        ),
        instr(
            "disconnect_p5_vsm",
            3,
            "Disconnect P5",
            "Power off. Unplug P5 from control.",
            "wash_motor_vsm_ohms",
        ),
        meas(
            "wash_motor_vsm_ohms",
            4,
            "VSM wash motor — P5 pins 1 & 2",
            "Ohms P5-1 to P5-2. Variable-speed spec 16–18 Ω. (SSM models: 7–12 Ω — use w11633848-wash-motor.)",
            "whirlpoolDishwasherFiltrationVsmWashMotorOhms",
            "P5",
            "1 & 2 (VSM)",
            pass_fail_branches("vsm_retest", "replace_wash_motor_vsm"),
        ),
        instr(
            "vsm_retest",
            5,
            "Reassemble and run Service Diagnostics",
            "Reconnect P5. Reassemble panels. Restore power and run Service Diagnostics to verify wash motor operation.",
            "wash_vsm_verified",
        ),
        outcome("replace_wash_motor_vsm", 6, "Replace wash motor", "Replace variable-speed wash motor if winding failed."),
        outcome(
            "wash_vsm_verified",
            7,
            "VSM wash motor verified",
            "VSM wash motor ohms verified. No AC bench run test — motor uses DC drive from control.",
        ),
    ],
)

DRAIN_MOTOR_VSM = proc(
    "w11480208-drain-motor-vsm",
    "§3-19: Drain Motor (Variable Speed platform)",
    "3-19",
    "Drain Motor with VSM",
    [61, 62],
    ["drain_pump"],
    ["F9E1", "F9E2", "F8E4", "drain_issue", "pump_check"],
    [
        instr(
            "drain_mechanical",
            2,
            "Drain path mechanical check",
            "Verify drain hose, disposal plug, check valve, filter. Run Service Diagnostics drain interval first.",
            "disconnect_p5_drain_vsm",
        ),
        instr(
            "disconnect_p5_drain_vsm",
            3,
            "Disconnect P5",
            "Power off. Unplug P5 from control.",
            "drain_motor_vsm_ohms",
        ),
        meas(
            "drain_motor_vsm_ohms",
            4,
            "VSM drain motor — P5 pins 5 & 6",
            "Ohms P5-5 to P5-6. W11480208 VSM spec 41–51 Ω. (SSM drain: P5-3 & P5-4 — use w11633848-drain-motor.)",
            "whirlpoolDishwasherFiltrationVsmDrainMotorOhms",
            "P5",
            "5 & 6 (VSM drain)",
            pass_fail_branches("reconnect_p5_drain_vsm", "replace_drain_motor_vsm"),
        ),
        instr(
            "reconnect_p5_drain_vsm",
            5,
            "Reconnect P5 and restore power",
            "Reconnect P5. Restore power.",
            "live_drain_vsm",
        ),
        visual(
            "live_drain_vsm",
            6,
            "Drain motor runs in Service Diagnostics?",
            "120 VAC at P5-5 and P5-6 during drain interval (motor connected).",
            yes_no("drain_vsm_verified", "replace_acu_drain_vsm", yes_label="Runs", no_label="No run / no voltage"),
        ),
        outcome("replace_drain_motor_vsm", 7, "Replace drain motor", "Replace drain pump if winding failed or impeller damaged."),
        outcome("replace_acu_drain_vsm", 8, "Replace ACU", "Motor good but no AC output — replace control."),
        outcome("drain_vsm_verified", 9, "VSM drain motor verified", "VSM drain motor verified."),
    ],
)

DC_FAN = proc(
    "w11480208-dc-fan",
    "§3-20: DC Fan Motor (ProDry)",
    "3-20",
    "DC Fan Motor",
    [62, 63],
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
        meas(
            "fan_ohms",
            4,
            "Fan motor — P14 pins 1 & 2",
            "Ohms between P14-1 and P14-2. W11480208 spec 145–185 kΩ.",
            "whirlpoolDishwasherFiltrationDcFanOhms",
            "P14",
            "1 & 2",
            pass_fail_branches("reconnect_p14", "replace_fan"),
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
            "13 VDC and fan spins in Service Diagnostics?",
            "During fan interval: 13 VDC ±5% at P14-1 and P14-2; fan spins.",
            yes_no("fan_verified", "replace_acu_fan", yes_label="Runs", no_label="No spin / no voltage"),
        ),
        outcome("replace_fan", 7, "Replace fan assembly", "Replace DC fan motor assembly."),
        outcome("replace_acu_fan", 8, "Replace ACU", "Fan good but no DC drive — replace control."),
        outcome("fan_verified", 9, "DC fan verified", "DC fan verified."),
    ],
)

INTERIOR_LED = proc(
    "w11480208-interior-led",
    "§3-21: Interior LED Lighting",
    "3-21",
    "Interior LED Lighting",
    [63, 64],
    ["heater"],
    ["hmi_check"],
    [
        instr(
            "led_door_open",
            2,
            "Door-open LED check",
            "Open door — interior LED tubes should turn on for up to 10 minutes. Two LEDs wired in parallel; one can fail independently.",
            "disconnect_p9_led",
        ),
        instr(
            "disconnect_p9_led",
            3,
            "Disconnect P9",
            "Power off. Remove toe and outer door panels. Verify P9 seated. Disconnect P9 from control.",
            "led_diode_check",
        ),
        visual(
            "led_diode_check",
            4,
            "Each LED passes diode check?",
            "Diode mode: numeric reading anode→cathode; OL cathode→anode on each LED tube.",
            yes_no("live_led_13v", "replace_led", yes_label="Both LEDs OK", no_label="LED failed"),
        ),
        visual(
            "live_led_13v",
            5,
            "13 VDC at P9-2 & P9-4 (door open, P9 unplugged)?",
            "Power on, door open within 10 min window: 13 VDC between P9-2 and P9-4 with lights disconnected.",
            yes_no("led_verified", "replace_acu_led", yes_label="13 VDC present", no_label="Missing"),
        ),
        outcome("replace_led", 6, "Replace defective LED", "Replace failed LED tube individually and retest."),
        outcome("replace_acu_led", 7, "Replace ACU", "LEDs good but no 13 V output — replace control."),
        outcome("led_verified", 8, "Interior LED verified", "Interior LED lighting verified."),
    ],
)


def diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11480208-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_dishwasher_acu",
        "manualId": "W11480208",
        "title": "W11480208 — Service Diagnostics cycle entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "1-2-3 key entry; press Key #2 to start service test cycle when door closes.",
        "tags": ["service_diagnostic", "fault_codes", "live_test"],
        "entryStepId": "prep_standby",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [25, 26],
        },
        "steps": [
            {
                "id": "prep_standby",
                "order": 1,
                "type": "instruction",
                "title": "Standby mode",
                "body": "Dishwasher plugged in, control in standby (no cycle running).",
                "sourceExcerpt": "To invoke the Service Diagnostics Mode, perform the following while in standby.",
                "requiresInput": False,
                "defaultNextStepId": "keypad_entry",
            },
            {
                "id": "keypad_entry",
                "order": 2,
                "type": "instruction",
                "title": "1-2-3 key entry + Key #2",
                "body": (
                    "Press any 3 keys (except Delay, Start, Cancel) in sequence 1-2-3, 1-2-3, 1-2-3 "
                    "(≤1 s between presses). All LEDs illuminate on success. "
                    "Press Key #2 (Run Service Test Cycle), then close the door to start. "
                    "Key #1 = UI test; Key #3 = error history (hold Key #3 5 s to clear). "
                    "START/RESUME rapid-advances one interval. Door open pauses; close door to resume."
                ),
                "sourceExcerpt": (
                    "Press any 3 keys in the sequence 1-2-3, 1-2-3, 1-2-3... "
                    "Then press button #2 and shut door to start the service cycle."
                ),
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    DOOR_SWITCH,
    HEATER,
    OVERFILL_SWITCH,
    DIVERTER_MOTOR,
    WASH_MOTOR_VSM,
    DRAIN_MOTOR_VSM,
    DC_FAN,
    INTERIOR_LED,
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLES = [diagnostic_entry_bundle()]
BUNDLE_FILES = ["w11480208-service-diagnostic-entry.json"]


def write_catalog() -> None:
    w11480208_entries = [
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
    w11633848_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w11633848-")
    ]
    catalog = {
        "manualId": "W11633848",
        "platformId": "whirlpool_dishwasher_acu",
        "templateId": "dishwasher",
        "label": 'Whirlpool/Maytag/KitchenAid ACU dishwasher (W11633848 + W11480208)',
        "notes": (
            "W11633848 Amana/Whirlpool 24\" + W11480208 filtration dishwasher (WDT740). "
            "Filtration manual uses P12 door, P11 overfill, P6 diverter, VSM motor pinouts. "
            "Shared fill/dispenser/OWI/diverter-sensor/SSM procedures from W11633848."
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

Manuals **W11633848** (Amana & Whirlpool 24\" dishwasher) and **W11480208** (filtration dishwasher WDT740).

Regenerate W11633848:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11633848
```

Regenerate W11480208 (filtration-specific procedures):

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11480208
```

Extraction:
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11633848_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11480208_DISHWASHER_EXTRACTION.md`
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
        "attach_w11480208_diagnostic_effects.py",
        "attach_w11480208_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
