#!/usr/bin/env python3
"""Generate W11366142 (KitchenAid KDTM404 premium dishwasher) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_dishwasher_acu"

SOURCE = {
    "manualId": "W11366142",
    "manualTitle": 'KitchenAid Premium Dishwasher (KDTM404/604/804)',
    "extractedTextFile": (
        "backend/docs/manuals/Kitchen aid dishwasher KDTM404KPS tech-sheet-w11366142-extracted.txt"
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

REUSED_PROCEDURE_REFS: list[dict] = [
    {
        "id": "w11633848-triac-fuse",
        "oemSection": "strip",
        "title": "F500 Triac Load Fuse",
        "reusedFrom": "W11633848",
        "relatedCodes": ["F1E1"],
    },
    {
        "id": "w11633848-acu-power",
        "oemSection": "strip",
        "title": "ACU Power & DC Supplies",
        "reusedFrom": "W11633848",
        "relatedCodes": ["F1E1"],
    },
    {
        "id": "w11480208-door-switch",
        "oemSection": "strip",
        "title": "Door Switch Circuit (P12)",
        "reusedFrom": "W11480208",
        "knowledgeIds": ["dishwasherDoorLatchSwitchOhms"],
        "relatedCodes": ["F5E1", "F5E2"],
    },
    {
        "id": "w11633848-fill-valve",
        "oemSection": "strip",
        "title": "Fill Valve Circuit (P6, 1200–1600 Ω)",
        "reusedFrom": "W11633848",
        "knowledgeIds": ["whirlpoolDishwasherAcuFillValveOhms"],
        "relatedCodes": ["F8E1", "F8E2", "F8E5"],
    },
    {
        "id": "w11480208-heater",
        "oemSection": "strip",
        "title": "Water Heating / Heat Dry (10–40 Ω)",
        "reusedFrom": "W11480208",
        "knowledgeIds": ["whirlpoolDishwasherAcuHeaterOhms"],
        "relatedCodes": ["F4E2", "F4E3"],
    },
    {
        "id": "w11633848-owi-sensor",
        "oemSection": "strip",
        "title": "OWI / Thermistor",
        "reusedFrom": "W11633848",
        "knowledgeIds": ["whirlpoolDishwasherAcuOwiThermistorOhms"],
        "relatedCodes": ["F3E1", "F3E2"],
    },
    {
        "id": "w11480208-overfill-switch",
        "oemSection": "strip",
        "title": "Overfill Float Switch (P11)",
        "reusedFrom": "W11480208",
        "knowledgeIds": ["dishwasherFloatSwitchOhms"],
        "relatedCodes": ["F8E4"],
    },
    {
        "id": "w11480208-diverter-motor",
        "oemSection": "strip",
        "title": "Diverter Motor (P6, 1100–1400 Ω)",
        "reusedFrom": "W11480208",
        "knowledgeIds": ["whirlpoolDishwasherFiltrationDiverterMotorOhms"],
        "relatedCodes": ["F10E4", "F10E5"],
    },
    {
        "id": "w11633848-diverter-sensor",
        "oemSection": "strip",
        "title": "Diverter Position Sensor",
        "reusedFrom": "W11633848",
        "relatedCodes": ["F10E4", "F10E5"],
    },
    {
        "id": "w11480208-dc-fan",
        "oemSection": "strip",
        "title": "DC Fan Motor (ProDry, 145–185 kΩ)",
        "reusedFrom": "W11480208",
        "knowledgeIds": ["whirlpoolDishwasherFiltrationDcFanOhms"],
        "relatedCodes": ["F10E3"],
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


WASH_MOTOR_VSM = proc(
    "w11366142-wash-motor-vsm",
    "Variable-Speed Wash Motor (A-SYNCH)",
    "strip",
    "Variable Speed Wash Motor",
    [1, 2],
    ["circulation_pump"],
    ["F7E2", "wash_issue", "pump_check"],
    [
        instr(
            "wash_prereq",
            2,
            "Wash path prerequisites",
            "Inspect sump, RIF filter, and spray arms. Run Service Diagnostics wash-motor interval first.",
            "disconnect_p5_vsm",
        ),
        instr(
            "disconnect_p5_vsm",
            3,
            "Disconnect P5",
            "Power off. Remove toe and outer door panels. Unplug P5 from control.",
            "wash_motor_vsm_ohms",
        ),
        meas(
            "wash_motor_vsm_ohms",
            4,
            "VSM wash motor — P5 pins 1 & 2",
            "Ohms P5-1 to P5-2. KDTM404 A-SYNCH variable-speed wash (800 W wet / 500 W dry). "
            "Filtration VSM spec 16–18 Ω applies; SSM models use 10–15 Ω on same pins.",
            "whirlpoolDishwasherFiltrationVsmWashMotorOhms",
            "P5",
            "1 & 2 (VSM)",
            pass_fail_branches("vsm_retest", "replace_wash_motor_vsm"),
        ),
        instr(
            "vsm_retest",
            5,
            "Reassemble and run Service Diagnostics",
            "Reconnect P5. Reassemble panels. Restore power and run Service Diagnostics to verify wash motor operation.",
            "wash_vsm_verified",
        ),
        outcome(
            "replace_wash_motor_vsm",
            6,
            "Replace wash motor",
            "Replace variable-speed wash motor if winding failed (F7E2).",
        ),
        outcome(
            "wash_vsm_verified",
            7,
            "VSM wash motor verified",
            "VSM wash motor verified. No AC bench run test — motor uses DC drive from control.",
        ),
    ],
)

DRAIN_MOTOR = proc(
    "w11366142-drain-motor",
    "Drain Motor (SSM, 27.4–32.2 Ω)",
    "strip",
    "Drain Motor",
    [1, 2],
    ["drain_pump"],
    ["F9E1", "F9E2", "F8E4", "drain_issue", "pump_check"],
    [
        instr(
            "drain_mechanical",
            2,
            "Drain path mechanical check",
            "Verify drain hose, disposal plug, check valve, and filter. Run Service Diagnostics drain interval first.",
            "disconnect_p5_drain",
        ),
        instr(
            "disconnect_p5_drain",
            3,
            "Disconnect P5",
            "Power off. Unplug P5 from control.",
            "drain_motor_ohms",
        ),
        meas(
            "drain_motor_ohms",
            4,
            "Drain motor — P5 pins 3 & 4",
            "Ohms P5-3 to P5-4. W11366142 strip spec 27.4–32.2 Ω (45 W SSM drain).",
            "whirlpoolDishwasherPremiumDrainMotorOhms",
            "P5",
            "3 & 4",
            pass_fail_branches("reconnect_p5_drain", "replace_drain_motor"),
        ),
        instr(
            "reconnect_p5_drain",
            5,
            "Reconnect P5 and restore power",
            "Reconnect P5. Restore power.",
            "live_drain",
        ),
        visual(
            "live_drain",
            6,
            "Drain motor runs in Service Diagnostics?",
            "120 VAC at P5-3 and P5-4 during drain interval (motor connected).",
            yes_no("drain_verified", "replace_acu_drain", yes_label="Runs", no_label="No run / no voltage"),
        ),
        outcome("replace_drain_motor", 7, "Replace drain motor", "Replace drain pump if winding failed or impeller damaged."),
        outcome("replace_acu_drain", 8, "Replace ACU", "Motor good but no AC output — replace control."),
        outcome("drain_verified", 9, "Drain motor verified", "Drain motor verified."),
    ],
)

DISPENSER = proc(
    "w11366142-dispenser",
    "Dispenser Solenoid (310–380 Ω)",
    "strip",
    "Dispenser Solenoid",
    [1, 2],
    ["inlet_valve"],
    ["F10E1", "dispenser_check"],
    [
        instr(
            "disp_mechanical",
            2,
            "Dispenser mechanical check",
            "Clear obstructions preventing dispenser lid from opening. If all TRIAC loads dead, check door switch and F500 fuse.",
            "disconnect_p12_disp",
        ),
        instr(
            "disconnect_p12_disp",
            3,
            "Disconnect P12",
            "Power off. Remove outer door and toe panels. Unplug P12 from control.",
            "dispenser_ohms",
        ),
        meas(
            "dispenser_ohms",
            4,
            "Dispenser — P12 pins 5 & 7",
            "Ohms between P12-5 and P12-7. W11366142 strip spec 310–380 Ω.",
            "whirlpoolDishwasherPremiumDispenserOhms",
            "P12",
            "5 & 7",
            pass_fail_branches("reconnect_p12_disp", "replace_dispenser"),
        ),
        instr(
            "reconnect_p12_disp",
            5,
            "Reconnect P12 and restore power",
            "Reconnect P12. Restore power and run Service Diagnostics dispenser interval.",
            "dispenser_verified",
        ),
        outcome("replace_dispenser", 6, "Replace dispenser", "Replace dispenser assembly if solenoid open/out of range."),
        outcome("dispenser_verified", 7, "Dispenser verified", "Dispenser solenoid verified."),
    ],
)

VENT_WAX_MOTOR = proc(
    "w11366142-vent-wax-motor",
    "Vent Wax Motor (1890–2310 Ω each coil)",
    "strip",
    "Vent Wax Motor",
    [1, 2],
    ["heater"],
    ["F10E2", "vent_check"],
    [
        instr(
            "vent_service_diag",
            2,
            "Vent in Service Diagnostics",
            "Run Service Diagnostics — observe vent open/close during dry interval. Clear error codes and retest if F10E2 was intermittent.",
            "disconnect_vent_wax",
        ),
        instr(
            "disconnect_vent_wax",
            3,
            "Disconnect vent wax motor",
            "Power off. Access ProDry/vent assembly. Disconnect vent wax motor harness at motor.",
            "vent_coil1_ohms",
        ),
        meas(
            "vent_coil1_ohms",
            4,
            "Vent wax motor — coil 1",
            "Ohms across first vent wax motor coil at harness. W11366142 spec 1890–2310 Ω per coil.",
            "whirlpoolDishwasherPremiumVentWaxMotorOhms",
            "Vent wax motor",
            "coil 1",
            pass_fail_branches("vent_coil2_ohms", "replace_vent_wax"),
        ),
        meas(
            "vent_coil2_ohms",
            5,
            "Vent wax motor — coil 2",
            "Ohms across second vent wax motor coil at harness. Expect 1890–2310 Ω.",
            "whirlpoolDishwasherPremiumVentWaxMotorOhms",
            "Vent wax motor",
            "coil 2",
            pass_fail_branches("reconnect_vent_wax", "replace_vent_wax"),
        ),
        instr(
            "reconnect_vent_wax",
            6,
            "Reconnect and restore power",
            "Reconnect vent wax motor. Restore power and run Service Diagnostics vent interval.",
            "live_vent_wax",
        ),
        visual(
            "live_vent_wax",
            7,
            "Vent opens in Service Diagnostics?",
            "Vent wax motor must be connected. Observe vent damper opens during dry/vent interval.",
            yes_no("vent_wax_verified", "replace_acu_vent", yes_label="Vent opens", no_label="No movement"),
        ),
        outcome("replace_vent_wax", 8, "Replace vent wax motor", "Replace vent wax motor if either coil open/out of range."),
        outcome("replace_acu_vent", 9, "Replace ACU", "Motor good but no vent drive — replace control or check vent fuse."),
        outcome("vent_wax_verified", 10, "Vent wax motor verified", "Vent wax motor circuit verified."),
    ],
)

TUB_LIGHT = proc(
    "w11366142-tub-light",
    "Tub Light (12 V PWM)",
    "strip",
    "Tub Light",
    [1, 2],
    ["heater"],
    ["F9E4", "hmi_check"],
    [
        instr(
            "tub_light_door_open",
            2,
            "Door-open tub light check",
            "Open door — tub light should illuminate (12 V PWM drive). Light may time out after several minutes.",
            "disconnect_p9_tub_light",
        ),
        instr(
            "disconnect_p9_tub_light",
            3,
            "Disconnect P9",
            "Power off. Remove toe and outer door panels. Verify P9 seated. Disconnect P9 from control.",
            "tub_light_diode_check",
        ),
        visual(
            "tub_light_diode_check",
            4,
            "Tub LED passes diode check?",
            "Diode mode: numeric reading anode→cathode; OL cathode→anode on tub LED assembly.",
            yes_no("live_tub_light", "replace_tub_led", yes_label="LED OK", no_label="LED failed"),
        ),
        visual(
            "live_tub_light",
            5,
            "12 V PWM at P9 (door open, P9 unplugged)?",
            "Power on, door open: verify 12 V PWM drive at tub light circuit per strip diagram (P9).",
            yes_no("tub_light_verified", "replace_acu_tub_light", yes_label="Drive present", no_label="Missing"),
        ),
        outcome("replace_tub_led", 6, "Replace tub light", "Replace failed tub light assembly and retest."),
        outcome("replace_acu_tub_light", 7, "Replace ACU", "LED good but no PWM output — replace control."),
        outcome("tub_light_verified", 8, "Tub light verified", "Tub light circuit verified."),
    ],
)

RIF_FILTER = proc(
    "w11366142-rif-filter",
    "RIF Filter Plugged (F7E4)",
    "strip",
    "RIF Filter",
    [1, 2],
    ["circulation_pump"],
    ["F7E4", "wash_issue", "rif_filter"],
    [
        instr(
            "rif_remove",
            2,
            "Remove RIF filter",
            "Remove lower rack. Twist and lift Removable Internal Filter (RIF) assembly per use & care guide.",
            "rif_inspect",
        ),
        visual(
            "rif_inspect",
            3,
            "Filter plugged or damaged?",
            "Inspect RIF screen and sump area for food debris, glass, or labels blocking flow.",
            yes_no("rif_clean", "rif_replace", yes_label="Plugged — cleanable", no_label="Damaged filter"),
        ),
        instr(
            "rif_clean",
            4,
            "Clean and reinstall RIF",
            "Rinse filter under running water. Clear sump debris. Reinstall RIF securely.",
            "rif_retest",
        ),
        visual(
            "rif_retest",
            5,
            "F7E4 cleared after Service Diagnostics?",
            "Restore power. Run Service Diagnostics wash interval — confirm F7E4 does not return.",
            yes_no("rif_verified", "rif_deeper_path", yes_label="Cleared", no_label="F7E4 returns"),
        ),
        instr(
            "rif_deeper_path",
            6,
            "Escalate wash path",
            "Filter clean but F7E4 persists — run variable-speed wash motor test and inspect diverter spray zones.",
            "rif_escalate_wash",
        ),
        outcome("rif_replace", 7, "Replace RIF filter", "Replace damaged RIF filter assembly."),
        outcome("rif_escalate_wash", 8, "Run wash motor test", "Continue with w11366142-wash-motor-vsm and diverter procedures."),
        outcome("rif_verified", 9, "RIF filter verified", "RIF filter clean — F7E4 resolved."),
    ],
)

PROCEDURES = [
    WASH_MOTOR_VSM,
    DRAIN_MOTOR,
    DISPENSER,
    VENT_WAX_MOTOR,
    TUB_LIGHT,
    RIF_FILTER,
]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]

PRIOR_MANUAL_IDS = ("W11499711", "W11794121", "W11366142")


def catalog_entry_from_ref(ref: dict) -> dict:
    return {
        "id": ref["id"],
        "manualId": "W11366142",
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
        "manualId": "W11366142",
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
        and entry.get("manualId") not in PRIOR_MANUAL_IDS
    ]
    w11480208_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w11480208-")
        and entry.get("manualId") not in PRIOR_MANUAL_IDS
    ]
    w11499711_entries = [
        entry for entry in existing.get("plannedProcedures", []) if entry.get("manualId") == "W11499711"
    ]
    w11794121_entries = [
        entry for entry in existing.get("plannedProcedures", []) if entry.get("manualId") == "W11794121"
    ]
    w11366142_entries = [catalog_entry_from_ref(ref) for ref in REUSED_PROCEDURE_REFS] + [
        catalog_entry_from_proc(item) for item in PROCEDURES
    ]
    catalog = {
        "manualId": "W11633848",
        "platformId": "whirlpool_dishwasher_acu",
        "templateId": "dishwasher",
        "label": (
            "Whirlpool/Maytag/KitchenAid/JennAir ACU dishwasher "
            "(W11633848 + W11480208 + W11499711 + W11794121 + W11366142)"
        ),
        "notes": (
            "W11633848 Amana/Whirlpool 24\" + W11480208 filtration WDT740 (VSM motors) + "
            "W11499711 microfiltration WDT750 (SSM wash 10–15 Ω) + W11794121 JennAir filtration (D.O.S.) + "
            "W11366142 KitchenAid premium KDTM404 (RIF filter F7E4, vent wax F10E2, tub light F9E4). "
            "Shared fill/OWI/diverter-sensor from W11633848; filtration pinouts from W11480208."
        ),
        "plannedProcedures": w11633848_entries
        + w11480208_entries
        + w11499711_entries
        + w11794121_entries
        + w11366142_entries,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {catalog_path.name} "
        f"({len(w11633848_entries)} W11633848 + {len(w11480208_entries)} W11480208 + "
        f"{len(w11499711_entries)} W11499711 + {len(w11794121_entries)} W11794121 + "
        f"{len(w11366142_entries)} W11366142)"
    )


def write_readme() -> None:
    readme = OUT / "README.md"
    readme.write_text(
        """# whirlpool_dishwasher_acu procedure seeds

Manuals **W11633848**, **W11480208**, **W11499711**, **W11794121**, and **W11366142** (KitchenAid KDTM404 premium).

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

Regenerate W11366142 (KitchenAid KDTM404 premium deltas):

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11366142
```

Extraction:
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11633848_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11480208_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11499711_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11794121_DISHWASHER_EXTRACTION.md`
- `frontend/components/diagnostics/knowledge/pattern-catalog/KITCHENAID_KDTM404KPS_DISHWASHER_EXTRACTION.md`
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
        "attach_w11366142_diagnostic_effects.py",
        "attach_w11366142_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
