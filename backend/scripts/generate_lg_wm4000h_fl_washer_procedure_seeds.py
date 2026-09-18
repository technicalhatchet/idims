#!/usr/bin/env python3
"""Generate LG WM4000H*A front-load washer procedure seeds (pilot P03)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "lg_fl_washer_wm4000"
PLATFORM = "lg_fl_washer_wm4000"

SOURCE = {
    "manualId": "LG-FL-WASHER",
    "manualTitle": "LG WM4000H*A Front-Load Washer (WM3400–WM4000 family)",
    "sourcePdf": "backend/docs/manuals/lg wm4000h fl washer service manual.pdf",
    "extractedTextFile": "backend/docs/manuals/lg wm4000h fl washer service manual-extracted.txt",
    "verifiedAt": "2026-09-17",
    "verifiedBy": "pilot-prerequisite-ingestion",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the washer or disconnect power before servicing. Replace all panels before operating.",
    "sourceExcerpt": "Disconnect power before servicing the unit.",
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
        "lgwm4000-power",
        "§4: Power / MAIN PWB supply",
        "4",
        "Installation and power",
        [8, 53],
        ["supply", "control_board"],
        ["no_power"],
        [
            instr("check_outlet", 2, "Outlet and cord", "Verify 120 VAC at outlet and power cord to MAIN PWB.", "main_pwb_check"),
            instr("main_pwb_check", 3, "MAIN PWB supply", "Check MAIN PWB power input and noise filter path.", "power_ok"),
            outcome("replace_main_pwb", 4, "Replace MAIN PWB", "Replace MAIN PWB when supply verified but control dead."),
            outcome("power_ok", 5, "Power path OK", "Supply and MAIN PWB input verified."),
        ],
    ),
    proc(
        "lgwm4000-door-lock",
        "§8: Door lock",
        "8",
        "Door lock component test",
        [33, 53],
        ["door_lock"],
        ["door_lock_check"],
        [
            instr("lock_harness", 2, "Door lock harness", "Verify DOOR LOCK harness at MAIN PWB.", "lock_ok"),
            outcome("replace_lock", 3, "Replace door lock", "Replace door lock assembly when harness verified."),
            outcome("lock_ok", 4, "Door lock OK", "Door lock verified."),
        ],
    ),
    proc(
        "lgwm4000-drain-pump",
        "§8: Drain pump",
        "8",
        "Drain pump component test",
        [33, 48, 53],
        ["drain_pump"],
        ["drain_failure"],
        [
            instr("pump_access", 2, "Drain pump connector", "Verify DRAIN PUMP harness and impeller.", "pump_ok"),
            outcome("replace_pump", 3, "Replace drain pump", "Replace drain pump when harness verified."),
            outcome("pump_ok", 4, "Drain pump OK", "Drain pump verified."),
        ],
    ),
    proc(
        "lgwm4000-motor-circuit",
        "§8: Direct-drive motor",
        "8",
        "Motor circuit (U/V/W)",
        [4, 33, 53],
        ["drive_motor"],
        ["motor_check"],
        [
            instr("motor_harness", 2, "Motor U/V/W harness", "Verify MOTOR connector at MAIN PWB — Direct Drive System.", "motor_ok"),
            outcome("replace_motor", 3, "Replace stator/motor", "Replace drive motor when harness verified."),
            outcome("motor_ok", 4, "Motor circuit OK", "Direct-drive motor path verified."),
        ],
    ),
    proc(
        "lgwm4000-wash-thermistor",
        "§8: Wash thermistor",
        "8",
        "WASH THERMISTOR",
        [33, 53],
        ["wash_ntc"],
        ["heating_failure"],
        [
            instr("ntc_harness", 2, "Wash thermistor harness", "Disconnect WASH THERMISTOR at MAIN PWB.", "ntc_ok"),
            outcome("replace_ntc", 3, "Replace wash thermistor", "Replace thermistor when out of range."),
            outcome("ntc_ok", 4, "Wash thermistor OK", "Wash thermistor verified."),
        ],
    ),
    proc(
        "lgwm4000-pressure-sensor",
        "§8: Pressure sensor",
        "8",
        "PRESSURE SENSOR",
        [33, 53],
        ["water_level_sensor", "pressure_hose"],
        ["water_level_failure"],
        [
            instr("sensor_harness", 2, "Pressure sensor harness", "Verify PRESSURE SENSOR connector and hose.", "sensor_ok"),
            outcome("replace_sensor", 3, "Replace pressure sensor", "Replace sensor or hose when harness verified."),
            outcome("sensor_ok", 4, "Pressure sensor OK", "Water level pressure path verified."),
        ],
    ),
    proc(
        "lgwm4000-inlet-valves",
        "§8: Inlet and dispenser valves",
        "8",
        "Inlet / bleach / pre-wash valves",
        [33, 53],
        ["inlet_valve", "dosing_pump"],
        ["fill_failure"],
        [
            instr("valve_harness", 2, "Valve harnesses", "Check VALVE HOT, INLET, PRE, and BLEACH solenoids at MAIN PWB.", "valves_ok"),
            outcome("replace_valve", 3, "Replace inlet valve", "Replace failed solenoid or valve assembly."),
            outcome("valves_ok", 4, "Inlet valves OK", "Fill valve path verified."),
        ],
    ),
    proc(
        "lgwm4000-wash-heater",
        "§8: Washer heater",
        "8",
        "WASHER HEATER (WM3900/WM4000)",
        [33, 53],
        ["wash_heater"],
        ["heating_failure", "no_heat"],
        [
            instr("heater_harness", 2, "Washer heater harness", "Verify WASHER HEATER at MAIN PWB — WM3900/WM4000 only.", "heater_ok"),
            outcome("replace_heater", 3, "Replace wash heater", "Replace heater element when harness verified."),
            outcome("heater_ok", 4, "Wash heater OK", "Wash heater verified."),
        ],
    ),
    proc(
        "lgwm4000-circulation-pump",
        "§8: Circulation pump",
        "8",
        "CIRCULATION PUMP (WM3900/WM4000)",
        [33, 53],
        ["recirc_pump"],
        ["recirc_failure"],
        [
            instr("circ_pump_harness", 2, "Circulation pump harness", "Verify CIRCULATION PUMP at MAIN PWB — LG implementation label.", "circ_ok"),
            outcome("replace_circ_pump", 3, "Replace circulation pump", "Replace circulation pump when harness verified."),
            outcome("circ_ok", 4, "Circulation pump OK", "Recirculation path verified — maps to canonical recirc_pump via overlay."),
        ],
    ),
    proc(
        "lgwm4000-display-comm",
        "§8: DISPLAY PWB ↔ MAIN PWB",
        "8",
        "Display board communication",
        [33, 53],
        ["hmi_control", "control_board"],
        ["hmi_check"],
        [
            instr("display_harness", 2, "DISPLAY PWB harness", "Verify DISPLAY PWB 10-pin harness to MAIN PWB.", "display_ok"),
            outcome("replace_display_pwb", 3, "Replace DISPLAY PWB", "Replace DISPLAY PWB or MAIN PWB per comm fault."),
            outcome("display_ok", 4, "Display comm OK", "DISPLAY PWB ↔ MAIN PWB communication verified."),
        ],
    ),
    proc(
        "lgwm4000-vibration-sensor",
        "§8: Vibration sensor",
        "8",
        "VIBRATION SENSOR (WM3600/WM4000)",
        [33, 53],
        ["suspension"],
        ["vibration_unbalance", "UB"],
        [
            instr("vib_harness", 2, "Vibration sensor harness", "Verify VIBRATION SENSOR at MAIN PWB.", "vib_ok"),
            outcome("replace_vib_sensor", 3, "Replace vibration sensor", "Replace vibration sensor when harness verified."),
            outcome("vib_ok", 4, "Vibration sensor OK", "Unbalance detection path verified."),
        ],
    ),
    proc(
        "lgwm4000-smart-diagnosis",
        "§2: Smart Diagnosis / ThinQ",
        "2",
        "SMART DIAGNOSIS and Wi-Fi",
        [4, 6, 15],
        ["hmi_control"],
        ["hmi_check", "smart_diagnosis"],
        [
            instr("wifi_check", 2, "Wi-Fi and ThinQ", "Verify 2.4 GHz Wi-Fi connection and ThinQ registration.", "smart_diag"),
            instr("smart_diag", 3, "Smart Diagnosis", "Run Smart Diagnosis from control panel or ThinQ app.", "diag_ok"),
            outcome("replace_wifi", 4, "Replace Wi-Fi module", "Replace Wi-Fi module or DISPLAY PWB when Smart Diagnosis fails."),
            outcome("diag_ok", 5, "Smart Diagnosis OK", "Connected diagnostics path verified — LG implementation overlay."),
        ],
    ),
]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "washer",
        "label": "LG WM4000H*A front-load washer (WM3400–WM4000)",
        "notes": "Pilot P03 — third-manufacturer FL mapping on frozen front_load_washer.",
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
    readme = f"""# LG WM4000H FL washer (`{PLATFORM}`)

**Manual:** LG-FL-WASHER — WM4000H*A TurboWash Direct Drive family  
**Extraction:** `knowledge/pattern-catalog/LG_FL_WM4000H_WASHER_EXTRACTION.md`

{len(PROCEDURES)} procedures for pilot P03 prerequisite ingestion.

```bash
python backend/scripts/generate_lg_wm4000h_fl_washer_procedure_seeds.py
python backend/scripts/run_normalization_pipeline.py --manual LG-FL-WASHER
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
