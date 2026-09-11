#!/usr/bin/env python3
"""Generate W11174814 delta procedure seeds for whirlpool_freestanding_range platform."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_freestanding_range"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_freestanding_range"

SOURCE = {
    "manualId": "W11174814",
    "manualTitle": (
        "Whirlpool/Maytag/KitchenAid/Kenmore/JennAir/IKEA/Amana Ranges (W11174814 Rev B)"
    ),
    "extractedTextFile": (
        "backend/docs/manuals/service-manual-w11174814-revb "
        "whirlpool maytag kitchenaid kenmore jennair amana ranges-extracted.txt"
    ),
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": (
        "Unplug the range or disconnect power before servicing. "
        "Resistance checks require power off and disconnected harnesses. "
        "Replace all parts and panels before operating."
    ),
    "sourceExcerpt": "Unplug range or disconnect power before resistance measurements.",
    "requiresInput": False,
}


def proc(
    pid: str,
    title: str,
    oem_num: str,
    oem_title: str,
    pages: list[int],
    component_ids: list[str],
    tags: list[str],
    steps: list[dict],
    template_ids: list[str] | None = None,
) -> dict:
    if not steps:
        raise ValueError(f"{pid} must define at least one step after safety")
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    item = {
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
    if template_ids:
        item["templateIds"] = template_ids
    return item


def meas(sid, order, title, body, kid, connector, pins, branches, excerpt="", pin_details=None):
    test_point = {"connector": connector, "pins": pins, "label": title}
    if pin_details:
        test_point["pinDetails"] = pin_details
    return {
        "id": sid,
        "order": order,
        "type": "measurement",
        "title": title,
        "body": body,
        "sourceExcerpt": excerpt or body,
        "measurementKnowledgeId": kid,
        "testPoint": test_point,
        "requiresInput": True,
        "branches": branches,
    }


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
        {"id": f"{prefix}_open", "label": "Open circuit (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


PIN_P10_WARMING_SENSOR = [
    {"pin": "3", "signal": "Warming drawer RTD"},
    {"pin": "4", "signal": "Warming drawer RTD"},
]


PROCEDURES = [
    proc(
        "w11174814-warming-drawer-sensor",
        "Warming Drawer Temperature Sensor",
        "RTD-WD",
        "Warming Drawer Temperature Sensor",
        [33, 34, 37, 38],
        ["temp_sensor"],
        ["F3E2", "sensor_check"],
        [
            meas(
                "warming_drawer_rtd",
                2,
                "Warming drawer sensor resistance",
                (
                    "Power off. Disconnect P10 from control. Measure P10-3 to P10-4. "
                    "Expect 1000–1200 Ω at room temperature (same RTD spec as main oven sensor)."
                ),
                "whirlpoolFreestandingRangeOvenSensorOhms",
                "P10",
                ["3", "4"],
                ohm_branches("wd_rtd", "wd_sensor_ok", "replace_wd_sensor"),
                pin_details=PIN_P10_WARMING_SENSOR,
            ),
            outcome("replace_wd_sensor", 3, "Replace warming drawer sensor", "Warming drawer RTD open, shorted, or out of range."),
            outcome("wd_sensor_ok", 4, "Warming drawer sensor verified", "Warming drawer RTD 1000–1200 Ω at room temperature."),
        ],
    ),
    proc(
        "w11174814-warming-drawer-element",
        "Warming Drawer Element",
        "WD-Element",
        "Warming Drawer Element",
        [33, 35, 37, 39],
        ["bake_element"],
        ["no_heat", "heating_element_check"],
        [
            meas(
                "warming_drawer_ohms",
                2,
                "Warming drawer element resistance",
                (
                    "Power off. Disconnect element leads. Maxwell electric: P4-1 to W (P6-3). "
                    "Maxwell gas: P1-4 to W. MRC electric: P4-2 to W. Expect 15–20 Ω nominal."
                ),
                "whirlpoolFreestandingRangeWarmingDrawerElementOhms",
                "P4/P1",
                ["element", "W"],
                ohm_branches("wd_elem", "wd_element_ok", "replace_wd_element"),
            ),
            outcome("replace_wd_element", 3, "Replace warming drawer element", "Warming drawer element open or out of range."),
            outcome("wd_element_ok", 4, "Warming drawer element verified", "Warming drawer element 15–20 Ω."),
        ],
    ),
    proc(
        "w11174814-gas-igniter",
        "Indigo Gas Oven Igniters (Bake / Broil)",
        "Igniter",
        "Bake and Broil Igniters",
        [86, 87],
        ["surface_ignition"],
        ["ignition_issue", "no_bake_heat_issue", "no_broil_heat_issue"],
        [
            meas(
                "bake_igniter_ohms",
                2,
                "Bake igniter resistance",
                (
                    "Power off. Disconnect bake igniter pigtail. Measure P2-3 to W (P6-3). "
                    "Expect 40–400 Ω at room temperature."
                ),
                "hotSurfaceIgniterOhms",
                "P2",
                ["3", "W"],
                ohm_branches("bake_ign", "broil_igniter_ohms", "replace_bake_igniter"),
            ),
            meas(
                "broil_igniter_ohms",
                3,
                "Broil igniter resistance",
                (
                    "Power off. Disconnect broil igniter pigtail. Measure P4-2 to W (P6-3). "
                    "Expect 40–400 Ω at room temperature."
                ),
                "hotSurfaceIgniterOhms",
                "P4",
                ["2", "W"],
                ohm_branches("broil_ign", "igniters_ok", "replace_broil_igniter"),
            ),
            outcome("replace_bake_igniter", 4, "Replace bake igniter", "Bake igniter open or out of range."),
            outcome("replace_broil_igniter", 5, "Replace broil igniter", "Broil igniter open or out of range."),
            outcome("igniters_ok", 6, "Igniters verified", "Bake and broil igniters 40–400 Ω at room temperature."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "w11174814-ceran-element",
        "Indigo Ceran Cooktop Element",
        "Ceran",
        "Cooktop Ceran Element",
        [86, 87],
        ["bake_element"],
        ["heating_element_check", "surface_burner"],
        [
            meas(
                "ceran_ohms",
                2,
                "Ceran element resistance",
                (
                    "Power off. At element terminals measure H1 to H2. "
                    "Expect 23–83 Ω nominal. Thermal limiter opens at 1100°F (593°C)."
                ),
                "whirlpoolFreestandingRangeIndigoCeranOhms",
                "H1/H2",
                ["H1", "H2"],
                ohm_branches("ceran", "ceran_ok", "replace_ceran"),
            ),
            outcome("replace_ceran", 3, "Replace ceran element or limiter", "Element open or out of range — check limiter if OL."),
            outcome("ceran_ok", 4, "Ceran element verified", "Indigo ceran element 23–83 Ω."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "w11174814-oven-light",
        "Oven Light Assembly",
        "Light",
        "Oven Light",
        [33, 41, 42, 44, 86],
        ["supply"],
        ["light_check"],
        [
            meas(
                "oven_light_ohms",
                2,
                "Oven light resistance",
                (
                    "Power off. Measure with light switch off and door closed. "
                    "Maxwell/MRC/Indigo: P5-4 to W (P6-3). LCC: Con1-4 to Con1-1 W. "
                    "LCX: P2-1 to W. Expect 0–40 Ω nominal."
                ),
                "whirlpoolFreestandingRangeOvenLightOhms",
                "P5/Con1",
                ["light", "W"],
                ohm_branches("light", "light_ok", "replace_light"),
            ),
            outcome("replace_light", 3, "Replace oven light", "Oven light open or out of range — replace bulb or assembly."),
            outcome("light_ok", 4, "Oven light verified", "Oven light 0–40 Ω."),
        ],
    ),
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def maxwell_mrc_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11174814-maxwell-mrc-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11174814",
        "title": "W11174814 — Maxwell/MRC Diagnostics mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console", "any"],
        "description": "Maxwell/MRC entry via CANCEL×2+START with Auto Test prerequisite.",
        "tags": ["service_diagnostic"],
        "entryStepId": "service_diagnostic_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [27, 28],
        },
        "steps": [
            {
                "id": "service_diagnostic_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Maxwell/MRC Diagnostics mode",
                "body": (
                    "Run Auto Test first: CANCEL → CANCEL → START → scroll to Auto Test → follow prompts.\n"
                    "Service modes: same entry (CANCEL×2+START). TEST ON shows cavity temp and door position "
                    "(UO=closed, UI=open). Electric: DLB engages on entry (normal). Press CANCEL to exit."
                ),
                "sourceExcerpt": "Diagnostics Mode (All Maxwell/MRC Controls) — CANCEL>CANCEL>START.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


def indigo_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11174814-indigo-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11174814",
        "title": "W11174814 — Indigo Diagnostics mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Indigo touch entry via HOME>FAVORITES>LIGHT repeated three times.",
        "tags": ["service_diagnostic"],
        "entryStepId": "service_diagnostic_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [30, 31],
        },
        "steps": [
            {
                "id": "service_diagnostic_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Indigo Diagnostics mode",
                "body": (
                    "Oven must be cool. Press HOME → FAVORITES → LIGHT three times in a row "
                    "(repeat the same three-key sequence until Diagnostics enters). "
                    "After each test, press CANCEL to return to clock and re-enter as needed. "
                    "Timeout: 5 minutes idle returns to time-of-day."
                ),
                "sourceExcerpt": "Enter Diagnostics Mode by pressing HOME>FAVORITES>LIGHT (repeat three times).",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


BUNDLES = [maxwell_mrc_diagnostic_entry_bundle(), indigo_diagnostic_entry_bundle()]
BUNDLE_FILES = [
    "w11174814-maxwell-mrc-diagnostic-entry.json",
    "w11174814-indigo-diagnostic-entry.json",
]


def write_catalog() -> None:
    w11174814_entries = [
        {
            "id": item["id"],
            "oemSection": item["source"]["oemTestNumber"],
            "title": item["title"],
            "status": "generated",
            "templateIds": item.get("templateIds"),
            "knowledgeIds": [
                step["measurementKnowledgeId"]
                for step in item["steps"]
                if step.get("measurementKnowledgeId")
            ],
            "relatedCodes": [tag for tag in item.get("tags", []) if tag.startswith("F")],
        }
        for item in PROCEDURES
    ]
    catalog_path = OUT / "procedureCatalog.json"
    existing = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.is_file() else {}
    w11746350_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w11746350-")
    ]
    w11174426_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w11174426-")
    ]
    catalog = {
        "manualId": "W11746350",
        "platformId": PLATFORM,
        "templateId": "electric_range",
        "label": (
            "Whirlpool/Maytag/KitchenAid/Kenmore/JennAir/IKEA/Amana freestanding range "
            "(W11746350 + W11174426 + W11174814)"
        ),
        "notes": (
            "Shared platformId whirlpool_freestanding_range. W11746350 Copernicus Settings diagnostics; "
            "W11174426 LCX/LCC CANCEL×2+START; W11174814 Maxwell/MRC/Indigo multi-brand manual. "
            "Fuel-specific procedures use templateIds electric_range / gas_range."
        ),
        "plannedProcedures": w11746350_entries + w11174426_entries + w11174814_entries,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote procedureCatalog.json ({len(w11746350_entries)} W11746350 + "
        f"{len(w11174426_entries)} W11174426 + {len(w11174814_entries)} W11174814 delta)"
    )


def write_readme() -> None:
    readme_path = OUT / "README.md"
    existing = readme_path.read_text(encoding="utf-8") if readme_path.is_file() else ""
    if "W11174814" in existing:
        return
    addition = """

