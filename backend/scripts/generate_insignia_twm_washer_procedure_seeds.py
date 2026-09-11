#!/usr/bin/env python3
"""Generate Insignia TWM41/TWM35 (capacitive level) washer procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "insignia_washer_cap"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "insignia_washer_cap"

SOURCE = {
    "manualId": "INSIGNIA-TWM-WASHER",
    "manualTitle": "Insignia NS-TWM41WH8A / NS-TWM35W1 top-load washer (capacitive level)",
    "extractedTextFile": "backend/docs/manuals/NS-TWM41WH8A insignia washer service manual-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the washer or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Disconnect power before accessing internal components.",
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


def ohm_branches(prefix, pass_next, fail_next):
    return [
        {"id": f"{prefix}_open", "label": "Open circuit (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next, "terminal": True, "oemOutcome": "Replace component — open circuit."},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next, "terminal": True, "oemOutcome": "Replace component — out of spec."},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next, "terminal": True, "oemOutcome": "Replace component — out of spec."},
        {"id": f"{prefix}_pass", "label": "In range", "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


INLET_VALVES = proc(
    "insigniatwmcap-inlet-valves",
    "Water inlet — E1 fill timeout",
    "4.5-A",
    "Water inlet time over (E1)",
    [24, 25],
    ["inlet_valve", "water_level_sensor"],
    ["E1", "fill_issue", "water_valve_check", "error_code"],
    [
        visual(
            "supply_check",
            2,
            "Water supply and drain hose",
            "Faucets fully open? Water pressure 0.05–1 MPa? Drain hose end not above 100 cm (simultaneous fill/drain causes E1)?",
            yes_no("supply_ok", "inlet_filter", "supply_bad", "correct_supply", "Correct water supply, drain hose routing, and faucet screens."),
        ),
        visual(
            "inlet_filter",
            3,
            "Inlet filter screens",
            "Are inlet hose screens clean and hoses not kinked?",
            yes_no("filter_ok", "harness_check", "filter_bad", "clean_filters", "Clean inlet filter screens and straighten hoses."),
        ),
        visual(
            "harness_check",
            4,
            "Inlet valve harness",
            "Harness to inlet valve intact with no open circuits?",
            yes_no("harness_ok", "inlet_valve_ohms", "harness_bad", "replace_harness", "Replace inlet valve harness."),
        ),
        meas(
            "inlet_valve_ohms",
            5,
            "Inlet valve coil resistance",
            "Measure inlet solenoid coil resistance. Spec: 0.7–1.2 kΩ.",
            "insigniaWasherCapInletValveOhms",
            "Inlet valve",
            "coil",
            ohm_branches("inlet", "level_sensor_ohms", "replace_inlet_valve"),
        ),
        meas(
            "level_sensor_ohms",
            6,
            "Level sensor resistance (term 1–3)",
            "Capacitive level sensor: 20–40 Ω between terminals 1 and 3. Also verify 40–50 nF between 1–2 and 2–3.",
            "insigniaWasherCapLevelSensorOhms",
            "Level sensor",
            "1-3",
            ohm_branches("level", "inlet_verified", "replace_level_sensor"),
            excerpt="Resistance 20–40 Ω term 1–3; capacitance 40–50 nF term 1–2 and 2–3.",
        ),
        outcome("replace_inlet_valve", 7, "Replace inlet valve", "Replace inlet valve assembly and retest fill."),
        outcome("replace_level_sensor", 8, "Replace level sensor", "Replace capacitive water level sensor and retest."),
        outcome("replace_harness", 9, "Replace harness", "Replace wiring harness between PCB and inlet valve/level sensor."),
        outcome("correct_supply", 10, "Correct installation", "Correct water supply or drain hose routing; retest."),
        outcome("clean_filters", 11, "Clean filters", "Clean inlet screens; retest fill."),
        outcome("inlet_verified", 12, "Inlet path verified", "Inlet valve and level sensor in spec — if E1 persists, replace PCBs."),
    ],
)

DRAIN_PUMP = proc(
    "insigniatwmcap-drain-pump",
    "Drain pump — E2 drain timeout",
    "4.5-B",
    "Water drainage time over (E2)",
    [26],
    ["drain_pump"],
    ["E2", "drain_issue", "pump_check", "error_code"],
    [
        visual(
            "drain_hose_check",
            2,
            "Drain hose routing",
            "Drain hose straight, not kinked, and end height correct?",
            yes_no("hose_ok", "pump_harness", "hose_bad", "correct_drain_hose", "Straighten drain hose and verify end height."),
        ),
        visual(
            "pump_harness",
            3,
            "Pump harness continuity",
            "Pump harness intact with no open circuits?",
            yes_no("pump_harness_ok", "pump_ohms", "pump_harness_bad", "replace_pump_harness", "Replace drain pump harness."),
        ),
        meas(
            "pump_ohms",
            4,
            "Drain pump coil resistance",
            "Measure drain pump winding. Spec: 10–20 Ω.",
            "insigniaWasherCapDrainPumpOhms",
            "Drain pump",
            "coil",
            ohm_branches("pump", "pump_blockage", "replace_pump"),
        ),
        visual(
            "pump_blockage",
            5,
            "Pump impeller blockage",
            "Disassemble pump — foreign object or blockage present?",
            yes_no("blockage_found", "clean_pump", "no_blockage", "replace_pcb_drain", "No blockage — pump ohms in spec; replace PCBs if E2 persists."),
        ),
        outcome("replace_pump", 6, "Replace drain pump", "Replace drain pump — coil out of spec."),
        outcome("clean_pump", 7, "Clean pump", "Remove obstruction from pump; reassemble and retest drain."),
        outcome("replace_pump_harness", 8, "Replace harness", "Replace drain pump wiring harness."),
        outcome("correct_drain_hose", 9, "Correct drain hose", "Correct drain hose routing and retest."),
        outcome("replace_pcb_drain", 10, "Replace PCBs", "Replace display and/or power PCB if drain path verified but E2 persists."),
    ],
)

LID_SWITCH = proc(
    "insigniatwmcap-lid-switch",
    "Lid magnet switch — E3 / CL",
    "4.5-C",
    "Lid open (E3)",
    [27],
    ["lid_switch"],
    ["E3", "CL", "lid_switch_check", "door_switch_check", "error_code"],
    [
        visual(
            "lid_closed",
            2,
            "Lid closed",
            "Is the top lid fully closed?",
            yes_no("lid_ok", "magnet_test", "lid_open", "close_lid", "Close the lid and retest."),
        ),
        visual(
            "magnet_test",
            3,
            "Magnet switch test",
            "Move a magnetic iron close to the lid panel — does E3 clear?",
            yes_no("magnet_ok", "switch_harness", "magnet_fail", "replace_magnet_switch", "Replace magnetic lid switch."),
        ),
        visual(
            "switch_harness",
            4,
            "Magnetic switch wiring",
            "Wiring to magnetic switch intact with good connections?",
            yes_no("switch_harness_ok", "lid_verified", "switch_harness_bad", "replace_switch_harness", "Repair or replace magnetic switch harness."),
        ),
        instr(
            "cl_note",
            5,
            "CL child lock timeout",
            "CL: door open >20 min with Child Lock on. Power off, deactivate Child Lock, or call service.",
            "lid_verified",
        ),
        outcome("close_lid", 6, "Close lid", "Close lid and press Start/Pause."),
        outcome("replace_magnet_switch", 7, "Replace lid switch", "Replace magnetic lid switch assembly."),
        outcome("replace_switch_harness", 8, "Replace harness", "Replace lid switch harness."),
        outcome("lid_verified", 9, "Lid switch verified", "Lid switch and harness OK — if E3 persists, replace PCB."),
    ],
)

UNBALANCE = proc(
    "insigniatwmcap-unbalance",
    "Unbalance / impact switch — E4 / E5",
    "4.5-D",
    "Unbalance (E4)",
    [28],
    ["suspension", "lid_switch"],
    ["E4", "E5", "unbalance", "spin_issue", "error_code"],
    [
        visual(
            "load_balance",
            2,
            "Load distribution",
            "Clothes evenly distributed in basket? Washer on level solid floor?",
            yes_no("load_ok", "washer_level", "load_bad", "redistribute_load", "Redistribute laundry evenly and retest spin."),
        ),
        visual(
            "washer_level",
            3,
            "Washer leveling",
            "All leveling legs adjusted so washer is level and not touching walls?",
            yes_no("level_ok", "impact_switch", "level_bad", "level_washer", "Adjust leveling legs."),
        ),
        visual(
            "impact_switch",
            4,
            "Impact switch (E5)",
            "Impact switch: push bar to alternate position — resistance changes? Open-circuit at rest or short when pressed = replace.",
            yes_no("impact_ok", "magnet_switch_e4", "impact_bad", "replace_impact_switch", "Replace impact switch."),
        ),
        visual(
            "magnet_switch_e4",
            5,
            "Magnetic switch (E4 path)",
            "Place magnetic iron near switch — resistance OK? Short-circuit = replace switch.",
            yes_no("magnet_e4_ok", "unbalance_verified", "magnet_e4_bad", "replace_magnet_switch_e4", "Replace magnetic switch."),
        ),
        outcome("redistribute_load", 6, "Redistribute load", "Balance laundry; unit retries up to 3 times before E4."),
        outcome("level_washer", 7, "Level washer", "Adjust feet for level installation."),
        outcome("replace_impact_switch", 8, "Replace impact switch", "Replace impact/collision switch (E5 on TWM35/WMT family)."),
        outcome("replace_magnet_switch_e4", 9, "Replace magnetic switch", "Replace lid magnetic switch."),
        outcome("unbalance_verified", 10, "Mechanical path OK", "Load, level, and switches OK — if E4/E5 persists, replace PCB."),
    ],
)

LEVEL_SENSOR = proc(
    "insigniatwmcap-level-sensor",
    "Capacitive level sensor — F8",
    "4.5-E",
    "Water level sensor failure (F8)",
    [29],
    ["water_level_sensor"],
    ["F8", "fill_issue", "error_code"],
    [
        instr(
            "cap_note",
            2,
            "Capacitance check",
            "Measure capacitance between terminals 1–2 and 2–3: expect 40–50 nF. Out of range = replace sensor.",
            "level_ohms",
        ),
        meas(
            "level_ohms",
            3,
            "Level sensor resistance (term 1–3)",
            "Resistance between terminals 1 and 3: 20–40 Ω.",
            "insigniaWasherCapLevelSensorOhms",
            "Level sensor",
            "1-3",
            ohm_branches("f8_level", "harness_f8", "replace_level_f8"),
        ),
        visual(
            "harness_f8",
            4,
            "Level sensor harness",
            "Harness and connections at level sensor seated with no damage?",
            yes_no("harness_f8_ok", "f8_verified", "harness_f8_bad", "replace_harness_f8", "Repair harness or connections."),
        ),
        outcome("replace_level_f8", 5, "Replace level sensor", "Replace capacitive water level sensor."),
        outcome("replace_harness_f8", 6, "Replace harness", "Replace level sensor wiring harness."),
        outcome("f8_verified", 7, "Level sensor verified", "Sensor and harness OK — if F8 persists, replace PCBs."),
    ],
)

DOOR_LOCK = proc(
    "insigniatwmcap-door-lock",
    "Door lock actuator — Fd",
    "4.5-F",
    "Door lock failure (Fd)",
    [30],
    ["door_lock"],
    ["Fd", "door_lock_check", "error_code"],
    [
        visual(
            "lock_harness",
            2,
            "Door lock harness",
            "Harness to door locker fully connected?",
            yes_no("lock_harness_ok", "lock_coil_ohms", "lock_harness_bad", "repair_lock_harness", "Repair door lock harness connections."),
        ),
        meas(
            "lock_coil_ohms",
            3,
            "Door lock coil (blue–blue)",
            "Resistance between two blue wires: 50–80 Ω.",
            "insigniaWasherCapDoorLockOhms",
            "Door locker",
            "blue-blue",
            ohm_branches("lock_coil", "lock_switch_check", "replace_door_lock"),
        ),
        visual(
            "lock_switch_check",
            4,
            "Latch position switch (black wires)",
            "Bar extended: black pair open-circuit? Bar retracted: short-circuit? Wrong state = replace locker.",
            yes_no("lock_switch_ok", "lock_verified", "lock_switch_bad", "replace_door_lock_switch", "Replace door lock — latch switch fault."),
        ),
        outcome("replace_door_lock", 5, "Replace door lock", "Replace door lock actuator assembly."),
        outcome("replace_door_lock_switch", 6, "Replace door lock", "Replace door lock — switch or coil fault."),
        outcome("repair_lock_harness", 7, "Repair harness", "Repair door lock wiring."),
        outcome("lock_verified", 8, "Door lock verified", "Door lock in spec — if Fd persists, replace PCBs."),
    ],
)

PCB_FAILURE = proc(
    "insigniatwmcap-pcb-failure",
    "PCB failure — F2 / C9",
    "4.3",
    "PCB failed (F2 / C9)",
    [18],
    ["acu"],
    ["F2", "C9", "hmi_check", "no_power", "error_code"],
    [
        instr(
            "pcb_symptoms",
            2,
            "F2 / C9 behavior",
            "F2 or C9 indicates PCB failure. Test mode entry failure (lights not ON, display not 88, no beep) also points to PCB.",
            "replace_pcbs",
        ),
        outcome("replace_pcbs", 3, "Replace PCBs", "Replace display PCB and/or power/main PCB per failed path."),
    ],
)

LOAD_SENSING = proc(
    "insigniatwmcap-load-sensing",
    "Load sensing / belt — F5 (TWM35)",
    "F5",
    "Load sensing failed (F5)",
    [18, 19],
    ["drive_belt"],
    ["F5", "fill_issue", "error_code"],
    [
        instr(
            "f5_belt",
            2,
            "Belt tension (F5)",
            "F5 on TWM35: load sensing failed — adjust belt tension per service manual. Verify drive belt not slipped.",
            "auto_sense_test",
        ),
        visual(
            "auto_sense_test",
            3,
            "Test mode 5 — auto-sensing",
            "Enter test mode (Soak + Extra Rinse + Power). Within 9 s press Delay for auto-sensing test. Digital shows result within 3 s?",
            yes_no("sense_ok", "f5_verified", "sense_bad", "replace_pcb_f5", "No display after 3 s — replace Power PCB."),
        ),
        outcome("replace_pcb_f5", 4, "Replace PCB or belt", "Adjust belt tension; replace Power PCB if auto-sense test fails."),
        outcome("f5_verified", 5, "Load sensing OK", "Auto-sensing test displays result — F5 should not recur."),
    ],
)


def test_mode_bundle() -> dict:
    return {
        "id": "insigniatwmcap-test-mode-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "TWM41/TWM35 — Control test mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Soak + Extra Rinse + Power together; tests 2–5 for motor, spin/pump, inlet valves, auto-sensing.",
        "tags": ["service_diagnostic", "error_code"],
        "entryStepId": "prep_empty",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [16, 17],
        },
        "steps": [
            {
                "id": "prep_empty",
                "order": 1,
                "type": "instruction",
                "title": "Empty tub before test mode",
                "body": "Empty the drum (spin cycle or front service panel). Water level sensor must be installed.",
                "sourceExcerpt": "Empty machine so no water left; water level sensor should be installed.",
                "requiresInput": False,
                "defaultNextStepId": "test_mode_entry",
            },
            {
                "id": "test_mode_entry",
                "order": 2,
                "type": "instruction",
                "title": "Enter test mode",
                "body": (
                    "Press Soak, Extra Rinse, and Power together. All lights and display ON then 6 beeps — "
                    "any light off, display not 88, or no beep → replace PCB. "
                    "Within 9 s: Soil Level = wash test (3 min); Temp = spin/pump test; "
                    "Fabric Softener = inlet valve + version; Delay = auto-sensing."
                ),
                "sourceExcerpt": "Press Soak, Extra Rinse and Power together to enter test mode.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    INLET_VALVES,
    DRAIN_PUMP,
    LID_SWITCH,
    UNBALANCE,
    LEVEL_SENSOR,
    DOOR_LOCK,
    PCB_FAILURE,
    LOAD_SENSING,
]

PROCEDURE_FILES = [f"{item['id']}.json" for item in PROCEDURES]
BUNDLES = [test_mode_bundle()]
BUNDLE_FILES = ["insigniatwmcap-test-mode-entry.json"]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "washer",
        "label": SOURCE["manualTitle"],
        "notes": "NS-TWM41WH8A + NS-TWM35W1 capacitive level sensor platform. F5 load sensing on TWM35.",
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
                "relatedCodes": [
                    tag
                    for tag in item.get("tags", [])
                    if tag in ("E1", "E2", "E3", "E4", "E5", "F2", "F5", "F8", "Fd", "C9", "CL")
                ],
            }
            for item in PROCEDURES
        ],
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name}")


def write_readme() -> None:
    readme = """# Insignia TWM41 / TWM35 washer procedures

Platform: `insignia_washer_cap` (capacitive water level sensor)

## Procedures

| ID | OEM | Tags |
|----|-----|------|
"""
    for item in PROCEDURES:
        codes = ", ".join(
            t for t in item.get("tags", []) if t in ("E1", "E2", "E3", "E4", "E5", "F2", "F5", "F8", "Fd", "C9", "CL")
        )
        readme += f"| `{item['id']}` | {item['source']['oemTestNumber']} | {codes} |\n"
    readme += "\n## Bundle\n\n- `insigniatwmcap-test-mode-entry` — Soak + Extra Rinse + Power (§4.1–4.2)\n"
    readme += "\nRegenerate: `python backend/scripts/generate_insignia_twm_washer_procedure_seeds.py`\n"
    (OUT / "README.md").write_text(readme, encoding="utf-8")


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

    effects = ROOT / "backend/scripts/attach_insignia_twm_washer_diagnostic_effects.py"
    if effects.exists():
        subprocess.run([sys.executable, str(effects)], check=True, cwd=ROOT)

    modes = ROOT / "backend/scripts/attach_insignia_twm_washer_service_modes.py"
    if modes.exists():
        subprocess.run([sys.executable, str(modes)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
