#!/usr/bin/env python3
"""Generate W8178559 (Whirlpool Duet Sport MCE dryer) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_duet_sport_dryer"

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

PROCEDURES = [MOTOR_CIRCUIT, HEATER_ELECTRIC, EXHAUST_THERMISTOR, MOISTURE_SENSOR]

PROCEDURE_FILES = [
    "w8178559-motor-circuit.json",
    "w8178559-heater-electric.json",
    "w8178559-exhaust-thermistor.json",
    "w8178559-moisture-sensor.json",
]


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

    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        path = OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")

    write_catalog()

    effects_script = ROOT / "backend" / "scripts" / "attach_w8178559_diagnostic_effects.py"
    if effects_script.exists():
        subprocess.run([sys.executable, str(effects_script)], check=True, cwd=ROOT)

    registry_script = ROOT / "backend" / "scripts" / "generate_procedure_registry.py"
    subprocess.run([sys.executable, str(registry_script)], check=True, cwd=ROOT)

    validate_script = ROOT / "backend" / "scripts" / "validate_procedure_seed.py"
    subprocess.run([sys.executable, str(validate_script)], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
