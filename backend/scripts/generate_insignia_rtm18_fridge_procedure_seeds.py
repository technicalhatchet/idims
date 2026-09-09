#!/usr/bin/env python3
"""Generate INSIGNIA-RTM18-FRIDGE delta — reuses midearss E-code seeds on midea_rss platform."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "midea_rss"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "midea_rss"
MANUAL_ID = "INSIGNIA-RTM18-FRIDGE"

SOURCE = {
    "manualId": MANUAL_ID,
    "manualTitle": "Insignia NS-RTM18 Top-Freezer Refrigerator (UR-BCD512WE-SQ)",
    "extractedTextFile": "backend/docs/manuals/NS-RTM18SS2 Service Manual-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

# RTM18 §9.6 LED E-family — identical troubleshooting to RSS26 §10.8 for these codes.
REUSED_PROCEDURE_REFS: list[dict] = [
    {
        "id": "midearss-rc-temp-sensor",
        "oemSection": "9.6",
        "title": "§9.6 E1: Refrigerator chamber temperature sensor",
        "reusedFrom": "MIDEA-RSS-FRIDGE",
        "knowledgeIds": ["mideaB3839ThermistorKohm"],
        "relatedCodes": ["E1"],
    },
    {
        "id": "midearss-fz-temp-sensor",
        "oemSection": "9.6",
        "title": "§9.6 E2: Freezing chamber temperature sensor",
        "reusedFrom": "MIDEA-RSS-FRIDGE",
        "knowledgeIds": ["mideaB3839ThermistorKohm"],
        "relatedCodes": ["E2"],
    },
    {
        "id": "midearss-fz-defrost-sensor",
        "oemSection": "9.6",
        "title": "§9.6 E5: Freezer defrost sensor",
        "reusedFrom": "MIDEA-RSS-FRIDGE",
        "knowledgeIds": ["mideaB3839ThermistorKohm"],
        "relatedCodes": ["E5"],
    },
    {
        "id": "midearss-communication",
        "oemSection": "9.6",
        "title": "§9.6 E6: Display ↔ main communication",
        "reusedFrom": "MIDEA-RSS-FRIDGE",
        "relatedCodes": ["E6"],
    },
    {
        "id": "midearss-ambient-sensor",
        "oemSection": "9.6",
        "title": "§9.6 E7: Ambient temperature sensor",
        "reusedFrom": "MIDEA-RSS-FRIDGE",
        "knowledgeIds": ["mideaB3839ThermistorKohm"],
        "relatedCodes": ["E7"],
    },
]


def test_mode_bundle() -> dict:
    return {
        "id": "mideartm18-test-mode-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": MANUAL_ID,
        "title": "Insignia RTM18 — Test / forced defrost mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter test mode for forced defrost per §9.7 (freeze + refrigerator gear buttons 3 s).",
        "tags": ["service_diagnostic", "forced_defrost"],
        "entryStepId": "tm_enter",
        "source": {
            **SOURCE,
            "oemTestNumber": "9.7",
            "pages": [40],
        },
        "steps": [
            {
                "id": "tm_enter",
                "order": 1,
                "type": "instruction",
                "title": "Enter test mode",
                "body": (
                    "Press and hold the freezer and refrigerator gear buttons together for 3 s, then release. "
                    "Use the freeze button to select forced defrost. Lock takes effect in test mode."
                ),
                "sourceExcerpt": (
                    "Keep pressing the Freezing and Refrigerating chamber gear setting button for 3 seconds and release."
                ),
                "requiresInput": False,
                "defaultNextStepId": "tm_forced_defrost",
            },
            {
                "id": "tm_forced_defrost",
                "order": 2,
                "type": "instruction",
                "title": "Forced defrost exit conditions",
                "body": (
                    "Forced defrost exits when the freezer defrost sensor reaches 8°C and the heater has run ≥ 3 min, "
                    "or after 60 min heater runtime. Power off or enter standby (hold temp button 3 s) to exit test mode."
                ),
                "sourceExcerpt": (
                    "In forced defrosting mode, when the freezing defrosting sensor reach a temperature of 8°C "
                    "and the defrosting heater has been working for at least 3 minutes."
                ),
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


BUNDLES = [test_mode_bundle()]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def catalog_entry_from_ref(ref: dict) -> dict:
    return {
        "id": ref["id"],
        "manualId": MANUAL_ID,
        "oemSection": ref["oemSection"],
        "title": ref["title"],
        "status": "reused",
        "reusedFrom": ref["reusedFrom"],
        "knowledgeIds": ref.get("knowledgeIds", []),
        "relatedCodes": ref.get("relatedCodes", []),
    }


def catalog_entry_from_bundle(item: dict) -> dict:
    return {
        "id": item["id"],
        "manualId": MANUAL_ID,
        "oemSection": "9.7",
        "title": item["title"],
        "status": "generated",
        "relatedCodes": [],
    }


def write_catalog() -> None:
    catalog_path = OUT / "procedureCatalog.json"
    existing = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.is_file() else {}
    rss_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if entry.get("manualId") != MANUAL_ID
        and not str(entry.get("id", "")).startswith("mideartm18-")
    ]
    rtm18_entries = [catalog_entry_from_ref(ref) for ref in REUSED_PROCEDURE_REFS] + [
        catalog_entry_from_bundle(bundle) for bundle in BUNDLES
    ]
    catalog = {
        "manualId": "MIDEA-RSS-FRIDGE",
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
    print(
        f"Wrote {catalog_path.name} "
        f"({len(rss_entries)} RSS + {len(rtm18_entries)} RTM18)"
    )


def write_readme() -> None:
    readme = OUT / "README.md"
    readme.write_text(
        """# midea_rss — Midea/Insignia refrigerator procedure seeds

**Platform:** `midea_rss` · template `refrigerator` · models `NS-RSS*`, `NS-RTM*`

## MIDEA-RSS-FRIDGE (NS-RSS26 SxS)

11 procedures + mandatory-mode bundle (§10.5). VFD + ice maker codes RSS-only.

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual MIDEA-RSS-FRIDGE
```

## INSIGNIA-RTM18-FRIDGE (NS-RTM18 top-freezer)

5 reused E-code procedures (E1/E2/E5/E6/E7) + test-mode bundle (§9.7). No ice maker or VFD.

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual INSIGNIA-RTM18-FRIDGE
```

**WO smoke:** NS-RTM18SS2 + Insignia → `midea_rss`; E5 → `midearss-fz-defrost-sensor`.

Extraction:
- `frontend/components/diagnostics/knowledge/pattern-catalog/MIDEA_INSIGNIA_REFRIGERATOR_FREEZER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/INSIGNIA_RTM18SS2_REFRIGERATOR_EXTRACTION.md`
""",
        encoding="utf-8",
    )
    print("Wrote README.md")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)

    for item, filename in zip(BUNDLES, BUNDLE_FILES, strict=True):
        path = BUNDLE_OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote bundles/{filename}")

    write_catalog()
    write_readme()

    for script_name in (
        "attach_insignia_rtm18_fridge_diagnostic_effects.py",
        "attach_insignia_rtm18_fridge_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: global validate reported errors (may include other platforms).", file=sys.stderr)


if __name__ == "__main__":
    main()
