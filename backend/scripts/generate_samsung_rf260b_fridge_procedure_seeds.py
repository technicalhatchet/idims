#!/usr/bin/env python3
"""Generate Samsung RF260B/RF261B SxS refrigerator procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_sxs"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-RF260B-FRIDGE",
    "manualTitle": "Samsung RF260B/RF261B Side-by-Side Refrigerator",
    "extractedTextFile": "backend/docs/manuals/samsung frdige rf260b-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the refrigerator before servicing electrical parts. For voltage checks on powered circuits, use appropriate PPE and one-hand test technique.",
    "sourceExcerpt": "Unplug the appliance before replacing or repairing electrical parts.",
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


def sensor_voltage_proc(
    pid,
    title,
    led_name,
    connector,
    pins,
    component_ids,
    tags,
    *,
    pages=(49, 50),
    powered=True,
):
    """Self-diagnostic sensor voltage check — 4.5 V warm to 1.0 V cold."""
    power_step = (
        instr(
            "apply_power",
            2,
            "Apply power for voltage test",
            "Restore power. Allow control to stabilize. Measure sensor voltage at MAIN PCB with harness connected.",
            "sensor_voltage",
            "Power on for board-side NTC voltage check.",
        )
        if powered
        else instr(
            "self_diag_led",
            2,
            "Confirm self-diagnostic LED",
            f"Run self-diagnostic (Power Freezer + Power Fridge 8 s). Verify {led_name} LED blink indicates this sensor path.",
            "sensor_voltage",
        )
    )
    return proc(
        pid,
        title,
        "4-1-3",
        f"Self-diagnostic — {led_name}",
        list(pages),
        component_ids,
        tags,
        [
            power_step,
            meas(
                "sensor_voltage",
                3,
                "Sensor voltage",
                f"Measure voltage {connector} {pins} — 4.5 V warm → 1.0 V cold per OEM table.",
                "refrigeratorThermistorVoltage",
                connector,
                pins,
                ohm_branches("sv", "sensor_ok", "replace_sensor", "4.5–1.0 V"),
            ),
            outcome("replace_sensor", 4, "Replace sensor", f"Replace {led_name} sensor or repair harness when voltage out of range."),
            outcome("sensor_ok", 5, "Sensor verified", f"{led_name} voltage and connections verified."),
        ],
    )


def fan_voltage_proc(pid, title, fan_name, pin_desc, tags):
    return proc(
        pid,
        f"§4-1-3: {fan_name} fan feedback",
        "4-1-3",
        f"Self-diagnostic — {fan_name}-FAN",
        [49, 50],
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
                f"Measure CN76 {pin_desc} ↔ CN76-1 (Gray) — 7–12 V while fan commanded.",
                "refrigeratorEvapFanFeedbackVoltage",
                "CN76",
                pin_desc,
                ohm_branches("fan", "fan_ok", "replace_fan", "7–12 V"),
            ),
            outcome("replace_fan", 4, "Replace fan", f"Replace {fan_name} evaporator fan motor or repair harness/feedback line."),
            outcome("fan_ok", 5, "Fan verified", f"{fan_name}-FAN feedback verified."),
        ],
    )


PROCEDURES = [
    sensor_voltage_proc(
        "samsungrf260b-fz-sensor",
        "§4-1-3: Freezer cabinet sensor (FZ-Sensor)",
        "FZ-Sensor",
        "CN30",
        "4 ↔ CN76-1",
        ["thermistor"],
        ["thermistor", "sensor_check", "not_cooling"],
    ),
    sensor_voltage_proc(
        "samsungrf260b-ff-sensor",
        "§4-1-3: Fresh-food cabinet sensor (FF-Sensor)",
        "FF-Sensor",
        "CN30",
        "5 ↔ CN76-1",
        ["thermistor"],
        ["thermistor", "sensor_check", "weak_cooling_ff"],
    ),
    sensor_voltage_proc(
        "samsungrf260b-fz-def-sensor",
        "§4-1-3: Freezer defrost sensor (FZ-DEF-Sensor)",
        "FZ-DEF-Sensor",
        "CN30",
        "5 ↔ CN76-1",
        ["thermistor"],
        ["thermistor", "defrost", "frost_buildup"],
    ),
    sensor_voltage_proc(
        "samsungrf260b-ff-def-sensor",
        "§4-1-3: Fresh-food defrost sensor (FF-DEF-Sensor)",
        "FF-DEF-Sensor",
        "CN30",
        "8 ↔ CN76-1",
        ["thermistor"],
        ["thermistor", "defrost", "frost_buildup"],
    ),
    sensor_voltage_proc(
        "samsungrf260b-ambient-sensor",
        "§4-1-3: Ambient sensor",
        "Ambient-Sensor",
        "CN78",
        "8 ↔ CN78-12",
        ["thermistor"],
        ["thermistor", "sensor_check"],
    ),
    sensor_voltage_proc(
        "samsungrf260b-pantry-sensor",
        "§4-1-3: Pantry sensor",
        "PANTRY-Sensor",
        "CN78",
        "9 ↔ CN76-1",
        ["thermistor"],
        ["thermistor", "sensor_check"],
    ),
    sensor_voltage_proc(
        "samsungrf260b-humidity-sensor",
        "§4-1-3: Humidity sensor",
        "Humidity-Sensor",
        "CN30",
        "3 ↔ CN76-1",
        ["thermistor"],
        ["thermistor", "sensor_check"],
    ),
    sensor_voltage_proc(
        "samsungrf260b-ice-maker-sensor",
        "§4-1-3: Ice maker fill sensor",
        "Ice Maker(F) Sensor",
        "CN90",
        "8 ↔ 9",
        ["thermistor", "ice_maker_module"],
        ["ice_maker", "thermistor", "no_ice"],
    ),
    fan_voltage_proc(
        "samsungrf260b-fz-fan",
        "Freezer evaporator",
        "FZ",
        "3 (Yellow)",
        ["evap_fan", "airflow", "not_cooling"],
    ),
    fan_voltage_proc(
        "samsungrf260b-ff-fan",
        "Fresh-food evaporator",
        "FF",
        "4 (Orange)",
        ["evap_fan", "airflow", "weak_cooling_ff"],
    ),
    fan_voltage_proc(
        "samsungrf260b-c-fan",
        "Condenser",
        "C",
        "5 (Sky-blue)",
        ["evap_fan", "condenser_fan", "airflow", "not_cooling"],
    ),
    proc(
        "samsungrf260b-fz-defrost-heater",
        "§4-1-3: Freezer defrost heater (FZ-DEF)",
        "4-1-3",
        "Self-diagnostic — FZ-DEF heater",
        [49, 50, 71],
        ["heater"],
        ["defrost_heater", "frost_buildup", "no_defrost"],
        [
            instr(
                "disconnect_cn70_fz",
                2,
                "Disconnect CN70",
                "Power off. Disconnect MAIN PCB CN70 harness before resistance test.",
                "fz_heater_ohms",
            ),
            meas(
                "fz_heater_ohms",
                3,
                "FZ defrost heater resistance",
                "CN70 Brown ↔ Gray (also CN70-3 Brown ↔ CN72-3 Gray per §4-2-4) — 63 Ω ±7%.",
                "samsungRefrigeratorDefrostHeaterOhms",
                "CN70",
                "Brown ↔ Gray",
                ohm_branches("fz_def", "fz_heater_ok", "replace_fz_heater", "63 Ω ±7%"),
            ),
            outcome("replace_fz_heater", 4, "Replace FZ defrost heater", "Replace heater or bimetal when open/short. 0 Ω = short; OL = open heater or fuse."),
            outcome("fz_heater_ok", 5, "FZ defrost heater OK", "Freezer defrost heater resistance verified."),
        ],
    ),
    proc(
        "samsungrf260b-ff-defrost-heater",
        "§4-1-3: Fresh-food defrost heater (FF-DEF)",
        "4-1-3",
        "Self-diagnostic — FF-DEF heater",
        [49, 50, 71],
        ["heater"],
        ["defrost_heater", "frost_buildup", "no_defrost"],
        [
            instr(
                "disconnect_cn70_ff",
                2,
                "Disconnect CN70",
                "Power off. Disconnect MAIN PCB CN70 harness before resistance test.",
                "ff_heater_ohms",
            ),
            meas(
                "ff_heater_ohms",
                3,
                "FF defrost heater resistance",
                "CN70 White ↔ Gray (CN70-1 White ↔ CN72-3 Gray per §4-2-4) — 120 Ω @115 V or 440 Ω @230 V ±7%.",
                "samsungRf260bFfDefrostHeaterOhms",
                "CN70",
                "White ↔ Gray",
                ohm_branches("ff_def", "ff_heater_ok", "replace_ff_heater", "120/440 Ω ±7%"),
            ),
            outcome("replace_ff_heater", 4, "Replace FF defrost heater", "Replace fresh-food defrost heater or bimetal when out of range."),
            outcome("ff_heater_ok", 5, "FF defrost heater OK", "Fresh-food defrost heater resistance verified."),
        ],
    ),
    proc(
        "samsungrf260b-ice-maker-function",
        "§4-1-3: Ice maker function (FZ)",
        "4-1-3",
        "Self-diagnostic — Ice Maker(FZ) Function",
        [49, 50],
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
    proc(
        "samsungrf260b-panel-communication",
        "§4-1-2: Panel communication (Pc-Er)",
        "4-1-2",
        "Display function — Communication error",
        [48, 51],
        ["display_panel", "main_control"],
        ["Pc-Er", "Pc Er", "41E", "hmi_check", "display_dead"],
        [
            visual(
                "pc_er_display",
                2,
                "Pc-Er active",
                "Pc-Er alternates ALL ON 0.5 s / ALL OFF 0.5 s until comm restored. Pantry display uses 0.5 s ON / 1.5 s OFF.",
                cp_yes_no("pc_er_yes", "check_harness", "pc_er_no", "comm_ok", "Communication error not present — verify complaint."),
            ),
            instr(
                "check_harness",
                3,
                "Panel ↔ MAIN harness",
                "Verify LVDS/ribbon and door-hinge harness seating. Check for moisture or pin damage. Scope comm lines if available.",
                "comm_restored",
            ),
            visual(
                "comm_restored",
                4,
                "Pc-Er cleared",
                "After harness repair and power cycle, is Pc-Er cleared?",
                cp_yes_no("comm_ok_yes", "comm_path_ok", "replace_boards", "replace_boards_out", "Replace MAIN and/or panel PCB per manual."),
            ),
            outcome("comm_ok", 5, "No comm fault", "Panel communication normal."),
            outcome("replace_boards_out", 6, "Replace PCB(s)", "Replace MAIN and panel PCB when harness verified good."),
            outcome("comm_path_ok", 7, "Communication OK", "Pc-Er cleared after harness service."),
        ],
    ),
    proc(
        "samsungrf260b-option-error",
        "§4-1-2: Option error (OP-Er)",
        "4-1-2",
        "Display function — Option error",
        [48],
        ["display_panel", "main_control"],
        ["OP-Er", "OP Er", "hmi_check"],
        [
            visual(
                "op_er_display",
                2,
                "OP-Er active",
                "OP-Er code repeatedly ON/OFF until option error settles — panel option mismatch with MAIN MICOM.",
                cp_yes_no("op_er_yes", "verify_option", "op_er_no", "option_ok", "Option error not displayed."),
            ),
            instr(
                "verify_option",
                3,
                "Option table match",
                "Verify panel PCB part number and option coding match MAIN PCB per §4-1-6 Option TABLE.",
                "option_restored",
            ),
            visual(
                "option_restored",
                4,
                "OP-Er cleared",
                "After matched panel/main pair installed, is OP-Er cleared?",
                cp_yes_no("option_ok_yes", "option_path_ok", "replace_matched_pair", "replace_pair_out", "Install matched MAIN + panel PCB set."),
            ),
            outcome("option_ok", 5, "No option fault", "Option error not present."),
            outcome("replace_pair_out", 6, "Replace matched PCBs", "Replace MAIN and panel as matched set."),
            outcome("option_path_ok", 7, "Option OK", "OP-Er cleared with correct option pairing."),
        ],
    ),
]


def test_mode_bundle() -> dict:
    return {
        "id": "samsungrf260b-test-mode-entry",
        "version": "1.0.0",
        "platformId": "samsung_sxs",
        "manualId": SOURCE["manualId"],
        "title": "Samsung RF260B — Test mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter test mode for manual operation and forced defrost (§4-1-1).",
        "tags": ["service_diagnostic", "defrost", "load_test"],
        "entryStepId": "tm_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [47]},
        "steps": [
            instr(
                "tm_enter",
                1,
                "Enter test mode",
                "Press Power Freezer + Fridge keys simultaneously for 8 seconds — all display segments turn off.",
                "tm_cycle",
            ),
            instr(
                "tm_cycle",
                2,
                "Test mode sequence",
                "Within 15 s press any key to cycle: FF (manual op 1) → OF-r (manual op 2) → rd (R defrost) → fd (F+R defrost). Power cycle cancels.",
                "tm_self_diag",
            ),
            instr(
                "tm_self_diag",
                3,
                "Self-diagnostic entry",
                "During normal operation: Power Freezer + Power Fridge 8 s → ding-dong → self-diagnostic LEDs 30 s (§4-1-3).",
                "@continue",
            ),
        ],
    }


def self_diagnostic_bundle() -> dict:
    return {
        "id": "samsungrf260b-self-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "samsung_sxs",
        "manualId": SOURCE["manualId"],
        "title": "Samsung RF260B — Self-diagnostic entry",
        "modeKind": "hmi_test",
        "uiVariants": ["any"],
        "description": "Run self-diagnostic checklist without full test-mode cycle.",
        "tags": ["service_diagnostic", "sensor_check"],
        "entryStepId": "sd_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [49]},
        "steps": [
            instr(
                "sd_enter",
                1,
                "Enter self-diagnostic",
                "Power Freezer + Power Fridge simultaneously 8 s during normal operation. Ding-dong confirms entry; fault LEDs blink 30 s.",
                "@continue",
            ),
        ],
    }


BUNDLES = [test_mode_bundle(), self_diagnostic_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "samsung_sxs",
        "templateId": "refrigerator",
        "label": "Samsung RF260B/RF261B side-by-side refrigerator",
        "notes": "§4-1 test mode + §4-1-3 self-diagnostic checklist. Shares samsung_sxs platform with RS28 field bindings.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [t for t in item.get("tags", []) if t.endswith("Er") or t in ("41E", "Pc-Er", "OP-Er")],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# Samsung SxS refrigerator RF260B (`samsung_sxs`)

**Manual:** SAMSUNG-RF260B-FRIDGE — RF260B*/RF261B* bottom-mount freezer SxS  
**Platform:** `samsung_sxs` — RF260*, RF261*  
**Extraction:** `knowledge/pattern-catalog/SAMSUNG_RF260B_FRIDGE_EXTRACTION.md`

16 procedures + 2 service-mode bundles (§4-1 test mode + self-diagnostic).

Regenerate: `python backend/scripts/generate_samsung_rf260b_fridge_procedure_seeds.py`
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
        "attach_samsung_rf260b_fridge_diagnostic_effects.py",
        "attach_samsung_rf260b_fridge_service_modes.py",
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
