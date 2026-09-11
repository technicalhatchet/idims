#!/usr/bin/env python3
"""Generate Samsung ice-maker frozen bulletin procedure seeds (samsung_fridge_rf28)."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_fridge_rf28"
CATALOG_PATH = OUT / "procedureCatalog.json"

SOURCE = {
    "manualId": "SAMSUNG-ICE-MAKER-BULLETIN",
    "manualTitle": "Samsung French Door Direct Cool Ice Maker Frozen (ASC20170602002)",
    "extractedTextFile": "backend/docs/manuals/samsung-service-bulletin-ice-maker-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug refrigerator before removing ice maker or sealing ice room. After ice maker removal, keep unit unplugged so cooling loop does not frost during service.",
    "sourceExcerpt": "When the ice maker is removed, unplug the refrigerator to ensure the cooling loop does not frost over during service.",
    "requiresInput": False,
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


def cp_yes_no(yes_next, no_next, no_outcome):
    return [
        {"id": "cp_yes", "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {
            "id": "cp_no",
            "label": "No / fault",
            "when": {"kind": "checkpoint_no"},
            "nextStepId": no_next,
            "terminal": True,
            "oemOutcome": no_outcome,
        },
    ]


def prep_procedure():
    steps = [
        instr(
            "remove_bucket",
            2,
            "Remove ice bucket",
            "Remove ice bucket and inspect ice room. If bucket is stuck, use steamer to melt ice until removable. Place towel under bucket to catch melt water.",
            "steam_defrost",
        ),
        instr(
            "steam_defrost",
            3,
            "Steam defrost ice room",
            "Use steamer to remove all ice/frost from ice room and run steam down drain area. NEVER use heat gun or hair dryer.",
            "unplug_service",
        ),
        instr(
            "unplug_service",
            4,
            "Unplug during service",
            "Remove ice maker per OEM procedure, then unplug refrigerator so cooling loop does not frost over during remaining service.",
            "towel_dry",
        ),
        instr(
            "towel_dry",
            5,
            "Dry ice room",
            "Towel dry ice room, ice maker assembly, and auger assembly — remove all water traces before sealing or reinstall.",
            "prep_complete",
        ),
        outcome("prep_complete", 6, "Prep complete", "Ice room defrosted and dried — proceed to bulletin service measures."),
    ]
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    return {
        "id": "samsungrf28-ice-room-frozen-prep",
        "version": "1.0.0",
        "title": "Frozen ice room — service preparation",
        "platformId": "samsung_fridge_rf28",
        "componentIds": ["ice_maker_module"],
        "tags": ["no_ice", "ice_maker_frozen", "ice_maker"],
        "source": {
            **SOURCE,
            "oemTestNumber": "prep",
            "oemTestTitle": "Service preparation — steam defrost and dry",
            "pages": [3],
        },
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }


def service_procedure():
    steps = [
        instr(
            "rtv_seal",
            2,
            "Seal ice room with RTV",
            "Apply Samsung RTV sealant (DA81-05595A) along housing-to-liner joints (45° applicator tip). Seal all gaps between ice room housing and liner wall.",
            "water_line",
        ),
        instr(
            "water_line",
            3,
            "Adjust water fill line",
            "From rear, press grey retainer ring and back fill hose out ~10 mm. Re-inspect with mirror — line must not protrude too far into fill area. Re-secure hoses flush on rear cabinet.",
            "auger_styrofoam",
        ),
        visual(
            "auger_styrofoam",
            4,
            "Auger motor styrofoam",
            "Inspect auger motor assembly for leftover styrofoam packing blocking ice room fan airflow.",
            cp_yes_no("ice_route", "auger_blocked", "Remove styrofoam packing from auger fan."),
        ),
        visual(
            "ice_route",
            5,
            "Ice route flapper seal",
            "Inspect ice route flapper — rubber pliable, no tears, fully closed. Pour water in chute: no leak at dispenser = good seal.",
            cp_yes_no("bucket_gasket", "replace_route", "Replace ice route assembly."),
        ),
        visual(
            "bucket_gasket",
            6,
            "Ice bucket gasket",
            "Inspect bucket for base cracks and gasket rips/rigidity preventing seal. Replace ice bucket if defective.",
            cp_yes_no("y_clip_kit", "replace_bucket", "Replace ice bucket assembly."),
        ),
        instr(
            "y_clip_kit",
            7,
            "Install Y-clip service kit",
            "Replace cooling-loop retainer with kit part. Install both Y-clips on cooling loop pressed firmly against insulation — clips pointing straight down.",
            "replace_im",
        ),
        instr(
            "replace_im",
            8,
            "Replace ice maker",
            "Replace ice maker assembly per bulletin model chart. After install, verify Y-clips still point straight down.",
            "verify_operation",
        ),
        visual(
            "verify_operation",
            9,
            "Verify ice maker operation",
            "Reapply power. Confirm ice maker harvest/fill and no frost recurrence after 24–48 h.",
            [
                {"id": "v_ok", "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "service_complete"},
                {
                    "id": "v_fail",
                    "label": "No / fault",
                    "when": {"kind": "checkpoint_no"},
                    "nextStepId": "escalate",
                    "terminal": True,
                    "oemOutcome": "Recheck seals, Y-clips, and water line; escalate to Samsung ASC if frost returns.",
                },
            ],
        ),
        outcome("service_complete", 10, "Service complete", "Bulletin service measures completed — ice maker replaced and verified."),
        outcome("auger_blocked", 11, "Clear auger blockage", "Remove styrofoam from auger fan assembly."),
        outcome("replace_route", 12, "Replace ice route", "Replace ice route assembly."),
        outcome("replace_bucket", 13, "Replace ice bucket", "Replace ice bucket assembly."),
        outcome("escalate", 14, "Escalate", "Recheck bulletin steps or escalate."),
    ]
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    return {
        "id": "samsungrf28-ice-room-frozen-service",
        "version": "1.0.0",
        "title": "Frozen ice room — bulletin service measures",
        "platformId": "samsung_fridge_rf28",
        "componentIds": ["ice_maker_module", "evap_fan", "dispenser_panel"],
        "tags": ["no_ice", "ice_maker_frozen", "ice_maker"],
        "source": {
            **SOURCE,
            "oemTestNumber": "1-7",
            "oemTestTitle": "RTV seal, water line, auger, route, bucket, Y-clip kit, ice maker",
            "pages": [4, 10],
        },
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }


PROCEDURES = [prep_procedure(), service_procedure()]


def write_catalog() -> None:
    existing = []
    if CATALOG_PATH.exists():
        data = json.loads(CATALOG_PATH.read_text(encoding="utf-8"))
        existing = [
            e
            for e in data.get("plannedProcedures", [])
            if not e["id"].startswith("samsungrf28-ice-room-frozen-")
        ]
    bulletin_entries = [
        {
            "id": p["id"],
            "oemSection": p["source"]["oemTestNumber"],
            "title": p["title"],
            "status": "generated",
            "relatedCodes": [],
        }
        for p in PROCEDURES
    ]
    catalog = {
        "manualId": "SAMSUNG-RF28-FRIDGE",
        "platformId": "samsung_fridge_rf28",
        "templateId": "refrigerator",
        "label": "Samsung RF28 French-door refrigerator",
        "notes": "§4-1 test mode + §4-1-2 self-diagnostic + ASC20170602002 frozen ice room bulletin.",
        "plannedProcedures": existing + bulletin_entries,
    }
    CATALOG_PATH.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for item in PROCEDURES:
        path = OUT / f"{item['id']}.json"
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")
    write_catalog()
    attach = ROOT / "backend/scripts/attach_samsung_rf28_fridge_diagnostic_effects.py"
    if attach.exists():
        subprocess.run([sys.executable, str(attach)], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: global validate reported errors (may include other platforms).", file=sys.stderr)


if __name__ == "__main__":
    main()
