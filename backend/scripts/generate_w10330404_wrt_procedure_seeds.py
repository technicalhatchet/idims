#!/usr/bin/env python3
"""Generate W10330404 (Whirlpool WRT top-mount refrigerator) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_wrt_top_mount"
PLATFORM = "whirlpool_wrt_top_mount"

SOURCE = {
    "manualId": "W10330404",
    "manualTitle": "Whirlpool Top-Mount Refrigerator Job Aid (W10330404 R-111)",
    "extractedTextFile": "backend/docs/manuals/w10330404-r-111-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the refrigerator or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Disconnect power before servicing. Replace all parts and panels before operating.",
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


def ohm_branches(prefix, pass_next, fail_next, pass_label="In range"):
    return [
        {"id": f"{prefix}_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


PROCEDURES = [
    proc(
        "w10330404-defrost-heater",
        "§4-5: Defrost heater resistance",
        "4-5",
        "Checking Defrost Heater",
        [47, 48],
        ["defrost_heater", "heater"],
        ["RD", "DF", "frost_buildup", "defrost_heater", "no_defrost"],
        [
            instr(
                "access_heater",
                2,
                "Access defrost heater",
                "Remove evaporator cover. Disconnect defrost heater wiring harness at the heater.",
                "heater_ohms",
            ),
            meas(
                "heater_ohms",
                3,
                "Defrost heater resistance",
                "Measure across heater terminals. Example: ~30 Ω installed, ~33 Ω uninstalled (verify tech sheet).",
                "whirlpoolWrtDefrostHeaterOhms",
                "defrost heater",
                "heater terminals",
                ohm_branches("heater", "sheath_check", "replace_heater", "~28–35 Ω"),
            ),
            visual(
                "sheath_check",
                4,
                "Heater sheath isolation",
                "One lead on heater wire, other on heater sheath — must read infinity (no short to ground).",
                cp_yes_no(
                    "sheath_ok",
                    "heater_ok",
                    "sheath_short",
                    "replace_heater",
                    "Replace defrost heater — element shorted to sheath.",
                ),
            ),
            outcome("replace_heater", 5, "Replace defrost heater", "Replace defrost heater when open, out of spec, or shorted to sheath."),
            outcome("heater_ok", 6, "Defrost heater verified", "Defrost heater resistance and sheath isolation verified."),
        ],
    ),
    proc(
        "w10330404-defrost-bimetal",
        "§4-8: Defrost bimetal / terminator",
        "4-8",
        "Checking Defrost Bimetal",
        [50, 51],
        ["defrost_thermostat"],
        ["DF", "frost_buildup", "defrost_thermostat", "no_defrost"],
        [
            instr(
                "access_bimetal",
                2,
                "Access defrost bimetal",
                "Remove evaporator cover. Disconnect bimetal harness. Test at harness terminals with power off.",
                "bimetal_state",
            ),
            visual(
                "bimetal_state",
                3,
                "Evaporator frost state",
                "Is the evaporator frosted and the bimetal cold (below ~40°F)? Warm bimetal should read open (infinity).",
                [
                    {"id": "frosty", "label": "Frosted / cold bimetal", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bimetal_ohms"},
                    {"id": "warm_open", "label": "Warm / post-defrost (open expected)", "when": {"kind": "checkpoint_no"}, "nextStepId": "bimetal_open_ok"},
                ],
            ),
            meas(
                "bimetal_ohms",
                4,
                "Defrost bimetal resistance (cold)",
                "Frosted evaporator and cold bimetal: expect <1 Ω closed. Open when warm after defrost is normal.",
                "whirlpoolWrtDefrostBimetalOhms",
                "defrost bimetal",
                "bimetal terminals",
                ohm_branches("bimetal", "bimetal_ok", "replace_bimetal", "<1 Ω closed"),
            ),
            outcome("bimetal_open_ok", 5, "Open when warm — normal", "Bimetal open when warm is expected — retest when evaporator is frosted if defrost failure suspected."),
            outcome("replace_bimetal", 6, "Replace defrost bimetal", "Replace defrost termination thermostat when open at frosted evaporator."),
            outcome("bimetal_ok", 7, "Bimetal verified", "Defrost bimetal closed at frosted evaporator — heater circuit can complete."),
        ],
    ),
    proc(
        "w10330404-defrost-timer",
        "§3-12: Mechanical defrost timer contacts",
        "3-12",
        "Checking Defrost Timer",
        [38, 39],
        ["defrost_timer", "control_board"],
        ["DF", "TIMER", "frost_buildup", "no_defrost"],
        [
            instr(
                "access_timer",
                2,
                "Access defrost timer",
                "Locate mechanical defrost timer (typically refrigerator compartment). Disconnect power before contact checks.",
                "timer_cool_contacts",
            ),
            visual(
                "timer_cool_contacts",
                3,
                "Timer in cooling position — contacts 1–2 and 1–4",
                "With timer in cooling: pins 1–2 = 0 Ω; pins 1–4 = OL. Rotate timer shaft until it snaps into defrost and recheck.",
                cp_yes_no(
                    "cool_ok",
                    "timer_defrost_contacts",
                    "cool_bad",
                    "replace_timer",
                    "Replace defrost timer — cooling contacts failed.",
                ),
            ),
            visual(
                "timer_defrost_contacts",
                4,
                "Timer in defrost position — contacts 1–2 and 1–4",
                "With timer in defrost: pins 1–2 = OL; pins 1–4 = 0 Ω. ~8 hr run / ~20 min defrost typical.",
                cp_yes_no(
                    "defrost_ok",
                    "timer_ok",
                    "defrost_bad",
                    "replace_timer",
                    "Replace defrost timer — defrost contacts failed.",
                ),
            ),
            outcome("replace_timer", 5, "Replace defrost timer", "Replace mechanical defrost timer when contact states fail in cool or defrost."),
            outcome("timer_ok", 6, "Timer contacts verified", "Defrost timer contact states verified in cool and defrost positions."),
        ],
    ),
    proc(
        "w10330404-ptc-start",
        "§5-9: PTC start device (cold)",
        "5-9",
        "PTC Thermistor Start Device",
        [63, 64],
        ["start_device", "compressor"],
        ["PTCOPEN", "OL", "compressor_wont_start", "not_cooling"],
        [
            instr(
                "cooldown",
                2,
                "Allow PTC cool-down",
                "Disconnect power. Allow PTC to cool ~10 minutes if compressor was recently run — hot PTC reads open.",
                "disconnect_ptc",
            ),
            instr(
                "disconnect_ptc",
                3,
                "Disconnect start device",
                "Remove machine compartment cover. Unplug start module from compressor. Do not rapid-cycle during service.",
                "ptc_ohms",
            ),
            meas(
                "ptc_ohms",
                4,
                "PTC cold resistance",
                "Measure PTC at room temperature — ~5 Ω cold; rises to 100kΩ+ within 1–3 s when energized.",
                "whirlpoolWrtPtcStartOhms",
                "PTC start module",
                "PTC terminals",
                ohm_branches("ptc", "ptc_ok", "replace_ptc", "~3–8 Ω cold"),
            ),
            outcome("replace_ptc", 5, "Replace start module", "Replace PTC start module/assembly when open cold or compressor won't start after cool-down."),
            outcome("ptc_ok", 6, "PTC verified", "PTC cold resistance in range — check overload and compressor windings if still won't start."),
        ],
    ),
    proc(
        "w10330404-condenser-fan",
        "§5-3: Condenser fan motor (shaded pole)",
        "5-3",
        "Condenser Fan Motor Resistance",
        [58, 59],
        ["condenser_fan"],
        ["running_often", "not_cooling", "condenser_fan", "airflow"],
        [
            instr(
                "access_cond_fan",
                2,
                "Access condenser fan",
                "Remove machine compartment cover. Disconnect condenser fan motor wires. Static condenser models have no fan — skip if not equipped.",
                "motor_type",
            ),
            visual(
                "motor_type",
                3,
                "Motor type check",
                "Shaded-pole motors can be ohm-tested (~700 Ω). Stepper motors cannot — use 120 VAC functional test only.",
                [
                    {"id": "shaded", "label": "Shaded pole — proceed with ohms", "when": {"kind": "checkpoint_yes"}, "nextStepId": "cond_fan_ohms"},
                    {"id": "stepper", "label": "Stepper — functional test only", "when": {"kind": "checkpoint_no"}, "nextStepId": "stepper_functional"},
                ],
            ),
            meas(
                "cond_fan_ohms",
                4,
                "Condenser fan winding resistance",
                "Measure across motor leads — shaded pole example ~700 Ω. OL indicates open winding.",
                "whirlpoolWrtCondenserFanOhms",
                "condenser fan motor",
                "motor leads",
                ohm_branches("cond_fan", "cond_fan_ok", "replace_cond_fan", "~600–800 Ω"),
            ),
            outcome(
                "stepper_functional",
                5,
                "Stepper motor — functional test",
                "Verify 120 VAC to stepper condenser fan when compressor runs; replace motor if voltage present and fan does not turn.",
            ),
            outcome("replace_cond_fan", 6, "Replace condenser fan", "Replace shaded-pole condenser fan motor when winding open or out of range."),
            outcome("cond_fan_ok", 7, "Condenser fan verified", "Condenser fan winding resistance verified."),
        ],
    ),
    proc(
        "w10330404-ice-maker-fuse",
        "§6-2: Ice maker harness thermal fuse",
        "6-2",
        "Ice Maker Thermal Fuse",
        [75, 76],
        ["ice_maker_module"],
        ["IMFUSE", "ice_maker", "no_ice"],
        [
            instr(
                "remove_im",
                2,
                "Remove ice maker",
                "Remove ice maker from freezer. Unplug ice maker from refrigerator harness. Depress locking tab to remove wire harness from housing.",
                "fuse_ohms",
            ),
            meas(
                "fuse_ohms",
                3,
                "Harness thermal fuse resistance",
                "Ohm across thermal fuse in harness (normally black wire) — 0 Ω closed. OL = open fuse.",
                "whirlpoolWrtIceMakerThermalFuseOhms",
                "ice maker harness",
                "thermal fuse",
                ohm_branches("im_fuse", "fuse_ok", "replace_harness", "0 Ω closed"),
            ),
            outcome(
                "replace_harness",
                4,
                "Replace ice maker harness",
                "Replace ice maker wire harness when fuse open. Verify mold heater operation after replacement.",
            ),
            outcome("fuse_ok", 5, "Thermal fuse verified", "Ice maker harness thermal fuse closed — continue ice maker diagnostics if no ice."),
        ],
    ),
    proc(
        "w10330404-compressor-windings",
        "§5-6: Compressor winding identification",
        "5-6",
        "Identifying Compressor Windings",
        [60, 61],
        ["compressor"],
        ["not_cooling", "compressor_wont_start", "OL"],
        [
            instr(
                "disconnect_comp",
                2,
                "Disconnect compressor terminals",
                "Disconnect power. Remove start module and disconnect compressor wires.",
                "find_common",
            ),
            instr(
                "find_common",
                3,
                "Identify common terminal",
                "Ohm all three terminal pairs. Highest reading = start + run in series; remaining terminal is common (C).",
                "identify_run_start",
            ),
            instr(
                "identify_run_start",
                4,
                "Identify run and start windings",
                "Meter on common: lower of the two remaining readings = run (R); other = start (S).",
                "ground_check",
            ),
            visual(
                "ground_check",
                5,
                "Winding-to-ground check",
                "Each terminal to ground/chassis must read infinity — any low reading indicates internal short.",
                cp_yes_no(
                    "ground_ok",
                    "windings_ok",
                    "ground_short",
                    "replace_compressor",
                    "Replace compressor — winding shorted to ground.",
                ),
            ),
            outcome("replace_compressor", 6, "Replace compressor", "Replace compressor when windings shorted to ground or locked rotor confirmed."),
            outcome(
                "windings_ok",
                7,
                "Windings isolated",
                "Compressor windings identified and not shorted to ground — check PTC, overload, and sealed system if still won't run.",
            ),
        ],
    ),
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Whirlpool / Maytag / Amana WRT top-mount refrigerator (W10330404)",
        "notes": "Mechanical timer / ADC job aid — ~30 Ω defrost heater, PTC ~5 Ω, IM harness fuse, shaded-pole cond fan ~700 Ω.",
        "plannedProcedures": [
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
                "relatedCodes": [t for t in item.get("tags", []) if t.isupper() and len(t) <= 8],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# whirlpool_wrt_top_mount — W10330404 procedure seeds

**Manual:** Whirlpool Top-Mount Refrigerator Job Aid (W10330404 R-111)  
**Platform:** `whirlpool_wrt_top_mount` — WRT*, W8T*, W4T*, MRT*, ART* (non-WRT311)  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_WRT_TOP_MOUNT_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10330404
```

## Procedures (7)

| ID | OEM | Tags |
|----|-----|------|
| w10330404-defrost-heater | §4-5 | RD, DF, frost_buildup |
| w10330404-defrost-bimetal | §4-8 | DF, frost_buildup |
| w10330404-defrost-timer | §3-12 | DF, TIMER |
| w10330404-ptc-start | §5-9 | PTCOPEN, OL |
| w10330404-condenser-fan | §5-3 | running_often, airflow |
| w10330404-ice-maker-fuse | §6-2 | IMFUSE, ice_maker |
| w10330404-compressor-windings | §5-6 | not_cooling, OL |

## WO smoke

Whirlpool `WRT518SZFM` → `whirlpool_wrt_top_mount`; frost + RD → `w10330404-defrost-heater`.
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        path = OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {filename}")

    write_catalog()
    write_readme()

    attach = ROOT / "backend" / "scripts" / "attach_w10330404_wrt_diagnostic_effects.py"
    if attach.exists():
        subprocess.run([sys.executable, str(attach)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: global validate reported errors (may include other platforms).", file=sys.stderr)


if __name__ == "__main__":
    main()
