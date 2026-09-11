#!/usr/bin/env python3
"""Generate Frigidaire Professional PRMC2285AF French-door refrigerator procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "frigidaire_prmc_french_door"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "frigidaire_prmc_french_door"

SOURCE = {
    "manualId": "FRIGIDAIRE-PRMC-FRIDGE",
    "manualTitle": "Frigidaire Professional PRMC2285AF French-Door Refrigerator",
    "extractedTextFile": "backend/docs/manuals/ServiceDataSheet-PRMC2285AF-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": (
        "Unplug the refrigerator before resistance checks or harness service. "
        "R-600a is flammable — follow sealed-system precautions when applicable."
    ),
    "sourceExcerpt": "Disconnect power cord before servicing this appliance.",
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
        "platformId": PLATFORM,
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


def instr(sid, order, title, body, nxt=None, excerpt="", requires_input=False):
    step = {
        "id": sid,
        "order": order,
        "type": "instruction",
        "title": title,
        "body": body,
        "sourceExcerpt": excerpt or body,
        "requiresInput": requires_input,
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


def meas_branches(prefix, pass_next, fail_next, pass_label="5–16 kΩ @ room temp"):
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


def er_tags(code: str, extra: list[str] | None = None) -> list[str]:
    compact = code.replace(" ", "_")
    return [compact, code, "thermistor", "sensor_check", *(extra or [])]


def thermistor_proc(
    pid: str,
    title: str,
    er_code: str,
    oem_test: str,
    sensor_label: str,
    harness_note: str,
    extra_tags: list[str] | None = None,
):
    tags = er_tags(er_code, extra_tags)
    return proc(
        pid,
        title,
        oem_test,
        f"Service mode test {oem_test}: {sensor_label}",
        [1],
        ["thermistor"],
        tags,
        [
            visual(
                "check_harness",
                2,
                "Harness and pin backouts",
                (
                    f"Check {harness_note} for pin backouts, pinched or damaged wires before replacing parts. "
                    "Reseat connector at main control board."
                ),
                cp_yes_no(
                    "harness_ok",
                    "service_mode_readout",
                    "repair_harness",
                    "repair_harness_out",
                    "Repair or replace harness when damaged or loose.",
                ),
            ),
            instr(
                "repair_harness",
                3,
                "Repair harness",
                "Repair wiring or reseat connector, then retest in service mode.",
                "service_mode_readout",
            ),
            outcome("repair_harness_out", 4, "Repair harness", "Repair sensor harness and retest."),
            visual(
                "service_mode_readout",
                5,
                f"Service mode test {oem_test} readout",
                (
                    f"In System Diagnostic Mode, navigate to test {oem_test} ({sensor_label}). "
                    "Display should show compartment temperature — not OP (open) or SH (short)."
                ),
                cp_yes_no(
                    "readout_ok",
                    "sensor_ohms",
                    "readout_bad",
                    "sensor_ohms",
                    "OP/SH indicates open or shorted sensor circuit.",
                ),
            ),
            meas(
                "sensor_ohms",
                6,
                f"{sensor_label} resistance",
                (
                    f"Power off. Measure {sensor_label} NTC at harness — typical 5–16 kΩ at room temperature. "
                    "Contact TID before main board replacement per service data sheet."
                ),
                "cabinetThermistorOhms",
                "main control harness",
                sensor_label,
                meas_branches("ntc", "sensor_ok", "replace_sensor"),
            ),
            outcome(
                "replace_sensor",
                7,
                "Replace sensor",
                f"Replace {sensor_label} or harness when open, shorted, or out of range.",
            ),
            outcome(
                "replace_main_pcb",
                8,
                "Replace main PCB",
                "Replace main control board when sensor and harness verified good but Er code persists.",
            ),
            outcome("sensor_ok", 9, "Sensor verified", f"{sensor_label} resistance and harness verified."),
        ],
    )


PROCEDURES = [
    thermistor_proc(
        "frigidaireprmc-fz-temp-sensor",
        "Er t1: Freezer cabinet temperature sensor",
        "Er t1",
        "30",
        "FRZ temp sensor",
        "freezer cabinet temperature sensor harness",
        ["not_cooling"],
    ),
    thermistor_proc(
        "frigidaireprmc-fz-defrost-sensor",
        "Er t2: Freezer evaporator defrost sensor",
        "Er t2",
        "39",
        "FRZ evaporator defrost sensor",
        "freezer evaporator defrost sensor harness",
        ["defrost", "frost_buildup"],
    ),
    thermistor_proc(
        "frigidaireprmc-ff-temp-sensor",
        "Er t3: Fresh-food cabinet temperature sensor",
        "Er t3",
        "29",
        "FF temp sensor",
        "fresh-food cabinet temperature sensor harness",
        ["weak_cooling_ff"],
    ),
    thermistor_proc(
        "frigidaireprmc-ff-defrost-sensor",
        "Er t4: Fresh-food evaporator defrost sensor",
        "Er t4",
        "31",
        "FF evaporator defrost sensor",
        "fresh-food evaporator defrost sensor harness",
        ["defrost", "frost_buildup"],
    ),
    thermistor_proc(
        "frigidaireprmc-vcz-temp-sensor",
        "Er t5: VCZ (variable zone) temperature sensor",
        "Er t5",
        "32",
        "VCZ temp sensor",
        "variable-chill zone (VCZ) temperature sensor harness",
        ["convert_drawer", "weak_cooling_ff"],
    ),
    thermistor_proc(
        "frigidaireprmc-ffim-tray-sensor",
        "Er t6: FFIM tray temperature sensor",
        "Er t6",
        "45",
        "FFIM tray temp sensor",
        "fresh-food ice maker tray temperature sensor harness",
        ["ice_maker", "no_ice"],
    ),
    proc(
        "frigidaireprmc-ui-communication",
        "Er CE: Dispenser UI ↔ main board communication",
        "CE",
        "Communication Error UI to Main Board",
        [1],
        ["display_panel", "main_control"],
        ["Er_CE", "Er CE", "hmi_check", "display_dead"],
        [
            visual(
                "ce_active",
                2,
                "Er CE on display?",
                (
                    "Er CE indicates communication failure between dispenser UI and main control board. "
                    "Check pin backouts and pinched wires on dispenser UI harness first."
                ),
                cp_yes_no(
                    "ce_yes",
                    "check_dispenser_harness",
                    "ce_no",
                    "comm_ok",
                    "Communication error not present.",
                ),
            ),
            instr(
                "check_dispenser_harness",
                3,
                "Inspect dispenser UI harness",
                (
                    "Verify external 4-button dispenser UI harness is fully seated at main board and dispenser. "
                    "In service mode, note dispenser UI firmware version scroll (tests after hardware tests)."
                ),
                "comm_restored",
            ),
            visual(
                "comm_restored",
                4,
                "Er CE cleared?",
                "After harness repair and power cycle, is Er CE cleared?",
                cp_yes_no(
                    "comm_ok_yes",
                    "comm_path_ok",
                    "replace_boards",
                    "replace_boards_out",
                    "Replace dispenser UI and/or main control board when harness verified.",
                ),
            ),
            outcome("comm_ok", 5, "No comm fault", "Dispenser UI communication normal."),
            outcome(
                "replace_boards_out",
                6,
                "Replace PCB(s)",
                "Replace external dispenser UI or main control board per OEM parts guidance.",
            ),
            outcome("comm_path_ok", 7, "Communication OK", "Er CE cleared after harness or board service."),
        ],
    ),
    proc(
        "frigidaireprmc-manual-defrost",
        "Manual defrost mode (dF)",
        "dF",
        "Manual Defrost",
        [1],
        ["heater", "main_control"],
        ["manual_defrost", "defrost", "frost_buildup"],
        [
            instr(
                "enter_df",
                2,
                "Enter manual defrost (dF)",
                "On main UI: hold + and Air Filter buttons for 10 seconds. Display shows dF while manual defrost is active.",
                "defrost_complete",
                requires_input=True,
            ),
            visual(
                "defrost_complete",
                3,
                "Defrost cycle effective?",
                (
                    "Allow manual defrost to run. Verify evaporator frost clears and compartment temperatures recover "
                    "after dF completes and unit returns to normal operation."
                ),
                cp_yes_no(
                    "defrost_ok",
                    "defrost_resolved",
                    "defrost_failed",
                    "continue_diagnostics",
                    "Manual defrost did not clear frost — continue component diagnostics.",
                ),
            ),
            outcome("defrost_resolved", 4, "Manual defrost OK", "Manual defrost completed — monitor temperatures."),
            outcome(
                "continue_diagnostics",
                5,
                "Continue diagnostics",
                "Frost or cooling fault remains — run Er t* sensor and heater service-mode tests.",
            ),
        ],
    ),
    proc(
        "frigidaireprmc-ffim-self-test",
        "FFIM twist-tray self-test (TEST button)",
        "FFIM-TEST",
        "Ice maker test cycling",
        [2],
        ["ice_maker_module"],
        ["ice_maker", "no_ice", "Er_t6", "Er t6"],
        [
            instr(
                "im_power_on",
                2,
                "Turn ice maker ON",
                "Press and hold POWER on the FFIM for ½ second until POWER illuminates solid green.",
                "run_self_test",
            ),
            instr(
                "run_self_test",
                3,
                "Run TEST self-diagnostic",
                (
                    "Press and release TEST/SERVICE. Tray performs two rotations: hold bail arm up during the first "
                    "rotation (simulate full bin); release for second rotation (empty bin). "
                    "POWER returns solid green if pass; rapid blink = internal IM failure."
                ),
                "self_test_result",
                requires_input=True,
            ),
            visual(
                "self_test_result",
                4,
                "Self-test passed?",
                "After second rotation home, is POWER solid green (no rapid blink)?",
                cp_yes_no(
                    "test_pass",
                    "im_ok",
                    "test_fail",
                    "replace_im",
                    "Replace FFIM assembly — internal failure detected.",
                ),
            ),
            outcome("im_ok", 5, "Ice maker OK", "FFIM self-test passed."),
            outcome("replace_im", 6, "Replace ice maker", "Replace fresh-food ice maker module after failed self-test."),
        ],
    ),
]


def service_mode_bundle() -> dict:
    return {
        "id": "frigidaireprmc-service-mode-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "Frigidaire PRMC — System Diagnostic Mode",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Hold − and + for 10 s; navigate tests with +/−; FREEZE BOOST toggles loads.",
        "tags": ["service_diagnostic", "load_test", "sensor_check"],
        "entryStepId": "sm_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [1]},
        "steps": [
            instr(
                "sm_enter",
                1,
                "Enter System Diagnostic Mode",
                "Press and hold − and + buttons for 10 seconds. First screens cycle all UI LEDs on, then off.",
                "sm_navigate",
            ),
            instr(
                "sm_navigate",
                2,
                "Navigate service tests",
                "Use +/− to advance through numbered tests. Press FREEZE BOOST to toggle load states on applicable tests.",
                "sm_exit",
            ),
            instr(
                "sm_exit",
                3,
                "Exit service mode",
                "Press and hold − and + for 10 seconds, or wait for 10 minutes of inactivity, to return to normal operation.",
                "@continue",
            ),
        ],
    }


BUNDLES = [service_mode_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Frigidaire Professional PRMC French-door refrigerator",
        "notes": "Er t1–t6 + Er CE; System Diagnostic Mode; FFIM self-test; manual defrost dF. Uses cabinetThermistorOhms.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [t for t in item.get("tags", []) if t.startswith("Er")],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = f"""# Frigidaire Professional PRMC French-door refrigerator (`{PLATFORM}`)

**Manual:** FRIGIDAIRE-PRMC-FRIDGE — PRMC* / FRMC* column-evaporator French door
**Platform:** `{PLATFORM}` — PRMC*, FRMC*
**Extraction:** `knowledge/pattern-catalog/FRIGIDAIRE_PRMC2285AF_EXTRACTION.md`

9 procedures + 1 service-mode bundle (System Diagnostic Mode).

Regenerate: `python backend/scripts/generate_frigidaire_prmc_fridge_procedure_seeds.py`
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
        "attach_frigidaire_prmc_fridge_diagnostic_effects.py",
        "attach_frigidaire_prmc_fridge_service_modes.py",
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
