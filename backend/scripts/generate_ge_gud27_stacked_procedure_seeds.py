#!/usr/bin/env python3
"""Generate GE GUD27 unitized stacked laundry (dryer section) procedure seeds."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "ge_gud27_stacked"

SOURCE = {
    "manualId": "GE-GUD27-STACKED",
    "manualTitle": "GE 24/27 in Unitized Laundry Centers (GUD27ESS/GUD27GSS)",
    "extractedTextFile": "backend/docs/manuals/gud27essmww-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

PLATFORM = "ge_gud27_stacked"

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": (
        "Unplug the laundry center or disconnect power before servicing the dryer section. "
        "Timer and start switch are intentionally ungrounded — shock risk if power is on during access."
    ),
    "sourceExcerpt": "Disconnect power before servicing. Timer may present electric shock during servicing.",
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
        "platformId": PLATFORM,
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


NO_HEAT_ELECTRIC = proc(
    "gegud27-no-heat-electric",
    "No Heat — Electric Dryer Path",
    "TS-60",
    "Electric Dryer Troubleshooting — No Heat",
    [60, 77],
    ["heating_element", "supply"],
    ["no_heat", "dryer_no_heat", "heating_element_check", "supply_issue"],
    [
        visual(
            "confirm_electric",
            2,
            "Confirm electric dryer section",
            "GUD27ESSMWW / XUD27ESSMWW = electric heat. GUD27GSS = gas — use gas no-heat procedure instead.",
            checkpoint_yes_no(
                "is_electric",
                "supply_240_both",
                "wrong_fuel",
                "use_gas_procedure",
                "Use gegud27-no-heat-gas for GUD27GSS gas dryer section.",
            ),
        ),
        visual(
            "supply_240_both",
            3,
            "240 VAC at both supply legs",
            "At terminal block with power on: measure 240 VAC across both hot legs. Each leg to neutral ~120 VAC.",
            checkpoint_yes_no(
                "supply_ok",
                "heat_at_elements",
                "supply_bad",
                "correct_supply",
                "Correct 240 V supply or cord/terminal block fault.",
            ),
        ),
        visual(
            "heat_at_elements",
            4,
            "240 VAC at both heater elements",
            "During heat call with drum running: verify 240 VAC present at heater element terminals per wiring diagram p.77.",
            checkpoint_yes_no(
                "voltage_at_heater",
                "thermostat_operation",
                "no_voltage_heater",
                "timer_motor_switch_path",
                "Check motor switch M1–M2, timer heat contacts, and heat selector per §60 chart.",
            ),
        ),
        visual(
            "thermostat_operation",
            5,
            "Thermostat temperature operation",
            "Verify cycling thermostats open/close at rated temps (inlet 210°F, outlet 130°F, high-limit 315°F, safety 235°F).",
            checkpoint_yes_no(
                "thermostats_cycle",
                "element_resistance_check",
                "thermostat_fault",
                "replace_thermostats",
                "Replace failed biased thermostat(s); clear vent if safety tripped.",
            ),
        ),
        instr(
            "element_resistance_check",
            6,
            "Element resistance",
            "Power off. Run gegud27-heater-thermostats-electric for outer/inner element Ω and thermostat continuity.",
            "electric_path_verified",
        ),
        instr(
            "timer_motor_switch_path",
            7,
            "Timer, motor switch, heat selector",
            "Verify timer B–A / Y–S heat contacts, motor centrifugal M1–M2, and heat selector switch per §62 timer chart.",
            "electric_path_verified",
        ),
        outcome("correct_supply", 8, "Correct supply", "Restore 240 VAC supply or replace cord/terminal block."),
        outcome("replace_thermostats", 9, "Replace thermostats", "Replace open biased thermostat(s)."),
        outcome("use_gas_procedure", 10, "Use gas procedure", "Route to gegud27-no-heat-gas."),
        outcome(
            "electric_path_verified",
            11,
            "Electric heat path reviewed",
            "Supply, voltage path, thermostats, and element checks complete per §60.",
        ),
    ],
)

HEATER_THERMOSTATS_ELECTRIC = proc(
    "gegud27-heater-thermostats-electric",
    "Heater Element & Thermostat Ohms",
    "TS-34",
    "Heater Assembly & Thermostats — Electric",
    [34, 35, 36, 77],
    ["heating_element", "thermal_cutoff"],
    ["no_heat", "dryer_no_heat", "heating_element_check"],
    [
        instr(
            "access_heater",
            2,
            "Access heater assembly",
            "Remove drum per service guide. Disconnect leads at elements and thermostats. Biased thermostats must be cool.",
            "outer_element",
        ),
        meas(
            "outer_element",
            3,
            "Outer element resistance",
            "Rx1 across outer element terminals: 23.7–26 Ω.",
            "geGud27DryerHeaterElementOhms",
            "Heater outer",
            "terminals",
            pass_fail_branches(
                "outer_ok",
                "inner_element",
                "outer_bad",
                "replace_outer",
                "Replace outer heating element.",
            ),
        ),
        meas(
            "inner_element",
            4,
            "Inner elements (combined)",
            "Rx1 across combined inner element path per wiring diagram p.77: 23.7–26 Ω.",
            "geGud27DryerHeaterElementOhms",
            "Heater inner",
            "terminals",
            pass_fail_branches(
                "inner_ok",
                "safety_thermostat",
                "inner_bad",
                "replace_inner",
                "Replace inner heating element(s).",
            ),
        ),
        visual(
            "safety_thermostat",
            5,
            "Safety thermostat continuity",
            "Cool thermostat: Rx1 across safety thermostat terminals = closed (0 Ω). Opens 235°F (225°F long vent).",
            checkpoint_yes_no(
                "safety_ok",
                "inlet_thermostat",
                "safety_open",
                "replace_safety",
                "Replace safety thermostat; inspect vent restriction.",
            ),
        ),
        visual(
            "inlet_thermostat",
            6,
            "Inlet control thermostat continuity",
            "Cool thermostat: Rx1 = closed. Opens at 210°F, closes 180°F.",
            checkpoint_yes_no(
                "inlet_ok",
                "outlet_thermostat",
                "inlet_open",
                "replace_inlet",
                "Replace inlet control thermostat.",
            ),
        ),
        visual(
            "outlet_thermostat",
            7,
            "Outlet control thermostat continuity",
            "On blower housing. Cool: Rx1 = closed. Opens 130°F, closes 110°F.",
            checkpoint_yes_no(
                "outlet_ok",
                "high_limit",
                "outlet_open",
                "replace_outlet",
                "Replace outlet control thermostat.",
            ),
        ),
        visual(
            "high_limit",
            8,
            "High-limit thermostat continuity",
            "On heater housing upper right. Cool: Rx1 = closed. Opens 315°F.",
            checkpoint_yes_no(
                "hilimit_ok",
                "heater_verified",
                "hilimit_open",
                "replace_hilimit",
                "Replace high-limit thermostat.",
            ),
        ),
        outcome("replace_outer", 9, "Replace outer element", "Replace outer heating element."),
        outcome("replace_inner", 10, "Replace inner element", "Replace inner heating element(s)."),
        outcome("replace_safety", 11, "Replace safety thermostat", "Replace safety thermostat."),
        outcome("replace_inlet", 12, "Replace inlet thermostat", "Replace inlet control thermostat."),
        outcome("replace_outlet", 13, "Replace outlet thermostat", "Replace outlet control thermostat."),
        outcome("replace_hilimit", 14, "Replace high-limit", "Replace high-limit thermostat."),
        outcome("heater_verified", 15, "Heater & thermostats OK", "Element resistances and thermostat continuity within spec."),
    ],
)

NO_HEAT_GAS = proc(
    "gegud27-no-heat-gas",
    "No Heat — Gas Dryer Path",
    "TS-61",
    "Gas Dryer Troubleshooting — No Heat",
    [61, 79],
    ["igniter", "gas_valve", "flame_sensor"],
    ["no_heat", "dryer_no_heat", "igniter_check", "gas_valve_check", "ignition_issue"],
    [
        visual(
            "confirm_gas",
            2,
            "Confirm gas dryer section",
            "GUD27GSSMWW / XUD27GSSMWW = gas heat. GUD27ESS = electric — use electric no-heat procedure.",
            checkpoint_yes_no(
                "is_gas",
                "ignitor_glows",
                "wrong_fuel_gas",
                "use_electric_procedure",
                "Use gegud27-no-heat-electric for GUD27ESS electric dryer section.",
            ),
        ),
        visual(
            "ignitor_glows",
            3,
            "Ignitor glows on heat call",
            "Start a heat cycle. Glo-bar should glow red within ~60 seconds.",
            checkpoint_yes_no(
                "glow_ok",
                "gas_present",
                "no_glow",
                "ignitor_ohms",
                "Test ignitor resistance and gas valve coil path.",
            ),
        ),
        visual(
            "gas_present",
            4,
            "Gas supply present",
            "Verify gas shutoff open, supply pressure, and no kinked flex line.",
            checkpoint_yes_no(
                "gas_ok",
                "flame_established",
                "gas_supply_fault",
                "correct_gas_supply",
                "Restore gas supply or clear restriction.",
            ),
        ),
        visual(
            "flame_established",
            5,
            "Flame established",
            "Burner should light and remain on. Short burn 1–2 min then off → flame detector or weak coils.",
            checkpoint_yes_no(
                "flame_ok",
                "gas_path_verified",
                "no_flame",
                "flame_detector_check",
                "Test flame detector and gas valve coils.",
            ),
        ),
        meas(
            "ignitor_ohms",
            6,
            "Ignitor resistance",
            "Power off. Disconnect ignitor harness. Rx1: 40–400 Ω.",
            "geGud27DryerIgnitorOhms",
            "Ignitor",
            "2-wire",
            pass_fail_branches(
                "ign_ok",
                "safety_coils",
                "ign_bad",
                "replace_ignitor",
                "Replace glo-bar ignitor.",
            ),
        ),
        meas(
            "safety_coils",
            7,
            "Safety + booster coil path",
            "Disconnect coil harness. Safety ~1400 Ω + booster ~580 Ω path to open safety valve.",
            "geGud27GasValveSafetyCoilOhms",
            "Gas valve",
            "safety+booster",
            pass_fail_branches(
                "safety_coil_ok",
                "main_coil",
                "safety_coil_bad",
                "replace_coils",
                "Replace gas valve coil assembly.",
            ),
        ),
        meas(
            "main_coil",
            8,
            "Main valve coil",
            "Flame detector cool/closed. Main coil approximately 1300 Ω.",
            "geGud27GasValveMainCoilOhms",
            "Gas valve",
            "main",
            pass_fail_branches(
                "main_ok",
                "backup_thermostats",
                "main_bad",
                "replace_coils",
                "Replace gas valve coil assembly.",
            ),
        ),
        visual(
            "flame_detector_check",
            9,
            "Flame detector continuity",
            "Cool detector: Rx1 < 1 Ω (normally closed). Opens when heated by ignitor/flame.",
            checkpoint_yes_no(
                "detector_ok",
                "backup_thermostats",
                "detector_bad",
                "replace_detector",
                "Replace flame detector.",
            ),
        ),
        visual(
            "backup_thermostats",
            10,
            "Safety & outlet thermostats",
            "Verify safety and outlet control thermostats cycle correctly; gas uses outlet thermostat for regulation.",
            checkpoint_yes_no(
                "backup_ok",
                "gas_path_verified",
                "backup_bad",
                "replace_thermostats_gas",
                "Replace failed thermostat(s).",
            ),
        ),
        outcome("replace_ignitor", 11, "Replace ignitor", "Replace glo-bar ignitor."),
        outcome("replace_coils", 12, "Replace gas coils", "Replace gas valve coil assembly."),
        outcome("replace_detector", 13, "Replace flame detector", "Replace flame detector."),
        outcome("correct_gas_supply", 14, "Correct gas supply", "Restore gas supply pressure and shutoff."),
        outcome("replace_thermostats_gas", 15, "Replace thermostats", "Replace failed gas dryer thermostats."),
        outcome("use_electric_procedure", 16, "Use electric procedure", "Route to gegud27-no-heat-electric."),
        outcome("gas_path_verified", 17, "Gas heat path reviewed", "Ignition, valve, flame detector, and thermostats checked per §61."),
    ],
)

NO_TUMBLE = proc(
    "gegud27-no-tumble",
    "No Tumble / Drum Not Turning",
    "TS-28",
    "Drive Belt, Idler & Motor",
    [28, 30],
    ["motor", "drive_belt"],
    ["motor_check", "dryer_no_tumble", "wont_spin"],
    [
        visual(
            "belt_idler_visual",
            2,
            "Drive belt & idler",
            "Inspect belt for breakage and idler arm tension. Idler arm is under high tension — do not snap back.",
            checkpoint_yes_no(
                "belt_ok",
                "start_winding",
                "belt_bad",
                "replace_belt_idler",
                "Replace drive belt and/or idler assembly.",
            ),
        ),
        meas(
            "start_winding",
            3,
            "Motor start winding M6–M4",
            "Disconnect motor harness. Rx1 at motor M6 to M4: 2.98–3.30 Ω.",
            "geGud27DryerMotorStartWindingOhms",
            "Motor",
            "M6–M4",
            pass_fail_branches(
                "start_ok",
                "run_winding",
                "start_bad",
                "replace_motor",
                "Replace drive motor (overload internal).",
            ),
        ),
        meas(
            "run_winding",
            4,
            "Motor run winding",
            "Terminal 2 on start switch to NO on door switch (door closed): 3.19–3.53 Ω.",
            "geGud27DryerMotorRunWindingOhms",
            "Motor run",
            "start sw 2–door NO",
            pass_fail_branches(
                "run_ok",
                "door_belt_switch",
                "run_bad",
                "replace_motor",
                "Replace drive motor.",
            ),
        ),
        visual(
            "door_belt_switch",
            5,
            "Door switch & belt switch",
            "Door closed: door switch passes motor neutral. Belt switch engages when idler pulley up.",
            checkpoint_yes_no(
                "switches_ok",
                "tumble_verified",
                "switch_fault",
                "replace_switches",
                "Replace door switch or belt switch.",
            ),
        ),
        outcome("replace_belt_idler", 6, "Replace belt/idler", "Replace drive belt and/or idler."),
        outcome("replace_motor", 7, "Replace motor", "Replace drive motor and blower assembly."),
        outcome("replace_switches", 8, "Replace switches", "Replace door or belt switch."),
        outcome("tumble_verified", 9, "Tumble path OK", "Belt, motor windings, and switches within spec."),
    ],
)

TIMER_NOT_ADVANCING = proc(
    "gegud27-timer-not-advancing",
    "Timer Not Advancing",
    "TS-62",
    "Timer Motor, Advance Resistor & Outlet Thermostat",
    [25, 62],
    ["user_interface", "exhaust_thermistor"],
    ["timer_not_advancing", "timer_issue", "unitized_timer", "long_dry"],
    [
        visual(
            "cycle_type",
            2,
            "Auto vs timed dry cycle",
            "Auto cycles hold timer until outlet thermostat senses dry. Timed Dry should advance continuously.",
            [
                {"id": "auto_cycle", "label": "Auto / sensor cycle", "when": {"kind": "checkpoint_yes"}, "nextStepId": "clothes_damp"},
                {"id": "timed_cycle", "label": "Timed dry cycle", "when": {"kind": "checkpoint_no"}, "nextStepId": "timer_motor_ohms"},
            ],
        ),
        visual(
            "clothes_damp",
            3,
            "Are clothes still damp?",
            "If load is still wet, timer will not advance on auto until outlet thermostat opens.",
            checkpoint_yes_no(
                "still_damp",
                "vent_outlet_check",
                "not_damp",
                "outlet_thermostat_auto",
                "Outlet thermostat not opening — test thermostat and vent.",
            ),
        ),
        instr(
            "vent_outlet_check",
            4,
            "Vent & outlet thermostat",
            "Run gegud27-vent-restriction. Verify outlet control thermostat opens ~130°F at blower.",
            "outlet_thermostat_auto",
        ),
        visual(
            "outlet_thermostat_auto",
            5,
            "Outlet thermostat on auto cycles",
            "Cool: continuity closed. Must open when exhaust air exceeds 130°F for timer to advance.",
            checkpoint_yes_no(
                "outlet_auto_ok",
                "advance_resistor",
                "outlet_auto_bad",
                "replace_outlet_timer",
                "Replace outlet control thermostat.",
            ),
        ),
        meas(
            "advance_resistor",
            6,
            "Time-advance resistor (electric)",
            "Electric models: timer Off/Cool Down — Rx1 timer contacts A to T = 4500 Ω.",
            "geGud27DryerTimerAdvanceResistorOhms",
            "Timer",
            "A–T",
            pass_fail_branches(
                "resistor_ok",
                "timer_motor_ohms",
                "resistor_bad",
                "replace_resistor",
                "Replace 4500 Ω voltage-dropping resistor on control bracket.",
            ),
        ),
        meas(
            "timer_motor_ohms",
            7,
            "Timer motor resistance",
            "Disconnect timer wiring. Timer motor approximately 2.4 kΩ.",
            "geGud27DryerTimerMotorOhms",
            "Timer motor",
            "motor winding",
            pass_fail_branches(
                "timer_motor_ok",
                "timer_chart",
                "timer_motor_bad",
                "replace_timer",
                "Replace dryer timer.",
            ),
        ),
        instr(
            "timer_chart",
            8,
            "Timer contact chart §62",
            "Verify timer contacts per §62 chart: B–C motor, B–A/Y–S heat, T–X timer motor, A–U bias heat.",
            "timer_verified",
        ),
        outcome("replace_resistor", 9, "Replace advance resistor", "Replace timer voltage-dropping resistor."),
        outcome("replace_timer", 10, "Replace timer", "Replace dryer timer assembly."),
        outcome("replace_outlet_timer", 11, "Replace outlet thermostat", "Replace outlet control thermostat."),
        outcome("timer_verified", 12, "Timer path OK", "Timer motor, advance resistor, and outlet thermostat within spec."),
    ],
)

VENT_RESTRICTION = proc(
    "gegud27-vent-restriction",
    "Vent Restriction & Long Dry Time",
    "TS-14",
    "Venting, Drum Speed & Exhaust",
    [14, 16, 32, 60],
    ["exhaust", "motor"],
    ["dryer_not_drying", "long_dry", "vent_restriction", "timer_not_advancing"],
    [
        instr(
            "lint_trap_vent",
            2,
            "Lint trap & vent run",
            "Clean lint screen. Inspect trap duct, external vent hood, and entire run for restriction or crushing.",
            "drum_speed",
        ),
        visual(
            "drum_speed",
            3,
            "Drum speed during operation",
            "Drum should tumble at normal speed. Static cling on small loads can stop tumble — add buffer items.",
            checkpoint_yes_no(
                "speed_ok",
                "exhaust_temp",
                "speed_low",
                "belt_motor_check",
                "Inspect belt, idler, and motor — run gegud27-no-tumble.",
            ),
        ),
        visual(
            "exhaust_temp",
            4,
            "Exhaust air temperature",
            "Restricted vent causes high exhaust temps, safety thermostat trips, and long dry times.",
            checkpoint_yes_no(
                "exhaust_ok",
                "long_vent_motor",
                "exhaust_hot",
                "clear_vent",
                "Clear vent restriction; verify outlet and safety thermostats reset.",
            ),
        ),
        meas(
            "long_vent_motor",
            5,
            "Long-vent blower motor (if equipped)",
            "Long-vent models: blower motor in parallel with drive motor, 14.25–15.75 Ω.",
            "geGud27LongVentBlowerMotorOhms",
            "Long-vent blower",
            "motor",
            pass_fail_branches(
                "lv_ok",
                "usage_factors",
                "lv_bad",
                "replace_lv_motor",
                "Replace long-vent blower motor.",
            ),
        ),
        instr(
            "usage_factors",
            6,
            "Customer usage factors",
            "Load size, bulky items, ambient temp, indoor venting, washer spin speed, and rinse temp affect dry time.",
            "vent_verified",
        ),
        instr(
            "belt_motor_check",
            7,
            "Belt & motor",
            "Run gegud27-no-tumble if drum speed low.",
            "vent_verified",
        ),
        outcome("clear_vent", 8, "Clear vent", "Clear exhaust restriction and verify airflow."),
        outcome("replace_lv_motor", 9, "Replace blower motor", "Replace long-vent blower motor."),
        outcome("vent_verified", 10, "Vent path OK", "Vent, drum speed, and exhaust within acceptable limits."),
    ],
)

PROCEDURES = [
    NO_HEAT_ELECTRIC,
    HEATER_THERMOSTATS_ELECTRIC,
    NO_HEAT_GAS,
    NO_TUMBLE,
    TIMER_NOT_ADVANCING,
    VENT_RESTRICTION,
]

PROCEDURE_FILES = [
    "gegud27-no-heat-electric.json",
    "gegud27-heater-thermostats-electric.json",
    "gegud27-no-heat-gas.json",
    "gegud27-no-tumble.json",
    "gegud27-timer-not-advancing.json",
    "gegud27-vent-restriction.json",
]


def write_catalog() -> None:
    catalog = {
        "manualId": "GE-GUD27-STACKED",
        "platformId": PLATFORM,
        "templateId": "stacked_laundry",
        "label": "GE GUD27 unitized stacked laundry — dryer section (mechanical timer)",
        "notes": (
            "Dryer portion only. GUD27ESS/XUD27ESS = electric heat; GUD27GSS/XUD27GSS = gas. "
            "No display error codes — symptom/chip routing. Washer section not in v1 scope."
        ),
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
                "relatedCodes": [tag for tag in item.get("tags", []) if tag.startswith("F")],
            }
            for item in PROCEDURES
        ],
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name}")


def write_readme() -> None:
    readme = """# GE GUD27 stacked laundry — dryer procedures

