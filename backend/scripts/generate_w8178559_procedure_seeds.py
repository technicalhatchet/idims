#!/usr/bin/env python3
"""Generate W8178559 (Whirlpool Duet Sport MCE dryer) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_duet_sport_dryer"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W8178559",
    "manualTitle": "Whirlpool Duet Sport Front-Load Dryer (Job Aid L-79)",
    "extractedTextFile": "backend/docs/manuals/jobaid-8178559-l-79 whirlpool fl dryer 2013 era-extracted.txt",
    "verifiedAt": "2026-03-08",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dryer or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Electrical Shock Hazard. Disconnect power before accessing.",
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
        "platformId": "whirlpool_duet_sport_dryer",
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


def instr(sid: str, order: int, title: str, body: str, nxt: str | None = None, excerpt: str = "") -> dict:
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


def visual(sid: str, order: int, title: str, body: str, branches: list[dict], excerpt: str = "") -> dict:
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


def outcome(sid: str, order: int, title: str, text: str) -> dict:
    return {
        "id": sid,
        "order": order,
        "type": "outcome",
        "title": title,
        "oemOutcome": text,
        "requiresInput": False,
    }


def pass_fail_branches(
    pass_id: str,
    pass_next: str,
    fail_id: str,
    fail_next: str,
    fail_outcome: str,
) -> list[dict]:
    return [
        {
            "id": pass_id,
            "label": "In spec",
            "when": {"kind": "measurement_normal"},
            "nextStepId": pass_next,
        },
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
            "label": "Borderline / warning",
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


def checkpoint_yes_no(yes_id: str, yes_next: str, no_id: str, no_next: str, no_outcome: str) -> list[dict]:
    return [
        {
            "id": yes_id,
            "label": "Yes / passes",
            "when": {"kind": "checkpoint_yes"},
            "nextStepId": yes_next,
        },
        {
            "id": no_id,
            "label": "No / failed",
            "when": {"kind": "checkpoint_no"},
            "nextStepId": no_next,
            "terminal": True,
            "oemOutcome": no_outcome,
        },
    ]


MOTOR_CIRCUIT = proc(
    "w8178559-motor-circuit",
    "TEST #2: Motor Circuit",
    "2",
    "Motor Circuit Test",
    [80, 81],
    ["motor"],
    ["motor_check", "wont_spin", "F26"],
    [
        instr(
            "mce_p8_p9_precheck",
            2,
            "MCE P8-4 to P9-1 pre-check",
            "Access machine control electronics. Measure resistance across P8-4 and P9-1. If 1–6 Ω, replace MCE. Otherwise continue to belt switch and motor at component.",
            "access_motor",
        ),
        instr(
            "access_motor",
            3,
            "Access belt switch and motor",
            "Remove back panel. Release drum belt from belt switch pulley. Disconnect white connector from drive motor switch.",
            "main_winding",
        ),
        meas(
            "main_winding",
            4,
            "Main winding — pin 4 to pin 5",
            "At motor switch: measure main winding between lt. blue wire at pin 4 and bare copper at pin 5. Spec 2.4–3.6 Ω.",
            "whirlpoolDuetSportDryerMotorOhms",
            "Motor main",
            "4–5",
            pass_fail_branches(
                "main_ok",
                "start_winding",
                "main_bad",
                "replace_motor",
                "Replace drive motor — main winding out of spec.",
            ),
        ),
        meas(
            "start_winding",
            5,
            "Start winding — pin 4 to pin 3",
            "At motor switch: measure start winding between lt. blue at pin 4 and bare copper at pin 3. Spec 2.4–3.8 Ω.",
            "whirlpoolDuetSportDryerMotorOhms",
            "Motor start",
            "4–3",
            pass_fail_branches(
                "start_ok",
                "belt_switch_checkpoint",
                "start_bad",
                "replace_motor",
                "Replace drive motor — start winding out of spec.",
            ),
        ),
        visual(
            "belt_switch_checkpoint",
            6,
            "Belt switch — infinity down, few Ω up",
            "With belt off pulley, belt switch should read infinity (OL). Push pulley up — should read a few ohms. Door switch with door closed: 0–2 Ω.",
            checkpoint_yes_no(
                "belt_ok",
                "motor_verified",
                "belt_bad",
                "service_belt_switch",
                "Replace belt switch or door switch per failed check.",
            ),
        ),
        outcome("replace_motor", 7, "Replace motor", "Replace drive motor assembly."),
        outcome("service_belt_switch", 8, "Service belt/door switch", "Replace failed belt switch or door switch."),
        outcome(
            "motor_verified",
            9,
            "Motor circuit verified at component",
            "Motor windings and belt/door switches OK — inspect harness to MCE if F-26 persists.",
        ),
    ],
)

HEATER_ELECTRIC = proc(
    "w8178559-heater-electric",
    "TEST #3: Heater (electric)",
    "3",
    "Heater Test",
    [82, 83],
    ["heating_element"],
    ["heating_element_check", "no_heat", "F01"],
    [
        instr(
            "access_thermal",
            2,
            "Access thermal components",
            "Remove toe panel. Measure resistance from red wire at thermal cut-off to red wire at heater element.",
            "heater_circuit",
        ),
        meas(
            "heater_circuit",
            3,
            "Thermal cut-off to heater — ~10 Ω",
            "Red at thermal cut-off to red at heater should read about 10 Ω (7–12 Ω element path). Open — check thermal cut-off, high-limit, and element continuity.",
            "whirlpoolDuetSportDryerHeaterOhms",
            "Heater",
            "cut-off to heater",
            pass_fail_branches(
                "heater_path_ok",
                "p14_thermistor_check",
                "heater_path_bad",
                "replace_heater_path",
                "Replace open heater, thermal cut-off, or high-limit per component test.",
            ),
        ),
        visual(
            "p14_thermistor_check",
            4,
            "P14-3 to P14-6 at MCE",
            "At MCE: measure P14-3 to P14-6. 5–15 kΩ → replace MCE. Less than 1 kΩ → replace exhaust thermistor. Greater than 20 kΩ (heat won't shut off) → replace thermistor.",
            checkpoint_yes_no(
                "p14_ok",
                "heater_verified",
                "p14_mce",
                "replace_mce",
                "Replace machine control electronics — P14 thermistor circuit indicates MCE fault.",
            ),
        ),
        outcome("replace_heater_path", 5, "Replace heater path component", "Replace failed element, thermal cut-off, or high-limit."),
        outcome("replace_mce", 6, "Replace MCE", "Replace machine control electronics."),
        outcome("heater_verified", 7, "Heater circuit verified", "Heating circuit and P14 thermistor path within spec at test points."),
    ],
)

EXHAUST_THERMISTOR = proc(
    "w8178559-exhaust-thermistor",
    "TEST #3a: Exhaust Thermistor",
    "3a",
    "Thermistor Test",
    [83, 84],
    ["exhaust_thermistor"],
    ["thermistor", "no_heat", "F22", "F23"],
    [
        instr(
            "timed_dry_fault_check",
            2,
            "Timed Dry fault check (optional)",
            "Empty dryer, clean lint screen. Start Timed Dry. If F-22 or F-23 flashes within 60 s and dryer shuts off, thermistor or harness is open/short — disconnect power before bench tests.",
            "disconnect_p14",
        ),
        instr(
            "disconnect_p14",
            3,
            "Disconnect P14 at MCE",
            "Access MCE. Disconnect P14 connector. Measure thermistor at component or through harness per wiring diagram.",
            "thermistor_ohms",
        ),
        meas(
            "thermistor_ohms",
            4,
            "Exhaust thermistor resistance",
            "Measure exhaust thermistor. ~12 kΩ @ 70°F; 9.2 kΩ @ 80°F; 19.9 kΩ @ 50°F (OEM R/T table). Open → F-22. Short → F-23.",
            "whirlpoolDuetSportDryerExhaustThermistorKohm",
            "P14 thermistor",
            "P14-3 to P14-6",
            pass_fail_branches(
                "ntc_ok",
                "thermistor_verified",
                "ntc_bad",
                "replace_thermistor",
                "Replace exhaust thermistor — out of spec or shorted.",
            ),
        ),
        outcome("replace_thermistor", 5, "Replace thermistor", "Replace exhaust thermistor."),
        outcome("thermistor_verified", 6, "Thermistor verified", "Exhaust thermistor within OEM R/T expectations."),
    ],
)

MOISTURE_SENSOR = proc(
    "w8178559-moisture-sensor",
    "TEST #4: Moisture Sensor",
    "4",
    "Moisture Sensor Test",
    [85, 86],
    ["moisture_sensor"],
    ["long_dry", "F28", "F29"],
    [
        instr(
            "diag_mode_entry",
            2,
            "Enter diagnostic test mode",
            "Activate diagnostic test mode and advance past saved fault codes. Machine fully assembled.",
            "door_short_check",
        ),
        visual(
            "door_short_check",
            3,
            "Door open short check",
            "Open dryer door. If beep + alphanumeric display immediately, short exists in moisture sensor system — inspect harness and sensor.",
            checkpoint_yes_no(
                "no_short",
                "wet_cloth_test",
                "short_found",
                "repair_short",
                "Repair short in moisture sensor harness or replace sensor/MCE as needed.",
            ),
        ),
        visual(
            "wet_cloth_test",
            4,
            "Wet cloth bridge test",
            "Bridge lint screen housing sensor strips with wet cloth. Beep + software revision on console = pass.",
            checkpoint_yes_no(
                "wet_pass",
                "moisture_verified",
                "wet_fail",
                "bench_sensor",
                "Sensor failed wet-cloth test — bench test at disconnected harness.",
            ),
        ),
        instr(
            "bench_sensor",
            5,
            "Bench moisture sensor",
            "Disconnect power. Remove toe panel, disconnect sensor from harness. Measure outermost contacts on cable with red MOVs. Replace sensor/harness if shorted.",
            "moisture_verified",
        ),
        outcome("repair_short", 6, "Repair moisture short", "Clear short or replace moisture sensor / wire harness / MCE."),
        outcome("moisture_verified", 7, "Moisture sensor verified", "Moisture sensor responds in diagnostic and bench checks."),
    ],
)

THERMAL_FUSE = proc(
    "w8178559-thermal-fuse",
    "TEST #3b: Thermal Fuse",
    "3b",
    "Thermal Fuse Test",
    [84],
    ["thermal_fuse"],
    ["no_heat", "thermal_fuse_check"],
    [
        instr(
            "access_thermal_fuse",
            2,
            "Access thermal fuse",
            "Remove toe panel. Electric: fuse in series with drive motor. Gas: fuse in series with gas valve. See Figure 11.",
            "thermal_fuse_continuity",
        ),
        visual(
            "thermal_fuse_continuity",
            3,
            "Thermal fuse continuity",
            "With ohmmeter on thermal fuse terminals: does the fuse show continuity (0 Ω)? Open circuit = failed fuse.",
            checkpoint_yes_no(
                "fuse_ok",
                "thermal_fuse_verified",
                "fuse_open",
                "replace_thermal_fuse",
                "Replace failed thermal fuse.",
            ),
        ),
        outcome("replace_thermal_fuse", 4, "Replace thermal fuse", "Replace thermal fuse."),
        outcome("thermal_fuse_verified", 5, "Thermal fuse verified", "Thermal fuse shows continuity."),
    ],
)

THERMAL_CUTOFF = proc(
    "w8178559-thermal-cutoff",
    "TEST #3c: Thermal Cut-Off",
    "3c",
    "Thermal Cut-Off Test",
    [84],
    ["thermal_cutoff"],
    ["no_heat", "heating_element_check"],
    [
        instr(
            "access_cutoff",
            2,
            "Access thermal cut-off",
            "Remove toe panel. Locate thermal cut-off per Figure 11.",
            "cutoff_continuity",
        ),
        visual(
            "cutoff_continuity",
            3,
            "Thermal cut-off continuity",
            "Does the thermal cut-off show continuity (0 Ω)? Open = replace cut-off and high-limit thermostat; check vent path and heater (electric).",
            checkpoint_yes_no(
                "cutoff_ok",
                "cutoff_verified",
                "cutoff_open",
                "replace_cutoff",
                "Replace thermal cut-off and high-limit thermostat; inspect exhaust and heater.",
            ),
        ),
        outcome(
            "replace_cutoff",
            4,
            "Replace cut-off & high-limit",
            "Replace thermal cut-off and high-limit thermostat.",
        ),
        outcome("cutoff_verified", 5, "Cut-off verified", "Thermal cut-off shows continuity."),
    ],
)

GAS_IGNITOR = proc(
    "w8178559-gas-ignitor",
    "TEST #3 (gas): Ignitor",
    "3-gas-ignitor",
    "Gas Ignitor Check",
    [82],
    ["igniter"],
    ["no_heat", "igniter_check", "ignition_issue"],
    [
        instr(
            "access_ignitor",
            2,
            "Access ignitor",
            "Remove toe panel. Disconnect ignitor connector at harness.",
            "ignitor_ohms",
        ),
        meas(
            "ignitor_ohms",
            3,
            "Ignitor resistance",
            "Measure ignitor cold resistance. Spec 50–250 Ω. Open = no glow. In spec but weak glow — check amp draw before condemning valve.",
            "whirlpoolDuetSportDryerIgnitorOhms",
            "Ignitor",
            "harness",
            pass_fail_branches(
                "ignitor_ok",
                "ignitor_verified",
                "ignitor_bad",
                "replace_ignitor",
                "Replace gas ignitor.",
            ),
        ),
        outcome("replace_ignitor", 4, "Replace ignitor", "Replace gas ignitor."),
        outcome("ignitor_verified", 5, "Ignitor verified", "Ignitor resistance within 50–250 Ω."),
    ],
)

GAS_VALVE = proc(
    "w8178559-gas-valve",
    "TEST #3d: Gas Valve Coils",
    "3d",
    "Gas Valve Test",
    [84],
    ["gas_valve"],
    ["no_heat", "gas_valve_check", "ignition_issue"],
    [
        instr(
            "access_gas_valve",
            2,
            "Access gas valve",
            "Remove toe panel. Disconnect gas valve harness. Gas supply off, power disconnected.",
            "coil_1_2",
        ),
        meas(
            "coil_1_2",
            3,
            "Coil terminals 1 to 2",
            "Measure resistance across terminals 1 and 2. Spec 1365 Ω ± 25.",
            "whirlpoolDuetSportDryerGasValveCoilOhms",
            "Gas valve",
            "1–2",
            pass_fail_branches(
                "coil12_ok",
                "coil_1_3",
                "coil12_bad",
                "replace_coils",
                "Replace gas valve coil(s) — terminals 1–2 out of spec.",
            ),
        ),
        meas(
            "coil_1_3",
            4,
            "Coil terminals 1 to 3",
            "Measure resistance across terminals 1 and 3. Spec 560 Ω ± 25.",
            "whirlpoolDuetSportDryerGasValveCoilOhms",
            "Gas valve",
            "1–3",
            pass_fail_branches(
                "coil13_ok",
                "coil_4_5",
                "coil13_bad",
                "replace_coils",
                "Replace gas valve coil(s) — terminals 1–3 out of spec.",
            ),
        ),
        meas(
            "coil_4_5",
            5,
            "Coil terminals 4 to 5",
            "Measure resistance across terminals 4 and 5. Spec 1220 Ω ± 50.",
            "whirlpoolDuetSportDryerGasValveCoilOhms",
            "Gas valve",
            "4–5",
            pass_fail_branches(
                "coil45_ok",
                "gas_valve_verified",
                "coil45_bad",
                "replace_coils",
                "Replace gas valve coil(s) — terminals 4–5 out of spec.",
            ),
        ),
        outcome("replace_coils", 6, "Replace valve coils", "Replace failed gas valve coil assembly."),
        outcome("gas_valve_verified", 7, "Gas valve coils verified", "All coil resistance readings within OEM chart."),
    ],
)


def diagnostic_entry_bundle() -> dict:
    return {
        "id": "w8178559-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_duet_sport_dryer",
        "manualId": "W8178559",
        "title": "W8178559 — Diagnostic test mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter MCE diagnostic mode, review saved/active F-xx codes, console button check (§6-1).",
        "tags": ["service_diagnostic", "fault_codes"],
        "entryStepId": "prep_standby",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [73, 74],
        },
        "steps": [
            {
                "id": "prep_standby",
                "order": 1,
                "type": "instruction",
                "title": "Standby mode",
                "body": "Dryer plugged in with all indicators off, or only Cycle Complete on.",
                "sourceExcerpt": "Be sure the dryer is in standby mode (plugged in with all indicators off).",
                "requiresInput": False,
                "defaultNextStepId": "diag_touchpad_entry",
            },
            {
                "id": "diag_touchpad_entry",
                "order": 2,
                "type": "instruction",
                "title": "Diagnostic entry — 3 sec × 3 pattern (§6-1)",
                "body": (
                    "Select any one button (except PAUSE/CANCEL) and use the same button throughout. "
                    "Press and hold 3 seconds → release 3 seconds → press and hold 3 seconds → "
                    "release 3 seconds → press and hold 3 seconds. All indicators illuminate 5 seconds "
                    "with 88 in Estimated Time Remaining. Saved codes show F-XX on display; active codes flash. "
                    "Press PAUSE/CANCEL to exit diagnostic mode."
                ),
                "sourceExcerpt": "Press/hold 3 seconds — Release 3 seconds — (repeat 3 holds).",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    MOTOR_CIRCUIT,
    HEATER_ELECTRIC,
    EXHAUST_THERMISTOR,
    MOISTURE_SENSOR,
    THERMAL_FUSE,
    THERMAL_CUTOFF,
    GAS_IGNITOR,
    GAS_VALVE,
]

PROCEDURE_FILES = [
    "w8178559-motor-circuit.json",
    "w8178559-heater-electric.json",
    "w8178559-exhaust-thermistor.json",
    "w8178559-moisture-sensor.json",
    "w8178559-thermal-fuse.json",
    "w8178559-thermal-cutoff.json",
    "w8178559-gas-ignitor.json",
    "w8178559-gas-valve.json",
]

BUNDLES = [diagnostic_entry_bundle()]
BUNDLE_FILES = ["w8178559-diagnostic-entry.json"]


def write_catalog() -> None:
    catalog = {
        "manualId": "W8178559",
        "platformId": "whirlpool_duet_sport_dryer",
        "templateId": "electric_dryer",
        "label": "Whirlpool Duet Sport MCE dryer (Job Aid 8178559)",
        "notes": "Also applies to gas_dryer template (shared platformId). Gas heater path uses TEST #3d for valve — electric heater procedure is electric-specific.",
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
                "relatedCodes": [
                    tag for tag in item.get("tags", []) if tag.startswith("F") or tag.startswith("f")
                ],
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

    effects_script = ROOT / "backend" / "scripts" / "attach_w8178559_diagnostic_effects.py"
    if effects_script.exists():
        subprocess.run([sys.executable, str(effects_script)], check=True, cwd=ROOT)

    service_modes_script = ROOT / "backend" / "scripts" / "attach_w8178559_service_modes.py"
    if service_modes_script.exists():
        subprocess.run([sys.executable, str(service_modes_script)], check=True, cwd=ROOT)

    diagrams_script = ROOT / "backend" / "scripts" / "attach_w8178559_procedure_diagrams.py"
    if diagrams_script.exists():
        subprocess.run([sys.executable, str(diagrams_script)], check=True, cwd=ROOT)

    registry_script = ROOT / "backend" / "scripts" / "generate_procedure_registry.py"
    subprocess.run([sys.executable, str(registry_script)], check=True, cwd=ROOT)

    validate_script = ROOT / "backend" / "scripts" / "validate_procedure_seed.py"
    subprocess.run([sys.executable, str(validate_script)], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
