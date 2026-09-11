#!/usr/bin/env python3
"""Generate W11187658 (Whirlpool ADA built-in dishwasher) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_dishwasher_ada"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W11187658",
    "manualTitle": "Whirlpool 18\" & 24\" ADA Built-In Dishwasher Service Manual",
    "extractedTextFile": "backend/docs/manuals/Whirlpool Dishwasher Service Manual-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dishwasher or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Unplug dishwasher or disconnect power.",
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
        "platformId": "whirlpool_dishwasher_ada",
        "componentIds": component_ids,
        "tags": tags,
        "source": {**SOURCE, "oemTestNumber": oem_num, "oemTestTitle": oem_title, "pages": pages},
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }


def instr(sid: str, order: int, title: str, body: str, nxt: str, excerpt: str = "") -> dict:
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


def yes_no(pass_id: str, fail_id: str, *, yes_label: str = "Yes / OK", no_label: str = "No / failed") -> list[dict]:
    return [
        {"id": f"{pass_id}_yes", "label": yes_label, "when": {"kind": "checkpoint_yes"}, "nextStepId": pass_id},
        {"id": f"{pass_id}_no", "label": no_label, "when": {"kind": "checkpoint_no"}, "nextStepId": fail_id},
    ]


def pass_fail_branches(pass_id: str, fail_id: str, *, pass_label: str = "Within spec", fail_label: str = "Out of spec / open") -> list[dict]:
    return [
        {"id": f"{pass_id}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_id},
        {
            "id": f"{pass_id}_warn",
            "label": "Borderline",
            "when": {"kind": "measurement_warning"},
            "nextStepId": fail_id,
            "terminal": True,
            "oemOutcome": fail_label,
        },
        {
            "id": f"{pass_id}_crit",
            "label": fail_label,
            "when": {"kind": "measurement_critical"},
            "nextStepId": fail_id,
            "terminal": True,
            "oemOutcome": fail_label,
        },
        {
            "id": f"{pass_id}_open",
            "label": "Open (OL)",
            "when": {"kind": "measurement_open"},
            "nextStepId": fail_id,
            "terminal": True,
            "oemOutcome": fail_label,
        },
    ]


INLET_FILL = proc(
    "w11187658-inlet-fill",
    "E1 — Water inlet failure (4 min fill)",
    "E1",
    "Water inlet failure",
    [18, 32, 38],
    ["inlet_valve"],
    ["E1", "fill_issue", "error_code", "water_valve_check"],
    [
        instr(
            "e1_symptom",
            2,
            "E1 behavior",
            "E1 displays when the flow meter cannot detect a correct fill after 4 minutes during the inlet step. "
            "Quick indicator flashes (SSD) or E1 on seven-segment display.",
            "supply_checks",
            excerpt="IF THE FLOW METER CAN'T DETECT A CORRECT FILL AFTER 4 MINUTES, E1 WILL BE DISPLAYED.",
        ),
        visual(
            "supply_checks",
            3,
            "Water supply and installation",
            "Verify supply valve on, 20–100 psi pressure, inlet screen clean, drain hose not siphoning, and dishwasher level.",
            yes_no("supply_ok", "fix_supply", yes_label="Supply OK", no_label="Supply issue found"),
            excerpt="1. CHECK THE WATER SUPPLY.",
        ),
        instr(
            "supply_ok",
            4,
            "Fill circuit inspection",
            "Power off. Access kick panel and control board cover. Inspect CN5 inlet harness, CN4 flow meter, "
            "pressure switch hose to sump, and drain path. Run fill-valve ohms (w11187658-fill-valve) and drain pump test if needed.",
            "pressure_switch_check",
        ),
        visual(
            "pressure_switch_check",
            5,
            "Pressure switch hose",
            "Pressure switch hose runs from switch on base bracket to sump. Hose kinked, disconnected, blocked, or leaking?",
            yes_no("pressure_hose_ok", "repair_pressure_hose", yes_label="Hose OK", no_label="Hose fault"),
            excerpt="5. CHECK THE PRESSURE SWITCH.",
        ),
        instr(
            "pressure_hose_ok",
            6,
            "Flow meter at CN4",
            "Inspect CN4 flow meter / thermistor / overflow harness for damage or poor connection at control board.",
            "fill_path_verified",
        ),
        outcome("fix_supply", 7, "Correct supply issue", "Restore water supply, correct installation, and retest fill."),
        outcome(
            "repair_pressure_hose",
            8,
            "Repair pressure switch path",
            "Repair or replace pressure switch hose; verify switch seated on base bracket.",
        ),
        outcome(
            "fill_path_verified",
            9,
            "Fill path verified",
            "Supply, inlet valve, flow meter, pressure switch, and drain prerequisites checked — retest for E1.",
        ),
    ],
)

FILL_VALVE = proc(
    "w11187658-fill-valve",
    "Water inlet valve — ~24 Ω (CN5)",
    "inlet-valve",
    "Water inlet valve resistance",
    [32, 8],
    ["inlet_valve"],
    ["E1", "fill_issue", "water_valve_check"],
    [
        instr(
            "access_fill_valve",
            2,
            "Access inlet valve",
            "Remove access panel and control board cover. Unplug CN5 from control board before ohms.",
            "fill_valve_ohms",
            excerpt="measure the resistance between CN5-1 and CN5-2.",
        ),
        meas(
            "fill_valve_ohms",
            3,
            "Inlet solenoid resistance",
            "Measure between CN5-1 (EV1) and CN5-2 (IS). Expect approximately 24 Ω.",
            "whirlpoolDishwasherAdaFillValveOhms",
            "CN5",
            "CN5-1 / CN5-2",
            pass_fail_branches("fill_valve_verified", "replace_fill_valve", fail_label="Replace inlet valve — open or out of spec."),
        ),
        outcome("replace_fill_valve", 4, "Replace inlet valve", "Replace water inlet valve; verify harness continuity if open."),
        outcome(
            "fill_valve_verified",
            5,
            "Fill valve verified",
            "Inlet solenoid ~24 Ω — retest fill; check flow meter and control 12 VDC at CN5 if E1 persists.",
        ),
    ],
)

DRAIN_PUMP = proc(
    "w11187658-drain-pump",
    "Drain pump — 25–35 Ω (CON2)",
    "drain-pump",
    "Drain pump resistance",
    [40, 16],
    ["drain_pump"],
    ["E1", "E4", "drain_issue", "pump_check"],
    [
        instr(
            "access_drain_pump",
            2,
            "Access drain pump",
            "Lay dishwasher on back after removing drip pan/float switch. Unplug CON2 from control board.",
            "drain_pump_ohms",
            excerpt="If the resistance is between 25-35 ohms, the drain pump and harness are good.",
        ),
        meas(
            "drain_pump_ohms",
            3,
            "Drain pump winding resistance",
            "Measure across CON2 pin 1 (drain pump) and CON1 pin 1 (neutral). Expect 25–35 Ω.",
            "insigniaDishwasherDrainPumpOhms",
            "CON2",
            "pin 1 / CON1-1",
            pass_fail_branches("drain_pump_verified", "replace_drain_pump", fail_label="Replace drain pump — open winding."),
        ),
        visual(
            "drain_pump_verified",
            4,
            "Check valve and impeller",
            "Verify check valve flapper moves freely and impeller is not fractured.",
            yes_no("drain_path_ok", "replace_drain_pump", yes_label="OK", no_label="Mechanical fault"),
        ),
        outcome("replace_drain_pump", 5, "Replace drain pump", "Replace drain pump assembly; verify hose and clamp."),
        outcome("drain_path_ok", 6, "Drain pump verified", "Pump ohms in spec and check valve OK."),
    ],
)

HEATER = proc(
    "w11187658-heater",
    "E3 — Tub heater ~14 Ω",
    "E3",
    "Heater failure",
    [34, 18],
    ["heater"],
    ["E3", "no_heat", "heating_element_check", "error_code"],
    [
        instr(
            "e3_symptom",
            2,
            "E3 behavior",
            "E3 displays when water temperature does not reach the correct value within 90 minutes. "
            "Quick and Glass indicators flash (non-SSD).",
            "access_heater",
            excerpt="WHEN THE TEMPERATURE DOESN'T REACH THE CORRECT VALUE AFTER 90 MINUTES, E3 WILL BE DISPLAYED.",
        ),
        instr(
            "access_heater",
            3,
            "Access heating element",
            "Lay unit on back; remove drip pan. Disconnect P02 and CON1 from control board. Access PO1/PO2 heater terminals.",
            "heater_ohms",
            excerpt="If the resistance is approximately 14 ohms, go to step 7.",
        ),
        meas(
            "heater_ohms",
            4,
            "Heater element resistance",
            "Measure between PO1/PO2 and CON1-1 (neutral). Expect approximately 14 Ω.",
            "whirlpoolDishwasherAdaHeaterOhms",
            "PO1/PO2",
            "element / CON1-1",
            pass_fail_branches("heater_verified", "replace_heater", fail_label="Replace heater — open element."),
        ),
        instr(
            "heater_verified",
            5,
            "Thermistor follow-up",
            "If E3 persists with good heater ohms, run tub thermistor test (w11187658-tub-thermistor) and verify heater relay output.",
            "heater_path_ok",
        ),
        outcome("replace_heater", 6, "Replace heater", "Replace heating element; verify harness continuity."),
        outcome("heater_path_ok", 7, "Heater verified", "Heater ~14 Ω — verify thermistor and control if E3 remains."),
    ],
)

TUB_THERMISTOR = proc(
    "w11187658-tub-thermistor",
    "Tub thermistor — E6/E7 NTC",
    "thermistor",
    "Tub thermistor resistance",
    [36, 18],
    ["heater"],
    ["E3", "E6", "E7", "thermistor_check", "error_code"],
    [
        instr(
            "ntc_symptom",
            2,
            "E6 / E7 behavior",
            "E6 = NTC open circuit (Light + Glass flash). E7 = NTC short (Light + Glass + Quick flash). "
            "Both affect E3 heat path.",
            "access_thermistor",
            excerpt="TEMPERATURE SENSOR OPEN CIRCUIT, E6 WILL BE DISPLAYED.",
        ),
        instr(
            "access_thermistor",
            3,
            "Access tub thermistor",
            "Lay dishwasher on back; remove drip pan. Thermistor on back of sump — unplug CN4 before ohms.",
            "thermistor_ohms",
            excerpt="77° F (25° C) — 10k ohms",
        ),
        meas(
            "thermistor_ohms",
            4,
            "Tub thermistor resistance",
            "Measure between CN4-2 (GND) and CN4-7 (RE) at room temperature (~77°F). Expect 10 kΩ.",
            "insigniaDishwasherTubThermistorOhms",
            "CN4",
            "CN4-2 / CN4-7",
            pass_fail_branches("thermistor_verified", "replace_thermistor", fail_label="Replace thermistor — open or shorted."),
        ),
        instr(
            "thermistor_verified",
            5,
            "Harness check",
            "Inspect thermistor harness between CN4 and sump. Repair opens before replacing control board.",
            "thermistor_path_ok",
        ),
        outcome("replace_thermistor", 6, "Replace thermistor", "Replace tub thermistor assembly."),
        outcome("thermistor_path_ok", 7, "Thermistor verified", "NTC in spec — if E6/E7/E3 persist, suspect control board."),
    ],
)

OVERFLOW = proc(
    "w11187658-overflow",
    "E4 — Overflow / base pan",
    "E4",
    "Overflow / water flood",
    [37, 18, 40],
    ["drain_pump"],
    ["E4", "leak_check", "error_code", "drain_issue"],
    [
        instr(
            "e4_symptom",
            2,
            "E4 behavior",
            "E4 displays when water flows into the base pan and activates the overflow switch. Light indicator flashes.",
            "e4_cause_checks",
            excerpt="IF WATER FLOWS INTO THE BASE AND ACTIVATES THE OVERFLOW SWITCH, THE DISHWASHER WILL DISPLAY E4.",
        ),
        visual(
            "e4_cause_checks",
            3,
            "Detergent, level, and leak source",
            "Check detergent type/amount, appliance level, and visible leak at door gasket, sump, or hoses.",
            yes_no("causes_ok", "correct_causes", yes_label="No obvious cause", no_label="Cause found"),
            excerpt="1. CHECK THE USE OF THE DETERGENT.",
        ),
        instr(
            "causes_ok",
            4,
            "CN4 overflow switch",
            "Inspect CN4 overflow switch harness. Float down: CN4-2 to CN4-3 should read ≤3 Ω. Float up: open circuit.",
            "drain_after_overflow",
        ),
        visual(
            "drain_after_overflow",
            5,
            "Drain pan and pump",
            "Remove standing water from base. Does drain pump run and remove water when commanded in service mode?",
            yes_no("drain_runs", "run_drain_pump_test", yes_label="Drains", no_label="Won't drain"),
        ),
        instr(
            "drain_runs",
            6,
            "Locate leak",
            "With pan dry, run a short fill cycle and inspect sump, door seal, and hose clamps for leak source.",
            "overflow_verified",
        ),
        instr(
            "run_drain_pump_test",
            7,
            "Drain pump bench test",
            "Run w11187658-drain-pump for 25–35 Ω winding check and check valve.",
            "replace_drain_if_needed",
        ),
        outcome("correct_causes", 8, "Correct installation", "Reduce detergent, level unit, or repair identified leak source."),
        outcome("replace_drain_if_needed", 9, "Service drain path", "Replace drain pump or clear obstruction; dry base pan before retest."),
        outcome("overflow_verified", 10, "Overflow path checked", "Pan dry, flood switch reset, drain verified — retest for E4."),
    ],
)


def service_mode_entry_bundle() -> dict:
    return {
        "id": "w11187658-service-mode-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_dishwasher_ada",
        "manualId": "W11187658",
        "title": "W11187658 — Service mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter service mode to cycle water valve, wash pump/heater, dispenser, and drain pump (§2-3).",
        "tags": ["service_diagnostic", "error_code"],
        "entryStepId": "prep_power_off",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [15, 16, 17],
        },
        "steps": [
            {
                "id": "prep_power_off",
                "order": 1,
                "type": "instruction",
                "title": "Power off, door open",
                "body": "Turn dishwasher off so no LEDs are lit. Disconnect power with the door open.",
                "sourceExcerpt": "Turn the dishwasher off and make sure no LED's are lit. Disconnect power to the dishwasher.",
                "requiresInput": False,
                "defaultNextStepId": "service_mode_entry",
            },
            {
                "id": "service_mode_entry",
                "order": 2,
                "type": "instruction",
                "title": "Service mode entry",
                "body": (
                    "Reapply power with door open. Within 60 seconds, press and hold the model-specific button pair "
                    "(24\" front: On/Off + Start/Pause; 18\" front: Cycles + Start/Cancel; 24\" top: Heavy + Start). "
                    "Close door — service mode cycles valve, wash/heater, dispenser, drain, then board type code."
                ),
                "sourceExcerpt": "Reapply power with the door open and quickly press and hold both buttons within 60 seconds from connecting power.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    INLET_FILL,
    FILL_VALVE,
    DRAIN_PUMP,
    HEATER,
    TUB_THERMISTOR,
    OVERFLOW,
]

PROCEDURE_FILES = [f"{item['id']}.json" for item in PROCEDURES]
BUNDLES = [service_mode_entry_bundle()]
BUNDLE_FILES = ["w11187658-service-mode-entry.json"]

ERROR_CODE_TAGS = {"E1", "E3", "E4", "E6", "E7"}


def write_catalog() -> None:
    catalog = {
        "manualId": "W11187658",
        "platformId": "whirlpool_dishwasher_ada",
        "templateId": "dishwasher",
        "label": "Whirlpool ADA built-in dishwasher (18\"/24\")",
        "notes": "E-family LED flash codes E1–E7 only (no F#E#). Bench ohms: CN5 valve ~24 Ω, PO1 heater ~14 Ω, CON2 drain 25–35 Ω, CN4 NTC 10 kΩ @ 77°F.",
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
                "relatedCodes": [tag for tag in item.get("tags", []) if tag in ERROR_CODE_TAGS],
            }
            for item in PROCEDURES
        ],
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name}")


def write_readme() -> None:
    readme = OUT / "README.md"
    readme.write_text(
        """# Whirlpool ADA dishwasher (`whirlpool_dishwasher_ada`) procedure seeds