**Platform:** `ge_gud27_stacked`  
**Template:** `stacked_laundry`  
**Manual:** GE-GUD27-STACKED (`gud27essmww.pdf`)

Mechanical timer dryer section only. No F-codes — route by complaint chips.

| Procedure | Symptom tags |
|-----------|--------------|
| `gegud27-no-heat-electric` | no_heat, dryer_no_heat |
| `gegud27-heater-thermostats-electric` | heating_element_check |
| `gegud27-no-heat-gas` | no_heat, ignition_issue |
| `gegud27-no-tumble` | dryer_no_tumble, motor_check |
| `gegud27-timer-not-advancing` | timer_not_advancing, unitized_timer |
| `gegud27-vent-restriction` | dryer_not_drying, long_dry |

**Pipeline:** `python backend/scripts/generate_ge_gud27_stacked_procedure_seeds.py`
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")
    print("Wrote README.md")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        path = OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")

    write_catalog()
    write_readme()

    effects_script = ROOT / "backend" / "scripts" / "attach_ge_gud27_stacked_diagnostic_effects.py"
    if effects_script.exists():
        subprocess.run([sys.executable, str(effects_script)], check=True, cwd=ROOT)

    registry_script = ROOT / "backend" / "scripts" / "generate_procedure_registry.py"
    subprocess.run([sys.executable, str(registry_script)], check=True, cwd=ROOT)

    validate_script = ROOT / "backend" / "scripts" / "validate_procedure_seed.py"
    subprocess.run([sys.executable, str(validate_script)], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
