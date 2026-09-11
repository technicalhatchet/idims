#!/usr/bin/env python3
"""Generate Midea/Insignia RSS26 SxS refrigerator (midea_rss) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "midea_rss"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "midea_rss"

SOURCE = {
    "manualId": "MIDEA-RSS-FRIDGE",
    "manualTitle": "Midea/Insignia NS-RSS26 Side-by-Side Refrigerator (UR-BCD746WE-DT)",
    "extractedTextFile": "backend/docs/manuals/NS-RSS26SS Service Manual-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the refrigerator before resistance checks or harness service. Restore power only for live diagnostics when required.",
    "sourceExcerpt": "Disconnect power before servicing electrical parts.",
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


def ohm_branches(prefix, pass_next, fail_next, pass_label="~2.0 kΩ @ 25°C"):
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


def b3839_sensor_proc(
    pid: str,
    title: str,
    fault_code: str,
    sensor_name: str,
    location: str,
    component_ids: list[str],
    extra_tags: list[str] | None = None,
):
    tags = [fault_code, "thermistor_check", "sensor_check", *(extra_tags or [])]
    return proc(
        pid,
        title,
        "10.8",
        f"Fault code {fault_code} — {sensor_name}",
        [47, 48, 44],
        component_ids,
        tags,
        [
            visual(
                "harness_check",
                2,
                "Main PCB harness seating",
                f"Verify {sensor_name} connector at main control board is fully seated with no foreign matter. Reseat connector.",
                cp_yes_no(
                    "harness_ok",
                    "bench_ntc",
                    "harness_bad",
                    "replace_harness",
                    "Repair or replace main harness when connector damaged.",
                ),
            ),
            instr(
                "bench_ntc",
                3,
                "Bench B3839 resistance",
                f"Disconnect power. Access {location}. Measure NTC B3839 per §9.4 R/T table (~2.0 kΩ @ 25°C).",
                "ntc_ohms",
            ),
            meas(
                "ntc_ohms",
                4,
                f"{sensor_name} resistance",
                "B3839 NTC — do not use generic 5–16 kΩ refrigerator band.",
                "mideaB3839ThermistorKohm",
                "main PCB harness",
                f"{sensor_name} pair",
                ohm_branches("ntc", "sensor_ok", "replace_sensor"),
            ),
            outcome("replace_harness", 5, "Replace harness", "Replace main wire harness when connector or wiring failed."),
            outcome("replace_sensor", 6, "Replace sensor", f"Replace {sensor_name} or repair harness when B3839 out of range."),
            outcome("replace_main_pcb", 7, "Replace main PCB", "Replace main control board when sensor and harness verified good."),
            outcome("sensor_ok", 8, "Sensor verified", f"{sensor_name} B3839 resistance and harness verified."),
        ],
    )


PROCEDURES = [
    b3839_sensor_proc(
        "midearss-rc-temp-sensor",
        "§10.8 E1: Refrigerating chamber temperature sensor",
        "E1",
        "RC cabinet temperature sensor",
        "refrigerating chamber air duct sensor (§9.2)",
        ["thermistor"],
        ["weak_cooling_ff"],
    ),
    b3839_sensor_proc(
        "midearss-fz-temp-sensor",
        "§10.8 E2: Freezing chamber temperature sensor",
        "E2",
        "FZ cabinet temperature sensor",
        "freezing chamber sensor card slot (§9.2)",
        ["thermistor"],
        ["not_cooling", "E9"],
    ),
    b3839_sensor_proc(
        "midearss-rc-defrost-sensor",
        "§10.8 E4: Refrigerating chamber defrost sensor",
        "E4",
        "RC defrost sensor",
        "refrigerating chamber defrost sensor (§8.6)",
        ["thermistor", "defrost_thermostat"],
        ["defrost", "frost_buildup"],
    ),
    b3839_sensor_proc(
        "midearss-fz-defrost-sensor",
        "§10.8 E5: Freezing chamber defrost sensor",
        "E5",
        "FZ defrost sensor",
        "evaporator top defrost sensor (§9.2)",
        ["thermistor", "defrost_thermostat"],
        ["defrost", "frost_buildup", "no_defrost"],
    ),
    b3839_sensor_proc(
        "midearss-ambient-sensor",
        "§10.8 E7: Ambient temperature sensor",
        "E7",
        "ambient temperature sensor",
        "upper hinge cover ambient sensor (§9.2)",
        ["thermistor"],
    ),
    proc(
        "midearss-fz-defrost-heater",
        "§6.3 / §8.6: Freezer defrost heater",
        "6.3",
        "Freezer defrost heater 115 V 240 W",
        [20, 29, 49],
        ["heater", "defrost_heater"],
        ["defrost_heater", "frost_buildup", "no_defrost", "E5"],
        [
            instr(
                "disconnect_heater",
                2,
                "Disconnect defrost heater",
                "Power off. Disconnect defrost heater connector at evaporator bottom (§8.6).",
                "heater_ohms",
            ),
            meas(
                "heater_ohms",
                3,
                "FZ defrost heater resistance",
                "115 V 240 W heater — calculated R ≈ 55 Ω (50–62 Ω normal band).",
                "mideaRssDefrostHeaterOhms",
                "defrost heater",
                "heater terminals",
                ohm_branches("heater", "heater_ok", "replace_heater", "50–62 Ω"),
            ),
            outcome("replace_heater", 4, "Replace defrost heater", "Replace freezer defrost heater or fuse when open/short."),
            outcome("heater_ok", 5, "Defrost heater OK", "Heater resistance verified — check defrost sensor and control if frost persists."),
        ],
    ),
    proc(
        "midearss-communication",
        "§10.8 E6: Display ↔ main communication",
        "10.8",
        "Communication failure (CN9)",
        [48, 49],
        ["display_panel", "main_control"],
        ["E6", "hmi_check", "display_dead"],
        [
            visual(
                "cn9_seated",
                2,
                "CN9 harness seating",
                "Verify CN9 between display control board and main PCB is fully seated with no foreign matter.",
                cp_yes_no("cn9_ok", "display_harness", "cn9_bad", "replace_cn9_harness", "Reseat or replace CN9 harness."),
            ),
            instr(
                "display_harness",
                3,
                "Display terminal contact",
                "Inspect display control board terminals. Resend fast connectors if contact is bad.",
                "comm_cleared",
            ),
            visual(
                "comm_cleared",
                4,
                "E6 cleared after service",
                "After harness repair and power cycle, is E6 communication fault cleared?",
                cp_yes_no(
                    "comm_ok",
                    "comm_verified",
                    "replace_boards",
                    "replace_boards_out",
                    "Replace main control board and/or display control board.",
                ),
            ),
            outcome("replace_cn9_harness", 5, "Replace main wire", "Replace main wire harness when CN9 path failed."),
            outcome("replace_boards_out", 6, "Replace PCB(s)", "Replace main and/or display PCB when harness verified good."),
            outcome("comm_verified", 7, "Communication OK", "E6 cleared — CN9 communication restored."),
        ],
    ),
    proc(
        "midearss-high-temp-alarm",
        "§10.8 E9: Freezer high-temperature alarm",
        "10.8",
        "High temperature alarm in freezing chamber",
        [48, 49],
        ["door_switch", "compressor", "thermistor"],
        ["E9", "not_cooling", "high_temp_alarm"],
        [
            visual(
                "door_sealed",
                2,
                "Door sealed and power stable",
                "Verify freezer door is tight shut and unit was not left off for extended period.",
                cp_yes_no("door_ok", "compressor_runs", "door_issue", "door_issue_out", "Correct door seal or restore power before sensor path."),
            ),
            visual(
                "compressor_runs",
                3,
                "Compressor refrigerating",
                "Is compressor running and cabinet cooling normally?",
                cp_yes_no("comp_ok", "run_e2_path", "comp_fail", "check_vfd", "Compressor not running — check VFD inverter LED fault codes."),
            ),
            instr(
                "run_e2_path",
                4,
                "Follow E2 sensor path",
                "When door and compressor OK, follow E2 freezer temperature sensor maintenance (harness + B3839 bench ohms).",
                "e9_resolved",
            ),
            instr(
                "check_vfd",
                5,
                "Check VFD inverter board",
                "Inspect variable-frequency driver LED blink pattern per §11.2 (overcurrent, overvoltage, undervoltage, LOCK, overload).",
                "vfd_outcome",
            ),
            outcome("door_issue_out", 6, "Correct door/power", "Reseal door or restore power; allow 24 hr stabilization."),
            outcome("vfd_outcome", 7, "Service VFD/compressor", "Replace VFD board or compressor per §11.2 LED fault pattern."),
            outcome("e9_resolved", 8, "E9 path complete", "E9 high-temp alarm addressed via door/compressor/sensor checks."),
        ],
    ),
    proc(
        "midearss-ice-maker",
        "§10.8 E0: Ice maker fault",
        "10.8",
        "Ice maker fault",
        [48, 50],
        ["ice_maker_module"],
        ["E0", "ice_maker", "no_ice"],
        [
            visual(
                "im_harness",
                2,
                "Ice maker harness at main PCB",
                "Verify ice maker terminal at main control board is seated with no foreign matter.",
                cp_yes_no("im_harness_ok", "im_function", "replace_im", "replace_im_out", "Replace ice maker module when harness verified."),
            ),
            instr(
                "im_function",
                3,
                "Verify ice maker operation",
                "Confirm harvest and fill cycle after reseating harness. Use EYE test mode if needed (§10.10).",
                "im_ok",
            ),
            outcome("replace_im_out", 4, "Replace ice maker", "Replace ice maker module when E0 persists."),
            outcome("im_ok", 5, "Ice maker OK", "Ice maker function verified after harness service."),
        ],
    ),
    proc(
        "midearss-ice-maker-sensor",
        "§10.8 EE: Ice maker sensor circuit",
        "10.8",
        "Ice maker sensor circuit fault",
        [48, 42],
        ["ice_maker_module", "thermistor"],
        ["EE", "ice_maker", "thermistor_check"],
        [
            visual(
                "ee_harness",
                2,
                "Ice maker sensor harness",
                "Verify ice maker sensor terminal at main PCB is seated with no foreign matter.",
                cp_yes_no("ee_harness_ok", "bench_im_sensor", "replace_im_sensor", "replace_im_sensor_out", "Replace ice maker sensor or module."),
            ),
            instr(
                "bench_im_sensor",
                3,
                "Bench ice maker sensor",
                "Disconnect power. Measure ice machine sensor at bottom of ice-making box — B3839 R/T table §9.4.",
                "im_sensor_ohms",
            ),
            meas(
                "im_sensor_ohms",
                4,
                "Ice maker sensor resistance",
                "B3839 NTC at ice maker sensor — ~2.0 kΩ @ 25°C.",
                "mideaB3839ThermistorKohm",
                "ice maker sensor",
                "sensor pair",
                ohm_branches("im_ntc", "im_sensor_ok", "replace_im_sensor_out"),
            ),
            outcome("replace_im_sensor_out", 5, "Replace ice maker sensor", "Replace ice maker sensor or ice maker assembly."),
            outcome("im_sensor_ok", 6, "Ice maker sensor OK", "Ice maker sensor B3839 verified."),
        ],
    ),
    proc(
        "midearss-vfd-inverter",
        "§11.2: VFD inverter board fault LED",
        "11.2",
        "Variable frequency driver board fault analysis",
        [52],
        ["compressor", "inverter_board"],
        ["not_cooling", "compressor_check", "inverter_fault"],
        [
            instr(
                "locate_vfd_led",
                2,
                "Locate VFD status LED",
                "Access compressor case VFD board (DZ120V1U inverter). Observe LED blink pattern with power applied.",
                "vfd_pattern",
            ),
            visual(
                "vfd_pattern",
                3,
                "VFD LED blink pattern",
                "Match pattern: 1×0.5s/1.5s=standby; 1×0.5s/1.5s interval=overcurrent; 2×=overvoltage; 4×=undervoltage; 8×=LOCK; 16×=overload. Which fault matches?",
                [
                    {"id": "vfd_none", "label": "No blink / compressor runs", "when": {"kind": "checkpoint_yes"}, "nextStepId": "vfd_ok"},
                    {"id": "vfd_fault", "label": "Fault blink pattern", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_vfd"},
                ],
            ),
            outcome("replace_vfd", 4, "Replace VFD board", "Replace variable frequency driver board per §11.2 fault LED pattern."),
            outcome("vfd_ok", 5, "VFD path clear", "VFD LED normal or compressor running — investigate sealed system or sensors if not cooling."),
        ],
    ),
]


def mandatory_mode_bundle() -> dict:
    return {
        "id": "midearss-mandatory-mode-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "Midea RSS26 — Mandatory diagnostic mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter mandatory mode for forced compressor (1) or ice maker cycle (3) per §10.5.",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "mm_enter",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [47],
        },
        "steps": [
            instr(
                "mm_enter",
                1,
                "Enter mandatory mode",
                "Press LOCK/UNLOCK + FRZ.TEMP together 3 s to enter/exit. Lock settings after selection. "
                "Display 0=normal; 1=compressor forced 36 hr; 3=ice maker turn-over ×2 then fill. Power-cycle after use.",
                "@continue",
            ),
        ],
    }


BUNDLES = [mandatory_mode_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog_path = OUT / "procedureCatalog.json"
    existing = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.is_file() else {}
    rtm18_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if entry.get("manualId") == "INSIGNIA-RTM18-FRIDGE"
        or str(entry.get("id", "")).startswith("mideartm18-")
    ]
    rss_entries = [
        {
            "id": item["id"],
            "manualId": SOURCE["manualId"],
            "oemSection": item["source"]["oemTestNumber"],
            "title": item["title"],
            "status": "generated",
            "relatedCodes": [t for t in item.get("tags", []) if t.startswith("E") and len(t) <= 3],
        }
        for item in PROCEDURES
    ]
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Midea/Insignia NS-RSS26 SxS + NS-RTM18 top-freezer (midea_rss)",
        "notes": (
            "MIDEA-RSS-FRIDGE: RSS26 §10.8 E-family + VFD + ice maker. "
            "INSIGNIA-RTM18-FRIDGE: top-freezer §9.6 subset E1/E2/E5/E6/E7 — reuses midearss sensor/comm seeds; "
            "test-mode bundle §9.7. B3839 NTC shared. Models: NS-RSS*, NS-RTM*."
        ),
        "plannedProcedures": rss_entries + rtm18_entries,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# midea_rss — NS-RSS26 / NS-RTM procedure seeds

**Manual:** MIDEA-RSS-FRIDGE — Midea UR-BCD746WE-DT / Insignia NS-RSS*, NS-RTM*  
**Platform:** `midea_rss`  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/MIDEA_INSIGNIA_REFRIGERATOR_FREEZER_EXTRACTION.md`

11 procedures + mandatory-mode bundle (§10.5).

Regenerate: `python backend/scripts/generate_midea_rss_fridge_procedure_seeds.py`

WO smoke: NS-RSS26SS + Insignia → `midea_rss`; E2 → `midearss-fz-temp-sensor`; E5 → `midearss-fz-defrost-sensor`.
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
        "attach_midea_rss_fridge_diagnostic_effects.py",
        "attach_midea_rss_fridge_service_modes.py",
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
