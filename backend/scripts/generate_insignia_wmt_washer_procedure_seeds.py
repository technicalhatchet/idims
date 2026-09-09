#!/usr/bin/env python3
"""Generate Insignia WMT41 (frequency level) washer procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "insignia_washer_freq"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "insignia_washer_freq"

SOURCE = {
    "manualId": "INSIGNIA-WMT-WASHER",
    "manualTitle": "Insignia NS-WMT41WA5 top-load washer (frequency level)",
    "extractedTextFile": "backend/docs/manuals/Service-Manual-NS-WMT41WA5-extracted.txt",
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


def freq_branches(prefix, pass_next, fail_next):
    return [
        {"id": f"{prefix}_crit_low", "label": "Below 18 kHz", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next, "terminal": True, "oemOutcome": "Replace level sensor — F8 fault."},
        {"id": f"{prefix}_warn", "label": "Borderline", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next, "terminal": True, "oemOutcome": "Replace level sensor — out of spec."},
        {"id": f"{prefix}_pass", "label": "26.4–27.0 kHz (empty)", "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
        {"id": f"{prefix}_crit_high", "label": "Above 30 kHz", "when": {"kind": "measurement_open"}, "nextStepId": fail_next, "terminal": True, "oemOutcome": "Replace level sensor — F8 fault."},
    ]


def yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


INLET_VALVES = proc(
    "insigniawmt41-inlet-valves",
    "Water inlet — E1 fill timeout",
    "E1",
    "Abnormal water inlet",
    [52, 53, 54],
    ["inlet_valve", "water_level_sensor"],
    ["E1", "fill_issue", "water_valve_check", "error_code"],
    [
        visual(
            "supply_check",
            2,
            "Water supply",
            "Faucets open? Inlet screens clean? Water pressure adequate? Simultaneous fill/drain (leak path) can cause E1.",
            yes_no("supply_ok", "inlet_harness", "supply_bad", "correct_supply", "Correct water supply and installation."),
        ),
        visual(
            "inlet_harness",
            3,
            "Inlet valve / level sensor harness",
            "Wire harness to inlet valve and level sensor intact?",
            yes_no("harness_ok", "inlet_valve_ohms", "harness_bad", "replace_harness", "Replace or repair harness."),
        ),
        meas(
            "inlet_valve_ohms",
            4,
            "Inlet valve coil (term 1–2)",
            "Inlet valve coil resistance: 4–6 Ω.",
            "insigniaWasherFreqInletValveOhms",
            "Inlet valve",
            "1-2",
            ohm_branches("inlet", "level_freq", "replace_inlet_valve"),
        ),
        meas(
            "level_freq",
            5,
            "Level sensor frequency (empty tub)",
            "Frequency at terminals 1–2 with empty tub: 26.70±0.3 kHz. F8 if <18 or >30 kHz.",
            "insigniaWasherLevelSensorFrequency",
            "Level sensor",
            "1-2",
            freq_branches("level_freq", "inlet_verified", "replace_level_sensor"),
            excerpt="Check frequency without load; empty tub 26.70±0.3 kHz.",
        ),
        outcome("replace_inlet_valve", 6, "Replace inlet valve", "Replace inlet valve — coil out of spec."),
        outcome("replace_level_sensor", 7, "Replace level sensor", "Replace frequency water level sensor."),
        outcome("replace_harness", 8, "Replace harness", "Replace inlet/level sensor harness."),
        outcome("correct_supply", 9, "Correct supply", "Correct water supply or leak path; retest."),
        outcome("inlet_verified", 10, "Inlet path verified", "Valve and level sensor OK — replace PCB/inverter if E1 persists."),
    ],
)

DRAIN_MOTOR = proc(
    "insigniawmt41-drain-motor",
    "Retractor / drain motor — E2",
    "E2",
    "Drainage problems",
    [54, 55],
    ["drain_pump"],
    ["E2", "drain_issue", "pump_check", "error_code"],
    [
        visual(
            "drain_clog",
            2,
            "Drain path obstruction",
            "Drain hose, valve, or pump obstructed by debris or small clothing?",
            yes_no("drain_clear", "retractor_harness", "drain_clogged", "clear_drain", "Clear drain hose, valve, or pump obstruction."),
        ),
        visual(
            "retractor_harness",
            3,
            "Retractor harness",
            "Harness to retractor/drain motor intact?",
            yes_no("retractor_harness_ok", "drain_motor_ohms", "retractor_harness_bad", "replace_harness_drain", "Replace retractor harness."),
        ),
        meas(
            "drain_motor_ohms",
            4,
            "Drain motor (Red–Light blue)",
            "Retractor/drain motor winding: 5–7 Ω.",
            "insigniaWasherFreqDrainPumpOhms",
            "Retractor",
            "Red-Light blue",
            ohm_branches("drain", "drain_verified", "replace_retractor"),
        ),
        instr(
            "inverter_note",
            5,
            "Variable-frequency path",
            "On VFD models, try replacing frequency converter/inverter if retractor ohms OK but E2 persists.",
            "drain_verified",
        ),
        outcome("replace_retractor", 6, "Replace retractor", "Replace retractor/drain motor assembly."),
        outcome("clear_drain", 7, "Clear obstruction", "Remove drain obstruction and retest."),
        outcome("replace_harness_drain", 8, "Replace harness", "Replace retractor wiring harness."),
        outcome("drain_verified", 9, "Drain path verified", "Retractor and drain path OK."),
    ],
)

LID_SWITCH = proc(
    "insigniawmt41-lid-switch",
    "Lid / door switch — E3",
    "E3",
    "Door left open",
    [55, 56],
    ["lid_switch"],
    ["E3", "lid_switch_check", "door_switch_check", "error_code"],
    [
        visual(
            "lid_closed",
            2,
            "Lid closed during operation",
            "Is the lid fully closed? E3 clears when lid is closed.",
            yes_no("lid_ok", "door_magnet", "lid_open", "close_lid", "Close lid and retest."),
        ),
        visual(
            "door_magnet",
            3,
            "Door magnet / lid switch",
            "Door magnet switch operating? Impact switch parallel path OK?",
            yes_no("magnet_ok", "lid_harness", "magnet_fail", "replace_lid_switch", "Replace lid switch or door magnet assembly."),
        ),
        visual(
            "lid_harness",
            4,
            "Lid switch harness",
            "Continuity on lid switch harness per OEM (ohm meter)?",
            yes_no("lid_harness_ok", "lid_verified", "lid_harness_bad", "replace_lid_harness", "Replace lid switch harness."),
        ),
        outcome("close_lid", 5, "Close lid", "Close lid — E3 should clear."),
        outcome("replace_lid_switch", 6, "Replace lid switch", "Replace door/lid switch assembly."),
        outcome("replace_lid_harness", 7, "Replace harness", "Replace lid switch wiring."),
        outcome("lid_verified", 8, "Lid switch verified", "Lid switch path OK."),
    ],
)

UNBALANCE = proc(
    "insigniawmt41-unbalance",
    "Imbalance — E4",
    "E4",
    "Imbalance error",
    [59, 60],
    ["suspension"],
    ["E4", "unbalance", "spin_issue", "error_code"],
    [
        visual(
            "load_balance",
            2,
            "Load and leveling",
            "Laundry evenly distributed? Washer level on sturdy flat surface?",
            yes_no("load_ok", "suspension_rods", "load_bad", "redistribute_load", "Redistribute load and level washer."),
        ),
        visual(
            "suspension_rods",
            3,
            "Suspension rods",
            "All four suspension rods intact (not broken)?",
            yes_no("rods_ok", "impact_e4", "rods_bad", "replace_rods", "Replace broken suspension rod(s)."),
        ),
        instr(
            "impact_e4",
            4,
            "Impact / collision switch",
            "Impact switch failure can cause E4 — verify switch and linkage (see E5 procedure).",
            "unbalance_verified",
        ),
        outcome("redistribute_load", 5, "Redistribute load", "Balance laundry; open lid to reset E4 if needed."),
        outcome("replace_rods", 6, "Replace suspension", "Replace broken suspension rod assembly."),
        outcome("unbalance_verified", 7, "Mechanical OK", "Load and suspension OK — check impact switch and drive system."),
    ],
)

IMPACT_SWITCH = proc(
    "insigniawmt41-impact-switch",
    "Impact switch — E5",
    "E5",
    "Impact switch signal disconnected",
    [56, 57],
    ["lid_switch"],
    ["E5", "unbalance", "error_code"],
    [
        visual(
            "tub_clearance",
            2,
            "Tub clearance",
            "Water bucket not pressing impact switch lever? Tub centered with adequate clearance?",
            yes_no("clearance_ok", "impact_terminals", "clearance_bad", "adjust_tub", "Reposition tub/cabinet so switch lever is not pressed."),
        ),
        visual(
            "impact_terminals",
            3,
            "Impact switch terminals",
            "Terminals seated — not loose or disconnected?",
            yes_no("terminals_ok", "impact_continuity", "terminals_bad", "reseat_terminals", "Reseat impact switch connectors."),
        ),
        visual(
            "impact_continuity",
            4,
            "Impact switch continuity",
            "Multimeter on impact switch: damaged or open when should be closed?",
            yes_no("impact_ok", "e5_verified", "impact_bad", "replace_impact", "Replace impact switch."),
        ),
        outcome("adjust_tub", 5, "Adjust installation", "Correct tub position and clearance."),
        outcome("reseat_terminals", 6, "Reseat connectors", "Reseat impact switch wiring."),
        outcome("replace_impact", 7, "Replace impact switch", "Replace impact/collision switch."),
        outcome("e5_verified", 8, "Impact switch OK", "Impact switch and wiring verified."),
    ],
)

LEVEL_SENSOR = proc(
    "insigniawmt41-level-sensor",
    "Frequency level sensor — F8",
    "F8",
    "Water level sensor fault",
    [54, 55],
    ["water_level_sensor"],
    ["F8", "fill_issue", "error_code"],
    [
        instr(
            "f8_define",
            2,
            "F8 monitor window",
            "After power-on PCB monitors level sensor frequency for 5 s. <18 kHz or >30 kHz triggers F8.",
            "harness_f8",
        ),
        visual(
            "harness_f8",
            3,
            "Level sensor harness",
            "Back panel: level sensor terminals properly inserted?",
            yes_no("harness_f8_ok", "level_freq_f8", "harness_f8_bad", "reseat_harness_f8", "Reinsert level sensor connections."),
        ),
        meas(
            "level_freq_f8",
            4,
            "Level sensor frequency (empty)",
            "Terminals 1–2, empty tub: 26.70±0.3 kHz.",
            "insigniaWasherLevelSensorFrequency",
            "Level sensor",
            "1-2",
            freq_branches("f8", "inspect_pcb_f8", "replace_level_f8"),
        ),
        visual(
            "inspect_pcb_f8",
            5,
            "PCB damage",
            "Main PCB damaged?",
            yes_no("pcb_ok", "f8_verified", "pcb_bad", "replace_pcb_f8", "Replace main PCB."),
        ),
        outcome("replace_level_f8", 6, "Replace level sensor", "Replace frequency water level sensor."),
        outcome("reseat_harness_f8", 7, "Reseat harness", "Reseat level sensor harness."),
        outcome("replace_pcb_f8", 8, "Replace PCB", "Replace main control PCB."),
        outcome("f8_verified", 9, "Level sensor verified", "Frequency in spec and harness OK."),
    ],
)

DRIVE_MOTOR = proc(
    "insigniawmt41-drive-motor",
    "Drive motor & capacitor — agitate/spin",
    "07",
    "Motor & capacitor check",
    [62, 63],
    ["drive_motor"],
    ["motor_check", "spin_issue", "agitate_issue"],
    [
        instr(
            "cap_discharge",
            2,
            "Discharge motor capacitor",
            "Discharge motor capacitor before resistance tests. Yellow–Blue: needle rises then ∞ = OK capacitor.",
            "motor_yellow_lightblue",
        ),
        meas(
            "motor_yellow_lightblue",
            3,
            "Motor Yellow–Light blue",
            "Drive motor winding pair: 15–25 Ω.",
            "insigniaWasherFreqDriveMotorOhms",
            "Drive motor",
            "Yellow-Light blue",
            ohm_branches("motor_yb", "motor_blue_lightblue", "replace_motor"),
        ),
        meas(
            "motor_blue_lightblue",
            4,
            "Motor Blue–Light blue",
            "Second motor winding pair: 15–25 Ω.",
            "insigniaWasherFreqDriveMotorOhms",
            "Drive motor",
            "Blue-Light blue",
            ohm_branches("motor_bl", "motor_verified", "replace_motor"),
        ),
        outcome("replace_motor", 5, "Replace motor", "Replace drive motor or capacitor per failed pair."),
        outcome("motor_verified", 6, "Motor verified", "Both motor pairs in spec — check belt, clutch, and inverter."),
    ],
)


def test_mode_bundle() -> dict:
    return {
        "id": "insigniawmt41-test-mode-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "WMT41 — FCt test mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "My Cycle + Soil + Power within 10 s; FCt display; tests 1–4 for motor, spin, fuzzy weigh, inlet valves.",
        "tags": ["service_diagnostic", "error_code"],
        "entryStepId": "prep_empty",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [21, 22, 23],
        },
        "steps": [
            {
                "id": "prep_empty",
                "order": 1,
                "type": "instruction",
                "title": "Prepare for test mode",
                "body": "Empty tub. Within 10 s of power on/off, press My Cycle and Soil together, then Power.",
                "sourceExcerpt": "Within 10 seconds press My Cycle and Soil together then Press Power.",
                "requiresInput": False,
                "defaultNextStepId": "test_mode_entry",
            },
            {
                "id": "test_mode_entry",
                "order": 2,
                "type": "instruction",
                "title": "FCt test mode",
                "body": (
                    "Display shows FCt — if not, replace PCB. "
                    "My Cycle = wash test (L1, 3 min); Temp = spin/clutch/pump; "
                    "Water Level = fuzzy weighing; Soil = inlet valves + software version."
                ),
                "sourceExcerpt": "Digital shows FCt. My cycle = washing test; Temp = spinning test.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


PROCEDURES = [
    INLET_VALVES,
    DRAIN_MOTOR,
    LID_SWITCH,
    UNBALANCE,
    IMPACT_SWITCH,
    LEVEL_SENSOR,
    DRIVE_MOTOR,
]

PROCEDURE_FILES = [f"{item['id']}.json" for item in PROCEDURES]
BUNDLES = [test_mode_bundle()]
BUNDLE_FILES = ["insigniawmt41-test-mode-entry.json"]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "washer",
        "label": SOURCE["manualTitle"],
        "notes": "NS-WMT41WA5 frequency level sensor + impact switch platform (OEM MAV160).",
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
                    if tag in ("E1", "E2", "E3", "E4", "E5", "F8")
                ],
            }
            for item in PROCEDURES
        ],
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name}")


def write_readme() -> None:
    readme = """# Insignia WMT41 washer procedures

Platform: `insignia_washer_freq` (frequency water level sensor)

## Procedures

| ID | OEM | Tags |
|----|-----|------|
"""
    for item in PROCEDURES:
        codes = ", ".join(
            t for t in item.get("tags", []) if t in ("E1", "E2", "E3", "E4", "E5", "F8")
        )
        readme += f"| `{item['id']}` | {item['source']['oemTestNumber']} | {codes} |\n"
    readme += "\n## Bundle\n\n- `insigniawmt41-test-mode-entry` — My Cycle + Soil + Power → FCt (§05)\n"
    readme += "\nRegenerate: `python backend/scripts/generate_insignia_wmt_washer_procedure_seeds.py`\n"
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

    effects = ROOT / "backend/scripts/attach_insignia_wmt_washer_diagnostic_effects.py"
    if effects.exists():
        subprocess.run([sys.executable, str(effects)], check=True, cwd=ROOT)

    modes = ROOT / "backend/scripts/attach_insignia_wmt_washer_service_modes.py"
    if modes.exists():
        subprocess.run([sys.executable, str(modes)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