## W11174814 delta procedures (5)

| ID | Fuel | OEM focus |
|----|------|-----------|
| w11174814-warming-drawer-sensor | both | Warming drawer RTD F3E2 |
| w11174814-warming-drawer-element | both | Warming drawer 15–20 Ω |
| w11174814-gas-igniter | gas | Indigo bake/broil igniter 40–400 Ω |
| w11174814-ceran-element | electric | Indigo ceran H1–H2 23–83 Ω |
| w11174814-oven-light | both | Oven light 0–40 Ω |

**Bundles:** `w11174814-maxwell-mrc-diagnostic-entry`, `w11174814-indigo-diagnostic-entry`

**Extraction:** `WHIRLPOOL_W11174814_FREESTANDING_RANGE_EXTRACTION.md`

```bash
python backend/scripts/generate_w11174814_procedure_seeds.py
```
"""
    readme_path.write_text(existing.rstrip() + addition + "\n", encoding="utf-8")
    print("Updated README.md")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)

    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        path = OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")

    for item, filename in zip(BUNDLES, BUNDLE_FILES, strict=True):
        path = BUNDLE_OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote bundles/{path.name}")

    write_catalog()
    write_readme()

    for script_name in (
        "attach_w11174814_diagnostic_effects.py",
        "attach_w11174814_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
