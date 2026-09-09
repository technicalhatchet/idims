#!/usr/bin/env python3
"""Generate W10674984 (Whirlpool WRT311 ADC 2000 wiring sheet) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_wrt311_adc"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_wrt311_adc"

SOURCE = {
    "manualId": "W10674984",
    "manualTitle": "Whirlpool WRT311 ADC 2000 Wiring Sheet (W10674984 Rev A)",
    "extractedTextFile": "backend/docs/manuals/wiring-sheet-W10674984-RevA wrt311fzdt00-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the refrigerator or disconnect power before resistance checks. Use caution on live ADC voltage tests.",
    "sourceExcerpt": "Disconnect power before servicing.",
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


def meas(sid, order, title, body, kid, connector, pins, branches, excerpt="", input_kind=None):
    step = {
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
    return step


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


def volt_branches(prefix, pass_next, fail_next):
    return [
        {"id": f"{prefix}_low", "label": "Low / no voltage", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_warn", "label": "Marginal voltage", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_pass", "label": "~120 VAC", "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


def adc_defrost_test_bundle() -> dict:
    return {
        "id": "w10674984-adc-defrost-test-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "ADC 2000 electronic defrost test mode entry",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "Enter ADC defrost test — bi-metal must be closed. Heater runs up to 18 min or until bi-metal opens.",
        "tags": ["ADCTEST", "defrost", "frost_buildup", "adc_test"],
        "entryStepId": "adc_test_enter",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [1],
        },
        "steps": [
            instr(
                "adc_test_enter",
                1,
                "Enter ADC defrost test mode",
                (
                    "Bi-metal must be closed. Option 1: power off 30 s → thermostat OFF → power on. "
                    "Option 2: thermostat OFF 15 s → ON 5 s (×3) → OFF. "
                    "Relay click confirms entry. Heater runs up to 18 minutes or until bi-metal opens. "
                    "Do not bypass bi-metal — risk of overheating evaporator."
                ),
                "@continue",
                "Electronic defrost control test mode — W10674984 page 1.",
            ),
        ],
    }


PROCEDURES = [
    proc(
        "w10674984-defrost-heater",
        "WRT311 defrost heater resistance (30–42 Ω)",
        "component",
        "Defrost Heater 350–480 W @ 120 V",
        [1],
        ["defrost_heater", "heater"],
        ["RD", "DF", "frost_buildup", "defrost_heater"],
        [
            instr(
                "access_heater",
                2,
                "Access defrost heater",
                "Remove evaporator cover. Disconnect defrost heater harness. Power must be off for ohms.",
                "heater_ohms",
            ),
            meas(
                "heater_ohms",
                3,
                "Defrost heater resistance",
                "350–480 W @ 120 V → 42–30 Ω (Embraco EM3Z/EM3D). Differs from W10330404 ~30 Ω generic spec.",
                "whirlpoolWrt311DefrostHeaterOhms",
                "defrost heater",
                "heater terminals",
                ohm_branches("heater", "heater_ok", "replace_heater", "30–42 Ω"),
            ),
            outcome("replace_heater", 4, "Replace defrost heater", "Replace defrost heater when open or outside 30–42 Ω band."),
            outcome("heater_ok", 5, "Defrost heater verified", "WRT311 defrost heater resistance in 30–42 Ω band."),
        ],
    ),
    proc(
        "w10674984-defrost-bimetal",
        "WRT311 defrost bi-metal (opens 58°F)",
        "component",
        "Defrost Bi-Metal",
        [1],
        ["defrost_thermostat"],
        ["DF", "frost_buildup", "defrost_thermostat"],
        [
            instr(
                "access_bimetal",
                2,
                "Access defrost bi-metal",
                "Remove evaporator cover. Disconnect bi-metal harness. Service note: opens at 58°F on WRT311.",
                "bimetal_ohms",
            ),
            meas(
                "bimetal_ohms",
                3,
                "Defrost bi-metal resistance",
                "Cold/frosted evaporator: <1 Ω closed. Open when warm after defrost is normal.",
                "whirlpoolWrt311DefrostBimetalOhms",
                "defrost bi-metal",
                "bi-metal terminals",
                ohm_branches("bimetal", "bimetal_ok", "replace_bimetal", "<1 Ω closed"),
            ),
            outcome("replace_bimetal", 4, "Replace bi-metal", "Replace defrost bi-metal when open at frosted evaporator."),
            outcome("bimetal_ok", 5, "Bi-metal verified", "Defrost bi-metal closed when evaporator frosted."),
        ],
    ),
    proc(
        "w10674984-adc-heater-voltage",
        "ADC 2000 defrost heater output (P2–P6)",
        "adc-voltage",
        "Defrost Heater Output P2 (PK) – P6 (WH)",
        [2],
        ["defrost_heater", "control_board"],
        ["RD", "DF", "ADCTEST", "frost_buildup", "adc_test"],
        [
            instr(
                "restore_power_adc",
                2,
                "Restore power for live test",
                "Plug in refrigerator. Enter ADC defrost test mode (service mode bundle) with bi-metal closed.",
                "heater_v",
            ),
            meas(
                "heater_v",
                3,
                "ADC defrost heater output voltage",
                "Measure P2 (PK) to P6 (WH) at ADC connector — 120 VAC when heater energized in test mode.",
                "whirlpoolWrt311AdcDefrostHeaterVoltage",
                "ADC 2000",
                "P2 (PK) – P6 (WH)",
                volt_branches("heater_v", "heater_v_ok", "adc_or_wiring_fault"),
            ),
            outcome(
                "adc_or_wiring_fault",
                4,
                "ADC relay or wiring",
                "No 120 V at P2–P6 in test mode with good heater/bi-metal — check ADC 2000, harness, or bi-metal state.",
            ),
            outcome("heater_v_ok", 5, "ADC heater output verified", "120 VAC present at ADC defrost heater output during test mode."),
        ],
    ),
    proc(
        "w10674984-adc-cooling-voltage",
        "ADC 2000 cooling output (P6–P4)",
        "adc-voltage",
        "Cooling Output P6 (WH) – P4 (OR)",
        [2],
        ["control_board", "compressor"],
        ["not_cooling", "compressor_wont_start"],
        [
            visual(
                "thermostat_calling",
                2,
                "Thermostat calling for cooling",
                "Cold control must be ON and calling for cooling (compressor should run or attempt start). Verify P1 (BK) to P6 (WH) = 120 VAC constant when plugged in.",
                cp_yes_no(
                    "calling_ok",
                    "cooling_v",
                    "not_calling",
                    "check_thermostat",
                    "Verify cold control ON and not in defrost pause — thermostat or ADC input issue.",
                ),
            ),
            meas(
                "cooling_v",
                3,
                "ADC cooling output voltage",
                "Measure P6 (WH) to P4 (OR) — 120 VAC to compressor, evap fan, and condenser fan when cooling.",
                "whirlpoolWrt311AdcCoolingOutputVoltage",
                "ADC 2000",
                "P6 (WH) – P4 (OR)",
                volt_branches("cooling_v", "cooling_v_ok", "adc_cooling_fault"),
            ),
            outcome("check_thermostat", 4, "Check thermostat / inputs", "Verify cold control, ADC constant input P1–P6, and defrost not active."),
            outcome(
                "adc_cooling_fault",
                5,
                "ADC cooling output fault",
                "No P6–P4 output when calling for cooling — ADC, thermostat, or harness before sealed system.",
            ),
            outcome("cooling_v_ok", 6, "Cooling output verified", "120 VAC present at ADC cooling output — check PTC/compressor if still not cooling."),
        ],
    ),
    proc(
        "w10674984-ptc-start",
        "PTC start device (WRT311 / Embraco)",
        "component",
        "PTC Start Device",
        [1, 2],
        ["start_device", "compressor"],
        ["PTCOPEN", "OL", "compressor_wont_start"],
        [
            instr(
                "cooldown",
                2,
                "Allow PTC cool-down",
                "Disconnect power. Allow ~10 min cool-down if compressor was recently run.",
                "ptc_ohms",
            ),
            meas(
                "ptc_ohms",
                3,
                "PTC cold resistance",
                "Unplug start module from Embraco compressor. ~5 Ω cold per W10330404 PTC guidance.",
                "whirlpoolWrtPtcStartOhms",
                "PTC start module",
                "PTC terminals",
                ohm_branches("ptc", "ptc_ok", "replace_ptc", "~3–8 Ω cold"),
            ),
            outcome("replace_ptc", 4, "Replace start module", "Replace PTC start module when open cold."),
            outcome("ptc_ok", 5, "PTC verified", "PTC cold resistance OK — check overload and ADC cooling output if won't start."),
        ],
    ),
]

BUNDLES = [adc_defrost_test_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]

ADC_TEST_PROCEDURES = {
    "w10674984-defrost-heater.json",
    "w10674984-adc-heater-voltage.json",
}


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Whirlpool WRT311 ADC 2000 top-mount (W10674984)",
        "notes": "ADC 2000 pin P1–P6 voltage tests; 30–42 Ω heater; bi-metal opens 58°F; Embraco EM3Z/EM3D.",
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
    readme = """# whirlpool_wrt311_adc — W10674984 procedure seeds

**Manual:** Whirlpool WRT311 ADC 2000 Wiring Sheet (W10674984 Rev A)  
**Platform:** `whirlpool_wrt311_adc` — WRT311* only  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WRT311FDZT00_W10674984_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10674984
```

## Procedures (5)

| ID | Source | Tags |
|----|--------|------|
| w10674984-defrost-heater | Component 30–42 Ω | RD, DF |
| w10674984-defrost-bimetal | Bi-metal 58°F | DF |
| w10674984-adc-heater-voltage | P2–P6 live | ADCTEST, RD |
| w10674984-adc-cooling-voltage | P6–P4 live | not_cooling |
| w10674984-ptc-start | PTC cold ohms | PTCOPEN, OL |

## Bundles (1)

- `w10674984-adc-defrost-test-entry` — thermostat sequence → ADC defrost test mode

## WO smoke

Whirlpool `WRT311FDZT00` → `whirlpool_wrt311_adc`; frost → `w10674984-defrost-heater`.
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
        "attach_w10674984_wrt311_diagnostic_effects.py",
        "attach_w10674984_wrt311_service_modes.py",
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
