#!/usr/bin/env python3
"""Generate Samsung TL CG71 dryer dryer (DVE50R / DVG50R) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_tl_dryer_cg71"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-TL-CG71-DRYER",
    "manualTitle": "Samsung Top-Load / Vented Dryer CG71 Family (DVE55CG71, DVG55CG71)",
    "extractedTextFile": "backend/docs/manuals/samsung tl dryer new style-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dryer or disconnect power before servicing. Touch power cord plug to discharge static before PCB work.",
    "sourceExcerpt": "Before commencing with tests the appliance must be disconnected from the supply.",
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
        "platformId": "samsung_tl_dryer_cg71",
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
        "samsungtlcg71d-thermistor",
        "§4-1 / §4-4: Thermistors (tC, tC5, HC)",
        "4-4",
        "Thermistor faults",
        [19, 25],
        ["exhaust_thermistor", "inlet_thermistor"],
        ["tC", "tC5", "HC", "thermistor_check", "no_heat"],
        [
            instr("vent_precheck", 2, "Vent and lint screen", "Clean lint screen. Verify vent not restricted — tC/tC5 often vent-related.", "thermistor_ohms"),
            meas("thermistor_ohms", 3, "Thermistor resistance", "Measure thermistor — 10 kΩ @ 25°C per §4-4.", "samsungTlDv50DryerThermistor10KOhms", "Thermistor", "Connector", ohm_branches("th", "thermistor_verified", "replace_thermistor", "~10 kΩ @ 25°C")),
            outcome("replace_thermistor", 4, "Replace thermistor", "Replace out-of-range thermistor; recheck vent."),
            outcome("thermistor_verified", 5, "Thermistors OK", "Thermistors in range — suspect PCB if tC/HC persists."),
        ],
    ),
    proc(
        "samsungtlcg71d-door-switch",
        "§4-1 / §4-4: Door switch (dC, dF)",
        "4-4",
        "Door switch",
        [19, 25],
        ["door_switch"],
        ["dC", "dF", "door_switch_check"],
        [
            visual("door_closed", 2, "Door fully closed", "Close door firmly. Check door sensor unit not loose.", cp_yes_no("door_ok", "door_switch_test", "secure_door", "secure_door_out", "Secure door sensor harness and latch.")),
            visual("door_switch_test", 3, "Door switch states", "OFF: COM–NC (1–3) < 1 Ω, COM–NO open. ON: COM–NO < 1 Ω, COM–NC open.", cp_yes_no("sw_ok", "door_verified", "replace_door_switch", "replace_door_switch_out", "Replace door switch assembly.")),
            outcome("secure_door_out", 4, "Secure door assembly", "Tighten door sensor and verify latch."),
            outcome("replace_door_switch_out", 5, "Replace door switch", "Replace door switch when incorrect state (dF)."),
            outcome("door_verified", 6, "Door switch OK", "Door switch operates correctly."),
        ],
    ),
    proc(
        "samsungtlcg71d-heater-electric",
        "§4-4: Electric heater",
        "4-4",
        "Heater element",
        [25, 26],
        ["heating_element"],
        ["no_heat", "HC", "heating_element_check"],
        [
            visual("heater_type", 2, "Single vs dual element", "Identify heater: SINGLE 5300 W pin 1–3 ~10 Ω; DUAL 3700/1500 W pin 2–3 ~13 Ω and pin 1–2 ~34 Ω.", [
                {"id": "single", "label": "Single element", "when": {"kind": "checkpoint_yes"}, "nextStepId": "heater_single_ohms"},
                {"id": "dual", "label": "Dual element", "when": {"kind": "checkpoint_no"}, "nextStepId": "heater_dual_low"},
            ]),
            meas("heater_single_ohms", 3, "Single element (pin 1–3)", "Expected ~10 Ω.", "samsungTlDv50DryerHeaterSingleOhms", "Heater", "1-3", ohm_branches("hs", "heater_verified", "replace_heater", "~10 Ω")),
            meas("heater_dual_low", 3, "Dual element low (pin 2–3)", "Expected ~13 Ω.", "samsungTlDv50DryerHeaterDualLowOhms", "Heater", "2-3", ohm_branches("hdl", "heater_dual_high", "replace_heater", "~13 Ω")),
            meas("heater_dual_high", 4, "Dual element high (pin 1–2)", "Expected ~34 Ω.", "samsungTlDv50DryerHeaterDualHighOhms", "Heater", "1-2", ohm_branches("hdh", "heater_verified", "replace_heater", "~34 Ω")),
            outcome("replace_heater", 5, "Replace heater", "Replace open or out-of-range heating element."),
            outcome("heater_verified", 6, "Heater OK", "Element in spec — check thermal cutoff chain and thermistors."),
        ],
        template_ids=ELECTRIC_ONLY,
    ),
    proc(
        "samsungtlcg71d-thermal-cutoff",
        "§4-4: Thermal cutoff and hi-limit",
        "4-4",
        "Thermal cut-off / hi-limit",
        [25, 26],
        ["thermal_fuse", "high_limit_thermostat"],
        ["no_heat", "thermal_fuse_check"],
        [
            instr("thermal_access", 2, "Access thermal chain", "Locate thermostat 1, thermal cut-off, thermostat 2/3, and hi-limit in heat path.", "thermal_check"),
            visual("thermal_check", 3, "Thermal devices continuity", "Thermostat 1/2/3 and hi-limit — resistance < 1 Ω at room temp when closed.", cp_yes_no("tc_ok", "thermal_ok", "replace_cutoff", "replace_cutoff_out", "Replace open thermal cut-off or thermostat.")),
            outcome("replace_cutoff_out", 4, "Replace thermal cutoff", "Replace thermal cut-off / thermostat in heat path."),
            outcome("thermal_ok", 5, "Thermal chain OK", "Thermal devices closed — element/gas path next."),
        ],
    ),
    proc(
        "samsungtlcg71d-motor-circuit",
        "§4-4: Motor windings and centrifugal switch",
        "4-4",
        "Drive motor",
        [26],
        ["drive_motor"],
        ["motor_check"],
        [
            meas("motor_34", 2, "Motor winding pin 3–4", "Expected 2.88 Ω.", "samsungTlDv50DryerMotorWinding34Ohms", "Motor", "3-4", ohm_branches("m34", "motor_45", "replace_motor", "2.88 Ω")),
            meas("motor_45", 3, "Motor winding pin 4–5", "Expected 3.5 Ω.", "samsungTlDv50DryerMotorWinding45Ohms", "Motor", "4-5", ohm_branches("m45", "motor_run_test", "replace_motor", "3.5 Ω")),
            visual("motor_run_test", 4, "Motor runs", "Restore power with belt on. Motor starts and drum rotates?", cp_yes_no("motor_ok", "motor_verified", "replace_motor_out", "replace_motor_out", "Replace motor assembly.")),
            outcome("replace_motor", 5, "Replace motor", "Replace motor when windings open or out of range."),
            outcome("replace_motor_out", 6, "Replace motor", "Replace motor assembly when run test fails."),
            outcome("motor_verified", 7, "Motor OK", "Motor windings and run verified."),
        ],
    ),
    proc(
        "samsungtlcg71d-belt-cutoff",
        "§4-4: Belt cut-off switch",
        "4-4",
        "Belt safety switch",
        [26],
        ["belt_switch"],
        ["motor_check"],
        [
            visual("belt_intact", 2, "Belt installed", "Verify belt on drum and motor pulley.", cp_yes_no("belt_ok", "belt_switch_test", "install_belt", "install_belt_out", "Install or replace drive belt.")),
            visual("belt_switch_test", 3, "Belt switch states", "Lever open < 1 Ω; lever pushed infinite (open).", cp_yes_no("bso_ok", "belt_verified", "replace_belt_switch", "replace_belt_switch_out", "Replace belt cut-off switch.")),
            outcome("install_belt_out", 4, "Service belt", "Reinstall or replace belt."),
            outcome("replace_belt_switch_out", 5, "Replace belt switch", "Replace belt cut-off switch."),
            outcome("belt_verified", 6, "Belt safety OK", "Belt and switch verified."),
        ],
    ),
    proc(
        "samsungtlcg71d-hmi",
        "§4-1: Display / buttons (bC2)",
        "4-1",
        "Button state bC2",
        [19],
        ["user_interface"],
        ["bC2", "hmi_check"],
        [
            visual("display_loose", 2, "Display PCB harness", "Check display PCB connector seated — no loose or shorted buttons. Rule out Child Lock.", cp_yes_no("hmi_ok", "hmi_verified", "replace_display", "replace_display_out", "Replace display PCB or harness.")),
            outcome("replace_display_out", 3, "Replace display PCB", "Replace display PCB when bC2 persists."),
            outcome("hmi_verified", 4, "HMI OK", "Display and buttons operate normally."),
        ],
    ),
    proc(
        "samsungtlcg71d-power",
        "§4-1: Power and communication (9C1, FC, AC)",
        "4-1",
        "Power / PCB",
        [19],
        ["supply", "main_control"],
        ["9C1", "FC", "AC", "no_power"],
        [
            visual("outlet_check", 2, "Outlet and voltage", "Verify proper supply voltage and frequency. Dedicated circuit.", cp_yes_no("supply_ok", "harness_pcb", "fix_supply", "fix_supply_out", "Correct electrical supply.")),
            instr("harness_pcb", 3, "PCB and harness", "Inspect PCB wire harness. AC invalid communication — check harness first.", "power_verified"),
            visual("power_verified", 4, "Fault cleared?", "After harness repair and power cycle, do 9C1/FC/AC codes clear?", cp_yes_no("pwr_ok", "power_ok", "replace_pcb", "replace_pcb_out", "Replace main PCB.")),
            outcome("fix_supply_out", 5, "Fix supply", "Correct installation voltage and frequency."),
            outcome("replace_pcb_out", 6, "Replace PCB", "Replace main control PCB."),
            outcome("power_ok", 7, "Power path OK", "Supply and PCB communication verified."),
        ],
    ),
    proc(
        "samsungtlcg71d-gas-valve",
        "§4-4: Gas valve coils (25M01A)",
        "4-4",
        "Gas valve",
        [27],
        ["gas_valve"],
        ["gas_valve_check", "no_heat"],
        [
            instr("valve_access", 2, "Gas valve coils", "Shut off gas. Disconnect power. Measure valve coil pairs at 25M01A harness.", "valve_12"),
            meas("valve_12", 3, "Valve 1–2", "~1365 Ω", "samsungTlDv50DryerGasValve12Ohms", "Valve", "1-2", ohm_branches("v12", "valve_13", "replace_valve", "~1365 Ω")),
            meas("valve_13", 4, "Valve 1–3", "~560 Ω", "samsungTlDv50DryerGasValve13Ohms", "Valve", "1-3", ohm_branches("v13", "valve_45", "replace_valve", "~560 Ω")),
            meas("valve_45", 5, "Valve 4–5", "~1325 Ω", "samsungTlDv50DryerGasValve45Ohms", "Valve", "4-5", ohm_branches("v45", "valve_67", "replace_valve", "~1325 Ω")),
            meas("valve_67", 6, "Valve 6–7", "~1000 Ω", "samsungTlDv50DryerGasValve67Ohms", "Valve", "6-7", ohm_branches("v67", "valve_verified", "replace_valve", "~1000 Ω")),
            outcome("replace_valve", 7, "Replace gas valve", "Replace gas valve when any coil open or out of range."),
            outcome("valve_verified", 8, "Gas valve OK", "All coil pairs in spec."),
        ],
        template_ids=GAS_ONLY,
    ),
    proc(
        "samsungtlcg71d-gas-ignitor",
        "§4-4: Gas igniter (101D)",
        "4-4",
        "Igniter",
        [27],
        ["igniter"],
        ["igniter_check", "no_heat", "ignition_issue"],
        [
            instr("ignitor_access", 2, "Igniter 101D", "Disconnect power. Do not touch igniter element.", "ignitor_ohms"),
            meas("ignitor_ohms", 3, "Igniter resistance", "Expected 40–400 Ω.", "samsungTlDv50DryerIgnitorOhms", "Igniter 101D", "Terminals", ohm_branches("ign", "ignitor_verified", "replace_ignitor", "40–400 Ω")),
            outcome("replace_ignitor", 4, "Replace igniter", "Replace open or out-of-range igniter."),
            outcome("ignitor_verified", 5, "Ignitor OK", "Igniter in spec — verify gas supply and valve coils."),
        ],
        template_ids=GAS_ONLY,
    ),
    proc(
        "samsungtlcg71d-gas-flame-sensor",
        "§4-4: Radiant flame sensor (10RS)",
        "4-4",
        "Flame sensor",
        [26, 27],
        ["flame_sensor"],
        ["ignition_issue", "flame_sensor_check"],
        [
            instr("flame_sensor_access", 2, "Radiant sensor 10RS", "120 V radiant sensor — verify harness seated. Resistance < 1 Ω when flame present.", "flame_sensor_ohms"),
            meas("flame_sensor_ohms", 3, "Flame sensor resistance", "At sensor — < 1 Ω when flame present; replace if infinite.", "samsungTlDv50DryerFlameSensorOhms", "10RS", "Terminals", ohm_branches("fs", "flame_verified", "replace_flame_sensor", "< 1 Ω with flame")),
            outcome("replace_flame_sensor", 4, "Replace flame sensor", "Replace 10RS radiant sensor."),
            outcome("flame_verified", 5, "Flame sense OK", "Ignition and flame sense verified."),
        ],
        template_ids=GAS_ONLY,
    ),
]


def smart_install_bundle() -> dict:
    return {
        "id": "samsungtlcg71d-smart-install-entry",
        "version": "1.0.0",
        "platformId": "samsung_tl_dryer_cg71",
        "manualId": SOURCE["manualId"],
        "title": "Samsung TL CG71 dryer — Smart Install entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Adjust Time Up + Temp 7 s → SC; touch sensor and motor/heater diagnosis.",
        "tags": ["service_diagnostic", "smart_install"],
        "entryStepId": "dsi_prep",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [22]},
        "steps": [
            instr("dsi_prep", 1, "Power on — empty drum", "Dryer powered on. Drum empty.", "dsi_enter"),
            instr("dsi_enter", 2, "Enter Smart Install", "Press and hold Adjust Time Up + Temp for 7 seconds until SC displays.", "dsi_touch"),
            instr("dsi_touch", 3, "Touch sensor test", "Open door — 0=open, 1=short. Wet cloth on sensor shows 1.", "dsi_motor_heater"),
            instr("dsi_motor_heater", 4, "Motor and heater test", "Press Start — OK = motor and heater normal; HC = fault.", "@continue"),
        ],
    }


BUNDLES = [smart_install_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "samsung_tl_dryer_cg71",
        "templateId": "electric_dryer",
        "label": "Samsung TL dryer DV50R (DVE50R, DVG50R)",
        "notes": "Electric + gas via templateIds. Smart Install §4-2-7, components §4-4. Separate from samsung_fl_dryer_bb8700.",
        "plannedProcedures": [
            {
                "id": p["id"],
                "oemSection": p["source"]["oemTestNumber"],
                "title": p["title"],
                "status": "generated",
                "templateIds": p.get("templateIds"),
            }
            for p in PROCEDURES
        ],
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
        "attach_samsung_tl_cg71_dryer_diagnostic_effects.py",
        "attach_samsung_tl_cg71_dryer_service_modes.py",
        "attach_samsung_tl_cg71_dryer_procedure_diagrams.py",
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
