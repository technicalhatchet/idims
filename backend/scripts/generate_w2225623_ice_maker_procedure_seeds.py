#!/usr/bin/env python3
"""Generate Whirlpool modular ice maker 2225623 (whirlpool_modular_ice_maker) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_modular_ice_maker"
PLATFORM = "whirlpool_modular_ice_maker"

SOURCE = {
    "manualId": "WHIRLPOOL-2225623-ICE-MAKER",
    "manualTitle": "Whirlpool Modular Ice Maker Service Sheet (Part 2225623, 120 V)",
    "extractedTextFile": "backend/docs/manuals/whirlpoolmodularicemakerservicesheet-2225623-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

MODULE_ACCESS = (
    "Test points L, N, M, T, H, V are stamped on the circuit module (3 Phillips removal screws). "
    "Pull water-adjust knob and snap off cover for access. Ejector blades must be in park for resistance tests. "
    "Do not manually start the cycle — initiate electrically only. Align \"D\" coupling on reinstall."
)

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": (
        "Unplug the refrigerator or disconnect power before resistance checks or module removal. "
        "Restore power only for live voltage checks when required."
    ),
    "sourceExcerpt": "MODULE OHMMETER CHECKS (no power; ejector blades in PARK).",
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


def ohm_branches(prefix, pass_next, fail_next, pass_label="In spec"):
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


PROCEDURES = [
    proc(
        "w2225623-module-power",
        "Module power (L–N)",
        "L–N",
        "Module power voltage",
        [1],
        ["ice_maker_module", "supply"],
        ["ice_maker", "no_ice", "no_power", "voltage_check", "supply_issue"],
        [
            instr(
                "module_access",
                2,
                "Access module test points",
                MODULE_ACCESS,
                "restore_power",
            ),
            instr(
                "restore_power",
                3,
                "Restore power for live check",
                "Reconnect power. Use meter or test light at module L–N test points.",
                "ln_voltage",
            ),
            visual(
                "ln_voltage",
                4,
                "L–N line voltage present?",
                "At L–N: line voltage = power OK; 0 V = no power to module.",
                cp_yes_no(
                    "ln_ok",
                    "power_ok",
                    "ln_fail",
                    "no_power_out",
                    "No line voltage at module — trace harness, shut-off arm, and cabinet supply.",
                ),
            ),
            outcome("no_power_out", 5, "No module power", "Repair harness or supply path to ice maker module."),
            outcome("power_ok", 6, "Module power OK", "L–N line voltage verified at module."),
        ],
    ),
    proc(
        "w2225623-mold-heater",
        "Mold heater (L–H) — 72 Ω",
        "L–H",
        "Mold heater resistance and voltage",
        [1],
        ["ice_maker_module", "heater"],
        ["ice_maker", "no_ice", "IME3", "E3", "IMFUSE"],
        [
            instr(
                "heater_setup",
                2,
                "Prepare for L–H ohms",
                f"{MODULE_ACCESS} Mold heater attached to support; power off.",
                "heater_ohms",
            ),
            meas(
                "heater_ohms",
                3,
                "Mold heater resistance (L–H)",
                "185 W @ 120 V = 72 Ω at L–H with heater on support, blades in park.",
                "whirlpoolModularIceMakerMoldHeaterOhms",
                "module",
                "L ↔ H",
                ohm_branches("lh", "heater_live", "replace_heater", "72 Ω"),
            ),
            instr(
                "heater_live",
                4,
                "Live heater voltage (L–H)",
                "Restore power and initiate cycle electrically. L–H line voltage = heater ON; 0 V = OFF.",
                "heater_voltage",
            ),
            visual(
                "heater_voltage",
                5,
                "Heater energizes during harvest?",
                "During harvest heat phase, does L–H show line voltage?",
                cp_yes_no(
                    "heater_v_ok",
                    "heater_ok",
                    "heater_v_fail",
                    "heater_control_out",
                    "Heater ohms OK but no L–H voltage — module control or bimetal path.",
                ),
            ),
            outcome("replace_heater", 6, "Replace mold heater / module", "Open or out-of-spec L–H heater — replace module (IME3/E3 heater timeout)."),
            outcome("heater_control_out", 7, "Module control fault", "Heater element OK but no harvest heat — check bimetal T–H and module."),
            outcome("heater_ok", 8, "Mold heater verified", "L–H 72 Ω and harvest heater voltage verified."),
        ],
    ),
    proc(
        "w2225623-motor-circuit",
        "Ejector motor (L–M) — 8800 Ω",
        "L–M",
        "Ejector motor resistance and voltage",
        [1],
        ["ice_maker_module"],
        ["ice_maker", "no_ice", "IME2", "E2", "motor_check"],
        [
            instr(
                "motor_setup",
                2,
                "Prepare for L–M ohms",
                f"{MODULE_ACCESS} Disconnect motor from support; blades in park; power off.",
                "motor_ohms",
            ),
            meas(
                "motor_ohms",
                3,
                "Motor winding resistance (L–M)",
                "1.5 W motor = 8800 Ω at L–M with motor disconnected from support.",
                "whirlpoolModularIceMakerMotorOhms",
                "module",
                "L ↔ M",
                ohm_branches("lm", "motor_live", "replace_motor", "8800 Ω"),
            ),
            instr(
                "motor_live",
                4,
                "Live motor voltage (L–M)",
                "Restore power and initiate cycle electrically. L–M line voltage = motor ON; 0 V = OFF.",
                "motor_voltage",
            ),
            visual(
                "motor_voltage",
                5,
                "Motor energizes during cycle?",
                "During eject phase, does L–M show line voltage and blades rotate?",
                cp_yes_no(
                    "motor_v_ok",
                    "motor_ok",
                    "motor_v_fail",
                    "motor_cam_out",
                    "Motor ohms OK but no rotation — cam coupling or module control (IME2/E2).",
                ),
            ),
            outcome("replace_motor", 6, "Replace ice maker module", "Open or out-of-spec L–M motor — replace module (IME2/E2 motor home not found)."),
            outcome("motor_cam_out", 7, "Check cam coupling", "Verify \"D\" coupling alignment; replace module if cam damaged."),
            outcome("motor_ok", 8, "Motor circuit verified", "L–M 8800 Ω and eject motor voltage verified."),
        ],
    ),
    proc(
        "w2225623-bimetal",
        "Harvest bimetal (T–H)",
        "T–H",
        "Bimetal continuity and voltage",
        [1],
        ["ice_maker_module", "defrost_thermostat"],
        ["ice_maker", "no_ice", "IME3", "E3", "IME5", "E5"],
        [
            instr(
                "bimetal_cold",
                2,
                "Cold mold condition",
                f"{MODULE_ACCESS} Mold must be cold (≤17°F ±3° closes). Power off for continuity test.",
                "bimetal_ohms",
            ),
            meas(
                "bimetal_ohms",
                3,
                "Bimetal continuity (T–H, cold)",
                "Bimetal closes ≤17°F ±3°; opens 32°F ±3°. Continuity when mold cold.",
                "whirlpoolModularIceMakerBimetalOhms",
                "module",
                "T ↔ H",
                ohm_branches("th", "bimetal_live", "replace_bimetal", "Closed (cold)"),
            ),
            instr(
                "bimetal_live",
                4,
                "Live bimetal voltage (T–H)",
                "Restore power. T–H: 0 V = closed; line voltage = open (warm mold).",
                "bimetal_voltage",
            ),
            visual(
                "bimetal_voltage",
                5,
                "Bimetal state matches mold temperature?",
                "Cold mold: T–H should read 0 V (closed). Warm mold after harvest: line voltage (open).",
                cp_yes_no(
                    "bimetal_v_ok",
                    "bimetal_ok",
                    "bimetal_v_fail",
                    "replace_bimetal_out",
                    "Bimetal stuck — replace ice maker module.",
                ),
            ),
            outcome("replace_bimetal", 6, "Replace ice maker module", "Open bimetal when mold cold — no harvest cycle."),
            outcome("replace_bimetal_out", 7, "Replace ice maker module", "Bimetal voltage state incorrect for mold temperature."),
            outcome("bimetal_ok", 8, "Bimetal verified", "T–H continuity and voltage state verified."),
        ],
    ),
    proc(
        "w2225623-water-valve",
        "Water valve (N–V) and fill volume",
        "N–V",
        "Water valve voltage and fill specification",
        [1],
        ["ice_maker_module", "water_valve"],
        ["ice_maker", "no_ice", "IME4", "E4", "water_valve_check"],
        [
            instr(
                "valve_setup",
                2,
                "Prepare for fill test",
                f"{MODULE_ACCESS} Confirm water supply ON and fill tube clear. Initiate cycle electrically only.",
                "valve_voltage",
            ),
            visual(
                "valve_voltage",
                3,
                "N–V valve voltage during fill?",
                "During water-fill phase: N–V line voltage = valve ON; 0 V = OFF.",
                cp_yes_no(
                    "valve_v_ok",
                    "fill_volume",
                    "valve_v_fail",
                    "valve_fault_out",
                    "No N–V voltage during fill — module, harness, or cabinet valve path.",
                ),
            ),
            visual(
                "fill_volume",
                4,
                "Fill volume ~140 cc / 7.5 sec?",
                "Measure fill: specification is 140 cc in 7.5 seconds. Under-fill causes small or hollow cubes.",
                cp_yes_no(
                    "fill_ok",
                    "valve_ok",
                    "fill_low",
                    "fill_adjust_out",
                    "Under-fill — check water pressure, filter, fill tube freeze, and adjustment.",
                ),
            ),
            outcome("valve_fault_out", 5, "Valve or module fault", "No fill voltage at N–V — trace valve, harness, and module (IME4/E4 dry cycle)."),
            outcome("fill_adjust_out", 6, "Adjust fill or repair supply", "Fill below 140 cc/7.5 s — check pressure, filter, fill tube; adjust fill screw."),
            outcome("valve_ok", 7, "Water fill verified", "N–V valve voltage and 140 cc / 7.5 s fill verified."),
        ],
    ),
    proc(
        "w2225623-harness-fuse",
        "Harness thermal fuse (IMFUSE)",
        "fuse",
        "In-harness thermal fuse continuity",
        [1],
        ["ice_maker_module"],
        ["ice_maker", "no_ice", "IMFUSE", "IME3", "E3"],
        [
            instr(
                "fuse_access",
                2,
                "Access harness fuse",
                "Disconnect ice maker from cabinet harness. Locate in-harness thermal fuse (often black wire). Power off.",
                "fuse_ohms",
            ),
            meas(
                "fuse_ohms",
                3,
                "Harness fuse continuity",
                "0 Ω closed — fuse good. OL = blown fuse after mold heater overheat event.",
                "whirlpoolModularIceMakerHarnessFuseOhms",
                "harness",
                "fuse leads",
                ohm_branches("fuse", "fuse_ok", "replace_harness", "0 Ω closed"),
            ),
            instr(
                "fuse_ok",
                4,
                "Verify heater after fuse OK",
                "When fuse tests good, verify L–H mold heater reads 72 Ω before reinstall.",
                "fuse_path_ok",
            ),
            outcome("replace_harness", 5, "Replace ice maker harness", "Open harness fuse — replace harness; verify L–H heater before reinstall."),
            outcome("fuse_path_ok", 6, "Harness fuse OK", "In-harness thermal fuse continuity verified."),
        ],
    ),
    proc(
        "w2225623-water-fill-adjust",
        "Water level adjustment",
        "fill",
        "Fill screw adjustment (CW decreases)",
        [1],
        ["ice_maker_module"],
        ["ice_maker", "small_cubes", "hollow_cubes", "no_ice"],
        [
            instr(
                "adjust_access",
                2,
                "Access fill adjustment",
                "Pull water-adjustment knob and snap off cover. Index knob on reinstall.",
                "adjust_direction",
            ),
            instr(
                "adjust_direction",
                3,
                "Fill adjustment direction",
                "Clockwise DECREASES fill. ½ turn ≈ 20 cc (1.2 sec); 1 full turn ≈ 40 cc (2.4 sec). Max 1 turn either direction — over-adjust damages module.",
                "cube_symptom",
            ),
            visual(
                "cube_symptom",
                4,
                "Small or hollow cubes?",
                "Are cubes undersized or hollow (under-fill symptom)?",
                cp_yes_no(
                    "cubes_yes",
                    "increase_fill",
                    "cubes_no",
                    "fill_ok",
                    "Fill volume acceptable — investigate other causes.",
                ),
            ),
            instr(
                "increase_fill",
                5,
                "Increase fill (CCW)",
                "Turn fill screw counter-clockwise up to ½ turn. Run harvest cycle and re-check 140 cc / 7.5 s target.",
                "adjust_ok",
            ),
            outcome("adjust_ok", 6, "Fill adjusted", "Fill screw adjusted — verify 140 cc / 7.5 s after change."),
            outcome("fill_ok", 7, "No fill adjustment needed", "Cube size normal — fill adjustment not required."),
        ],
    ),
    proc(
        "w2225623-ime-errors",
        "Test 56 ice maker errors (IME2–IME5)",
        "56",
        "Electronic model ice maker service codes",
        [1],
        ["ice_maker_module"],
        ["ice_maker", "no_ice", "IME2", "IME3", "IME4", "IME5", "E2", "E3", "E4", "E5"],
        [
            visual(
                "ime_code",
                2,
                "Which test 56 code is displayed?",
                "French-door / electronic models show IME codes during service test 56. Modular 2225623 uses L/N/M/T/H/V test points.",
                [
                    {"id": "ime_e2", "label": "E2 / IME2 — motor home", "when": {"kind": "checkpoint_yes"}, "nextStepId": "route_e2"},
                    {"id": "ime_e3", "label": "E3 / IME3 — heater timeout", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_e3"},
                ],
            ),
            instr(
                "route_e2",
                3,
                "IME2 — motor path",
                "Run w2225623-motor-circuit: L–M should read 8800 Ω off support; verify cam \"D\" coupling alignment.",
                "e2_done",
            ),
            instr(
                "route_e3",
                4,
                "IME3 — heater / bimetal / fuse path",
                "Run w2225623-mold-heater (L–H 72 Ω), w2225623-bimetal (T–H), and w2225623-harness-fuse (IMFUSE).",
                "e3_done",
            ),
            visual(
                "ime_code_2",
                5,
                "E4 or E5 displayed?",
                "E4/IME4 = dry cycle (no water). E5/IME5 = thermistor on electronic models; modular uses bimetal T–H.",
                [
                    {"id": "ime_e4", "label": "E4 / IME4 — dry cycle", "when": {"kind": "checkpoint_yes"}, "nextStepId": "route_e4"},
                    {"id": "ime_e5", "label": "E5 / IME5 — thermistor", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_e5"},
                ],
            ),
            instr(
                "route_e4",
                6,
                "IME4 — water fill path",
                "Run w2225623-water-valve: N–V valve voltage and 140 cc / 7.5 s fill specification.",
                "e4_done",
            ),
            instr(
                "route_e5",
                7,
                "IME5 — bimetal substitute",
                "On modular 2225623, harvest thermostat is bimetal T–H (not thermistor). Run w2225623-bimetal procedure.",
                "e5_done",
            ),
            outcome("e2_done", 8, "IME2 path complete", "Motor L–M and cam coupling checked per 2225623 sheet."),
            outcome("e3_done", 9, "IME3 path complete", "Heater, bimetal, and harness fuse checked per 2225623 sheet."),
            outcome("e4_done", 10, "IME4 path complete", "Water valve N–V and fill volume checked per 2225623 sheet."),
            outcome("e5_done", 11, "IME5 path complete", "Bimetal T–H checked — modular module has no mold thermistor."),
        ],
    ),
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Whirlpool modular ice maker (2225623)",
        "notes": "L/N/M/T/H/V test points; 72 Ω heater, 8800 Ω motor, 140 cc/7.5 s fill. Brand-wide — no model pattern.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [
                    t
                    for t in item.get("tags", [])
                    if t.startswith(("IME", "E")) and len(t) <= 5 or t == "IMFUSE"
                ],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# whirlpool_modular_ice_maker — 2225623 procedure seeds

**Manual:** WHIRLPOOL-2225623-ICE-MAKER — Modular ice maker service sheet (part 2225623, 120 V)  
**Platform:** `whirlpool_modular_ice_maker` (brand-wide, no model pattern)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_MODULAR_ICE_MAKER_2225623_EXTRACTION.md`

8 procedures covering L/N/M/T/H/V test points, harness fuse, fill adjustment, and IME2–IME5 routing.

Regenerate: `python backend/scripts/generate_w2225623_ice_maker_procedure_seeds.py`

WO smoke: any Whirlpool/Maytag/KitchenAid/Amana refrigerator + `ice_maker` chip → `whirlpool_modular_ice_maker`; IME2 → `w2225623-motor-circuit`; IME4 → `w2225623-water-valve`.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        (OUT / filename).write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {filename}")
    write_catalog()
    write_readme()
    attach = ROOT / "backend" / "scripts" / "attach_w2225623_ice_maker_diagnostic_effects.py"
    if attach.is_file():
        subprocess.run([sys.executable, str(attach)], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: global validate reported errors (may include other platforms).", file=sys.stderr)


if __name__ == "__main__":
    main()
