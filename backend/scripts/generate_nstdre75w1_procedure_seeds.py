#!/usr/bin/env python3
"""Generate NS-TDRE75W1 (Insignia TDRE/TDRG vented dryer) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "insignia_dryer_tdre"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "NS-TDRE75W1",
    "manualTitle": "Insignia NS-TDRE75W1 / NS-TDRG75W1 Vented Dryer Service Manual",
    "extractedTextFile": "backend/docs/manuals/NS-TDRE75W1 Service Manual-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dryer or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Disconnect power before accessing internal components.",
    "requiresInput": False,
}

ELECTRIC_DRYER_ONLY = ["electric_dryer"]
GAS_DRYER_ONLY = ["gas_dryer"]


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
    result = {
        "id": pid,
        "version": "1.0.0",
        "title": title,
        "platformId": "insignia_dryer_tdre",
        "componentIds": component_ids,
        "tags": tags,
        "source": {**SOURCE, "oemTestNumber": oem_num, "oemTestTitle": oem_title, "pages": pages},
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }
    if template_ids:
        result["templateIds"] = template_ids
    return result


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


def pass_fail_branches(pass_id, pass_next, fail_id, fail_next, fail_outcome):
    return [
        {"id": pass_id, "label": "In spec", "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
        {
            "id": fail_id,
            "label": "Out of spec",
            "when": {"kind": "measurement_critical"},
            "nextStepId": fail_next,
            "terminal": True,
            "oemOutcome": fail_outcome,
        },
        {
            "id": f"{fail_id}_warn",
            "label": "Borderline",
            "when": {"kind": "measurement_warning"},
            "nextStepId": fail_next,
            "terminal": True,
            "oemOutcome": fail_outcome,
        },
        {
            "id": f"{fail_id}_open",
            "label": "Open circuit",
            "when": {"kind": "measurement_open"},
            "nextStepId": fail_next,
            "terminal": True,
            "oemOutcome": fail_outcome,
        },
    ]


def checkpoint_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {
            "id": no_id,
            "label": "No / failed",
            "when": {"kind": "checkpoint_no"},
            "nextStepId": no_next,
            "terminal": True,
            "oemOutcome": no_outcome,
        },
    ]


def continuity_ok_branches(ok_id, ok_next, bad_id, bad_next, bad_outcome):
    return checkpoint_yes_no(ok_id, ok_next, bad_id, bad_next, bad_outcome)


OUTLET_THERMISTOR = proc(
    "nstdre75w1-outlet-thermistor",
    "Outlet NTC — service test 04 & bench",
    "04",
    "NTC test (service mode screen 04)",
    [23, 24, 29],
    ["exhaust_thermistor"],
    ["E5", "no_heat", "thermistor_check", "error_code"],
    [
        instr(
            "service_test_ntc",
            2,
            "Service test — screen 04 NTC",
            "Enter service test mode (Time Adjust + and Wrinkle Care within 3s after Power; display shows St). "
            "Press Time Adjust + until screen 04. E5 displays on NTC fault; otherwise current outlet temp is shown.",
            "bench_outlet_ntc",
            excerpt="Screen 04, NTC test. If NTC error, error code E5 will show up.",
        ),
        instr(
            "bench_outlet_ntc",
            3,
            "Bench outlet NTC at CN3",
            "Disconnect power. Outlet NTC at CN3 pins 1–2 (TEMP_OUT). "
            "Spec: ~50 kΩ @ 77°F (40 kΩ @ 86°F, 99 kΩ @ 50°F).",
            "outlet_ntc_ohms",
        ),
        meas(
            "outlet_ntc_ohms",
            4,
            "Outlet NTC resistance",
            "Measure CN3 TEMP_OUT (pins 1–2) at room temperature.",
            "insigniaDryerOutletThermistorKohm",
            "CN3",
            "1-2",
            pass_fail_branches(
                "outlet_ntc_ok",
                "inspect_cn3_harness",
                "outlet_ntc_bad",
                "replace_outlet_ntc",
                "Replace outlet thermistor — E5 fault (A/D <10 or >1000).",
            ),
            excerpt="Thermistor resistance 50KΩ @ 77°F. If infinity, replace thermistor.",
        ),
        instr(
            "inspect_cn3_harness",
            5,
            "Inspect CN3 harness",
            "Verify CN3 harness between main PCB and outlet NTC. Repair opens/shorts; retest screen 04 in service mode.",
            "outlet_ntc_verified",
        ),
        outcome("replace_outlet_ntc", 6, "Replace outlet NTC", "Replace outlet temperature sensor and retest service mode 04."),
        outcome("outlet_ntc_verified", 7, "Outlet NTC verified", "Bench reading in spec and/or service test 04 shows temp without E5."),
    ],
)

HUMIDITY_SENSOR = proc(
    "nstdre75w1-humidity-sensor",
    "Humidity sensor — E4 timed-dry fallback",
    "E4",
    "Humidity sensor error",
    [24, 25, 29],
    ["moisture_sensor"],
    ["E4", "long_dry", "moisture_sensor_check", "error_code"],
    [
        instr(
            "e4_symptom_check",
            2,
            "E4 behavior",
            "E4 logs at end of cycle: control runs timed drying without humidity sensor. "
            "Clothes may finish wet until code is reviewed.",
            "bench_humidity_cn10",
            excerpt="Control runs whole cycle with timed drying; error logged at end.",
        ),
        instr(
            "bench_humidity_cn10",
            3,
            "Bench humidity sensor CN10",
            "Disconnect power. Humidity sensor at CN10 pins 1–4 (HUM). Check harness for damage at drum moisture bars.",
            "humidity_continuity",
        ),
        visual(
            "humidity_continuity",
            4,
            "Humidity sensor / harness continuity",
            "Does CN10 humidity circuit show continuity (not open) and bars are clean with no corrosion?",
            continuity_ok_branches(
                "humidity_ok",
                "humidity_verified",
                "humidity_bad",
                "replace_humidity_sensor",
                "Replace humidity sensor assembly or CN10 harness.",
            ),
        ),
        outcome(
            "replace_humidity_sensor",
            5,
            "Replace humidity sensor",
            "Replace humidity sensor at CN10; clean bars; retest auto-dry cycle.",
        ),
        outcome("humidity_verified", 6, "Humidity path verified", "Humidity sensor and CN10 harness OK — E4 should not recur."),
    ],
)

COMMUNICATION = proc(
    "nstdre75w1-communication",
    "Display communication — C9 fault",
    "C9",
    "Communication error",
    [24, 25],
    ["user_interface", "acu"],
    ["C9", "hmi_check", "no_power", "error_code"],
    [
        instr(
            "c9_symptom",
            2,
            "C9 behavior",
            "C9 after 110 s comm timeout: heater off, motor off, fault state. Often dead or frozen UI mid-cycle.",
            "inspect_cn9",
            excerpt="110 sec timeout — heater off, motor off, go to fault state.",
        ),
        visual(
            "inspect_cn9",
            3,
            "CN9 display harness seated",
            "Access main PCB. Is CN9 (display communication) fully seated with no pin damage?",
            continuity_ok_branches(
                "cn9_seated",
                "cn9_continuity",
                "cn9_loose",
                "reseat_cn9",
                "Reseat CN9 harness; verify display ribbon at UI board.",
            ),
        ),
        visual(
            "cn9_continuity",
            4,
            "CN9 harness continuity",
            "With power off, verify continuity on CN9 harness between main PCB and display PCB (no opens).",
            continuity_ok_branches(
                "cn9_ok",
                "comm_verified",
                "cn9_bad",
                "replace_display_or_pcb",
                "Replace display assembly or main PCB per failed path.",
            ),
        ),
        instr("reseat_cn9", 5, "Reseat and retest", "Reseat CN9 and display connectors; restore power and verify UI responds.", "comm_verified"),
        outcome(
            "replace_display_or_pcb",
            6,
            "Replace display or PCB",
            "Replace display PCB assembly or main control board; retest for C9.",
        ),
        outcome("comm_verified", 7, "Communication verified", "CN9 path OK — C9 should not return."),
    ],
)

HEATER_ELECTRIC = proc(
    "nstdre75w1-heater-electric",
    "Electric heater element — 20 Ω",
    "heater-electric",
    "Heater resistance check (electric)",
    [25, 29],
    ["heating_element", "thermal_cutoff", "thermal_fuse"],
    ["no_heat", "heating_element_check", "E5"],
    [
        instr(
            "access_heater_electric",
            2,
            "Access heater (electric)",
            "Remove toe/kick panel. Electric heater at CN7/CN8 (HEATER 1 / HEATER 2). Check thermal cut-off and hi-limit in series first.",
            "thermal_cutoff_electric",
        ),
        visual(
            "thermal_cutoff_electric",
            3,
            "Thermal cut-off continuity (electric)",
            "Thermal cut-off in heater path: resistance < 1 Ω. Open = replace thermal cut-off.",
            continuity_ok_branches(
                "tcutoff_ok",
                "hi_limit_electric",
                "tcutoff_open",
                "replace_thermal_cutoff",
                "Replace thermostat thermal cut-off (212/176°F).",
            ),
        ),
        visual(
            "hi_limit_electric",
            4,
            "Hi-limit thermostat continuity",
            "Hi-limit thermostat: < 1 Ω. Press red reset button if tripped from overtemperature.",
            continuity_ok_branches(
                "hilimit_ok",
                "heater_ohms",
                "hilimit_open",
                "replace_hi_limit",
                "Replace hi-limit thermostat.",
            ),
        ),
        meas(
            "heater_ohms",
            5,
            "Heater element resistance",
            "Measure heater element at CN7/CN8 — expect 20 Ω.",
            "insigniaDryerHeaterOhms",
            "CN7/CN8",
            "HEATER",
            pass_fail_branches(
                "heater_ok",
                "heater_verified",
                "heater_bad",
                "replace_heater",
                "Replace heater assembly — open element.",
            ),
            excerpt="Heater resistance 20 Ω. If infinity, replace heater.",
        ),
        outcome("replace_thermal_cutoff", 6, "Replace thermal cut-off", "Replace thermal cut-off and verify vent path."),
        outcome("replace_hi_limit", 7, "Replace hi-limit", "Replace hi-limit thermostat; check vent restriction."),
        outcome("replace_heater", 8, "Replace heater", "Replace heater element assembly."),
        outcome("heater_verified", 9, "Heater path verified", "Thermal devices and 20 Ω element in spec."),
    ],
    template_ids=ELECTRIC_DRYER_ONLY,
)

HEATER_GAS = proc(
    "nstdre75w1-heater-gas",
    "Gas heat path — thermal devices",
    "heater-gas",
    "Gas burner thermal path",
    [30],
    ["gas_valve", "thermal_cutoff", "thermal_fuse"],
    ["no_heat", "ignition_issue", "gas_heater_check"],
    [
        instr(
            "access_gas_heat",
            2,
            "Access gas burner area",
            "Remove toe panel. Gas heat path: flame sensor → igniter → gas valve → hi-limit → thermal cut-off.",
            "gas_thermal_cutoff",
        ),
        visual(
            "gas_thermal_cutoff",
            3,
            "Gas thermal cut-off continuity",
            "Thermal cut-off in gas heat path: < 1 Ω. Open = replace.",
            continuity_ok_branches(
                "gas_tcutoff_ok",
                "gas_hi_limit",
                "gas_tcutoff_open",
                "replace_gas_tcutoff",
                "Replace gas thermal cut-off.",
            ),
        ),
        visual(
            "gas_hi_limit",
            4,
            "Gas hi-limit continuity",
            "Hi-limit thermostat: < 1 Ω. Press red reset if overtemperature tripped.",
            continuity_ok_branches(
                "gas_hilimit_ok",
                "gas_heat_path_ok",
                "gas_hilimit_open",
                "replace_gas_hilimit",
                "Replace gas hi-limit thermostat.",
            ),
        ),
        instr(
            "gas_heat_path_ok",
            5,
            "Continue gas ignition checks",
            "Thermal path OK. Run gas ignitor, flame sensor, and gas valve coil procedures if no heat.",
            "gas_heat_verified",
        ),
        outcome("replace_gas_tcutoff", 6, "Replace thermal cut-off", "Replace gas thermal cut-off."),
        outcome("replace_gas_hilimit", 7, "Replace hi-limit", "Replace gas hi-limit."),
        outcome("gas_heat_verified", 8, "Gas thermal path OK", "Thermal cut-off and hi-limit pass — check ignitor/valve/flame sensor."),
    ],
    template_ids=GAS_DRYER_ONLY,
)

THERMAL_CUTOFF = proc(
    "nstdre75w1-thermal-cutoff",
    "Thermal cut-off — continuity",
    "thermal-cutoff",
    "Thermostat thermal cut-off",
    [29, 30],
    ["thermal_cutoff"],
    ["no_heat", "thermal_fuse_check"],
    [
        instr(
            "access_thermal_cutoff",
            2,
            "Locate thermal cut-off",
            "Thermal cut-off in exhaust/heat path. Electric: 212/176°F 25A. Gas: 347°F 25A. Power off.",
            "tcutoff_continuity",
        ),
        visual(
            "tcutoff_continuity",
            3,
            "Thermal cut-off < 1 Ω",
            "Ohmmeter across thermal cut-off terminals. Infinity = open fuse — replace.",
            continuity_ok_branches(
                "tcutoff_pass",
                "tcutoff_verified",
                "tcutoff_fail",
                "replace_tcutoff",
                "Replace thermostat thermal cut-off.",
            ),
            excerpt="Thermostat Thermal cut-off resistance < 1Ω. If infinity, replace.",
        ),
        outcome("replace_tcutoff", 4, "Replace thermal cut-off", "Replace thermal cut-off; verify unrestricted vent."),
        outcome("tcutoff_verified", 5, "Thermal cut-off OK", "Continuity < 1 Ω."),
    ],
)

THERMAL_HI_LIMIT = proc(
    "nstdre75w1-thermal-hi-limit",
    "Regulating thermostat & hi-limit",
    "hi-limit",
    "Regulating thermostat and hi-limit",
    [29, 30],
    ["thermal_fuse"],
    ["no_heat"],
    [
        instr(
            "access_regulating",
            2,
            "Locate regulating thermostat",
            "Regulating thermostat (158/122°F 25A) and hi-limit in heat path. Power off.",
            "regulating_continuity",
        ),
        visual(
            "regulating_continuity",
            3,
            "Regulating thermostat < 1 Ω",
            "Resistance across regulating thermostat: < 1 Ω. Infinity = replace.",
            continuity_ok_branches(
                "reg_ok",
                "hilimit_check",
                "reg_bad",
                "replace_regulating",
                "Replace regulating thermostat.",
            ),
            excerpt="Regulating Thermostat resistance < 1Ω.",
        ),
        visual(
            "hilimit_check",
            4,
            "Hi-limit < 1 Ω",
            "Hi-limit thermostat: < 1 Ω. Press red reset button if supply was cut from overtemperature.",
            continuity_ok_branches(
                "hilimit_pass",
                "hilimit_verified",
                "hilimit_fail",
                "replace_hilimit",
                "Replace hi-limit thermostat.",
            ),
        ),
        outcome("replace_regulating", 5, "Replace regulating thermostat", "Replace regulating thermostat."),
        outcome("replace_hilimit", 6, "Replace hi-limit", "Replace hi-limit thermostat."),
        outcome("hilimit_verified", 7, "Thermostats OK", "Regulating thermostat and hi-limit continuity pass."),
    ],
)

GAS_IGNITOR = proc(
    "nstdre75w1-gas-ignitor",
    "Gas ignitor — 40–400 Ω",
    "ignitor",
    "Igniter resistance",
    [30],
    ["igniter"],
    ["no_heat", "igniter_check", "ignition_issue"],
    [
        instr(
            "access_ignitor",
            2,
            "Access ignitor",
            "Disconnect power. Remove burner shield per disassembly §5. Handle ignitor carefully — fragile.",
            "ignitor_ohms",
            excerpt="Take care the ignitor.",
        ),
        meas(
            "ignitor_ohms",
            3,
            "Ignitor resistance",
            "Measure ignitor cold resistance.",
            "hotSurfaceIgniterOhms",
            "Ignitor",
            "terminals",
            pass_fail_branches(
                "ignitor_ok",
                "ignitor_verified",
                "ignitor_bad",
                "replace_ignitor",
                "Replace ignitor — open or out of 40–400 Ω range.",
            ),
            excerpt="Igniter resistance 40~400Ω. If infinity, replace igniter.",
        ),
        outcome("replace_ignitor", 4, "Replace ignitor", "Replace hot-surface ignitor."),
        outcome("ignitor_verified", 5, "Ignitor verified", "Ignitor 40–400 Ω."),
    ],
    template_ids=GAS_DRYER_ONLY,
)

GAS_VALVE = proc(
    "nstdre75w1-gas-valve",
    "Gas valve coils",
    "gas-valve",
    "Gas valve coil resistance",
    [30],
    ["gas_valve"],
    ["no_heat", "gas_valve_check"],
    [
        instr(
            "access_gas_valve",
            2,
            "Access gas valve",
            "Disconnect power. Gas valve coil pairs: Valve1-2 = 1.2 kΩ, Valve1-3 = 0.5 kΩ, Valve4-5 = 1.2 kΩ.",
            "valve_coil_ohms",
        ),
        meas(
            "valve_coil_ohms",
            3,
            "Gas valve coil resistance",
            "Measure each coil pair on gas valve. Infinity on any coil = replace valve.",
            "gasValveCoilOhms",
            "Gas valve",
            "1-2 / 1-3 / 4-5",
            pass_fail_branches(
                "valve_ok",
                "valve_verified",
                "valve_bad",
                "replace_valve",
                "Replace gas valve assembly.",
            ),
            excerpt="Valve1-2: 1.2KΩ; Valve1-3: 0.5KΩ; Valve4-5: 1.2KΩ.",
        ),
        outcome("replace_valve", 4, "Replace gas valve", "Replace gas valve."),
        outcome("valve_verified", 5, "Gas valve verified", "All coil pairs in spec."),
    ],
    template_ids=GAS_DRYER_ONLY,
)

FLAME_SENSOR = proc(
    "nstdre75w1-flame-sensor",
    "Flame sensor — continuity",
    "flame-sensor",
    "Flame sensor resistance",
    [30],
    ["flame_sensor"],
    ["no_heat", "ignition_issue"],
    [
        instr(
            "access_flame_sensor",
            2,
            "Access flame sensor",
            "Disconnect power. Flame sensor on burner assembly.",
            "flame_sensor_continuity",
        ),
        visual(
            "flame_sensor_continuity",
            3,
            "Flame sensor < 1 Ω",
            "Flame sensor resistance < 1 Ω when clean. Infinity = replace flame sensor.",
            continuity_ok_branches(
                "flame_ok",
                "flame_verified",
                "flame_bad",
                "replace_flame_sensor",
                "Replace flame sensor.",
            ),
            excerpt="Flame sensor resistance < 1Ω.",
        ),
        outcome("replace_flame_sensor", 4, "Replace flame sensor", "Replace flame sensor; clean burner area."),
        outcome("flame_verified", 5, "Flame sensor OK", "Flame sensor continuity passes."),
    ],
    template_ids=GAS_DRYER_ONLY,
)

DOOR_SWITCH = proc(
    "nstdre75w1-door-switch",
    "Door switch — COM to NO",
    "door-switch",
    "Door switch test",
    [29],
    ["door_switch"],
    ["door_switch_check", "wont_start"],
    [
        instr(
            "door_switch_access",
            2,
            "Door switch at CN1",
            "Disconnect power. Door switch on CN1. Terminals COM–NO (1–2): open door = ∞ Ω; door closed/pushed = < 1 Ω.",
            "door_open_check",
        ),
        visual(
            "door_open_check",
            3,
            "Door open — switch open",
            "With door open, COM–NO reads open (∞ Ω)?",
            continuity_ok_branches(
                "door_open_ok",
                "door_closed_check",
                "door_open_bad",
                "replace_door_switch",
                "Replace door switch — stuck closed.",
            ),
        ),
        visual(
            "door_closed_check",
            4,
            "Door closed — switch closed",
            "With door closed and latched, COM–NO < 1 Ω?",
            continuity_ok_branches(
                "door_closed_ok",
                "door_switch_verified",
                "door_closed_bad",
                "replace_door_switch",
                "Replace door switch assembly.",
            ),
        ),
        outcome("replace_door_switch", 5, "Replace door switch", "Replace door switch at CN1."),
        outcome("door_switch_verified", 6, "Door switch verified", "Door switch opens and closes correctly."),
    ],
)

BELT_SAFETY = proc(
    "nstdre75w1-belt-safety",
    "Belt safety switch",
    "belt-safety",
    "Belt safety switch",
    [29],
    ["motor"],
    ["wont_start", "motor_check"],
    [
        instr(
            "belt_switch_access",
            2,
            "Belt safety switch",
            "Disconnect power. Belt safety switch on motor/blower path.",
            "belt_lever_open",
        ),
        visual(
            "belt_lever_open",
            3,
            "Lever open — < 1 Ω",
            "Belt lever in open (normal) position: resistance < 1 Ω.",
            continuity_ok_branches(
                "belt_open_ok",
                "belt_lever_push",
                "belt_open_bad",
                "replace_belt_switch",
                "Replace belt safety switch.",
            ),
            excerpt="Lever open: Resistance value < 1Ω.",
        ),
        visual(
            "belt_lever_push",
            4,
            "Lever pushed — open circuit",
            "Simulate belt-off (lever pushed): resistance ∞ Ω?",
            continuity_ok_branches(
                "belt_push_ok",
                "belt_verified",
                "belt_push_bad",
                "replace_belt_switch",
                "Replace belt safety switch.",
            ),
            excerpt="Lever push: Resistance value ∞ Ω.",
        ),
        outcome("replace_belt_switch", 5, "Replace belt switch", "Replace belt safety switch."),
        outcome("belt_verified", 6, "Belt switch OK", "Belt safety switch operates correctly."),
    ],
)

HMI_TEST = proc(
    "nstdre75w1-hmi-test",
    "Service test — knob & key check",
    "02-03",
    "Knob light and key checking (screens 02–03)",
    [23],
    ["user_interface"],
    ["hmi_check", "C9", "error_code"],
    [
        instr(
            "advance_screen_02",
            2,
            "Service test screen 02 — knob lights",
            "Enter service test mode. Press Time Adjust + to screen 02. Turn cycle knob — indicator lights around knob should follow each detent.",
            "knob_light_check",
        ),
        visual(
            "knob_light_check",
            3,
            "Knob indicator lights",
            "Does each knob position toggle the surrounding light on/off correctly?",
            continuity_ok_branches(
                "knob_ok",
                "advance_screen_03",
                "knob_bad",
                "inspect_display_harness",
                "Inspect display/knob harness at CN9.",
            ),
        ),
        instr(
            "advance_screen_03",
            4,
            "Service test screen 03 — key check",
            "Press Time Adjust + to screen 03 (key checking mode). Press each touchpad key.",
            "key_check",
        ),
        visual(
            "key_check",
            5,
            "All keys respond",
            "Does every control key register in key-check mode?",
            continuity_ok_branches(
                "keys_ok",
                "hmi_verified",
                "keys_bad",
                "replace_ui",
                "Replace display/control panel or main PCB.",
            ),
        ),
        instr(
            "inspect_display_harness",
            6,
            "Inspect CN9 harness",
            "Verify CN9 display communication harness; reseat connectors.",
            "hmi_verified",
        ),
        outcome("replace_ui", 7, "Replace UI or PCB", "Replace display assembly or main PCB."),
        outcome("hmi_verified", 8, "HMI verified", "Knob lights and keys pass service tests 02–03."),
    ],
)

MOTOR_CIRCUIT = proc(
    "nstdre75w1-motor-circuit",
    "Motor — belt switch & centrifugal",
    "motor",
    "Motor centrifugal switch",
    [29],
    ["motor"],
    ["motor_check", "wont_start", "C9"],
    [
        instr(
            "motor_centrifugal",
            2,
            "Centrifugal switch (motor)",
            "Motor centrifugal contacts (1M–6M): start winding closes 1M–2M and 3M–5M; run winding closes 1M–2M, 3M–5M, and 5M–6M. "
            "Verify contacts with motor stopped vs drum spinning.",
            "belt_switch_precheck",
            excerpt="Centrifugal Switch (Motor) contact table.",
        ),
        instr(
            "belt_switch_precheck",
            3,
            "Belt safety prerequisite",
            "Confirm belt safety switch passes (nstdre75w1-belt-safety) before condemning motor.",
            "motor_run_check",
        ),
        visual(
            "motor_run_check",
            4,
            "Motor runs with belt on",
            "With belt installed and door closed, does motor start and drum turn?",
            [
                {
                    "id": "motor_runs",
                    "label": "Yes / runs",
                    "when": {"kind": "checkpoint_yes"},
                    "nextStepId": "motor_verified",
                },
                {
                    "id": "motor_no_run",
                    "label": "No / won't run",
                    "when": {"kind": "checkpoint_no"},
                    "nextStepId": "replace_motor",
                },
            ],
        ),
        outcome("replace_motor", 5, "Replace motor", "Replace motor assembly — centrifugal or winding fault."),
        outcome("motor_verified", 6, "Motor verified", "Motor runs; belt safety and centrifugal logic OK."),
    ],
)


def service_test_entry_bundle() -> dict:
    return {
        "id": "nstdre75w1-service-test-entry",
        "version": "1.0.0",
        "platformId": "insignia_dryer_tdre",
        "manualId": "NS-TDRE75W1",
        "title": "NS-TDRE75W1 — Service test mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter control-panel service test mode (St); step through screens 01–04 including NTC test.",
        "tags": ["service_diagnostic", "error_code"],
        "entryStepId": "prep_power",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [23],
        },
        "steps": [
            {
                "id": "prep_power",
                "order": 1,
                "type": "instruction",
                "title": "Door closed, power on",
                "body": "Make sure the door is closed. Press Power so the unit is ready.",
                "sourceExcerpt": "Make sure the door is closed, press [Power] button.",
                "requiresInput": False,
                "defaultNextStepId": "service_mode_entry",
            },
            {
                "id": "service_mode_entry",
                "order": 2,
                "type": "instruction",
                "title": "Service test entry",
                "body": (
                    "Within 3 seconds after pressing Power, press Time Adjust + and Wrinkle Care at the same time. "
                    "Display shows St. Press Time Adjust + to step: 01 software version, 02 knob lights, 03 key check, "
                    "04 NTC test (E5 on fault), 05 normal operation, Ed end."
                ),
                "sourceExcerpt": "Press [Time Adjust +] and [Wrinkle Care] at the same time within 3s after press [Power].",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    OUTLET_THERMISTOR,
    HUMIDITY_SENSOR,
    COMMUNICATION,
    HEATER_ELECTRIC,
    HEATER_GAS,
    THERMAL_CUTOFF,
    THERMAL_HI_LIMIT,
    GAS_IGNITOR,
    GAS_VALVE,
    FLAME_SENSOR,
    DOOR_SWITCH,
    BELT_SAFETY,
    HMI_TEST,
    MOTOR_CIRCUIT,
]

PROCEDURE_FILES = [f"{item['id']}.json" for item in PROCEDURES]

BUNDLES = [service_test_entry_bundle()]
BUNDLE_FILES = ["nstdre75w1-service-test-entry.json"]


def write_catalog() -> None:
    catalog = {
        "manualId": "NS-TDRE75W1",
        "platformId": "insignia_dryer_tdre",
        "templateId": "electric_dryer",
        "label": "Insignia NS-TDRE75W1 / NS-TDRG75W1 vented dryer",
        "notes": "Service-test-mode flows (screens 01–04) plus component checks §4.3–4.4. Gas procedures use gas_dryer templateIds.",
        "plannedProcedures": [
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
                "relatedCodes": [tag for tag in item.get("tags", []) if tag in ("E4", "E5", "C9")],
            }
            for item in PROCEDURES
        ],
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name}")


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

    effects_script = ROOT / "backend" / "scripts" / "attach_nstdre75w1_diagnostic_effects.py"
    if effects_script.exists():
        subprocess.run([sys.executable, str(effects_script)], check=True, cwd=ROOT)

    service_modes_script = ROOT / "backend" / "scripts" / "attach_nstdre75w1_service_modes.py"
    if service_modes_script.exists():
        subprocess.run([sys.executable, str(service_modes_script)], check=True, cwd=ROOT)

    registry_script = ROOT / "backend" / "scripts" / "generate_procedure_registry.py"
    subprocess.run([sys.executable, str(registry_script)], check=True, cwd=ROOT)

    validate_script = ROOT / "backend" / "scripts" / "validate_procedure_seed.py"
    subprocess.run([sys.executable, str(validate_script)], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
