#!/usr/bin/env python3
"""Generate Samsung DV22N heat-pump dryer procedure seeds (pilot P07)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_hp_dryer_dv22n"
PLATFORM = "samsung_hp_dryer_dv22n"

SOURCE = {
    "manualId": "SAMSUNG-HP-DRYER-DV22N",
    "manualTitle": "Samsung DV22N6850 Heat-Pump Dryer (DV6800N)",
    "sourcePdf": "backend/docs/manuals/samsung heat pump dryer dv22n8650.pdf",
    "extractedTextFile": "backend/docs/manuals/samsung heat pump dryer dv22n8650-extracted.txt",
    "verifiedAt": "2026-09-17",
    "verifiedBy": "pilot-prerequisite-ingestion",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dryer or disconnect power before servicing unless a live test is required.",
    "sourceExcerpt": "Execute service after unplugging the power supply unit.",
    "requiresInput": False,
}


def proc(pid, title, oem_num, oem_title, pages, component_ids, tags, steps):
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


def outcome(sid, order, title, text):
    return {
        "id": sid,
        "order": order,
        "type": "outcome",
        "title": title,
        "oemOutcome": text,
        "requiresInput": False,
    }


PROCEDURES = [
    proc(
        "samsungdv22n-door-switch",
        "§4-1: Door open (dC)",
        "4-1",
        "Door sensor circuit",
        [25],
        ["door_switch"],
        ["dC", "door_switch_check"],
        [
            instr("close_door", 2, "Door and harness", "Close door; verify door sensor harness terminals.", "door_ok"),
            outcome("replace_door_switch", 3, "Replace door switch", "Replace door switch or harness."),
            outcome("door_ok", 4, "Door switch OK", "Door authorization verified."),
        ],
    ),
    proc(
        "samsungdv22n-drum-motor",
        "§4-1: BLDC drum motor (3C)",
        "4-1",
        "Drum inverter faults",
        [25, 26],
        ["drive"],
        ["3C", "motor_check"],
        [
            instr("motor_connector", 2, "Drum motor connector", "Verify drum motor connector and belt.", "motor_ok"),
            outcome("replace_inverter", 3, "Replace drum inverter PBA", "Replace drum inverter when motor verified."),
            outcome("motor_ok", 4, "Drum motor OK", "Drum drive path verified."),
        ],
    ),
    proc(
        "samsungdv22n-compressor-inverter",
        "§4-1: Compressor inverter (3CA, HC)",
        "4-1",
        "Heat pump compressor path",
        [25, 26],
        ["compressor", "heat_pump"],
        ["3CA", "HC", "no_heat"],
        [
            instr("compressor_check", 2, "Compressor inverter PBA", "Verify compressor connector, belt, and inverter PBA.", "hp_ok"),
            outcome("replace_compressor_pba", 3, "Replace compressor inverter", "Replace compressor inverter PBA or compressor."),
            outcome("hp_ok", 4, "Compressor path OK", "Heat pump thermal system verified."),
        ],
    ),
    proc(
        "samsungdv22n-refrigerant-thermistors",
        "§4-1: Refrigerant thermistors (tC, tC5, tC7, tC8, tCA)",
        "4-1",
        "Refrigerant circuit NTC",
        [25, 26],
        ["thermistor", "heat_pump"],
        ["tC", "tC5", "tC7", "tC8", "tCA", "no_heat"],
        [
            instr("thermistor_check", 2, "Thermistor resistance", "Measure thermistor 1–5 per §4-1 fault table.", "ntc_ok"),
            outcome("replace_thermistor", 3, "Replace thermistor", "Replace open/short refrigerant thermistor."),
            outcome("ntc_ok", 4, "Thermistors OK", "Refrigerant sensing verified."),
        ],
    ),
    proc(
        "samsungdv22n-condensate-overflow",
        "§4-1: Condensate overflow (5C)",
        "4-1",
        "Water tank / drain path",
        [25],
        ["condensate", "drain"],
        ["5C", "long_dry"],
        [
            instr("tank_drain", 2, "Tank and drain pump", "Empty water tank; verify drain pump and float sensor.", "moisture_ok"),
            outcome("replace_pump", 3, "Replace drain pump", "Replace drain pump or float switch."),
            outcome("moisture_ok", 4, "Moisture rejection OK", "Sealed moisture rejection path verified."),
        ],
    ),
    proc(
        "samsungdv22n-drain-pump-float",
        "§4-5: Float switch and pump motor",
        "4-5",
        "Component test float/pump",
        [35],
        ["drain", "condensate"],
        ["5C", "drain_issue"],
        [
            instr("float_test", 2, "Float switch", "Float up 0–200 mΩ; float down OL.", "pump_test"),
            instr("pump_test", 3, "Pump motor 770 Ω", "Measure pump motor resistance 770 Ω.", "drain_ok"),
            outcome("replace_float_pump", 4, "Replace float or pump", "Replace float switch or pump motor."),
            outcome("drain_ok", 5, "Drain path OK", "Condensate removal verified."),
        ],
    ),
    proc(
        "samsungdv22n-power-supply",
        "§4-1: Supply voltage (9C1, 9C2)",
        "4-1",
        "Power condition fault",
        [25, 26],
        ["supply"],
        ["9C1", "9C2", "no_power"],
        [
            instr("voltage_check", 2, "Operating voltage", "Verify supply voltage during heat/dry operation.", "supply_ok"),
            outcome("replace_main_pba", 3, "Replace main PBA", "Replace main PBA when supply verified."),
            outcome("supply_ok", 4, "Supply OK", "Power supply verified."),
        ],
    ),
    proc(
        "samsungdv22n-pba-communication",
        "§4-1: PBA communication (AC, AC6)",
        "4-1",
        "Main ↔ inverter communication",
        [25, 26],
        ["main_control"],
        ["AC", "AC6", "hmi_check"],
        [
            instr("harness_check", 2, "Main ↔ inverter harness", "Verify wire connections between main and inverter PBAs.", "comm_ok"),
            outcome("replace_pba", 3, "Replace PBA", "Replace main or inverter PBA."),
            outcome("comm_ok", 4, "Communication OK", "PBA communication verified."),
        ],
    ),
    proc(
        "samsungdv22n-hmi-button",
        "§4-1: Button stuck (bC2)",
        "4-1",
        "Display PCB key circuit",
        [25],
        ["display_panel"],
        ["bC2", "hmi_check"],
        [
            instr("keypad_check", 2, "Display PCB keys", "Check display PCB key circuit for short.", "hmi_ok"),
            outcome("replace_display", 3, "Replace display PCB", "Replace display PCB when key short confirmed."),
            outcome("hmi_ok", 4, "HMI OK", "Button circuit verified."),
        ],
    ),
    proc(
        "samsungdv22n-lint-filter",
        "§4-1: Case filter restriction (tC)",
        "4-1",
        "Lint filter / airflow",
        [25],
        ["lint_filter"],
        ["tC", "long_dry"],
        [
            instr("clean_filter", 2, "Clean case filter", "Clean case filter per tC error guidance.", "filter_ok"),
            outcome("filter_ok", 3, "Filter path OK", "Case filter restriction cleared."),
        ],
    ),
]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "electric_dryer",
        "label": "Samsung DV22N6850 heat-pump dryer",
        "notes": "Pilot P07 — heat_pump_dryer composition/reference consumption.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = f"""# Samsung DV22N heat-pump dryer (`{PLATFORM}`)

**Manual:** SAMSUNG-HP-DRYER-DV22N — DV22N6850HX/A2  
**Extraction:** `knowledge/pattern-catalog/SAMSUNG_HP_DRYER_DV22N_EXTRACTION.md`

{len(PROCEDURES)} procedures for pilot P07 prerequisite ingestion.

```bash
python backend/scripts/generate_samsung_hp_dryer_dv22n_procedure_seeds.py
python backend/scripts/run_normalization_pipeline.py --manual SAMSUNG-HP-DRYER-DV22N
```
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for item in PROCEDURES:
        path = OUT / f"{item['id']}.json"
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")
    write_catalog()
    write_readme()
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: validate reported errors.", file=sys.stderr)


if __name__ == "__main__":
    main()