**Manual:** W11187658 — 18\" & 24\" ADA Built-In Dishwashers  
**Extraction:** [`WHIRLPOOL_DISHWASHER_PLATFORM_EXTRACTION.md`](../../knowledge/pattern-catalog/WHIRLPOOL_DISHWASHER_PLATFORM_EXTRACTION.md) §1  
**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json)

Regenerate:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11187658
```

## Measurement knowledge

| Procedure | Knowledge ID | Spec |
|-----------|--------------|------|
| Fill valve | `whirlpoolDishwasherAdaFillValveOhms` | ~24 Ω (CN5) |
| Heater | `whirlpoolDishwasherAdaHeaterOhms` | ~14 Ω |
| Drain pump | `insigniaDishwasherDrainPumpOhms` | 25–35 Ω (shared spec) |
| Tub thermistor | `insigniaDishwasherTubThermistorOhms` | 10 kΩ @ 77°F (shared spec) |

## Error codes

| Code | Procedure |
|------|-----------|
| E1 | `w11187658-inlet-fill`, `w11187658-fill-valve` |
| E3 | `w11187658-heater`, `w11187658-tub-thermistor` |
| E4 | `w11187658-overflow`, `w11187658-drain-pump` |
| E6/E7 | `w11187658-tub-thermistor` |
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
        "attach_w11187658_diagnostic_effects.py",
        "attach_w11187658_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
