#!/usr/bin/env python3
"""Generate Samsung FL BB8700 dryer (DVE/DVG 53/50BB) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_fl_dryer_bb8700"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-FL-BB8700-DRYER",
    "manualTitle": "Samsung Front-Load Dryer BB8700 / DV8700B Family",
    "extractedTextFile": "backend/docs/manuals/samsung fl dryer new style dv53bb8700-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dryer or disconnect power before servicing. Control board and inlet valve are not grounded during service.",
    "sourceExcerpt": "Execute service after unplugging the power supply unit.",
    "requiresInput": False,
}

ELECTRIC_ONLY = ["electric_dryer"]
GAS_ONLY = ["gas_dryer"]


def proc(pid, title, oem_num, oem_title, pages, component_ids, tags, steps, template_ids=None):
    if not steps:
        raise ValueError(f"{pid} must define steps")
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    result = {
        "id": pid,
        "version": "1.0.0",
        "title": title,
        "platformId": "samsung_fl_dryer_bb8700",
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
    step = {"id": sid, "order": order, "type": "instruction", "title": title, "body": body, "sourceExcerpt": excerpt or body, "requiresInput": False}
    if nxt:
        step["defaultNextStepId"] = nxt
    return step


def visual(sid, order, title, body, branches, excerpt=""):
    return {"id": sid, "order": order, "type": "visual_check", "title": title, "body": body, "sourceExcerpt": excerpt or body, "requiresInput": True, "branches": branches}


def outcome(sid, order, title, text):
    return {"id": sid, "order": order, "type": "outcome", "title": title, "oemOutcome": text, "requiresInput": False}


def ohm_branches(prefix, pass_next, fail_next, pass_label="In spec"):
    return [
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
        {"id": f"{prefix}_open", "label": "Open", "when": {"kind": "measurement_open"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_warn", "label": "Borderline", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_crit", "label": "Out of spec", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next, "terminal": True},
    ]


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


PROCEDURES = [
    proc(
        "samsungbb8700-dryer-thermistor",
        "§4-1: Thermistors (tC, tC5, HC)",
        "4-1",
        "Thermistor faults",
        [35, 40],
        ["exhaust_thermistor", "inlet_thermistor"],
        ["tC", "tC5", "HC", "thermistor_check", "no_heat"],
        [
            instr("vent_precheck", 2, "Vent and lint screen", "Clean lint screen. Verify vent not restricted — tC/tC5 often vent-related.", "thermistor_bench"),
            instr("thermistor_bench", 3, "Measure thermistor resistance", "Disconnect power. Measure thermistor1 and thermistor2 per §4-6 — compare both; manual directs resistance check when code present.", "thermistor_compare"),
            visual("thermistor_compare", 4, "Thermistor readings plausible?", "Both thermistors show similar reasonable resistance (not open/shorted vs each other)?", cp_yes_no("th_ok", "thermistor_verified", "replace_thermistor", "replace_thermistor_out", "Replace out-of-range thermistor; recheck vent.")),
            outcome("replace_thermistor_out", 5, "Replace thermistor", "Replace faulty thermistor and verify vent path."),
            outcome("thermistor_verified", 6, "Thermistors OK", "Thermistors in range — suspect PCB if tC/HC persists."),
        ],
    ),
    proc(
        "samsungbb8700-dryer-door-switch",
        "§4-1 / §4-6: Door switch (dC, dF)",
        "4-6",
        "Door switch",
        [35, 40],
        ["door_switch"],
        ["dC", "dF", "door_switch_check"],
        [
            visual("door_closed", 2, "Door fully closed", "Close door firmly. Check door sensor unit not loose.", cp_yes_no("door_ok", "door_switch_bench", "secure_door", "secure_door_out", "Secure door sensor harness and latch.")),
            instr("door_switch_bench", 3, "Door switch continuity", "Disconnect power. Door switch 125 V 10 A — measure OFF: open circuit; ON (door closed): closed circuit per §4-6.", "door_switch_test"),
            visual("door_switch_test", 4, "Switch toggles correctly?", "Resistance/continuity changes when door latched vs open?", cp_yes_no("sw_ok", "door_verified", "replace_door_switch", "replace_door_switch_out", "Replace door switch assembly.")),
            outcome("secure_door_out", 5, "Secure door assembly", "Tighten door sensor and verify latch."),
            outcome("replace_door_switch_out", 6, "Replace door switch", "Replace door switch when incorrect state (dF)."),
            outcome("door_verified", 7, "Door switch OK", "Door switch operates correctly."),
        ],
    ),
    proc(
        "samsungbb8700-dryer-heater-electric",
        "§4-6: Electric heater (5300 W)",
        "4-6",
        "Heater element",
        [40, 41],
        ["heating_element"],
        ["no_heat", "HC", "heating_element_check"],
        [
            instr("heater_access", 2, "Access heater terminals", "Disconnect power. Access single 240 V 5300 W element per §4-6.", "heater_ohms"),
            meas("heater_ohms", 3, "Heater resistance", "Expected ~10.9 Ω (V²/P for 5300 W @ 240 V).", "samsungFlBb8700DryerHeaterOhms", "Heater", "Element terminals", ohm_branches("he", "heater_verified", "replace_heater", "~11 Ω")),
            outcome("replace_heater", 4, "Replace heater", "Replace open or out-of-range heating element."),
            outcome("heater_verified", 5, "Heater OK", "Element in spec — check thermal cutoff chain and thermistors."),
        ],
        template_ids=ELECTRIC_ONLY,
    ),
    proc(
        "samsungbb8700-dryer-thermal-cutoff",
        "§4-6: Thermal cutoff and hi-limit",
        "4-6",
        "Thermal cut-off / hi-limit",
        [40, 42],
        ["thermal_fuse", "high_limit_thermostat"],
        ["no_heat", "thermal_fuse_check"],
        [
            instr("thermal_access", 2, "Access thermal chain", "Disconnect power. Locate thermal cut-off, regulating thermostat, and hi-limit 60T21 in heat path.", "hi_limit_ohms"),
            meas("hi_limit_ohms", 3, "Hi-limit 60T21", "Resistance < 1 Ω when closed (room temp).", "samsungFlBb8700DryerHiLimitOhms", "60T21", "Terminals", ohm_branches("hl", "thermal_verified", "replace_hi_limit", "< 1 Ω closed")),
            visual("thermal_verified", 4, "Thermal cut-off continuity", "Thermal cut-off and cycling thermostat show continuity at room temp?", cp_yes_no("tc_ok", "thermal_ok", "replace_cutoff", "replace_cutoff_out", "Replace open thermal cut-off or thermostat.")),
            outcome("replace_hi_limit", 5, "Replace hi-limit", "Replace 60T21 hi-limit thermostat."),
            outcome("replace_cutoff_out", 6, "Replace thermal cutoff", "Replace thermal cut-off / thermostat in heat path."),
            outcome("thermal_ok", 7, "Thermal chain OK", "Thermal devices closed — element/gas path next."),
        ],
    ),
    proc(
        "samsungbb8700-dryer-motor-circuit",
        "§4-6: Motor centrifugal switch",
        "4-6",
        "Drive motor",
        [41],
        ["drive_motor"],
        ["motor_check"],
        [
            instr("motor_centrifugal", 2, "Centrifugal switch table", "Motor centrifugal switch: verify contact states Start vs Run for contacts 1M–6M per §4-6 table.", "motor_run_test"),
            visual("motor_run_test", 3, "Motor runs and drum turns", "Restore power (belt on). Motor starts and drum rotates freely?", cp_yes_no("motor_ok", "motor_verified", "replace_motor", "replace_motor_out", "Replace motor or repair centrifugal switch.")),
            outcome("replace_motor_out", 4, "Replace motor", "Replace motor assembly when windings or centrifugal switch fail."),
            outcome("motor_verified", 5, "Motor OK", "Motor and centrifugal logic verified."),
        ],
    ),
    proc(
        "samsungbb8700-dryer-belt-cutoff",
        "§4-6: Belt cut-off switch",
        "4-6",
        "Belt safety switch",
        [41],
        ["belt_switch"],
        ["motor_check"],
        [
            visual("belt_intact", 2, "Belt installed", "Verify belt on drum and motor pulley.", cp_yes_no("belt_ok", "belt_switch_test", "install_belt", "install_belt_out", "Install or replace drive belt.")),
            visual("belt_switch_test", 3, "Belt switch states", "Belt switch: open when belt off, closed when belt on (125 V 16 A).", cp_yes_no("bso_ok", "belt_verified", "replace_belt_switch", "replace_belt_switch_out", "Replace belt cut-off switch.")),
            outcome("install_belt_out", 4, "Service belt", "Reinstall or replace belt."),
            outcome("replace_belt_switch_out", 5, "Replace belt switch", "Replace belt cut-off switch."),
            outcome("belt_verified", 6, "Belt safety OK", "Belt and switch verified."),
        ],
    ),
    proc(
        "samsungbb8700-dryer-hmi",
        "§4-1: Display / buttons (bC2)",
        "4-1",
        "Button state bC2",
        [35],
        ["user_interface"],
        ["bC2", "hmi_check"],
        [
            visual("display_loose", 2, "Display PCB harness", "Check display PCB connector seated — no loose or shorted buttons.", cp_yes_no("hmi_ok", "hmi_verified", "replace_display", "replace_display_out", "Replace display PCB or harness.")),
            outcome("replace_display_out", 3, "Replace display PCB", "Replace display PCB when bC2 persists."),
            outcome("hmi_verified", 4, "HMI OK", "Display and buttons operate normally."),
        ],
    ),
    proc(
        "samsungbb8700-dryer-power",
        "§4-1: Power and communication (9C1, FC, AC)",
        "4-1",
        "Power / PCB",
        [35],
        ["supply", "main_control"],
        ["9C1", "FC", "AC", "no_power"],
        [
            visual("outlet_check", 2, "Outlet and voltage", "Verify proper 120/240 V supply and frequency. Dedicated circuit.", cp_yes_no("supply_ok", "harness_pcb", "fix_supply", "fix_supply_out", "Correct electrical supply and outlet.")),
            instr("harness_pcb", 3, "PCB and harness", "Inspect PCB wire harness connections. AC invalid communication — check harness first.", "power_verified"),
            visual("power_verified", 4, "Fault cleared?", "After harness repair and power cycle, do 9C1/FC/AC codes clear?", cp_yes_no("pwr_ok", "power_ok", "replace_pcb", "replace_pcb_out", "Replace main PCB.")),
            outcome("fix_supply_out", 5, "Fix supply", "Correct installation voltage and frequency."),
            outcome("replace_pcb_out", 6, "Replace PCB", "Replace main control PCB."),
            outcome("power_ok", 7, "Power path OK", "Supply and PCB communication verified."),
        ],
    ),
    proc(
        "samsungbb8700-dryer-gas-valve",
        "§4-6: Gas valve coils (25M01A)",
        "4-6",
        "Gas valve",
        [42],
        ["gas_valve"],
        ["gas_valve_check", "no_heat"],
        [
            instr("valve_access", 2, "Gas valve coils", "Disconnect power. Measure valve coil pairs at 25M01A harness.", "valve_12"),
            meas("valve_12", 3, "Valve 1–2", "~1365 Ω", "samsungFlBb8700DryerGasValve12Ohms", "Valve", "1-2", ohm_branches("v12", "valve_13", "replace_valve", "~1365 Ω")),
            meas("valve_13", 4, "Valve 1–3", "~560 Ω", "samsungFlBb8700DryerGasValve13Ohms", "Valve", "1-3", ohm_branches("v13", "valve_45", "replace_valve", "~560 Ω")),
            meas("valve_45", 5, "Valve 4–5", "~1325 Ω", "samsungFlBb8700DryerGasValve45Ohms", "Valve", "4-5", ohm_branches("v45", "valve_67", "replace_valve", "~1325 Ω")),
            meas("valve_67", 6, "Valve 6–7", "~1000 Ω", "samsungFlBb8700DryerGasValve67Ohms", "Valve", "6-7", ohm_branches("v67", "valve_verified", "replace_valve", "~1000 Ω")),
            outcome("replace_valve", 7, "Replace gas valve", "Replace gas valve when any coil open or out of range."),
            outcome("valve_verified", 8, "Gas valve OK", "All coil pairs in spec."),
        ],
        template_ids=GAS_ONLY,
    ),
    proc(
        "samsungbb8700-dryer-gas-ignitor",
        "§4-6: Gas igniter (101D)",
        "4-6",
        "Igniter",
        [42],
        ["igniter"],
        ["igniter_check", "no_heat", "ignition_issue"],
        [
            instr("ignitor_access", 2, "Igniter 101D", "Disconnect power. Do not touch igniter element.", "ignitor_ohms"),
            meas("ignitor_ohms", 3, "Igniter resistance", "Expected 40–120 Ω.", "samsungFlBb8700DryerIgnitorOhms", "Igniter 101D", "Terminals", ohm_branches("ign", "ignitor_verified", "replace_ignitor", "40–120 Ω")),
            outcome("replace_ignitor", 4, "Replace igniter", "Replace open or out-of-range igniter."),
            outcome("ignitor_verified", 5, "Igniter OK", "Igniter in spec — verify gas supply and valve coils."),
        ],
        template_ids=GAS_ONLY,
    ),
    proc(
        "samsungbb8700-dryer-gas-flame-sensor",
        "§4-6: Radiant flame sensor (10RS)",
        "4-6",
        "Flame sensor",
        [41, 42],
        ["flame_sensor"],
        ["ignition_issue"],
        [
            instr("flame_sensor_access", 2, "Radiant sensor 10RS", "120 V radiant sensor — verify harness and sensor seated at burner.", "flame_sensor_check"),
            visual("flame_sensor_check", 3, "Flame sense during heat", "During timed dry heat, does flame stay lit >20 min without HE/HC? Check terminal wiring if HC.", cp_yes_no("flame_ok", "flame_verified", "replace_flame_sensor", "replace_flame_sensor_out", "Replace radiant flame sensor or repair harness.")),
            outcome("replace_flame_sensor_out", 4, "Replace flame sensor", "Replace 10RS radiant sensor."),
            outcome("flame_verified", 5, "Flame sense OK", "Ignition and flame sense verified."),
        ],
        template_ids=GAS_ONLY,
    ),
]


def smart_install_bundle() -> dict:
    return {
        "id": "samsungbb8700-dryer-smart-install-entry",
        "version": "1.0.0",
        "platformId": "samsung_fl_dryer_bb8700",
        "manualId": SOURCE["manualId"],
        "title": "Samsung BB8700 dryer — Smart Install entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Temp + Option 7 s → AS; touch sensor and vent blockage tests.",
        "tags": ["service_diagnostic", "smart_install"],
        "entryStepId": "dsi_prep",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [37]},
        "steps": [
            instr("dsi_prep", 1, "Empty drum", "Power on dryer. Drum empty.", "dsi_enter"),
            instr("dsi_enter", 2, "Enter Smart Install", "Press and hold Temp + Option for 7 seconds until AS displays.", "@continue"),
        ],
    }


def error_recall_bundle() -> dict:
    return {
        "id": "samsungbb8700-dryer-error-recall",
        "version": "1.0.0",
        "platformId": "samsung_fl_dryer_bb8700",
        "manualId": SOURCE["manualId"],
        "title": "Samsung BB8700 dryer — Error Recall",
        "modeKind": "fault_codes",
        "uiVariants": ["any"],
        "description": "Display last detected error on Dryness + Temp models.",
        "tags": ["fault_codes", "error_code"],
        "entryStepId": "er_entry",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [35]},
        "steps": [
            instr("er_entry", 1, "Error Recall mode", "Enter Error Recall per control panel — last error code displays (DVE(G)53BB89/8700*, DVE(G)46BB6700*). Nothing shown if no error stored.", "@continue"),
        ],
    }


BUNDLES = [smart_install_bundle(), error_recall_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "samsung_fl_dryer_bb8700",
        "templateId": "electric_dryer",
        "label": "Samsung FL dryer BB8700 (DVE/DVG 53/50BB)",
        "notes": "Electric + gas via templateIds. Smart Install §4-3, components §4-6.",
        "plannedProcedures": [{"id": p["id"], "oemSection": p["source"]["oemTestNumber"], "title": p["title"], "status": "generated", "templateIds": p.get("templateIds")} for p in PROCEDURES],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


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
    for script in (
        "attach_samsung_fl_bb8700_dryer_diagnostic_effects.py",
        "attach_samsung_fl_bb8700_dryer_service_modes.py",
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
