#!/usr/bin/env python3
"""Generate Samsung NE58H/NE58R induction slide-in range procedure seeds (pilot P05)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_range_ne58h_induction"
PLATFORM = "samsung_range_ne58"

SOURCE = {
    "manualId": "SAMSUNG-NE58H-INDUCTION-RANGE",
    "manualTitle": "Samsung NE58R9560WS Slide-In Induction Range",
    "sourcePdf": "backend/docs/manuals/samsunginductionne58h.pdf",
    "extractedTextFile": "backend/docs/manuals/samsunginductionne58h-extracted.txt",
    "verifiedAt": "2026-09-17",
    "verifiedBy": "pilot-prerequisite-ingestion",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Disconnect electrical power at breaker before servicing. Replace all panels before operating.",
    "sourceExcerpt": "Disconnect power before servicing the range.",
    "requiresInput": False,
}


def proc(pid, title, oem_num, oem_title, pages, component_ids, tags, steps):
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    return {
        "id": pid,
        "version": "1.0.0",
        "title": title,
        "platformId": PLATFORM,
        "templateIds": ["induction_range"],
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
        "ne58h-power",
        "§4-3: No power / terminal block",
        "4-3",
        "Power troubleshooting",
        [57],
        ["supply", "main_control"],
        ["no_power"],
        [
            instr("check_breaker", 2, "Breaker and terminal block", "Verify 220–240 VAC at terminal block.", "smps_check"),
            instr("smps_check", 3, "Main PCB SMPS", "Check SMPS 5 V / 12 V on main PCB.", "power_ok"),
            outcome("replace_pcb", 4, "Replace main PCB", "Replace main PCB when supply verified but SMPS failed."),
            outcome("power_ok", 5, "Power path OK", "Supply and SMPS verified."),
        ],
    ),
    proc(
        "ne58h-cf0-main-sub",
        "C-F0: Main ↔ sub PCB communication",
        "4-1",
        "Failure display C-F0",
        [36, 37],
        ["main_control"],
        ["C-F0", "hmi_check"],
        [
            instr("check_connectors", 2, "Main and sub connectors", "Verify main and sub PCB connectors seated.", "comm_ok"),
            outcome("replace_main", 3, "Replace main PCB", "Replace main PCB when connectors verified."),
            outcome("comm_ok", 4, "Communication OK", "Main ↔ sub communication verified."),
        ],
    ),
    proc(
        "ne58h-cf2-touch",
        "C-F2: Touch PCB communication",
        "4-1",
        "Failure display C-F2",
        [36, 37],
        ["display_panel"],
        ["C-F2", "hmi_check"],
        [
            instr("sub_touch", 2, "Sub PCB touch harness", "Verify sub PCB connector and touch PCB harness.", "touch_ok"),
            outcome("replace_sub", 3, "Replace sub or control PCB", "Replace sub PCB or control PCB per manual."),
            outcome("touch_ok", 4, "Touch comm OK", "Touch communication verified."),
        ],
    ),
    proc(
        "ne58h-c20-oven-sensor",
        "C-20: Oven temperature sensor",
        "4-1",
        "Oven sensor open/short",
        [37],
        ["thermistor"],
        ["C-20", "sensor_check"],
        [
            instr("sensor_access", 2, "Oven sensor harness", "Disconnect sensor at main PCB CN320 path.", "sensor_ok"),
            outcome("replace_sensor", 3, "Replace oven sensor", "Replace oven sensor or main PCB per C-20 flow."),
            outcome("sensor_ok", 4, "Oven sensor OK", "Oven sensor verified."),
        ],
    ),
    proc(
        "ne58h-c21-abnormal-temp",
        "C-21: Abnormal internal temperature",
        "4-1",
        "Oven over-temperature",
        [37],
        ["bake_element", "broil_element", "thermistor"],
        ["C-21", "no_bake"],
        [
            instr("sensor_ohms", 2, "Oven sensor ~1080 Ω", "Measure oven sensor at room temperature.", "relay_check"),
            instr("relay_check", 3, "Bake/broil/convection relays", "Verify DLB, bake, broil, convection relays on main PCB.", "temp_ok"),
            outcome("replace_main", 4, "Replace main PCB", "Replace main PCB when heaters and sensor verified."),
            outcome("temp_ok", 5, "Thermal path OK", "Abnormal temp path cleared."),
        ],
    ),
    proc(
        "ne58h-cd1-door-lock",
        "C-d1: Door lock mispositioned",
        "4-1",
        "Door lock motor",
        [36],
        ["door_lock"],
        ["C-d1", "door_lock_check"],
        [
            instr("lock_harness", 2, "Door lock harness", "Verify harness to lock motor and microswitch.", "lock_ok"),
            outcome("replace_lock", 3, "Replace door lock", "Replace door lock motor or switch."),
            outcome("lock_ok", 4, "Door lock OK", "Door lock verified."),
        ],
    ),
    proc(
        "ne58h-induction-igbt-sensor",
        "Cooktop: IGBT sensor open/short",
        "4-2",
        "Assy-Inverter Module IGBT sensor",
        [41, 56],
        ["surface_element"],
        ["igbt_check", "surface_burner"],
        [
            instr("inverter_access", 2, "Assy-Inverter Module", "Access inverter module — IGBT sensor open/short flows.", "igbt_ok"),
            outcome("replace_inverter", 3, "Replace Assy-Inverter Module", "Replace inverter PCB when IGBT sensor fault confirmed."),
            outcome("igbt_ok", 4, "IGBT sensor OK", "IGBT sensor path verified — platform overlay vocabulary."),
        ],
    ),
    proc(
        "ne58h-induction-pan-detection",
        "Cooktop: Pan detection / unsuitable cookware",
        "4-2",
        "Pan detection fault",
        [41],
        ["surface_element"],
        ["surface_burner", "long_bake"],
        [
            instr("cookware_check", 2, "Suitable cookware", "Verify suitable ferrous cookware on induction zone.", "pan_ok"),
            outcome("replace_inverter_touch", 3, "Replace inverter or touch PCB", "Replace Assy-Inverter Module or touch PCB."),
            outcome("pan_ok", 4, "Pan detection OK", "Pan detection verified."),
        ],
    ),
    proc(
        "ne58h-induction-comm-inverter",
        "Cooktop: Display ↔ inverter communication",
        "4-2",
        "Inverter communication",
        [56, 57],
        ["surface_element", "display_panel"],
        ["hmi_check"],
        [
            instr("inverter_voltage", 2, "Inverter CN101 5V/12V", "Measure inverter module supply and communication harness.", "comm_inverter_ok"),
            outcome("replace_inverter_pcb", 3, "Replace inverter PCB", "Replace Assy-Inverter Module or filter PCB fuse path."),
            outcome("comm_inverter_ok", 4, "Inverter comm OK", "Display ↔ inverter communication verified."),
        ],
    ),
    proc(
        "ne58h-bake-element",
        "§4-3: Bake element component test",
        "4-3",
        "Bake heater",
        [44],
        ["bake_element"],
        ["no_bake", "heating_element_check"],
        [
            instr("bake_disconnect", 2, "Bake harness", "Disconnect bake element harness.", "bake_ok"),
            outcome("replace_bake", 3, "Replace bake element", "Replace bake element when out of range."),
            outcome("bake_ok", 4, "Bake element OK", "Bake element verified."),
        ],
    ),
    proc(
        "ne58h-convection-fan",
        "§4-3: Convection fan motor",
        "4-3",
        "Convection fan",
        [44],
        ["convection_fan"],
        ["long_bake"],
        [
            instr("fan_check", 2, "Convection fan motor", "Measure convection fan motor and voltage when cycling.", "fan_ok"),
            outcome("replace_fan", 3, "Replace convection fan", "Replace fan motor or convection element."),
            outcome("fan_ok", 4, "Convection fan OK", "Convection fan verified."),
        ],
    ),
]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "induction_range",
        "label": "Samsung NE58R9560 induction slide-in range",
        "notes": "Pilot P05 — implementation terminology stress on frozen range_oven.",
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
    readme = f"""# Samsung NE58H induction range (`{PLATFORM}` + `induction_range`)

**Manual:** SAMSUNG-NE58H-INDUCTION-RANGE — NE58R9560WS induction slide-in  
**Extraction:** `knowledge/pattern-catalog/SAMSUNG_NE58H_INDUCTION_RANGE_EXTRACTION.md`

{len(PROCEDURES)} procedures for pilot P05 prerequisite ingestion.

```bash
python backend/scripts/generate_samsung_ne58h_induction_range_procedure_seeds.py
python backend/scripts/run_normalization_pipeline.py --manual SAMSUNG-NE58H-INDUCTION-RANGE
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
