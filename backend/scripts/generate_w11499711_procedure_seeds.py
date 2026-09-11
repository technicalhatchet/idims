#!/usr/bin/env python3
"""Generate W11499711 (KitchenAid/Maytag microfiltration dishwasher WDT750) procedure seeds."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_dishwasher_acu"

SOURCE = {
    "manualId": "W11499711",
    "manualTitle": 'KitchenAid/Maytag 24" Microfiltration Dishwasher (WDT750)',
    "extractedTextFile": (
        "backend/docs/manuals/technical-manual-w11499711-reve WDT750SAKB0-extracted.txt"
    ),
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

# W11499711 §3 component sections → existing procedure IDs (no duplicate seed JSON).
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
    {
        "id": "w11480208-interior-led",
        "oemSection": "3-18",
        "title": "§3-18: Interior LED Lighting",
        "reusedFrom": "W11480208",
        "relatedCodes": [],
    },
]


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


def meas(
    sid: str,
    order: int,
    title: str,
    body: str,
    kid: str,
    connector: str,
    pins: str,
    branches: list[dict],
    excerpt: str = "",
) -> dict:
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


def pass_fail_branches(
    pass_id: str,
    fail_id: str,
    *,
    pass_label: str = "Within spec",
    fail_label: str = "Out of spec / open",
) -> list[dict]:
    return [
        {
            "id": f"{pass_id}_pass",
            "label": pass_label,
            "when": {"kind": "measurement_normal"},
            "nextStepId": pass_id,
        },
        {
            "id": f"{pass_id}_warn",
            "label": "Borderline",
            "when": {"kind": "measurement_warning"},
            "nextStepId": fail_id,
        },
        {
            "id": f"{pass_id}_crit",
            "label": fail_label,
            "when": {"kind": "measurement_critical"},
            "nextStepId": fail_id,
        },
        {
            "id": f"{pass_id}_open",
            "label": "Open (OL)",
            "when": {"kind": "measurement_open"},
            "nextStepId": fail_id,
        },
    ]


def yes_no(pass_id: str, fail_id: str, *, yes_label: str = "Yes / OK", no_label: str = "No / failed") -> list[dict]:
    return [
        {"id": f"{pass_id}_yes", "label": yes_label, "when": {"kind": "checkpoint_yes"}, "nextStepId": pass_id},
        {"id": f"{pass_id}_no", "label": no_label, "when": {"kind": "checkpoint_no"}, "nextStepId": fail_id},
    ]


WASH_MOTOR_SSM = proc(
    "w11499711-wash-motor-ssm",
    "§3-15: Wash Motor (SSM, WDT750)",
    "3-15",
    "Wash Motor",
    [53, 54],
    ["circulation_pump"],
    ["F4E3", "F7E1", "wash_issue", "pump_check"],
    [
        instr(
            "wash_prereq",
            2,
            "Wash path prerequisites",
            "Inspect sump, coarse filter, spray arms. Run Service Diagnostics wash-motor interval first.",
            "disconnect_p5_wash",
        ),
        instr(
            "disconnect_p5_wash",
            3,
            "Disconnect P5",
            "Power off. Remove toe and outer door panels. Unplug P5 from control.",
            "wash_motor_ohms",
        ),
        meas(
            "wash_motor_ohms",
            4,
            "Wash motor — P5 pins 1 & 2",
            "Ohms P5-1 to P5-2. W11499711 SSM spec 10–15 Ω (not VSM 16–18 Ω).",
            "whirlpoolDishwasherAcuWashMotorOhms",
            "P5",
            "1 & 2",
            pass_fail_branches("wash_fuse_check", "replace_wash_motor"),
        ),
        visual(
            "wash_fuse_check",
            5,
            "F501 wash fuse < 3 Ω (if equipped)?",
            "Some models: ohms P4-1 to P5-1 on control. < 3 Ω fuse OK; > 3 Ω replace control.",
            yes_no("reconnect_p5_wash", "replace_acu_wash_fuse", yes_label="Fuse OK or N/A", no_label="F501 open"),
        ),
        instr(
            "reconnect_p5_wash",
            6,
            "Reconnect P5 and restore power",
            "Reconnect P5. Restore power.",
            "live_wash_motor",
        ),
        visual(
            "live_wash_motor",
            7,
            "Wash motor runs in Service Diagnostics?",
            "120 VAC at P5-1 and P5-2 during wash interval.",
            yes_no("wash_verified", "wash_capacitor_check", yes_label="Runs", no_label="No run / no voltage"),
        ),
        visual(
            "wash_capacitor_check",
            8,
            "Capacitor passes charge test?",
            "Discharge cap with 20 kΩ resistor. Ohms across cap terminals — steady increase = good; short/open = replace cap.",
            yes_no("replace_wash_motor_cap", "replace_wash_motor_after_cap", yes_label="Cap good", no_label="Cap failed"),
        ),
        outcome("replace_wash_motor", 9, "Replace wash motor", "Replace wash motor if winding failed."),
        outcome("replace_acu_wash_fuse", 10, "Replace ACU (F501)", "Replace control if F501 open."),
        outcome("replace_wash_motor_cap", 11, "Replace capacitor", "Replace wash motor capacitor and retest."),
        outcome(
            "replace_wash_motor_after_cap",
            12,
            "Replace wash motor",
            "Cap good but motor hums/won't start — replace wash motor assembly.",
        ),
        outcome("replace_acu_wash", 13, "Replace ACU", "Motor good but no AC output — replace control."),
        outcome("wash_verified", 14, "Wash motor verified", "Wash motor circuit verified."),
    ],
)

PROCEDURES = [WASH_MOTOR_SSM]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def catalog_entry_from_ref(ref: dict) -> dict:
    return {
        "id": ref["id"],
        "manualId": "W11499711",
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
        "manualId": "W11499711",
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
        and entry.get("manualId") != "W11499711"
    ]
    w11480208_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w11480208-")
        and entry.get("manualId") != "W11499711"
    ]
    w11499711_entries = [catalog_entry_from_ref(ref) for ref in REUSED_PROCEDURE_REFS] + [
        catalog_entry_from_proc(item) for item in PROCEDURES
    ]
    catalog = {
        "manualId": "W11633848",
        "platformId": "whirlpool_dishwasher_acu",
        "templateId": "dishwasher",
        "label": "Whirlpool/Maytag/KitchenAid ACU dishwasher (W11633848 + W11480208 + W11499711)",
        "notes": (
            "W11633848 Amana/Whirlpool 24\" + W11480208 filtration WDT740 (VSM motors) + "
            "W11499711 microfiltration WDT750 (SSM wash 10–15 Ω). "
            "Shared fill/dispenser/OWI/diverter-sensor from W11633848; filtration pinouts from W11480208."
        ),
        "plannedProcedures": w11633848_entries + w11480208_entries + w11499711_entries,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {catalog_path.name} "
        f"({len(w11633848_entries)} W11633848 + {len(w11480208_entries)} W11480208 + "
        f"{len(w11499711_entries)} W11499711)"
    )


def write_readme() -> None:
    readme = OUT / "README.md"
    readme.write_text(
        """# whirlpool_dishwasher_acu procedure seeds

Manuals **W11633848** (Amana & Whirlpool 24\" dishwasher), **W11480208** (filtration WDT740), and **W11499711** (microfiltration WDT750).

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

Extraction:
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11633848_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11480208_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11499711_DISHWASHER_EXTRACTION.md`
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
        "attach_w11499711_diagnostic_effects.py",
        "attach_w11499711_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
