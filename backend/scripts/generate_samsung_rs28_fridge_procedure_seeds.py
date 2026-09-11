#!/usr/bin/env python3
"""Generate Samsung RS28/RS23 SxS refrigerator procedure seed JSON (delta on samsung_sxs)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_sxs"
BUNDLE_OUT = OUT / "bundles"
CATALOG_PATH = OUT / "procedureCatalog.json"

SOURCE = {
    "manualId": "SAMSUNG-RS28-SXS",
    "manualTitle": "Samsung RS28/RS23 Side-by-Side Refrigerator (SpaceMax)",
    "extractedTextFile": "backend/docs/manuals/samsung rs28 sxs-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the refrigerator before servicing electrical parts. For voltage checks on powered circuits, use appropriate PPE and one-hand test technique.",
    "sourceExcerpt": "Unplug the appliance before the changing or repairing the electric parts.",
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
        "platformId": "samsung_sxs",
        "componentIds": component_ids,
        "tags": tags,
        "source": {**SOURCE, "oemTestNumber": oem_num, "oemTestTitle": oem_title, "pages": pages},
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
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


def outcome(sid, order, title, text):
    return {
        "id": sid,
        "order": order,
        "type": "outcome",
        "title": title,
        "oemOutcome": text,
        "requiresInput": False,
    }


def ohm_branches(prefix, pass_next, fail_next, pass_label="In range"):
    return [
        {"id": f"{prefix}_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_crit", "label": "Critical", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


def sensor_voltage_proc(pid, title, led_name, connector, pins, component_ids, tags, *, pages=(67, 68), note=""):
    body = f"Measure voltage {connector} {pins} — 4.5 V warm → 1.0 V cold per OEM table."
    if note:
        body = f"{body} {note}"
    return proc(
        pid,
        title,
        "4-2",
        f"Self-diagnostic — {led_name}",
        list(pages),
        component_ids,
        tags,
        [
            instr(
                "apply_power",
                2,
                "Apply power for voltage test",
                "Restore power. Allow control to stabilize. Measure sensor voltage at MAIN PCB with harness connected.",
                "sensor_voltage",
            ),
            meas(
                "sensor_voltage",
                3,
                "Sensor voltage",
                body,
                "refrigeratorThermistorVoltage",
                connector,
                pins,
                ohm_branches("sv", "sensor_ok", "replace_sensor", "4.5–1.0 V"),
            ),
            outcome("replace_sensor", 4, "Replace sensor", f"Replace {led_name} sensor or repair harness when voltage out of range."),
            outcome("sensor_ok", 5, "Sensor verified", f"{led_name} voltage and connections verified."),
        ],
    )


def fan_voltage_proc(pid, title, fan_name, pins, tags):
    return proc(
        pid,
        f"§4-2: {fan_name} fan feedback",
        "4-2",
        f"Self-diagnostic — {fan_name}-FAN",
        [67, 68],
        ["evap_fan"],
        tags,
        [
            instr(
                "fan_run",
                2,
                "Command fan on",
                "Close doors 1 minute so evaporator fan runs. Door-open may stop F-fan; C-fan may run with door open.",
                "fan_voltage",
            ),
            meas(
                "fan_voltage",
                3,
                "Fan feedback voltage",
                f"Measure CN20 {pins} — 7–12 V while fan commanded.",
                "refrigeratorEvapFanFeedbackVoltage",
                "CN20",
                pins,
                ohm_branches("fan", "fan_ok", "replace_fan", "7–12 V"),
            ),
            outcome("replace_fan", 4, "Replace fan", f"Replace {fan_name} fan motor or repair harness/feedback line."),
            outcome("fan_ok", 5, "Fan verified", f"{fan_name}-FAN feedback verified."),
        ],
    )


def comm_error_proc(pid, title, code, component_ids, tags, pages=(69,)):
    return proc(
        pid,
        title,
        "4-2",
        f"Self-diagnostic — {code}",
        list(pages),
        component_ids,
        tags,
        [
            visual(
                "code_active",
                2,
                f"{code} active",
                f"{code} displayed on panel. Verify harness seating and moisture before condemning PCBs.",
                cp_yes_no("code_yes", "check_harness", "code_no", "comm_ok", f"{code} not present — verify complaint."),
            ),
            instr(
                "check_harness",
                3,
                "Verify harness",
                "Inspect door-hinge harness, ribbon/LVDS, and connector pins for damage or moisture.",
                "comm_restored",
            ),
            visual(
                "comm_restored",
                4,
                f"{code} cleared",
                f"After harness repair and power cycle, is {code} cleared?",
                cp_yes_no("comm_ok_yes", "comm_path_ok", "replace_boards", "replace_boards_out", "Replace affected PCB(s) per manual."),
            ),
            outcome("comm_ok", 5, "No comm fault", "Communication normal."),
            outcome("replace_boards_out", 6, "Replace PCB(s)", f"Replace PCB(s) when harness verified good and {code} persists."),
            outcome("comm_path_ok", 7, "Communication OK", f"{code} cleared after harness service."),
        ],
    )


PROCEDURES = [
    sensor_voltage_proc(
        "samsungrs28-f-sensor",
        "§4-2: Freezer cabinet sensor (F-Sensor)",
        "F-Sensor",
        "CN20",
        "1 ↔ 3",
        ["thermistor"],
        ["thermistor", "sensor_check", "not_cooling"],
    ),
    sensor_voltage_proc(
        "samsungrs28-r-sensor",
        "§4-2: Fresh-food cabinet sensor (R-Sensor)",
        "R-Sensor",
        "CN20",
        "10 ↔ 12",
        ["thermistor"],
        ["thermistor", "sensor_check", "weak_cooling_ff", "8E"],
        note="LED-panel RS28T5B models may use CN20 2 ↔ 4 instead.",
    ),
    sensor_voltage_proc(
        "samsungrs28-f-def-sensor",
        "§4-2: Freezer defrost sensor (F-DEF-Sensor)",
        "F-DEF-Sensor",
        "CN20",
        "5 ↔ 7",
        ["thermistor"],
        ["thermistor", "defrost", "frost_buildup", "5E", "SE"],
    ),
    sensor_voltage_proc(
        "samsungrs28-ambient-sensor",
        "§4-2: Ambient sensor",
        "Ambient-Sensor",
        "CN40",
        "18 ↔ 20",
        ["thermistor"],
        ["thermistor", "sensor_check"],
    ),
    sensor_voltage_proc(
        "samsungrs28-humidity-sensor",
        "§4-2: Humidity sensor",
        "Humidity-Sensor",
        "CN40",
        "14 ↔ 20",
        ["thermistor"],
        ["thermistor", "sensor_check", "14E"],
    ),
    sensor_voltage_proc(
        "samsungrs28-ice-maker-sensor",
        "§4-2: Ice maker sensor",
        "Ice Maker Sensor",
        "CN90",
        "11 ↔ 13",
        ["thermistor", "ice_maker_module"],
        ["ice_maker", "thermistor", "no_ice"],
    ),
    fan_voltage_proc(
        "samsungrs28-f-fan",
        "Freezer evaporator",
        "F",
        "15 ↔ 17",
        ["evap_fan", "airflow", "not_cooling", "22E"],
    ),
    fan_voltage_proc(
        "samsungrs28-c-fan",
        "Condenser",
        "C",
        "22 ↔ 24",
        ["evap_fan", "condenser_fan", "airflow", "not_cooling", "22C"],
    ),
    proc(
        "samsungrs28-f-defrost-heater",
        "§4-2: Freezer defrost heater (F-DEF)",
        "4-2",
        "Self-diagnostic — F-DEF heater",
        [68, 101],
        ["heater"],
        ["defrost_heater", "frost_buildup", "no_defrost"],
        [
            instr(
                "disconnect_cn70",
                2,
                "Disconnect CN70/CN85",
                "Power off. Disconnect MAIN PCB CN70 and CN85 harnesses before resistance test.",
                "f_def_heater_ohms",
            ),
            meas(
                "f_def_heater_ohms",
                3,
                "F-DEF heater resistance",
                "CN70 pin 5 ↔ CN85 pin 3 — 63 Ω (115 V) or 230 Ω (230 V) ±7%. 0 Ω = short; OL = open heater or bimetal.",
                "samsungRefrigeratorDefrostHeaterOhms",
                "CN70",
                "5 ↔ CN85-3",
                ohm_branches("f_def", "f_heater_ok", "replace_f_heater", "63/230 Ω ±7%"),
            ),
            outcome("replace_f_heater", 4, "Replace F-DEF heater", "Replace defrost heater or bimetal when out of range."),
            outcome("f_heater_ok", 5, "F-DEF heater OK", "Freezer defrost heater resistance verified."),
        ],
    ),
    proc(
        "samsungrs28-damper-heater",
        "§4-2: R-room damper heater",
        "4-2",
        "Self-diagnostic — Damper Heater",
        [68, 101],
        ["damper_motor", "heater"],
        ["defrost_heater", "damper", "airflow", "weak_cooling_ff", "RD"],
        [
            instr(
                "disconnect_cn40",
                2,
                "Disconnect CN40",
                "Power off. Disconnect CN40 from MAIN PCB before resistance test.",
                "damper_heater_ohms",
            ),
            meas(
                "damper_heater_ohms",
                3,
                "Damper heater resistance",
                "CN40 pin 25 ↔ pin 27 — 48 Ω ±7% (RS28A500). LED-panel RS28T5B manuals may list 7–12 V when commanded.",
                "samsungRs28DamperHeaterOhms",
                "CN40",
                "25 ↔ 27",
                ohm_branches("damper", "damper_ok", "replace_damper", "48 Ω ±7%"),
            ),
            outcome("replace_damper", 4, "Replace damper heater", "Replace R-room damper heater or damper assembly when out of range."),
            outcome("damper_ok", 5, "Damper heater OK", "R-room damper heater resistance verified."),
        ],
    ),
    proc(
        "samsungrs28-ice-pipe-heater",
        "§4-2: Ice pipe heater",
        "4-2",
        "Self-diagnostic — Ice Pipe Heater",
        [68, 101],
        ["ice_pipe_heater"],
        ["ice_maker", "water_dispenser", "33E"],
        [
            instr(
                "ice_pipe_run",
                2,
                "Command ice pipe heater",
                "Dispense water or run ice maker fill so ice pipe heater is commanded on.",
                "ice_pipe_voltage",
            ),
            meas(
                "ice_pipe_voltage",
                3,
                "Ice pipe heater voltage",
                "CN90 pin 1 ↔ pin 5 — 7–12 V while heater commanded.",
                "refrigeratorEvapFanFeedbackVoltage",
                "CN90",
                "1 ↔ 5",
                ohm_branches("ice_pipe", "ice_pipe_ok", "replace_ice_pipe", "7–12 V"),
            ),
            outcome("replace_ice_pipe", 4, "Replace ice pipe heater", "Replace ice pipe heater or repair harness when voltage out of range."),
            outcome("ice_pipe_ok", 5, "Ice pipe heater OK", "Ice pipe heater voltage verified."),
        ],
    ),
    proc(
        "samsungrs28-ice-maker-function",
        "§4-2: Ice maker function",
        "4-2",
        "Self-diagnostic — Ice Maker Function",
        [68],
        ["ice_maker_module"],
        ["ice_maker", "no_ice"],
        [
            visual(
                "im_error_count",
                2,
                "Ice maker error history",
                "Freezer ice maker error displays after 3 failures. Inspect fill tube, harness, and module installation.",
                cp_yes_no("im_clear", "im_test", "replace_im", "replace_im_out", "Replace ice maker module and verify harvest."),
            ),
            instr(
                "im_test",
                3,
                "Verify ice maker operation",
                "After replacement, confirm harvest cycle and fill complete without repeating error.",
                "im_ok",
            ),
            outcome("replace_im_out", 4, "Replace ice maker", "Replace ice maker module when function error persists."),
            outcome("im_ok", 5, "Ice maker OK", "Ice maker function verified after service."),
        ],
    ),
    comm_error_proc(
        "samsungrs28-panel-communication",
        "§4-2: Panel communication (41Er)",
        "41Er",
        ["display_panel", "main_control"],
        ["41Er", "41E", "hmi_check", "display_dead"],
    ),
    comm_error_proc(
        "samsungrs28-inverter-communication",
        "§4-2: Inverter communication (44Er)",
        "44Er",
        ["inverter_board", "main_control"],
        ["44Er", "44E", "hmi_check", "not_cooling"],
    ),
    comm_error_proc(
        "samsungrs28-io-expander-communication",
        "§4-2: I/O expander communication (46Er)",
        "46Er",
        ["main_control"],
        ["46Er", "46E", "hmi_check"],
    ),
    comm_error_proc(
        "samsungrs28-dispenser-communication",
        "§4-2: Dispenser panel communication (47Er)",
        "47Er",
        ["dispenser_panel", "main_control"],
        ["47Er", "47E", "hmi_check", "water_dispenser"],
    ),
    comm_error_proc(
        "samsungrs28-wifi-communication",
        "§4-2: Wi-Fi communication (52Er)",
        "52Er",
        ["display_panel", "main_control"],
        ["52Er", "52E", "hmi_check"],
    ),
]


def engineer_test_bundle() -> dict:
    return {
        "id": "samsungrs28-engineer-test-entry",
        "version": "1.0.0",
        "platformId": "samsung_sxs",
        "manualId": SOURCE["manualId"],
        "title": "Samsung RS28 — Engineer mode / Force Run entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["lcd_in_door"],
        "description": "Enter Fridge Function Test for Force Run and Force Defrost (§4-2-1).",
        "tags": ["service_diagnostic", "defrost", "load_test"],
        "entryStepId": "eng_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [48, 51]},
        "steps": [
            instr(
                "eng_enter",
                1,
                "Enter engineer mode",
                "Within 3 s touch A-B-A-B-A-B on display (toast: Engineer mode). Choose Fridge Function Test.",
                "eng_force_run",
            ),
            instr(
                "eng_force_run",
                2,
                "Force Run / Force Defrost",
                "Force Run 1/2/3 (FF 1/2/A) runs compressor + F-fan 24 h. Force Defrost (Fd) defrosts F+R compartments. TEST CANCEL or power cycle exits.",
                "@continue",
            ),
        ],
    }


def led_test_mode_bundle() -> dict:
    return {
        "id": "samsungrs28-led-test-mode-entry",
        "version": "1.0.0",
        "platformId": "samsung_sxs",
        "manualId": SOURCE["manualId"],
        "title": "Samsung RS28 — LED test mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console"],
        "description": "Enter test mode for manual operation and forced defrost (§4-2-8).",
        "tags": ["service_diagnostic", "defrost", "load_test"],
        "entryStepId": "tm_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [60, 62]},
        "steps": [
            instr(
                "tm_enter",
                1,
                "Enter test mode",
                "Press Fridge + Power Cool simultaneously 6 s — display blinks 0.5 s. Release and press Power Cool to enter test mode.",
                "tm_cycle",
            ),
            instr(
                "tm_cycle",
                2,
                "Test mode sequence",
                "Within 15 s press any key: FF (manual op) → Fd (forced F defrost) → cancel (display off). Power cycle cancels.",
                "@continue",
            ),
        ],
    }


def self_diagnostic_bundle() -> dict:
    return {
        "id": "samsungrs28-self-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "samsung_sxs",
        "manualId": SOURCE["manualId"],
        "title": "Samsung RS28 — Self-diagnostic entry",
        "modeKind": "hmi_test",
        "uiVariants": ["any"],
        "description": "Run self-diagnostic checklist (touchscreen §4-2-2 or LED keys §4-2-9).",
        "tags": ["service_diagnostic", "sensor_check"],
        "entryStepId": "sd_enter_touch",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [52, 64]},
        "steps": [
            instr(
                "sd_enter_touch",
                1,
                "Touchscreen self-diagnosis",
                "Engineer mode → Fridge Function Test → Self Diagnosis. Errors list for 60 s (§4-2-2).",
                "sd_enter_led",
            ),
            instr(
                "sd_enter_led",
                2,
                "LED panel self-diagnosis",
                "Fridge + Power Cool 6 s (display blinks 4 s) then hold 10 s total — ding-dong, fault LEDs blink 30 s (§4-2-9). Cancel: Fridge + Power Cool 10 s.",
                "@continue",
            ),
        ],
    }


BUNDLES = [engineer_test_bundle(), led_test_mode_bundle(), self_diagnostic_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    rs28_entries = [
        {
            "id": item["id"],
            "oemSection": item["source"]["oemTestNumber"],
            "title": item["title"],
            "status": "generated",
            "relatedCodes": [
                t
                for t in item.get("tags", [])
                if t.endswith("Er") or t.endswith("E") and len(t) <= 4
            ],
        }
        for item in PROCEDURES
    ]
    existing = []
    if CATALOG_PATH.exists():
        data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        existing = [e for e in data.get("plannedProcedures", []) if not e["id"].startswith("samsungrs28-")]
    catalog = {
        "manualId": "SAMSUNG-RS28-SXS",
        "platformId": "samsung_sxs",
        "templateId": "refrigerator",
        "label": "Samsung SxS refrigerator (RF260B + RS28/RS23)",
        "notes": "RF260B §4-1-3 (CN30/CN76) + RS28 §4-2 checklist (CN20/CN40/CN90). Shared samsung_sxs platform.",
        "plannedProcedures": existing + rs28_entries,
    }
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# Samsung SxS refrigerator (`samsung_sxs`)

**Manuals:**
- `SAMSUNG-RF260B-FRIDGE` — RF260B*/RF261B* (CN30/CN76 pinouts)
- `SAMSUNG-RS28-SXS` — RS28A500*/RS23A500*/RS28T5B* (CN20/CN40/CN90 pinouts)

**Extraction:**
- `knowledge/pattern-catalog/SAMSUNG_RF260B_FRIDGE_EXTRACTION.md`
- `knowledge/pattern-catalog/SAMSUNG_RS28_FRIDGE_EXTRACTION.md`

RF260B: 16 procedures + 2 bundles. RS28: 17 procedures + 3 bundles.

Regenerate RF260B: `python backend/scripts/generate_samsung_rf260b_fridge_procedure_seeds.py`  
Regenerate RS28: `python backend/scripts/generate_samsung_rs28_fridge_procedure_seeds.py`
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")


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
    write_readme()
    for script in (
        "attach_samsung_rs28_fridge_diagnostic_effects.py",
        "attach_samsung_rs28_fridge_service_modes.py",
        "attach_samsung_rs28_fridge_procedure_diagrams.py",
    ):
        path = ROOT / "backend" / "scripts" / script
        if path.exists():
            subprocess.run([sys.executable, str(path)], check=True, cwd=ROOT)
    crop = ROOT / "backend/scripts/crop_samsung_rs28_procedure_figures.py"
    if crop.exists():
        subprocess.run([sys.executable, str(crop)], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: global validate reported errors (may include other platforms).", file=sys.stderr)


if __name__ == "__main__":
    main()
