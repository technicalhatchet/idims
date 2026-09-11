#!/usr/bin/env python3
"""Generate W11794121 (JennAir 24\" Filtration dishwasher) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_dishwasher_acu"

SOURCE = {
    "manualId": "W11794121",
    "manualTitle": 'JennAir 24" Filtration Dishwasher',
    "extractedTextFile": "backend/docs/manuals/technical-manual-W11794121-revb-extracted.txt",
    "verifiedAt": "2026-03-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dishwasher or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "WARNING — Electrical Shock Hazard. Disconnect power before servicing.",
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
) -> dict:
    if not steps:
        raise ValueError(f"{pid} must define at least one step after safety")
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    return {
        "id": pid,
        "version": "1.0.0",
        "title": title,
        "platformId": "whirlpool_dishwasher_acu",
        "componentIds": component_ids,
        "tags": tags,
        "source": {
            **SOURCE,
            "oemTestNumber": oem_num,
            "oemTestTitle": oem_title,
            "pages": pages,
        },
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }


def instr(sid: str, order: int, title: str, body: str, next_id: str, excerpt: str = "") -> dict:
    return {
        "id": sid,
        "order": order,
        "type": "instruction",
        "title": title,
        "body": body,
        "sourceExcerpt": excerpt or body,
        "requiresInput": False,
        "defaultNextStepId": next_id,
    }


def visual(
    sid: str,
    order: int,
    title: str,
    body: str,
    branches: list[dict],
    excerpt: str = "",
) -> dict:
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


def outcome(sid: str, order: int, title: str, body: str) -> dict:
    return {
        "id": sid,
        "order": order,
        "type": "outcome",
        "title": title,
        "body": body,
        "oemOutcome": body,
        "requiresInput": False,
    }


def yes_no(pass_id: str, fail_id: str, *, yes_label: str = "Yes / OK", no_label: str = "No / failed") -> list[dict]:
    return [
        {"id": f"{pass_id}_yes", "label": yes_label, "when": {"kind": "checkpoint_yes"}, "nextStepId": pass_id},
        {"id": f"{pass_id}_no", "label": no_label, "when": {"kind": "checkpoint_no"}, "nextStepId": fail_id},
    ]


# W11794121 §3 component sections → existing procedure IDs (no duplicate seed JSON).
REUSED_PROCEDURE_REFS: list[dict] = [
    {
        "id": "w11633848-triac-fuse",
        "oemSection": "3-4",
        "title": "§3-4: F500 Triac Load Fuse",
        "reusedFrom": "W11633848",
        "relatedCodes": ["F1E1"],
    },
    {
        "id": "w11633848-acu-power",
        "oemSection": "3-6",
        "title": "§3-6: ACU Power & DC Supplies",
        "reusedFrom": "W11633848",
        "relatedCodes": ["F1E1"],
    },
    {
        "id": "w11480208-door-switch",
        "oemSection": "3-7",
        "title": "§3-7: Door Switch Circuit (P12)",
        "reusedFrom": "W11480208",
        "knowledgeIds": ["dishwasherDoorLatchSwitchOhms"],
        "relatedCodes": ["F5E1", "F5E2"],
    },
    {
        "id": "w11633848-fill-valve",
        "oemSection": "3-8",
        "title": "§3-8: Fill Valve Circuit",
        "reusedFrom": "W11633848",
        "knowledgeIds": ["whirlpoolDishwasherAcuFillValveOhms"],
        "relatedCodes": ["F8E1", "F8E2", "F6E2"],
    },
    {
        "id": "w11633848-dispenser",
        "oemSection": "3-9",
        "title": "§3-9: Dispenser Solenoid",
        "reusedFrom": "W11633848",
        "relatedCodes": ["F10E1", "F10E2", "F10E3"],
    },
    {
        "id": "w11480208-heater",
        "oemSection": "3-10",
        "title": "§3-10: Water Heating / Heat Dry (10–40 Ω)",
        "reusedFrom": "W11480208",
        "knowledgeIds": ["whirlpoolDishwasherAcuHeaterOhms"],
        "relatedCodes": ["F4E2", "F4E3", "F7E1", "F7E2"],
    },
    {
        "id": "w11633848-owi-sensor",
        "oemSection": "3-11",
        "title": "§3-11: OWI / Thermistor",
        "reusedFrom": "W11633848",
        "knowledgeIds": ["whirlpoolDishwasherAcuOwiThermistorOhms"],
        "relatedCodes": ["F3E1", "F3E2", "F3E3"],
    },
    {
        "id": "w11480208-overfill-switch",
        "oemSection": "3-12",
        "title": "§3-12: Overfill Float Switch (P11)",
        "reusedFrom": "W11480208",
        "knowledgeIds": ["dishwasherFloatSwitchOhms"],
        "relatedCodes": ["F6E4", "F8E4"],
    },
    {
        "id": "w11480208-diverter-motor",
        "oemSection": "3-13",
        "title": "§3-13: Diverter Motor (P6)",
        "reusedFrom": "W11480208",
        "knowledgeIds": ["whirlpoolDishwasherFiltrationDiverterMotorOhms"],
        "relatedCodes": ["F9E1", "F10E5"],
    },
    {
        "id": "w11633848-diverter-sensor",
        "oemSection": "3-14",
        "title": "§3-14: Diverter Position Sensor",
        "reusedFrom": "W11633848",
        "relatedCodes": ["F9E1", "F10E5"],
    },
    {
        "id": "w11499711-wash-motor-ssm",
        "oemSection": "3-15",
        "title": "§3-15: Wash Motor (SSM, 10–15 Ω)",
        "reusedFrom": "W11499711",
        "knowledgeIds": ["whirlpoolDishwasherAcuWashMotorOhms"],
        "relatedCodes": ["F4E3", "F7E1"],
    },
    {
        "id": "w11633848-drain-motor",
        "oemSection": "3-16",
        "title": "§3-16: Drain Motor (SSM)",
        "reusedFrom": "W11633848",
        "knowledgeIds": ["whirlpoolDishwasherAcuDrainMotorOhms"],
        "relatedCodes": ["F9E1", "F9E2", "F8E4"],
    },
    {
        "id": "w11480208-dc-fan",
        "oemSection": "3-17",
        "title": "§3-17: DC Fan Motor (ProDry)",
        "reusedFrom": "W11480208",
        "knowledgeIds": ["whirlpoolDishwasherFiltrationDcFanOhms"],
        "relatedCodes": ["F10E3"],
    },
]

DOOR_OPENING_SYSTEM = proc(
    "w11794121-door-opening-system",
    "§3-19: Door Opening System (D.O.S.)",
    "3-19",
    "Door Opening System (D.O.S.)",
    [139, 140],
    ["door_gasket"],
    ["auto_door_open", "door_lock_check"],
    [
        instr(
            "dos_service_diag",
            2,
            "D.O.S. in Service Diagnostics",
            "Check Door Opening System operation during Service Diagnostics cycle (auto door open interval).",
            "dos_live_voltage_setup",
        ),
        instr(
            "dos_live_voltage_setup",
            3,
            "Set up DC voltage test",
            "Remove outer door to access control. Set voltmeter to DC. Connect leads to test pads P9-1 and P9-2 on control board.",
            "live_dos_voltage",
        ),
        visual(
            "live_dos_voltage",
            4,
            "12 VDC at P9-1 & P9-2 during D.O.S. interval?",
            "Plug in power. Start Service Diagnostics Cycle. At the D.O.S. interval, measure DC between P9-1 and P9-2. Expect 12 VDC ± 5%.",
            yes_no("replace_dos_module", "replace_acu_dos", yes_label="12 VDC present", no_label="No voltage"),
        ),
        instr(
            "replace_dos_module",
            5,
            "Replace DOS module",
            "Control output verified — replace Door Opening System (D.O.S.) module and retest.",
            "dos_verified",
        ),
        outcome(
            "replace_acu_dos",
            6,
            "Replace ACU",
            "No DC drive at P9 during D.O.S. interval — replace control board and retest.",
        ),
        outcome(
            "dos_verified",
            7,
            "D.O.S. verified",
            "Door Opening System drive verified — reassemble and run Service Diagnostics to confirm auto door open.",
        ),
    ],
)

PROCEDURES = [DOOR_OPENING_SYSTEM]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def catalog_entry_from_ref(ref: dict) -> dict:
    return {
        "id": ref["id"],
        "manualId": "W11794121",
        "oemSection": ref["oemSection"],
        "title": ref["title"],
        "status": "reused",
        "reusedFrom": ref["reusedFrom"],
        "knowledgeIds": ref.get("knowledgeIds", []),
        "relatedCodes": ref.get("relatedCodes", []),
    }


def catalog_entry_from_proc(item: dict) -> dict:
    return {
        "id": item["id"],
        "manualId": "W11794121",
        "oemSection": item["source"]["oemTestNumber"],
        "title": item["title"],
        "status": "generated",
        "knowledgeIds": [
            step["measurementKnowledgeId"]
            for step in item["steps"]
            if step.get("measurementKnowledgeId")
        ],
        "relatedCodes": [tag for tag in item.get("tags", []) if tag.startswith("F")],
    }


def write_catalog() -> None:
    catalog_path = OUT / "procedureCatalog.json"
    existing = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.is_file() else {}
    w11633848_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w11633848-")
        and entry.get("manualId") not in ("W11499711", "W11794121")
    ]
    w11480208_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w11480208-")
        and entry.get("manualId") not in ("W11499711", "W11794121")
    ]
    w11499711_entries = [
        entry for entry in existing.get("plannedProcedures", []) if entry.get("manualId") == "W11499711"
    ]
    w11794121_entries = [catalog_entry_from_ref(ref) for ref in REUSED_PROCEDURE_REFS] + [
        catalog_entry_from_proc(item) for item in PROCEDURES
    ]
    catalog = {
        "manualId": "W11633848",
        "platformId": "whirlpool_dishwasher_acu",
        "templateId": "dishwasher",
        "label": "Whirlpool/Maytag/KitchenAid/JennAir ACU dishwasher (W11633848 + W11480208 + W11499711 + W11794121)",
        "notes": (
            "W11633848 Amana/Whirlpool 24\" + W11480208 filtration WDT740 (VSM motors) + "
            "W11499711 microfiltration WDT750 (SSM wash 10–15 Ω) + W11794121 JennAir filtration (D.O.S.). "
            "Shared fill/dispenser/OWI/diverter-sensor from W11633848; filtration pinouts from W11480208."
        ),
        "plannedProcedures": w11633848_entries
        + w11480208_entries
        + w11499711_entries
        + w11794121_entries,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {catalog_path.name} "
        f"({len(w11633848_entries)} W11633848 + {len(w11480208_entries)} W11480208 + "
        f"{len(w11499711_entries)} W11499711 + {len(w11794121_entries)} W11794121)"
    )


def write_readme() -> None:
    readme = OUT / "README.md"
    readme.write_text(
        """# whirlpool_dishwasher_acu procedure seeds

Manuals **W11633848**, **W11480208**, **W11499711**, and **W11794121** (JennAir 24\" Filtration).

Regenerate W11633848:

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11633848
```

Regenerate W11480208 (filtration-specific procedures):

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11480208
```

Regenerate W11499711 (WDT750 SSM wash-motor delta):

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11499711
```

Regenerate W11794121 (JennAir D.O.S. delta):

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11794121
```

Extraction:
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11633848_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11480208_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11499711_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11794121_DISHWASHER_EXTRACTION.md`
""",
        encoding="utf-8",
    )
    print("Wrote README.md")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)

    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        path = OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")

    write_catalog()
    write_readme()

    for script_name in (
        "attach_w11794121_diagnostic_effects.py",
        "attach_w11794121_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
