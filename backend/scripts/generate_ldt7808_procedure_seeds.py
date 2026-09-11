#!/usr/bin/env python3
"""Generate LG LDT7808ST dishwasher procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "lg_dishwasher_ldt7808"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "LG-LDT7808-DISHWASHER",
    "manualTitle": "LG LDT7808 Top-Control Dishwasher Service Manual",
    "extractedTextFile": "backend/docs/manuals/LDT7808ST-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dishwasher or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "DISCONNECT POWER SUPPLY LINE BEFORE SERVICING.",
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
        "platformId": "lg_dishwasher_ldt7808",
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


INLET_VALVE = proc(
    "ldt7808-inlet-valve",
    "§7-1/7-2: Inlet Valve (IE fill fault)",
    "7-1-IE",
    "INLET ERROR",
    [47, 49, 52],
    ["inlet_valve"],
    ["IE", "fill_issue", "water_valve_check"],
    [
        visual(
            "water_tap",
            2,
            "Water supply tap open?",
            "Verify the water supply tap is fully open and inlet hose is not kinked.",
            yes_no("hose_ok", "open_tap"),
        ),
        instr("open_tap", 3, "Open water supply", "Open the water supply tap and retest fill.", "water_tap"),
        visual(
            "hose_ok",
            4,
            "Inlet hose and pressure OK?",
            "Repair kinked hose if needed. Water pressure should be 20–120 psi (140–830 kPa).",
            yes_no("filter_clean", "repair_hose"),
        ),
        instr("repair_hose", 5, "Repair inlet hose", "Repair or replace kinked inlet hose.", "hose_ok"),
        visual(
            "filter_clean",
            6,
            "Inlet valve screen clean?",
            "Unscrew inlet hose at valve side. Clean filter of inlet valve if clogged.",
            yes_no("valve_ohms", "clean_filter"),
        ),
        instr("clean_filter", 7, "Clean inlet screen", "Clean inlet valve filter and retest.", "filter_clean"),
        meas(
            "valve_ohms",
            8,
            "Inlet valve coil resistance",
            "Disconnect power. Measure inlet valve coil — manual spec 23~27 Ω.",
            "lgDishwasherLdt7808InletValveOhms",
            "Inlet valve",
            "coil",
            pass_fail_branches("valve_verified", "replace_valve"),
            "Check the electric resistance of Inlet Valve. (23~27Ω)",
        ),
        outcome("valve_verified", 9, "Inlet valve verified", "Inlet valve coil within spec. Check hall sensor if IE persists."),
        outcome("replace_valve", 10, "Replace inlet valve", "Replace inlet valve assembly."),
    ],
)

HALL_SENSOR = proc(
    "ldt7808-hall-sensor",
    "§7-2: Hall Sensor (IE fill path)",
    "7-2-hall",
    "Hall sensor fill check",
    [49, 52],
    ["inlet_valve"],
    ["IE", "fill_issue"],
    [
        visual(
            "air_breaker",
            2,
            "Air breaker impeller spins?",
            "Verify air breaker impeller spins freely.",
            yes_no("hall_ohms", "replace_air_breaker"),
        ),
        instr("replace_air_breaker", 3, "Replace air breaker", "Replace air breaker assembly.", "air_breaker"),
        meas(
            "hall_ohms",
            4,
            "Hall sensor resistance",
            "Disconnect power. Measure hall sensor — manual spec 9 kΩ ±5%.",
            "lgDishwasherLdt7808HallSensorOhms",
            "Hall sensor",
            "coil",
            pass_fail_branches("hall_verified", "replace_hall"),
            "The resistance is 9kΩ ±5%",
        ),
        outcome("hall_verified", 5, "Hall sensor verified", "Hall sensor within spec."),
        outcome("replace_hall", 6, "Replace hall sensor", "Replace hall sensor."),
    ],
)

DRAIN_PUMP = proc(
    "ldt7808-drain-pump",
    "§7-1/7-2: Drain Pump (OE drain fault)",
    "7-1-OE",
    "DRAIN ERROR",
    [47, 50],
    ["drain_pump"],
    ["OE", "drain_issue", "pump_check"],
    [
        visual(
            "filter_clear",
            2,
            "Filter assembly clear?",
            "Clean filter assembly and verify drain hose, air gap, and knockout plug.",
            yes_no("impeller_free", "clean_drain_path"),
        ),
        instr(
            "clean_drain_path",
            3,
            "Clear drain path",
            "Remove kink/block in drain hose; clean air gap; remove garbage disposal knockout plug.",
            "filter_clear",
        ),
        visual(
            "impeller_free",
            4,
            "Drain impeller free?",
            "Check drain motor impeller is not stuck.",
            yes_no("pump_ohms", "repair_impeller"),
        ),
        instr("repair_impeller", 5, "Clear impeller", "Repair drain motor when impeller stuck; replace if error persists.", "impeller_free"),
        meas(
            "pump_ohms",
            6,
            "Drain pump resistance",
            "Disconnect power. Measure drain pump winding — manual spec 4~5 Ω.",
            "lgDishwasherLdt7808DrainPumpOhms",
            "YL3",
            "pump",
            pass_fail_branches("pump_verified", "replace_pump"),
            "The resistance is 4~5Ω",
        ),
        outcome("pump_verified", 7, "Drain pump verified", "Drain pump winding within spec."),
        outcome("replace_pump", 8, "Replace drain pump", "Replace drain motor / pump assembly."),
    ],
)

THERMISTOR = proc(
    "ldt7808-thermistor",
    "§7-1/7-2: Tub Thermistor (tE thermal error)",
    "7-1-tE",
    "THERMAL ERROR",
    [47, 53],
    ["heater"],
    ["tE", "thermistor_check"],
    [
        visual(
            "wiring_ok",
            2,
            "Thermistor harness connected?",
            "Verify RD6 ↔ WH4 wiring is connected to main PCB.",
            yes_no("therm_ohms", "reconnect_wiring"),
        ),
        instr("reconnect_wiring", 3, "Reconnect wiring", "Check and reconnect thermistor harness.", "wiring_ok"),
        meas(
            "therm_ohms",
            4,
            "Thermistor resistance",
            "Disconnect power. Measure tub thermistor — manual spec 8~44 kΩ (NTC varies with temperature).",
            "lgDishwasherLdt7808ThermistorOhms",
            "RD6",
            "thermistor",
            pass_fail_branches("therm_verified", "replace_therm"),
            "The resistance is 8~44kΩ",
        ),
        outcome("therm_verified", 5, "Thermistor verified", "Thermistor within expected range."),
        outcome("replace_therm", 6, "Replace thermistor", "Replace thermistor."),
    ],
)

HEATER = proc(
    "ldt7808-heater",
    "§7-1/7-2: Wash Heater (HE heater error)",
    "7-1-HE",
    "HEATER ERROR",
    [47, 54],
    ["heater"],
    ["HE", "no_heat", "heating_element_check"],
    [
        visual(
            "inlet_temp",
            2,
            "Inlet water temperature OK?",
            "Inlet water should not exceed 185°F. Adjust supply to ~120°F if very high.",
            yes_no("heater_wiring", "adjust_inlet_temp"),
        ),
        instr("adjust_inlet_temp", 3, "Adjust inlet temperature", "Reduce inlet water temperature to ~120°F and retest.", "inlet_temp"),
        visual(
            "heater_wiring",
            4,
            "Heater harness connected?",
            "Verify RL2 pin4 ↔ RL3 pin4 heater wiring to main PCB.",
            yes_no("heater_ohms", "reconnect_heater"),
        ),
        instr("reconnect_heater", 5, "Reconnect heater wiring", "Check and reconnect heater harness.", "heater_wiring"),
        meas(
            "heater_ohms",
            6,
            "Heater element resistance",
            "Disconnect power. Measure heater element — manual spec 11.54 Ω ±10%.",
            "lgDishwasherLdt7808HeaterOhms",
            "Pump casing",
            "heater",
            pass_fail_branches("heater_verified", "replace_heater"),
            "Check the electric resistance of Heater.",
        ),
        outcome("heater_verified", 7, "Heater verified", "Heater element within spec."),
        outcome("replace_heater", 8, "Replace heater", "Replace pump casing assembly (heater)."),
    ],
)

WASH_MOTOR = proc(
    "ldt7808-wash-motor",
    "§7-1/7-2: Wash Motor (motor error)",
    "7-1-motor",
    "MOTOR ERROR",
    [47, 55, 61],
    ["circulation_pump"],
    ["motor_error", "wash_issue", "pump_check"],
    [
        visual(
            "door_closed",
            2,
            "Door tightly closed?",
            "Verify door is tightly closed and door switch in latch handle operates.",
            yes_no("motor_wiring", "close_door"),
        ),
        instr("close_door", 3, "Close door", "Close door tightly and retest.", "door_closed"),
        visual(
            "motor_wiring",
            4,
            "Wash motor wiring connected?",
            "Verify washing motor and controller wiring connections.",
            yes_no("impeller_locked", "reconnect_motor"),
        ),
        instr("reconnect_motor", 5, "Reconnect motor wiring", "Check and reconnect wash motor harness.", "motor_wiring"),
        visual(
            "impeller_locked",
            6,
            "Wash impeller free?",
            "Verify washing pump impeller is not locked.",
            yes_no("motor_ohms", "replace_casing"),
        ),
        instr("replace_casing", 7, "Replace pump casing", "Replace pump casing assembly when impeller locked.", "impeller_locked"),
        meas(
            "motor_ohms",
            8,
            "Wash motor resistance",
            "Disconnect RD3 connector. Measure wash motor — manual spec 22.5~24.9 Ω at 20°C.",
            "lgDishwasherLdt7808WashMotorOhms",
            "RD3",
            "motor",
            pass_fail_branches("motor_verified", "replace_motor"),
            "The resistance is 22.5~24.9Ω, at 20°C",
        ),
        outcome("motor_verified", 9, "Wash motor verified", "Wash motor winding within spec."),
        outcome("replace_motor", 10, "Replace wash motor", "Replace washing pump/motor (pump casing assembly)."),
    ],
)

VARIO_VALVE = proc(
    "ldt7808-vario-valve",
    "§7-1/7-2: Vario Valve (VARIO ERROR)",
    "7-1-VARIO",
    "VARIO ERROR",
    [47, 56],
    ["circulation_pump"],
    ["VARIO_ERROR", "vario_error", "wash_issue"],
    [
        visual(
            "vario_wiring",
            2,
            "Vario wiring connected?",
            "Verify vario motor/switch wiring to main PCB.",
            yes_no("vario_switch", "reconnect_vario"),
        ),
        instr("reconnect_vario", 3, "Reconnect vario wiring", "Check and reconnect vario harness.", "vario_wiring"),
        visual(
            "vario_switch",
            4,
            "Vario switch assembled properly?",
            "Remove 2 screws; verify vario S/W and cam are seated correctly.",
            yes_no("vario_ohms", "reassemble_switch"),
        ),
        instr("reassemble_switch", 5, "Reassemble vario switch", "Reassemble vario S/W and cam.", "vario_switch"),
        meas(
            "vario_ohms",
            6,
            "Vario motor resistance",
            "Disconnect power. Measure vario motor — manual spec 4 kΩ ±5%.",
            "lgDishwasherLdt7808VarioMotorOhms",
            "Vario motor",
            "coil",
            pass_fail_branches("vario_verified", "replace_vario"),
            "The resistance is 4kΩ ±5%",
        ),
        outcome("vario_verified", 7, "Vario motor verified", "Vario motor within spec; verify cam position in test mode."),
        outcome("replace_vario", 8, "Replace vario motor", "Replace vario motor."),
    ],
)

LEAK_FLOAT = proc(
    "ldt7808-leak-float",
    "§7-1/7-2: Leak / Float (AE leakage error)",
    "7-1-AE",
    "LEAKAGE ERROR",
    [47, 51],
    ["door_gasket"],
    ["AE", "leak_ae", "leak_issue"],
    [
        instr(
            "ae_checklist",
            2,
            "AE service checklist",
            "Document cycle count, detergent type, leveling, and when AE appeared. Remove water under floater switch (safety switch).",
            "door_gasket_check",
        ),
        visual(
            "door_gasket_check",
            3,
            "Door gasket secure?",
            "Check door gasket/liner is not loose or fallen off.",
            yes_no("float_ok", "replace_door_liner"),
        ),
        instr("replace_door_liner", 4, "Replace door liner", "Replace door liner assembly.", "door_gasket_check"),
        visual(
            "float_ok",
            5,
            "Float / safety switch free?",
            "Verify float assembly is not stuck. Tilt unit and drain base water if flooded.",
            yes_no("level_ok", "replace_float"),
        ),
        instr("replace_float", 6, "Replace float assembly", "Replace floater / safety switch assembly.", "float_ok"),
        visual(
            "level_ok",
            7,
            "Unit leveled and sealed?",
            "Level dishwasher; verify sump seal and drain hose connections.",
            yes_no("leak_verified", "level_unit"),
        ),
        instr("level_unit", 8, "Level unit", "Level machine and verify mounting bracket.", "level_ok"),
        outcome("leak_verified", 9, "Leak path addressed", "Physical leak sources checked. Replace main PCB if AE persists with no leak found."),
    ],
)

BUBBLE_ERROR = proc(
    "ldt7808-bubble-error",
    "§7-1: Bubble Error (BE suds fault)",
    "7-1-BE",
    "BUBBLE ERROR",
    [47],
    ["door_gasket"],
    ["BE", "bubble_error"],
    [
        visual(
            "detergent_ok",
            2,
            "Dishwasher detergent only?",
            "Only use detergents designed for dishwashers. No dish soap or oversudsing agents.",
            yes_no("level_ok_be", "use_correct_detergent"),
        ),
        instr("use_correct_detergent", 3, "Use correct detergent", "Switch to dishwasher detergent only.", "detergent_ok"),
        visual(
            "level_ok_be",
            4,
            "Unit leveled?",
            "Verify dishwasher is installed level.",
            yes_no("be_resolved", "level_be"),
        ),
        instr("level_be", 5, "Level dishwasher", "Level unit per installation instructions.", "level_ok_be"),
        outcome("be_resolved", 6, "BE resolved", "Correct detergent and leveling verified."),
    ],
)

EXCESS_FILL = proc(
    "ldt7808-excess-fill",
    "§7-1: Excess Fill (inlet valve stuck open)",
    "7-1-EXCESS",
    "EXCESS ERROR",
    [48],
    ["inlet_valve"],
    ["fill_issue"],
    [
        visual(
            "valve_leak",
            2,
            "Inlet valve stuck open?",
            "Excess fill auto-drains. Check inlet valve for damage or stuck-open condition.",
            yes_no("pcb_check", "replace_inlet_excess"),
        ),
        instr("replace_inlet_excess", 3, "Replace inlet valve", "Replace inlet valve.", "valve_leak"),
        visual(
            "pcb_check",
            4,
            "Recent PCB replacement?",
            "If PCB was replaced and error persists, check hole sensor.",
            yes_no("excess_verified", "replace_hole_sensor"),
        ),
        instr("replace_hole_sensor", 5, "Replace hole sensor", "Replace hole sensor after PCB swap.", "pcb_check"),
        outcome("excess_verified", 6, "Excess fill addressed", "Inlet valve and sensor path checked."),
    ],
)


def test_mode_bundle() -> dict:
    return {
        "id": "ldt7808-test-mode-entry",
        "version": "1.0.0",
        "platformId": "lg_dishwasher_ldt7808",
        "manualId": "LG-LDT7808-DISHWASHER",
        "title": "LDT7808 — Test Mode entry (§3-3)",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter test mode: Power+Start once, then press Start 1–7 to load components.",
        "tags": ["service_diagnostic", "live_test"],
        "entryStepId": "prep_power",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [16],
        },
        "steps": [
            {
                "id": "prep_power",
                "order": 1,
                "type": "instruction",
                "title": "Power on",
                "body": "Press Power to turn dishwasher on.",
                "sourceExcerpt": "3-3 TEST MODE — POWER + START",
                "requiresInput": False,
                "defaultNextStepId": "enter_test_mode",
            },
            {
                "id": "enter_test_mode",
                "order": 2,
                "type": "instruction",
                "title": "Enter test mode",
                "body": (
                    "Press Power + Start once (version display n35/U00/D00). "
                    "Then press Start repeatedly to step through loads: "
                    "1=Sump temp/dispenser, 2=Drying fan, 3=Soil sensor, 4=Drain motor RPM, "
                    "5=Inlet valve frequency, 6=Wash motor RPM, 7=Heater + Vario valve. "
                    "Start ×8 powers off. Door must be closed for most steps."
                ),
                "sourceExcerpt": "Press POWER + START; press Start 1–7 for component loads.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


def water_supply_bundle() -> dict:
    return {
        "id": "ldt7808-water-supply-check",
        "version": "1.0.0",
        "platformId": "lg_dishwasher_ldt7808",
        "manualId": "LG-LDT7808-DISHWASHER",
        "title": "LDT7808 — Water supply check (LQC mode)",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "LQC fill check: Power+Start, then Start ×5 for supply sound.",
        "tags": ["fill_issue", "live_test"],
        "entryStepId": "lqc_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [49],
        },
        "steps": [
            {
                "id": "lqc_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter LQC water check",
                "body": "Press Power + Start. Press Start 5 times and listen for water supplying sound. Press Power to turn off.",
                "sourceExcerpt": "How to Check Water supply (LQC Mode)",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    INLET_VALVE,
    HALL_SENSOR,
    DRAIN_PUMP,
    THERMISTOR,
    HEATER,
    WASH_MOTOR,
    VARIO_VALVE,
    LEAK_FLOAT,
    BUBBLE_ERROR,
    EXCESS_FILL,
]

BUNDLES = [test_mode_bundle(), water_supply_bundle()]


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
                if tag.isupper() or tag.endswith("_ERROR") or tag.endswith("_error")
            ],
        }
        for item in PROCEDURES
    ]
    catalog = {
        "manualId": "LG-LDT7808-DISHWASHER",
        "platformId": "lg_dishwasher_ldt7808",
        "templateId": "dishwasher",
        "label": "LG LDT7808 top-control dishwasher (QuadWash / Vario)",
        "notes": "LDT7808ST service manual — error-message troubleshooting §7-1, component flowcharts §7-2, test mode §3-3.",
        "plannedProcedures": entries,
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name} ({len(entries)} procedures)")


def write_readme() -> None:
    readme = OUT / "README.md"
    readme.write_text(
        """# lg_dishwasher_ldt7808 procedure seeds

Manual **LG-LDT7808-DISHWASHER** (LDT7808ST service manual).

Regenerate:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual LG-LDT7808-DISHWASHER
```

Extraction: `frontend/components/diagnostics/knowledge/pattern-catalog/LG_LDT7808ST_DISHWASHER_EXTRACTION.md`
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
        "attach_ldt7808_diagnostic_effects.py",
        "attach_ldt7808_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
