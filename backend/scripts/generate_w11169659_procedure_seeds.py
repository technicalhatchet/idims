#!/usr/bin/env python3
"""Generate W11169659 (Whirlpool/Maytag MED9620 steam dryer) procedure seeds — delta variants only."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_ccu_dryer"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "W11169659",
    "manualTitle": "Whirlpool & Maytag 27 in Front-Load Gas & Electric Dryers Service Manual",
    "extractedTextFile": "backend/docs/manuals/service-manual-w11169659 wedmed9620-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the dryer or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Electrical Shock Hazard. Disconnect power before accessing.",
    "requiresInput": False,
}

ELECTRIC_DRYER_ONLY = ["electric_dryer"]

# W10881701 procedures reused verbatim (no new seed files).
SHARED_W10881701 = [
    ("2", "w10881701-supply-connections", "TEST #2: Supply Connections"),
    ("3", "w10881701-motor-circuit", "TEST #3: Motor Circuit"),
    ("4-gas", "w10881701-heater-gas", "TEST #4: Heat System (gas)"),
    ("4a", "w10881701-thermistors", "TEST #4a: Thermistors"),
    ("4b", "w10881701-thermal-fuse", "TEST #4b: Thermal Fuse"),
    ("4c", "w10881701-thermal-cutoff", "TEST #4c: Thermal Cut-Off"),
    ("4d", "w10881701-gas-valve", "TEST #4d: Gas Valve"),
    ("6", "w10881701-button-indicator", "TEST #6: Buttons and Indicators"),
    ("7", "w10881701-door-switch", "TEST #7: Door Switch"),
    ("9", "w10881701-water-valve", "TEST #9: Water Valve"),
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
    template_ids: list[str] | None = None,
) -> dict:
    if not steps:
        raise ValueError(f"{pid} must define at least one step after safety")
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    result = {
        "id": pid,
        "version": "1.0.0",
        "title": title,
        "platformId": "whirlpool_ccu_dryer",
        "componentIds": component_ids,
        "tags": tags,
        "source": {**SOURCE, "oemTestNumber": oem_num, "oemTestTitle": oem_title, "pages": pages},
        "entryStepId": "safety_power_off",
        "steps": [safety, *steps],
    }
    if template_ids:
        result["templateIds"] = template_ids
    return result


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


def checkpoint_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / passes", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {
            "id": no_id,
            "label": "No / failed",
            "when": {"kind": "checkpoint_no"},
            "nextStepId": no_next,
            "terminal": True,
            "oemOutcome": no_outcome,
        },
    ]


ACU_POWER = proc(
    "w11169659-acu-power",
    "TEST #1: ACU Power Check",
    "1",
    "ACU Power Check",
    [36, 37],
    ["acu"],
    ["supply_issue", "F1E1", "F6E1", "F6E2", "no_power"],
    [
        instr(
            "green_led",
            2,
            "Verify ACU green LED",
            "Power on — green LED on ACU should flash then stay lit after boot. If HMI works but LED never wakes, suspect UI wake path.",
            "verify_outlet",
        ),
        instr("verify_outlet", 3, "Verify outlet voltage", "Electric: 240/208 VAC. Gas: 120 VAC. Time-delay fuse required on electric.", "access_acu"),
        instr("access_acu", 4, "Access ACU", "Remove top panel. Restore power only for live voltage steps below.", "live_l1"),
        visual(
            "live_l1",
            5,
            "120 VAC at J8-3 (N) and J9-2 (L1)",
            "Use needle probes. Black to J8-3, red to J9-2 — expect 120 VAC.",
            checkpoint_yes_no("l1_ok", "live_5v", "l1_bad", "supply_connections", "No L1 at ACU — perform TEST #2 supply connections."),
        ),
        visual(
            "live_5v",
            6,
            "+5 VDC at J2-2 vs J2-4 (J2 unplugged)",
            "Unplug J2 from ACU. DC volts: red J2-2 (+5 VDC), black J2-4 (ground). Missing +5V with J14 unplugged → shorted thermistor (TEST #4a).",
            checkpoint_yes_no("v5_ok", "live_12v", "v5_bad", "j14_thermistor_short", "Diagnose thermistor short or harness before replacing ACU."),
        ),
        instr(
            "j14_thermistor_short",
            7,
            "Thermistor short isolation",
            "Disconnect power. Unplug J14, restore power, retest +5 VDC at J2-2/J2-4. If +5 returns, run TEST #4a thermistors.",
            "j2_ui_isolation",
        ),
        instr(
            "j2_ui_isolation",
            8,
            "UI harness isolation",
            "Reconnect J14. Leave J2 unplugged. Retest +5 VDC at J2 header pins 2 & 4 (do not short pins). If +5 returns, check ACU↔HMI harness; replace HMI if harness OK.",
            "replace_acu",
        ),
        visual(
            "live_12v",
            9,
            "+12.7 VDC at J2-1 vs J2-4",
            "J2 unplugged. DC volts: red J2-1 (+12.7 VDC), black J2-4 (ground). Missing at header → replace ACU; returns with J2 unplugged → check HMI harness.",
            checkpoint_yes_no("v12_ok", "acu_power_verified", "v12_bad", "replace_acu", "Replace ACU — +12.7 VDC missing at J2."),
        ),
        instr("supply_connections", 10, "Supply path fault", "Perform TEST #2 supply connections.", "acu_power_verified"),
        outcome("replace_acu", 11, "Replace ACU", "Replace appliance control unit (ACU)."),
        outcome("acu_power_verified", 12, "ACU power verified", "Line, +5 VDC, and +12.7 VDC present at ACU."),
    ],
)

HEATER_ELECTRIC = proc(
    "w11169659-heater-electric",
    "TEST #4: Heat System (electric)",
    "4",
    "Heat System",
    [42, 43],
    ["heating_element"],
    ["no_heat", "heating_element_check", "F1E1"],
    [
        instr(
            "service_diag_l1_l2",
            2,
            "Service Diagnostic L1/L2 quick check",
            "Enter Service Diagnostic Mode. Verify L1 and L2 present at heater relay — confirms centrifugal switch, element, high-limit, and cut-off path.",
            "access_heat",
        ),
        instr("access_heat", 3, "Access thermal components", "Remove front panel. Power off before resistance checks.", "element_path_ohms"),
        visual(
            "element_path_ohms",
            4,
            "Thermal cut-off to heater (~10 Ω)",
            "Ohmmeter: red at thermal cut-off to red/white at heater. Expect about 10 Ω. Open → check cut-off, high-limit, and element per strip circuit.",
            checkpoint_yes_no("path_ok", "outlet_ntc", "path_open", "replace_heat_parts", "Replace open element or cut-off/high-limit pair."),
        ),
        visual(
            "outlet_ntc",
            5,
            "Outlet thermistor J14-3 to J14-6",
            "Disconnect J14. Use outlet thermistor R/T table. Open/short → replace thermistor or repair harness.",
            checkpoint_yes_no("ntc_ok", "heater_verified", "ntc_bad", "replace_thermistor", "Replace outlet thermistor."),
        ),
        instr(
            "l2_centrifugal",
            6,
            "L2 / centrifugal follow-up",
            "If L2 missing in service mode but element path OK, inspect centrifugal switch before replacing ACU.",
            "heater_verified",
        ),
        outcome("replace_heat_parts", 7, "Replace heat components", "Replace failed element, thermal cut-off, and/or high-limit thermostat."),
        outcome("replace_thermistor", 8, "Replace thermistor", "Replace outlet thermistor."),
        outcome("heater_verified", 9, "Heater circuit verified", "Element path, limits, and outlet NTC within spec."),
    ],
    ELECTRIC_DRYER_ONLY,
)

MOISTURE_SENSOR = proc(
    "w11169659-moisture-sensor",
    "TEST #5: Moisture Sensor",
    "5",
    "Moisture Sensor",
    [47],
    ["moisture_sensor"],
    ["long_dry", "not_drying", "F3E2", "F3E5"],
    [
        instr(
            "service_mode_wet_cloth",
            2,
            "Service Diagnostic moisture test",
            "Enter Service Diagnostic Mode. Open door. Touch both moisture strips with wet cloth or finger — repeating beep and alphanumeric display = pass.",
            "wet_cloth_result",
        ),
        visual(
            "wet_cloth_result",
            3,
            "Wet-cloth test result",
            "Repeating beep and number on display when both strips touched?",
            checkpoint_yes_no("cloth_pass", "outlet_ntc_ref", "cloth_fail", "bench_harness", "No beep or beep before touch — continue bench checks."),
        ),
        instr(
            "bench_harness",
            4,
            "Bench moisture harness check",
            "Power off. Remove console/front panel. Disconnect 3-wire moisture sensor below door. Remove J13 at ACU.",
            "j13_harness",
        ),
        visual(
            "j13_harness",
            5,
            "J13 harness continuity",
            "Continuity from J13 at ACU to moisture sensor connector.",
            checkpoint_yes_no("harness_ok", "outer_contacts", "harness_bad", "replace_harness", "Replace main wire harness."),
        ),
        visual(
            "outer_contacts",
            6,
            "Outermost contacts (with MOVs)",
            "Small resistance across outer contacts → clean metal strips; if still low, replace sensor harness.",
            checkpoint_yes_no("outer_ok", "ground_isolation", "outer_bad", "replace_harness", "Replace moisture sensor harness."),
        ),
        visual(
            "ground_isolation",
            7,
            "Outer contacts to center ground",
            "Each outer contact to center terminal must read infinity (OL).",
            checkpoint_yes_no("ground_ok", "rear_sensor_note", "ground_bad", "replace_harness", "Replace moisture sensor harness."),
        ),
        instr(
            "rear_sensor_note",
            8,
            "Rear moisture sensor (Quad Sense)",
            "Some Maytag models: repeat steps 6–10 using connector J23 for rear moisture sensor (F3E5).",
            "moisture_verified",
        ),
        instr(
            "outlet_ntc_ref",
            9,
            "Outlet thermistor follow-up",
            "If auto-dry still stops early after sensor OK, run TEST #4a outlet thermistor.",
            "moisture_verified",
        ),
        outcome("replace_harness", 10, "Replace harness/sensor", "Replace moisture sensor harness or sensor assembly."),
        outcome("moisture_verified", 11, "Moisture sensor verified", "Service mode and bench checks pass."),
    ],
)

DRUM_LED = proc(
    "w11169659-drum-led",
    "TEST #8: Drum LED",
    "8",
    "Drum LED",
    [50],
    ["drum_light"],
    ["drum_light_check", "no_light"],
    [
        instr("access_drum_led", 2, "Access drum LED circuit", "Remove top panel. Verify J6 drum LED connector seated at ACU.", "harness_check"),
        visual(
            "harness_check",
            3,
            "Drum LED harness",
            "Check inline connections between drum LED and ACU J6.",
            checkpoint_yes_no("harness_ok", "j6_current", "harness_bad", "repair_harness", "Repair or replace drum LED harness."),
        ),
        visual(
            "j6_current",
            4,
            "J6 driver current (150–370 mA)",
            "Unplug J6. Milliamps across J6 pins 1 & 3, power on, door open — expect 150–370 mA if ACU driver OK.",
            checkpoint_yes_no("current_ok", "replace_led", "current_bad", "replace_acu", "Replace ACU — drum LED driver missing."),
        ),
        outcome("repair_harness", 5, "Repair harness", "Repair drum LED harness or connections."),
        outcome("replace_led", 6, "Replace drum LED", "Replace drum LED assembly."),
        outcome("replace_acu", 7, "Replace ACU", "Replace ACU when current present but LED still dark."),
    ],
)

DELTA_PROCEDURES = [ACU_POWER, HEATER_ELECTRIC, MOISTURE_SENSOR, DRUM_LED]
DELTA_FILES = [f"{p['id']}.json" for p in DELTA_PROCEDURES]


def diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11169659-diagnostic-entry",
        "version": "1.0.0",
        "platformId": "whirlpool_ccu_dryer",
        "manualId": "W11169659",
        "title": "W11169659 — Service Diagnostics entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console", "any"],
        "description": "Enter ACU Service Diagnostics (3-button sequence × 3). Success: all indicators on 5 sec with 888.",
        "tags": ["service_diagnostic", "fault_codes"],
        "entryStepId": "prep_standby",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [18, 19],
        },
        "steps": [
            {
                "id": "prep_standby",
                "order": 1,
                "type": "instruction",
                "title": "Standby mode",
                "body": "Dryer plugged in with all indicators off.",
                "sourceExcerpt": "Be sure the dryer is in standby mode.",
                "requiresInput": False,
                "defaultNextStepId": "three_button_entry",
            },
            {
                "id": "three_button_entry",
                "order": 2,
                "type": "instruction",
                "title": "3-button diagnostic entry",
                "body": (
                    "Select any three buttons (except POWER and START). Within 8 seconds, press and release each button once, "
                    "then repeat the same 3-button sequence two more times (9 presses total). "
                    "Success: all indicators illuminated 5 seconds with 888 on display and tone."
                ),
                "sourceExcerpt": "Press/release 1st, 2nd, 3rd button — repeat sequence 2 more times.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


def service_test_bundle() -> dict:
    return {
        "id": "w11169659-service-test-mode",
        "version": "1.0.0",
        "platformId": "whirlpool_ccu_dryer",
        "manualId": "W11169659",
        "title": "W11169659 — Service Test Mode",
        "modeKind": "load_test",
        "uiVariants": ["console", "any"],
        "description": "From Service Diagnostics, press 2nd button then START — L1/L2/heater/airflow; step 8 verifies water spray.",
        "tags": ["service_test", "live_test"],
        "entryStepId": "service_test_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [19, 20],
        },
        "steps": [
            {
                "id": "service_test_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Service Test Mode",
                "body": (
                    "With Service Diagnostic mode active, press and release the 2nd diagnostic button, "
                    "then press and release START. Door must be closed. "
                    "Press START to begin L2 → L1 → heater → airflow sequence. Step 8 verifies water valve spray."
                ),
                "sourceExcerpt": "User enters Service Test Mode through Service Diagnostics.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            },
        ],
    }


BUNDLES = [diagnostic_entry_bundle(), service_test_bundle()]
BUNDLE_FILES = ["w11169659-diagnostic-entry.json", "w11169659-service-test-mode.json"]


def catalog_entry_for_proc(item: dict, status: str = "generated") -> dict:
    return {
        "id": item["id"],
        "oemSection": item["source"]["oemTestNumber"],
        "title": item["title"],
        "status": status,
        "manualId": "W11169659",
        "knowledgeIds": [
            step["measurementKnowledgeId"]
            for step in item["steps"]
            if step.get("measurementKnowledgeId")
        ],
        "relatedCodes": [tag for tag in item.get("tags", []) if tag.startswith("F")],
    }


def shared_catalog_entry(oem_section: str, proc_id: str, title: str, related_codes: list[str] | None = None) -> dict:
    return {
        "id": proc_id,
        "oemSection": oem_section,
        "title": title,
        "status": "shared",
        "manualId": "W11169659",
        "reuseFrom": "W10881701",
        "knowledgeIds": [],
        "relatedCodes": related_codes or [],
    }


def write_catalog() -> None:
    catalog_path = OUT / "procedureCatalog.json"
    existing = json.loads(catalog_path.read_text(encoding="utf-8")) if catalog_path.is_file() else {}
    w10680150_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w10680150-")
    ]
    w10881701_entries = [
        entry
        for entry in existing.get("plannedProcedures", [])
        if str(entry.get("id", "")).startswith("w10881701-")
    ]
    w11169659_native = [catalog_entry_for_proc(item) for item in DELTA_PROCEDURES]
    w11169659_shared = [
        shared_catalog_entry(oem, proc_id, title)
        for oem, proc_id, title in SHARED_W10881701
    ]
    catalog = {
        "manualId": "W10680150",
        "platformId": "whirlpool_ccu_dryer",
        "templateId": "electric_dryer",
        "label": "Whirlpool/Maytag ACU/CCU electric & gas dryer",
        "notes": (
            "W10680150 tech sheet + W10881701 WED9500 + W11169659 MED9620 share whirlpool_ccu_dryer. "
            "Connector J* (service manuals) = P* (W10680150). Duet Sport 83/85 → whirlpool_duet_sport_dryer. "
            "WED95*/MED95* → W10881701 (#8–#10). WED96*/MED96* → W11169659 (4 delta procs + 10 shared w10881701)."
        ),
        "plannedProcedures": w10680150_entries + w10881701_entries + w11169659_native + w11169659_shared,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote {catalog_path.name} "
        f"({len(w10680150_entries)} W10680150 + {len(w10881701_entries)} W10881701 + "
        f"{len(w11169659_native)} W11169659 native + {len(w11169659_shared)} W11169659 shared)"
    )


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)

    for item, filename in zip(DELTA_PROCEDURES, DELTA_FILES, strict=True):
        path = OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")

    for item, filename in zip(BUNDLES, BUNDLE_FILES, strict=True):
        path = BUNDLE_OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote bundles/{path.name}")

    write_catalog()

    for script_name in (
        "attach_w11169659_diagnostic_effects.py",
        "attach_w11169659_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
