#!/usr/bin/env python3
"""Generate W11174426 (Whirlpool/Maytag/Amana LCX/LCC range) procedure seed JSON files."""

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
    "manualId": "W11174426",
    "manualTitle": "Whirlpool/Maytag/Amana/IKEA Ranges (W11174426 Rev B)",
    "extractedTextFile": (
        "backend/docs/manuals/technical-manual-w11174426-revb whirlpool maytag amana ranges-extracted.txt"
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
        "Resistance checks require power off. Replace all parts and panels before operating."
    ),
    "sourceExcerpt": "Unplug range or disconnect power before resistance measurements.",
    "requiresInput": False,
}


def proc(pid, title, oem_num, oem_title, pages, component_ids, tags, steps, template_ids=None):
    if not steps:
        raise ValueError(f"{pid} needs steps")
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
        {"id": f"{prefix}_open", "label": "Open circuit (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


PIN_P3_SENSOR = [
    {"pin": "4", "signal": "RTD", "wireColor": "—", "wireColorConfidence": "manual_only"},
    {"pin": "5", "signal": "RTD", "wireColor": "—", "wireColorConfidence": "manual_only"},
]


PROCEDURES = [
    proc(
        "w11174426-acu-power",
        "Control Power & Supply",
        "Power",
        "Oven Control Supply",
        [2, 3, 25, 26],
        ["supply"],
        ["supply_issue", "no_power", "F1E0", "F1E1", "F1E2", "F9E0"],
        [
            meas(
                "control_voltage",
                2,
                "Control supply P1-1 to P1-3",
                "Connect meter. Restore power. Confirm 120 VAC at control P1-1 to P1-3 (or terminal block L1–N).",
                "supplyVoltage120",
                "P1",
                "1 & 3",
                ohm_branches("ctrl_v", "acu_ok", "check_wiring"),
            ),
            visual(
                "check_wiring",
                3,
                "Wiring between control and terminal block",
                "Power off. Check wires/connectors between control and terminal block — fully seated?",
                [
                    {"id": "wire_ok", "label": "Wiring OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_control"},
                    {"id": "wire_bad", "label": "Damaged wiring", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_wiring"},
                ],
            ),
            instr("repair_wiring", 4, "Repair wiring", "Repair harness/terminal block, restore power, retest.", "control_voltage"),
            visual(
                "miswire_check",
                5,
                "F9E0 terminal block wiring",
                "For F9E0: verify 240 VAC L1–L2 and 120 VAC L1–N and L2–N at supply; range terminal block wired correctly.",
                [
                    {"id": "miswire_ok", "label": "Wiring correct", "when": {"kind": "checkpoint_yes"}, "nextStepId": "acu_ok"},
                    {"id": "miswire_bad", "label": "Miswired", "when": {"kind": "checkpoint_no"}, "nextStepId": "correct_wiring"},
                ],
            ),
            instr("correct_wiring", 6, "Correct terminal block wiring", "Correct miswire per tech sheet, retest.", "miswire_check"),
            outcome("replace_control", 7, "Replace oven control", "Supply good, wiring OK — replace main control."),
            outcome("acu_ok", 8, "Control supply verified", "Control has proper supply; no error codes in Diagnostics."),
        ],
    ),
    proc(
        "w11174426-hmi",
        "Keypad / HMI (F2E1)",
        "HMI",
        "Keypad Connection",
        [25, 26],
        ["supply"],
        ["hmi_check", "F2E1"],
        [
            visual(
                "keypad_p11",
                2,
                "Keypad connector P11",
                "Power off. Inspect keypad connection to main control (P11). Reseat if loose.",
                [
                    {"id": "p11_ok", "label": "P11 OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "keypad_retest"},
                    {"id": "p11_bad", "label": "Loose or damaged P11", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_p11"},
                ],
            ),
            instr("repair_p11", 3, "Repair P11 harness", "Repair connector/harness, restore power, wait 60 sec.", "keypad_retest"),
            visual(
                "keypad_retest",
                4,
                "Retest after reconnect",
                "Does F2E1 clear after reconnect? If reappears, replace keypad then control.",
                [
                    {"id": "f2e1_clear", "label": "Error cleared", "when": {"kind": "checkpoint_yes"}, "nextStepId": "hmi_ok"},
                    {"id": "f2e1_stuck", "label": "F2E1 persists", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_keypad"},
                ],
            ),
            outcome("replace_keypad", 5, "Replace keypad / control", "Replace keypad first; if persists replace main control."),
            outcome("hmi_ok", 6, "Keypad verified", "Keypad connection verified, no F2E1."),
        ],
    ),
    proc(
        "w11174426-oven-sensor",
        "Oven Temperature Sensor",
        "RTD",
        "Oven Temp Sensor",
        [25, 26, 45, 46],
        ["temp_sensor"],
        ["sensor_check", "temp_accuracy_issue", "F3E0", "F6E1"],
        [
            visual(
                "diag_f3e0",
                2,
                "Confirm F3E0 / room temp in Diagnostics",
                "Enter Diagnostics (CANCEL×2+START). Verify sensor at room temp and failure code matches.",
                [
                    {"id": "match", "label": "Code matches", "when": {"kind": "checkpoint_yes"}, "nextStepId": "sensor_harness"},
                    {"id": "nomatch", "label": "Does not match", "when": {"kind": "checkpoint_no"}, "nextStepId": "sensor_ok"},
                ],
            ),
            visual(
                "sensor_harness",
                3,
                "Sensor harness connections",
                "Power off. Check sensor connections on harness and board (P3 or Con 3).",
                [
                    {"id": "h_ok", "label": "OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "sensor_ohms"},
                    {"id": "h_bad", "label": "Damaged", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_harness"},
                ],
            ),
            instr("repair_harness", 4, "Repair sensor harness", "Repair harness, retest.", "sensor_ohms"),
            meas(
                "sensor_ohms",
                5,
                "RTD resistance at sensor connector",
                "Disconnect sensor. Measure pins — 1000–1200 Ω at room temp. "
                "LCX: P3-4 to P3-5; LCC: Con 3-9 to Con 3-10. Check short to casing.",
                "whirlpoolFreestandingRangeOvenSensorOhms",
                "P3 / Con3",
                "RTD pins",
                ohm_branches("rtd", "sensor_ok", "replace_sensor"),
            ),
            outcome("replace_sensor", 6, "Replace oven sensor or harness", "RTD out of range or shorted."),
            outcome("sensor_ok", 7, "Oven sensor verified", "Sensor 1000–1200 Ω — clear code, run BAKE+START 1 min."),
        ],
    ),
    proc(
        "w11174426-door-latch",
        "Door Latch (Clean Mode)",
        "Latch",
        "Door Latch Motor",
        [26, 27, 45, 46],
        ["temp_sensor"],
        ["door_latch_check", "F5E1"],
        [
            visual(
                "clean_latch_test",
                2,
                "Clean keypad latch test in Diagnostics",
                "In Diagnostics press CLEAN to run lock motor. Follow F5E1 tree: latch icon vs door state.",
                [
                    {"id": "mech_ok", "label": "Latch cycles, icon matches", "when": {"kind": "checkpoint_yes"}, "nextStepId": "latch_ok"},
                    {"id": "mech_fail", "label": "Motor/switch fault path", "when": {"kind": "checkpoint_no"}, "nextStepId": "latch_voltage"},
                ],
            ),
            visual(
                "latch_voltage",
                3,
                "Latch motor voltage P2-3 to N",
                "When latch should run (within 20 sec of CLEAN), verify 120 VAC at P2-3 to N (LCX).",
                [
                    {"id": "v120", "label": "120 VAC present", "when": {"kind": "checkpoint_yes"}, "nextStepId": "latch_ohms"},
                    {"id": "no_v", "label": "No voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_control_latch"},
                ],
            ),
            meas(
                "latch_ohms",
                4,
                "Latch motor resistance",
                "Power off. LCX: P2-3 to P1-3 WH; LCC: Con 1-4 to Con 1-1 W — expect 500–3000 Ω.",
                "whirlpoolFreestandingRangeDoorLatchOhms",
                "P2 / Con1",
                "latch motor",
                ohm_branches("latch", "latch_ok", "replace_latch"),
            ),
            outcome("replace_control_latch", 5, "Replace oven control", "No voltage to latch motor — replace control."),
            outcome("replace_latch", 6, "Replace latch motor assembly", "Motor open or harness damaged."),
            outcome("latch_ok", 7, "Door latch verified", "Latch motor and switches verified in Clean mode."),
        ],
    ),
    proc(
        "w11174426-bake-element",
        "Bake Element",
        "Bake",
        "Bake Element",
        [45, 46, 47],
        ["bake_element"],
        ["heating_element_check", "no_bake_heat_issue", "F3E0"],
        [
            meas(
                "bake_ohms",
                2,
                "Bake element resistance",
                "Power off. LCX: P4-3 to P5-4; LCC: Con 2-7 to Con 4-3 — expect 10–40 Ω nominal.",
                "bakeElementOhms",
                "P4 / Con2",
                "bake terminals",
                ohm_branches("bake", "bake_voltage", "replace_bake"),
            ),
            visual(
                "bake_voltage",
                3,
                "Bake mode voltage",
                "In Bake mode verify 240 VAC at element when energized (may cycle with broil on some models).",
                [
                    {"id": "bv_ok", "label": "Voltage when bake on", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bake_ok"},
                    {"id": "bv_bad", "label": "No voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_control_bake"},
                ],
            ),
            outcome("replace_bake", 4, "Replace bake element", "Bake element open or out of range."),
            outcome("replace_control_bake", 5, "Replace oven control", "Element good but no bake voltage."),
            outcome("bake_ok", 6, "Bake element verified", "Bake element Ω and voltage verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "w11174426-broil-element",
        "Broil Element",
        "Broil",
        "Broil Element",
        [45, 46, 47],
        ["broil_element"],
        ["heating_element_check", "no_broil_heat_issue"],
        [
            meas(
                "broil_ohms",
                2,
                "Broil element resistance",
                "Power off. LCX: P5-1 to P5-4 WH; LCC: Con 2-1 to Con 4-3 — expect 10–40 Ω nominal.",
                "broilElementOhms",
                "P5 / Con2",
                "broil terminals",
                ohm_branches("broil", "broil_voltage", "replace_broil"),
            ),
            visual(
                "broil_voltage",
                3,
                "Broil mode voltage",
                "In Broil mode only broil element energized — verify 240 VAC at element.",
                [
                    {"id": "broil_v_ok", "label": "Voltage OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "broil_ok"},
                    {"id": "broil_v_bad", "label": "No voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_control_broil"},
                ],
            ),
            outcome("replace_broil", 4, "Replace broil element", "Broil element failed."),
            outcome("replace_control_broil", 5, "Replace oven control", "Element good, no broil voltage."),
            outcome("broil_ok", 6, "Broil element verified", "Broil element verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "w11174426-infinite-switch",
        "Cooktop Infinite Switches",
        "Switch",
        "Infinite Switches",
        [45, 46, 47],
        ["bake_element"],
        ["heating_element_check", "surface_burner"],
        [
            visual(
                "cooktop_indicator",
                2,
                "Cooktop On indicator",
                "Turn any cooktop element ON — does Cooktop On indicator light?",
                [
                    {"id": "ind_on", "label": "Indicator on", "when": {"kind": "checkpoint_yes"}, "nextStepId": "element_heats"},
                    {"id": "ind_off", "label": "No indicator", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_switch_wiring"},
                ],
            ),
            visual(
                "element_heats",
                3,
                "Element cycles hot",
                "At high setting, does infinite switch cycle element on/off to maintain temperature?",
                [
                    {"id": "cycles", "label": "Cycles normally", "when": {"kind": "checkpoint_yes"}, "nextStepId": "switch_ok"},
                    {"id": "no_heat", "label": "No heat / stuck on", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_switch"},
                ],
            ),
            instr("check_switch_wiring", 4, "Check infinite switch wiring", "Inspect switch terminals and supply to affected burner.", "replace_switch"),
            outcome("replace_switch", 5, "Replace infinite switch or element", "Switch or element circuit fault."),
            outcome("switch_ok", 6, "Infinite switches verified", "Cooktop infinite switch operation verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "w11174426-dsi-board",
        "DSI Board (Gas Oven)",
        "DSI",
        "DSI Board",
        [45, 46, 47],
        ["gas_valve"],
        ["gas_valve_check", "ignition_issue", "no_bake_heat_issue"],
        [
            meas(
                "dsi_bake_coil",
                2,
                "DSI bake valve J1-1 to J1-2",
                "In Bake mode with burner operation attempted, measure valve coil — 216 Ω nominal at J1-1 to J1-2.",
                "whirlpoolFreestandingRangeDsiValveOhms",
                "J1",
                "1 & 2",
                ohm_branches("dsi_bake", "dsi_broil_coil", "replace_dsi_valve"),
            ),
            meas(
                "dsi_broil_coil",
                3,
                "DSI broil valve J1-3 to J1-2",
                "In Broil mode measure J1-3 to J1-2 — 216 Ω nominal.",
                "whirlpoolFreestandingRangeDsiValveOhms",
                "J1",
                "3 & 2",
                ohm_branches("dsi_broil", "dsi_voltage", "replace_dsi_valve"),
            ),
            visual(
                "dsi_voltage",
                4,
                "DSI supply and flame sense",
                "Verify 120 VAC J1-4 to J1-6 (bake) and J1-4 to J1-10. When lit, flame sense 8–18 VDC.",
                [
                    {"id": "dsi_ok", "label": "Voltage and flame OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "dsi_ok_outcome"},
                    {"id": "dsi_bad", "label": "No voltage / no flame", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_dsi_board"},
                ],
            ),
            outcome("replace_dsi_valve", 5, "Replace gas valve coil", "DSI valve coil out of 216 Ω range."),
            outcome("replace_dsi_board", 6, "Replace DSI board", "Coils good but ignition failure — replace DSI."),
            outcome("dsi_ok_outcome", 7, "DSI verified", "Gas oven DSI and valve verified."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "w11174426-surface-spark",
        "Surface Spark Module",
        "Spark",
        "Surface Burner Spark Module",
        [45, 46, 47],
        ["surface_ignition"],
        ["ignition_issue", "surface_burner"],
        [
            visual(
                "surface_spark",
                2,
                "Surface burner spark test",
                "Turn one cooktop knob to LITE. Verify burner sparks. Expect 120 VAC L to N at spark module.",
                [
                    {"id": "spark_yes", "label": "Sparks at all burners", "when": {"kind": "checkpoint_yes"}, "nextStepId": "spark_ok"},
                    {"id": "spark_no", "label": "No spark", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_module"},
                ],
            ),
            outcome("replace_module", 3, "Replace surface spark module", "Replace module or repair L/N wiring."),
            outcome("spark_ok", 4, "Surface spark verified", "Surface ignition verified."),
        ],
        template_ids=["gas_range"],
    ),
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def service_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11174426-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W11174426",
        "title": "W11174426 — Diagnostics mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console", "any"],
        "description": "LCX/LCC Diagnostics entry via CANCEL×2+START.",
        "tags": ["service_diagnostic"],
        "entryStepId": "service_diagnostic_entry",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [2, 3],
        },
        "steps": [
            {
                "id": "service_diagnostic_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Diagnostics mode",
                "body": (
                    "Press CANCEL, then CANCEL, then START within 5 seconds. "
                    "Oven must be cool. Electric models: DLB engages on entry (normal). "
                    "Use keypad tests for relay/load checks. Press CANCEL to exit."
                ),
                "sourceExcerpt": "Enter Diagnostics mode by pressing CANCEL>CANCEL>START within a 5-second period.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


BUNDLES = [service_diagnostic_entry_bundle()]
BUNDLE_FILES = ["w11174426-service-diagnostic-entry.json"]


def write_catalog() -> None:
    w11174426_entries = [
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
    catalog = {
        "manualId": "W11746350",
        "platformId": PLATFORM,
        "templateId": "electric_range",
        "label": "Whirlpool/Maytag/Amana freestanding range (W11746350 + W11174426)",
        "notes": (
            "Shared platformId whirlpool_freestanding_range. W11746350 Copernicus Settings diagnostics; "
            "W11174426 LCX/LCC CANCEL×2+START. Fuel-specific procedures use templateIds electric_range / gas_range."
        ),
        "plannedProcedures": w11746350_entries + w11174426_entries,
    }
    catalog_path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(
        f"Wrote procedureCatalog.json ({len(w11746350_entries)} W11746350 + {len(w11174426_entries)} W11174426)"
    )


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

    for script_name in (
        "attach_w11174426_diagnostic_effects.py",
        "attach_w11174426_service_modes.py",
    ):
        script = ROOT / "backend" / "scripts" / script_name
        if script.exists():
            subprocess.run([sys.executable, str(script)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], check=True, cwd=ROOT)


if __name__ == "__main__":
    main()
