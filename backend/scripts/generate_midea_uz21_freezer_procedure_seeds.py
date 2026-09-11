#!/usr/bin/env python3
"""Generate Midea/Insignia UZ21 upright freezer (midea_uz21) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "midea_uz21"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "midea_uz21"

SOURCE = {
    "manualId": "MIDEA-UZ21-FREEZER",
    "manualTitle": "Midea/Insignia NS-UZ21 Upright Freezer (HS-772FWE)",
    "extractedTextFile": "backend/docs/manuals/NS-UZ21WH0 insignia freezer-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the freezer before resistance checks or harness service.",
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
        "9.6",
        f"Error code {fault_code} — {sensor_name}",
        [38, 39, 34],
        component_ids,
        tags,
        [
            visual(
                "harness_check",
                2,
                "Main PCB harness seating",
                f"Verify {sensor_name} connector at main PCB is fully seated with no foreign matter.",
                cp_yes_no(
                    "harness_ok",
                    "bench_ntc",
                    "harness_bad",
                    "replace_sensor",
                    "Replace sensor when resistance out of range.",
                ),
            ),
            instr(
                "bench_ntc",
                3,
                "Bench B3839 resistance",
                f"Disconnect power. Pull sensor connector at main PCB. Measure {location} — B3839 §8.4 R/T (~2.0 kΩ @ 25°C).",
                "ntc_ohms",
            ),
            meas(
                "ntc_ohms",
                4,
                f"{sensor_name} resistance",
                "B3839 NTC — do not use generic 5–16 kΩ cabinet band.",
                "mideaB3839ThermistorKohm",
                "main PCB harness",
                f"{sensor_name} pair",
                ohm_branches("ntc", "sensor_ok", "replace_sensor"),
            ),
            outcome("replace_sensor", 5, "Replace sensor", f"Replace {sensor_name} when B3839 out of range."),
            outcome("replace_main_pcb", 6, "Replace main PCB", "Replace main PCB when sensor and harness verified good."),
            outcome("sensor_ok", 7, "Sensor verified", f"{sensor_name} B3839 resistance verified."),
        ],
    )


PROCEDURES = [
    b3839_sensor_proc(
        "mideauz21-fz-temp-sensor",
        "§9.6 E2: Freezer temperature sensor",
        "E2",
        "freezer cabinet temperature sensor",
        "freezer chamber sensor (§8.2)",
        ["thermistor"],
        ["not_cooling"],
    ),
    b3839_sensor_proc(
        "mideauz21-fz-defrost-sensor",
        "§9.6 E5: Freezer defrost sensor",
        "E5",
        "freezer defrost sensor",
        "evaporator defrost sensor (§7.6)",
        ["thermistor", "defrost_thermostat"],
        ["defrost", "frost_buildup", "no_defrost"],
    ),
    b3839_sensor_proc(
        "mideauz21-ambient-sensor",
        "§9.6 E7: Ambient temperature sensor",
        "E7",
        "ambient temperature sensor",
        "ambient sensor at hinge/cabinet (§8.1)",
        ["thermistor"],
    ),
    proc(
        "mideauz21-fz-defrost-heater",
        "§5.1 / §7.6: Freezer defrost heater",
        "5.1",
        "Freezer defrost heater 115 V 320 W",
        [14, 23, 37],
        ["heater", "defrost_heater"],
        ["defrost_heater", "frost_buildup", "no_defrost", "E5", "E9"],
        [
            instr(
                "disconnect_heater",
                2,
                "Disconnect defrost heater",
                "Power off. Disconnect defrost heater with sensor/fuse assembly at evaporator (§7.6).",
                "heater_ohms",
            ),
            meas(
                "heater_ohms",
                3,
                "FZ defrost heater resistance",
                "115 V 320 W heater — calculated R ≈ 41 Ω (38–48 Ω normal band).",
                "mideaUz21DefrostHeaterOhms",
                "defrost heater",
                "heater terminals",
                ohm_branches("heater", "heater_ok", "replace_heater", "38–48 Ω"),
            ),
            outcome("replace_heater", 4, "Replace defrost heater", "Replace defrost heater assembly when open/short."),
            outcome("heater_ok", 5, "Defrost heater OK", "Heater resistance verified — check defrost sensor if frost persists."),
        ],
    ),
    proc(
        "mideauz21-communication",
        "§9.6 E6: Display ↔ main communication",
        "9.6",
        "Communication failure",
        [38, 39],
        ["display_panel", "main_control"],
        ["E6", "hmi_check", "display_dead"],
        [
            visual(
                "harness_seated",
                2,
                "Display and main PCB harness",
                "Verify display, hinge cover, and main PCB connectors are seated with no foreign matter.",
                cp_yes_no("harness_ok", "wire_continuity", "harness_bad", "replace_door", "Replace door when door harness wire is open (∞ Ω)."),
            ),
            instr(
                "wire_continuity",
                3,
                "Wire resistance display ↔ main",
                "Pull all connectors. Measure wire resistance between display PCB and main PCB — ∞ Ω indicates broken wire.",
                "comm_board_swap",
            ),
            visual(
                "comm_board_swap",
                4,
                "Replace display then main",
                "If wire OK, replace display control board. If E6 persists, replace main PCB.",
                cp_yes_no("comm_ok", "comm_verified", "replace_main", "replace_main_out", "Replace main PCB when display swap failed."),
            ),
            outcome("replace_door", 5, "Replace door assembly", "Replace door when harness in door is broken."),
            outcome("replace_main_out", 6, "Replace main PCB", "Replace main control board."),
            outcome("comm_verified", 7, "Communication OK", "E6 cleared after harness or PCB service."),
        ],
    ),
    proc(
        "mideauz21-high-temp-alarm",
        "§9.6 E9: High-temperature alarm",
        "9.6",
        "High temperature alarm in freezing chamber",
        [38, 39],
        ["door_switch", "evap_fan", "heater", "light_switch"],
        ["E9", "not_cooling", "high_temp_alarm"],
        [
            visual(
                "door_gasket",
                2,
                "Door seal and gasket",
                "Verify door fully closed with no gasket leakage or deformation.",
                cp_yes_no("door_ok", "evap_frost", "fix_door", "fix_door_out", "Reshape or replace door gasket."),
            ),
            visual(
                "evap_frost",
                3,
                "Evaporator frost and fan",
                "Inspect evaporator for heavy frost or frozen fan. Does evaporator need defrost heater service?",
                cp_yes_no("frost_ok", "fan_runs", "service_defrost", "defrost_heater_path", "Follow defrost heater procedure when evaporator iced."),
            ),
            visual(
                "fan_runs",
                4,
                "Freezer fan motor",
                "Reseat fan motor connectors. Does fan run normally?",
                cp_yes_no("fan_ok", "e9_ok", "replace_fan", "replace_fan_out", "Replace freezer fan motor."),
            ),
            instr(
                "defrost_heater_path",
                5,
                "Service defrost heater",
                "When evaporator frosted, run forced defrost test mode (§9.7) and verify defrost heater ohms.",
                "e9_ok",
            ),
            outcome("fix_door_out", 6, "Correct door seal", "Reshape gasket or adjust door alignment."),
            outcome("replace_fan_out", 7, "Replace fan motor", "Replace freezer evaporator fan motor."),
            outcome("e9_ok", 8, "E9 path complete", "E9 high-temp alarm addressed via door/defrost/fan checks."),
        ],
    ),
    proc(
        "mideauz21-evap-fan",
        "§7.5 / §9.6 E9: Freezer evaporator fan",
        "7.5",
        "Freezer chamber fan motor",
        [22, 38],
        ["evap_fan"],
        ["airflow", "not_cooling", "E9"],
        [
            instr(
                "access_fan",
                2,
                "Access evaporator fan",
                "Remove freezer air duct per §7.5. Verify DC 12 V fan motor (2020 r/min spec) is seated on shaft.",
                "fan_test_mode",
            ),
            instr(
                "fan_test_mode",
                3,
                "Forced cooling test",
                "Enter test mode (LOCK + − 3 s). Press + for forced cooling (display 1) — compressor and fan should run.",
                "fan_runs",
            ),
            visual(
                "fan_runs",
                4,
                "Fan runs in forced cooling",
                "With forced cooling active, does freezer fan rotate and move air?",
                cp_yes_no("fan_ok", "fan_verified", "replace_fan", "replace_fan_out", "Replace fan motor per §7.5."),
            ),
            outcome("replace_fan_out", 5, "Replace evaporator fan", "Replace DC 12 V freezer fan motor."),
            outcome("fan_verified", 6, "Evaporator fan OK", "Fan runs in forced cooling mode."),
        ],
    ),
]


def test_mode_bundle() -> dict:
    return {
        "id": "mideauz21-test-mode-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "Midea UZ21 — Test mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter test mode for forced cooling and defrost per §9.7.",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "tm_enter",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [40],
        },
        "steps": [
            instr(
                "tm_enter",
                1,
                "Enter test mode",
                "Press LOCK + − together 3 s — LED shows 0. Auto-exits after 30 s idle. "
                "Press + once → forced cooling (1). Press Vacation → forced defrost (3). "
                "LOCK + − 3 s again to exit.",
                "@continue",
            ),
        ],
    }


def forced_defrost_bundle() -> dict:
    return {
        "id": "mideauz21-forced-defrost-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "Midea UZ21 — Forced defrost (test mode 3)",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "From test mode, select forced defrost — heater on, compressor/fan off.",
        "tags": ["forced_defrost", "defrost", "frost_buildup"],
        "entryStepId": "fd_enter",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [40],
        },
        "steps": [
            instr(
                "fd_enter",
                1,
                "Forced defrost in test mode",
                "Enter test mode (LOCK + − 3 s). Press Vacation button — display shows 3. "
                "Heater runs until defrost sensor reaches 12°C/7°C or 60 min max. Power-cycle after field use.",
                "@continue",
            ),
        ],
    }


BUNDLES = [test_mode_bundle(), forced_defrost_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "standalone_freezer",
        "label": "Midea/Insignia NS-UZ upright freezer",
        "notes": "E-family §9.6; B3839 §8.4; EZ90H1A fixed-speed compressor. Test mode §9.7.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [t for t in item.get("tags", []) if t.startswith("E") and len(t) <= 3],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# midea_uz21 — NS-UZ21 upright freezer procedure seeds

**Manual:** MIDEA-UZ21-FREEZER — Midea HS-772FWE / Insignia NS-UZ*  
**Platform:** `midea_uz21`  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/MIDEA_INSIGNIA_REFRIGERATOR_FREEZER_EXTRACTION.md`

7 procedures + 2 service-mode bundles (§9.7 test mode + forced defrost).

Regenerate: `python backend/scripts/generate_midea_uz21_freezer_procedure_seeds.py`

WO smoke: NS-UZ21WH0 + Insignia → `midea_uz21`; E5 → `mideauz21-fz-defrost-sensor`; frost → `mideauz21-fz-defrost-heater`.
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
        "attach_midea_uz21_freezer_diagnostic_effects.py",
        "attach_midea_uz21_freezer_service_modes.py",
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
