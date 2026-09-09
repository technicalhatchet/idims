#!/usr/bin/env python3
"""Generate NS-DWR3SS1 (Insignia DWR3 top-control dishwasher) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "insignia_dishwasher"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "INSIGNIA-DWR3-DISHWASHER",
    "manualTitle": "Insignia NS-DWR3SS1 Top Control Dishwasher Service Manual",
    "extractedTextFile": "backend/docs/manuals/NS-DWR3SS1 service manual again-ocr-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dishwasher or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Disconnect the power supply to the dishwasher.",
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
        "platformId": "insignia_dishwasher",
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
    "nsdwr3ss1-inlet-fill",
    "E1 — Water inlet failure (4 min fill)",
    "E1",
    "Water inlet failure",
    [28, 19, 20],
    ["inlet_valve"],
    ["E1", "fill_issue", "error_code", "water_valve_check"],
    [
        instr(
            "e1_symptom",
            2,
            "E1 behavior",
            "E1 logs when the flow meter cannot detect defined water within 4 minutes during the inlet step. "
            "OCR may show El — treat as E1.",
            "supply_checks",
            excerpt="If the flow meter can't detect the defined water after 4 minutes, the dishwasher will warning for E1.",
        ),
        visual(
            "supply_checks",
            3,
            "Water supply and installation",
            "Verify supply valve on, adequate pressure, inlet screen clean, drain hose not siphoning, and dishwasher level.",
            yes_no("supply_ok", "fix_supply", yes_label="Supply OK", no_label="Supply issue found"),
            excerpt="1. check the water supply",
        ),
        instr(
            "supply_ok",
            4,
            "Bench fill path",
            "Power off. Access kick panel. Inspect CON3 inlet harness, flow meter at CN4, pressure switch hose, and drain path. "
            "Run fill-valve ohms test (nsdwr3ss1-fill-valve) and drain pump test if sump retains water.",
            "pressure_switch_check",
        ),
        visual(
            "pressure_switch_check",
            5,
            "Pressure switch hose and tubing",
            "Pressure switch hose runs from switch to sump via air breaker. Hose kinked, disconnected, or blocked?",
            yes_no("pressure_hose_ok", "repair_pressure_hose", yes_label="Hose OK", no_label="Hose fault"),
            excerpt="5. check the pressure switch",
        ),
        instr(
            "pressure_hose_ok",
            6,
            "Flow meter and CN4",
            "Inspect CN4 flow meter / flood detection harness for damage or poor connection at main PCB.",
            "fill_path_verified",
        ),
        outcome("fix_supply", 7, "Correct supply issue", "Restore water supply, correct installation, and retest fill."),
        outcome("repair_pressure_hose", 8, "Repair pressure switch path", "Repair or replace pressure switch hose; verify switch seated in base bracket."),
        outcome(
            "fill_path_verified",
            9,
            "Fill path verified",
            "Supply, inlet valve, flow meter, pressure switch, and drain prerequisites checked — retest for E1.",
        ),
    ],
)

FILL_VALVE = proc(
    "nsdwr3ss1-fill-valve",
    "Water inlet valve — ~1 kΩ",
    "inlet-valve",
    "Water inlet valve resistance",
    [19, 11],
    ["inlet_valve"],
    ["E1", "fill_issue", "water_valve_check"],
    [
        instr(
            "access_fill_valve",
            2,
            "Access inlet valve",
            "Remove kick board and lower front cover. Inlet valve on left front brace — disconnect 2 solenoid wires before ohms.",
            "fill_valve_ohms",
            excerpt="The water valve has an approximate resistance value of 1 Kn",
        ),
        meas(
            "fill_valve_ohms",
            3,
            "Inlet solenoid resistance",
            "Measure across the two solenoid terminals. Expect ~1 kΩ.",
            "insigniaDishwasherFillValveOhms",
            "Inlet valve",
            "solenoid terminals",
            pass_fail_branches("fill_valve_verified", "replace_fill_valve", fail_label="Replace inlet valve — open or out of spec."),
        ),
        outcome("replace_fill_valve", 4, "Replace inlet valve", "Replace water inlet valve; use new screw-type hose clamp per manual."),
        outcome("fill_valve_verified", 5, "Fill valve verified", "Inlet solenoid ~1 kΩ — retest fill if E1 persists, check flow meter and PCB."),
    ],
)

DRAIN_PUMP = proc(
    "nsdwr3ss1-drain-pump",
    "Drain pump — 25–35 Ω",
    "drain-pump",
    "Drain pump resistance",
    [21, 11],
    ["drain_pump"],
    ["E1", "E4", "drain_issue", "pump_check"],
    [
        instr(
            "access_drain_pump",
            2,
            "Access drain pump",
            "Lay dishwasher on back after removing from installation. Remove base cover screw. "
            "Rotate pump 1/4-turn counterclockwise to remove; disconnect 2 wires.",
            "drain_pump_ohms",
            excerpt="The drain pump has an approximate resistance value of 25- 350.",
        ),
        meas(
            "drain_pump_ohms",
            3,
            "Drain pump winding resistance",
            "Measure across drain pump motor terminals. Expect 25–35 Ω.",
            "insigniaDishwasherDrainPumpOhms",
            "CON3",
            "pin 5 / pump terminals",
            pass_fail_branches("drain_pump_verified", "replace_drain_pump", fail_label="Replace drain pump — open winding."),
        ),
        visual(
            "drain_pump_verified",
            4,
            "Check valve and O-ring",
            "Verify check valve flapper moves freely and O-ring retained in pump seal before reassembly.",
            yes_no("drain_path_ok", "replace_drain_pump", yes_label="OK", no_label="Mechanical fault"),
        ),
        outcome("replace_drain_pump", 5, "Replace drain pump", "Replace drain pump assembly; verify O-ring and clamp."),
        outcome("drain_path_ok", 6, "Drain pump verified", "Pump ohms in spec and check valve OK."),
    ],
)

HEATER = proc(
    "nsdwr3ss1-heater",
    "E3 — Tub heater 10–15 Ω",
    "E3",
    "Heater failure",
    [23, 28],
    ["heater"],
    ["E3", "no_heat", "heating_element_check", "error_code"],
    [
        instr(
            "e3_symptom",
            2,
            "E3 behavior",
            "E3 logs when water temperature cannot reach the defined value within 90 minutes.",
            "access_heater",
            excerpt="when the temperature cant reached the defined value after 90 minutes, the dishwasher will warning for E3.",
        ),
        instr(
            "access_heater",
            3,
            "Access heating element",
            "Remove bottom rack. Lay unit on back; remove base cover. Pull down nylon terminal covers and disconnect heater wires at PO1/PO2.",
            "heater_ohms",
            excerpt="The heater has an approximate resistance value of 10-1s n",
        ),
        meas(
            "heater_ohms",
            4,
            "Heater element resistance",
            "Measure across heating element terminals. Expect 10–15 Ω.",
            "insigniaDishwasherHeaterOhms",
            "PO1/PO2",
            "heater terminals",
            pass_fail_branches("heater_verified", "replace_heater", fail_label="Replace heater — open element."),
        ),
        instr(
            "heater_verified",
            5,
            "Thermistor follow-up",
            "If E3 persists with good heater ohms, run tub thermistor test (nsdwr3ss1-tub-thermistor) and inspect PCB heater output.",
            "heater_path_ok",
        ),
        outcome("replace_heater", 6, "Replace heater", "Replace heating element; ensure O-ring retained at sump."),
        outcome("heater_path_ok", 7, "Heater verified", "Heater 10–15 Ω — verify thermistor and control if E3 remains."),
    ],
)

TUB_THERMISTOR = proc(
    "nsdwr3ss1-tub-thermistor",
    "Tub thermistor — E6/E7 NTC",
    "thermistor",
    "Tub thermistor resistance",
    [22, 28],
    ["heater"],
    ["E3", "E6", "E7", "thermistor_check", "error_code"],
    [
        instr(
            "ntc_symptom",
            2,
            "E6 / E7 behavior",
            "E6 = NTC open (thermal sensor cut). E7 = NTC short. Both may appear in factory mode; also affects E3 heat path.",
            "access_thermistor",
            excerpt="E6 - thermal sensor cut. E7 - thermal sensor short.",
        ),
        instr(
            "access_thermistor",
            3,
            "Access tub thermistor",
            "Lay dishwasher on back; remove base cover. Thermistor on back of sump — disconnect harness before ohms.",
            "thermistor_ohms",
            excerpt="R@25°C=10KQ±2%; R@60°C=3011O±2%.",
        ),
        meas(
            "thermistor_ohms",
            4,
            "Tub thermistor resistance",
            "Measure at room temperature (~25°C). Expect 10 kΩ ±2%.",
            "insigniaDishwasherTubThermistorOhms",
            "Thermistor",
            "harness terminals",
            pass_fail_branches("thermistor_verified", "replace_thermistor", fail_label="Replace thermistor — open or shorted."),
        ),
        instr(
            "thermistor_verified",
            5,
            "Harness check",
            "Inspect thermistor harness for pin damage at PCB and sump. Repair opens before replacing PCB.",
            "thermistor_path_ok",
        ),
        outcome("replace_thermistor", 6, "Replace thermistor", "Replace tub thermistor; retain O-ring at sump."),
        outcome("thermistor_path_ok", 7, "Thermistor verified", "NTC in spec — if E6/E7/E3 persist, suspect PCB."),
    ],
)

OVERFLOW = proc(
    "nsdwr3ss1-overflow",
    "E4 — Overflow / base pan",
    "E4",
    "Overflow / water flood",
    [28, 20, 21],
    ["drain_pump"],
    ["E4", "leak_check", "error_code", "drain_issue"],
    [
        instr(
            "e4_symptom",
            2,
            "E4 behavior",
            "E4 logs when water floods the bottom pan and the detective micro-switch moves.",
            "e4_cause_checks",
            excerpt="the water flood into the bottom and result in the detective switch moves, the dishwasher will warning for E4.",
        ),
        visual(
            "e4_cause_checks",
            3,
            "Detergent, level, and leak source",
            "Check detergent type/amount, appliance level, and visible leak at door gasket, sump, or hoses.",
            yes_no("causes_ok", "correct_causes", yes_label="No obvious cause", no_label="Cause found"),
        ),
        instr(
            "causes_ok",
            4,
            "CN4 flood detection",
            "Inspect CN4 rinse-aid / flow meter / water-flood detection harness and base pan micro-switch.",
            "drain_after_overflow",
        ),
        visual(
            "drain_after_overflow",
            5,
            "Drain pan and pump",
            "Remove standing water from base. Does drain pump run and remove water when commanded?",
            yes_no("drain_runs", "run_drain_pump_test", yes_label="Drains", no_label="Won't drain"),
        ),
        instr(
            "drain_runs",
            6,
            "Locate leak",
            "With pan dry, run a short fill cycle and inspect sump, door seal, air breaker, and hose clamps for leak source.",
            "overflow_verified",
        ),
        instr(
            "run_drain_pump_test",
            7,
            "Drain pump bench test",
            "Run nsdwr3ss1-drain-pump for 25–35 Ω winding check and check valve.",
            "replace_drain_if_needed",
        ),
        outcome("correct_causes", 8, "Correct installation", "Reduce detergent, level unit, or repair identified leak source."),
        outcome("replace_drain_if_needed", 9, "Service drain path", "Replace drain pump or clear obstruction; dry base pan before retest."),
        outcome("overflow_verified", 10, "Overflow path checked", "Pan dry, flood switch reset, drain verified — retest for E4."),
    ],
)

DIVERTER = proc(
    "nsdwr3ss1-diverter",
    "E8 — Diverter valve assembly",
    "E8",
    "Diverter valve assembly problem",
    [25, 28, 11],
    ["circulation_pump"],
    ["E8", "wash_issue", "error_code"],
    [
        instr(
            "e8_symptom",
            2,
            "E8 behavior",
            "E8 = diverter valve assembly problem. Poor top-rack wash is a common complaint when diverter fails.",
            "access_diverter",
            excerpt="Diverter valve assembly problem",
        ),
        instr(
            "access_diverter",
            3,
            "Access diverter",
            "Remove sump diverter valve cover and storm wash pipe (3 screws). Diverter motor mounts to sump with 2 screws. "
            "CN3 carries turbidity and diverter valve detection.",
            "diverter_motor_check",
        ),
        visual(
            "diverter_motor_check",
            4,
            "Diverter motor and linkage",
            "Does diverter motor rotate and change spray path when commanded in service test? Linkage free of debris?",
            yes_no("diverter_motor_ok", "replace_diverter_motor", yes_label="Motor moves", no_label="Motor failed"),
        ),
        visual(
            "diverter_motor_ok",
            5,
            "Diverter micro switch (CN3)",
            "With power off, verify diverter position micro-switch at CN3 toggles with motor travel (no stuck position).",
            yes_no("diverter_switch_ok", "replace_diverter_assembly", yes_label="Switch OK", no_label="Switch fault"),
        ),
        instr(
            "diverter_switch_ok",
            6,
            "CN3 harness",
            "Inspect CN3 harness between PCB and diverter detection circuit. Repair opens before replacing PCB.",
            "diverter_verified",
        ),
        outcome("replace_diverter_motor", 7, "Replace diverter motor", "Replace diverter valve motor on sump."),
        outcome("replace_diverter_assembly", 8, "Replace diverter assembly", "Replace diverter motor and/or micro-switch assembly."),
        outcome("diverter_verified", 9, "Diverter verified", "Motor and position detection OK — E8 should not return."),
    ],
)

CONTROL_PANEL = proc(
    "nsdwr3ss1-control-panel",
    "E9 — Stuck button (>30 s)",
    "E9",
    "Stuck button",
    [28, 11],
    ["user_interface"],
    ["E9", "hmi_check", "error_code"],
    [
        instr(
            "e9_symptom",
            2,
            "E9 behavior",
            "E9 logs when any button is held longer than 30 seconds.",
            "inspect_panel",
            excerpt="when some buttons have been pressed over 30 seconds, the dishwasher will warning for E9.",
        ),
        visual(
            "inspect_panel",
            3,
            "Control panel / touchpad",
            "Inspect control panel for stuck, damaged, or moisture-swollen keys. Disconnect power and verify keys release freely.",
            yes_no("panel_frees", "replace_control_panel", yes_label="Keys release", no_label="Stuck key"),
        ),
        instr(
            "panel_frees",
            4,
            "Retest operation",
            "Restore power. Press each touchpad key briefly — none should hold continuously.",
            "panel_verified",
        ),
        outcome("replace_control_panel", 5, "Replace control panel", "Replace control panel assembly (UI board is bonded to panel)."),
        outcome("panel_verified", 6, "Control panel verified", "No stuck keys — E9 should not return."),
    ],
)

DISPLAY_COMM = proc(
    "nsdwr3ss1-display-comm",
    "Ed — Display ↔ main communication",
    "Ed",
    "Display communication error",
    [28, 11],
    ["user_interface", "acu"],
    ["Ed", "hmi_check", "no_power", "error_code"],
    [
        instr(
            "ed_symptom",
            2,
            "Ed behavior",
            "Ed logs when the display board cannot receive or the main board cannot send for more than 20 seconds.",
            "inspect_cn2",
            excerpt="when the display board cant receive or the main board can't send signal over 20 seconds",
        ),
        visual(
            "inspect_cn2",
            3,
            "CN2 display harness seated",
            "Remove control panel. Is CN2 (display board) fully seated with no bent pins?",
            yes_no("cn2_seated", "reseat_cn2", yes_label="Seated", no_label="Loose or damaged"),
        ),
        visual(
            "cn2_seated",
            4,
            "CN2 harness continuity",
            "With power off, verify continuity on harness between main PCB CN2 and display PCB (no opens).",
            yes_no("comm_verified", "replace_display_or_pcb", yes_label="Harness OK", no_label="Open harness"),
        ),
        instr("reseat_cn2", 5, "Reseat and retest", "Reseat CN2 and cycle progress indicator harness; restore power and verify display responds.", "comm_verified"),
        outcome("replace_display_or_pcb", 6, "Replace display or PCB", "Replace display assembly or main PCB per failed path."),
        outcome("comm_verified", 7, "Communication verified", "CN2 path OK — Ed should not return."),
    ],
)


def service_test_entry_bundle() -> dict:
    return {
        "id": "nsdwr3ss1-service-test-entry",
        "version": "1.0.0",
        "platformId": "insignia_dishwasher",
        "manualId": "INSIGNIA-DWR3-DISHWASHER",
        "title": "NS-DWR3SS1 — Service test mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter service/factory test mode to verify dispenser and outputs (page 27 control layout).",
        "tags": ["service_diagnostic", "error_code"],
        "entryStepId": "prep_power",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [27, 13],
        },
        "steps": [
            {
                "id": "prep_power",
                "order": 1,
                "type": "instruction",
                "title": "Door closed, power ready",
                "body": "Close the door. Press Power to wake the control (hold 3 seconds to turn on from standby).",
                "sourceExcerpt": "Turn on / off the power by press and hold power for 3 seconds.",
                "requiresInput": False,
                "defaultNextStepId": "service_mode_entry",
            },
            {
                "id": "service_mode_entry",
                "order": 2,
                "type": "instruction",
                "title": "Service test entry",
                "body": (
                    "Per factory-mode control layout (page 27): with power on, press Start/Cancel to enter service test. "
                    "Use service test to verify detergent/rinse module operation (page 13). Press Start/Cancel to step tests."
                ),
                "sourceExcerpt": "Operation of the detergent/rinse module can be checked by using the service test mode.",
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
    DIVERTER,
    CONTROL_PANEL,
    DISPLAY_COMM,
]

PROCEDURE_FILES = [f"{item['id']}.json" for item in PROCEDURES]
BUNDLES = [service_test_entry_bundle()]
BUNDLE_FILES = ["nsdwr3ss1-service-test-entry.json"]

ERROR_CODE_TAGS = {"E1", "E3", "E4", "E6", "E7", "E8", "E9", "Ed"}


def write_catalog() -> None:
    catalog = {
        "manualId": "INSIGNIA-DWR3-DISHWASHER",
        "platformId": "insignia_dishwasher",
        "templateId": "dishwasher",
        "label": "Insignia NS-DWR3SS1 top-control dishwasher",
        "notes": "Midea OEM E-family codes (E1–E9, Ed). Bench ohms from component sections; CN2 display, CN3 diverter, CN4 flow/flood.",
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
        """# Insignia DWR3 dishwasher (`insignia_dishwasher`) procedure seeds

**Manual:** NS-DWR3SS1 Top Control Dishwasher  
**Extraction:** [`INSIGNIA_DWR3SS1_DISHWASHER_EXTRACTION.md`](../../knowledge/pattern-catalog/INSIGNIA_DWR3SS1_DISHWASHER_EXTRACTION.md)  
**Catalog:** [`procedureCatalog.json`](./procedureCatalog.json)

Regenerate:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual INSIGNIA-DWR3-DISHWASHER
```

## Measurement knowledge (batch9)

| Procedure | Knowledge ID | Spec |
|-----------|--------------|------|
| Fill valve | `insigniaDishwasherFillValveOhms` | ~1 kΩ |
| Drain pump | `insigniaDishwasherDrainPumpOhms` | 25–35 Ω |
| Heater | `insigniaDishwasherHeaterOhms` | 10–15 Ω |
| Tub thermistor | `insigniaDishwasherTubThermistorOhms` | 10 kΩ @ 25°C |

## Error codes

| Code | Procedure |
|------|-----------|
| E1 | `nsdwr3ss1-inlet-fill`, `nsdwr3ss1-fill-valve` |
| E3 | `nsdwr3ss1-heater`, `nsdwr3ss1-tub-thermistor` |
| E4 | `nsdwr3ss1-overflow`, `nsdwr3ss1-drain-pump` |
| E6/E7 | `nsdwr3ss1-tub-thermistor` |
| E8 | `nsdwr3ss1-diverter` |
| E9 | `nsdwr3ss1-control-panel` |
| Ed | `nsdwr3ss1-display-comm` |
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
        "attach_insignia_dwr3_dishwasher_diagnostic_effects.py",
        "attach_insignia_dwr3_dishwasher_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
