#!/usr/bin/env python3
"""Generate Samsung RF28 French-door refrigerator procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_fridge_rf28"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-RF28-FRIDGE",
    "manualTitle": "Samsung RF28 French-door refrigerator",
    "extractedTextFile": "backend/docs/manuals/samsung rf28 fddeli-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

PLATFORM = "samsung_fridge_rf28"

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug refrigerator before resistance checks. Discharge PCB per manual. High voltage on inverter PCB and SMPS.",
    "sourceExcerpt": "Unplug the appliance before changing or repairing electric parts.",
    "requiresInput": False,
}


def proc(pid, title, oem_num, oem_title, pages, component_ids, tags, steps):
    if not steps:
        raise ValueError(f"{pid} must define steps")
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


def ohm_branches(prefix, pass_next, fail_next, pass_label="In range"):
    return [
        {"id": f"{prefix}_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_crit", "label": "Critical", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def volt_branches(prefix, pass_next, fail_next):
    return [
        {"id": f"{prefix}_crit", "label": "Out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_warn", "label": "Marginal", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_pass", "label": "In range", "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


def sensor_proc(pid, title, connector, pins, tags, component="thermistor"):
    return proc(
        pid,
        title,
        "4-1-2",
        "Self-diagnostic CHECK LIST — sensor",
        [56, 57, 77, 78],
        [component],
        tags + ["sensor_check"],
        [
            instr(
                "run_self_diag",
                2,
                "Run self-diagnosis",
                "Fridge + FlexZone 10 s during normal operation — ding-dong confirms entry; note blinking LED for this sensor.",
                "sensor_voltage",
            ),
            meas(
                "sensor_voltage",
                3,
                f"Thermistor voltage {connector} {pins}",
                f"Measure MAIN PCB {connector} {pins} — 4.5 V warm → 1.0 V cold (0.6–4.6 V per §4-2-1).",
                "samsungRf28FridgeThermistorVoltage",
                connector,
                pins,
                volt_branches("ntc", "sensor_ok", "replace_sensor"),
            ),
            outcome("replace_sensor", 4, "Replace sensor", "Replace thermistor or repair harness when voltage out of range."),
            outcome("sensor_ok", 5, "Sensor OK", "Voltage in range — clear error after repair and power cycle."),
        ],
    )


def fan_proc(pid, title, connector, pins, tags):
    return proc(
        pid,
        title,
        "4-1-2",
        "Self-diagnostic CHECK LIST — fan",
        [57, 82],
        ["evap_fan"],
        tags + ["evap_fan", "airflow"],
        [
            instr(
                "fan_cmd",
                2,
                "Command fan on",
                "Use Test Mode manual operation (FF) or Load Condition display. Door open may stop F-fan — allow 1 min after close.",
                "fan_fb",
            ),
            meas(
                "fan_fb",
                3,
                f"Fan feedback {connector} {pins}",
                f"Measure {connector} {pins} — 7–12 V while fan commanded.",
                "samsungRf28FridgeEvapFanFeedbackVoltage",
                connector,
                pins,
                volt_branches("fan", "fan_ok", "replace_fan"),
            ),
            outcome("replace_fan", 4, "Replace fan", "Replace fan motor or repair harness/feedback line."),
            outcome("fan_ok", 5, "Fan OK", "Feedback voltage in range while fan runs."),
        ],
    )


PROCEDURES = [
    sensor_proc("samsungrf28-freezer-sensor", "Freezer compartment sensor (F)", "CN20", "10 ↔ 12", ["freezer_sensor", "not_cooling"]),
    sensor_proc("samsungrf28-fridge-sensor", "Fridge compartment sensor (R)", "CN20", "9 ↔ 11", ["fridge_sensor", "weak_cooling_ff"]),
    sensor_proc("samsungrf28-freezer-defrost-sensor", "Freezer defrost sensor (F-DEF)", "CN20", "6 ↔ 8", ["defrost_sensor", "frost_buildup"]),
    sensor_proc("samsungrf28-fridge-defrost-sensor", "Fridge defrost sensor (R-DEF)", "CN20", "5 ↔ 7", ["defrost_sensor", "frost_buildup"]),
    sensor_proc("samsungrf28-ambient-sensor", "External air sensor", "CN60", "3 ↔ 5", ["ambient_sensor"]),
    sensor_proc("samsungrf28-flex-sensor", "Flex-Zone sensor", "CN40", "18 ↔ 20", ["flex_sensor"]),
    sensor_proc("samsungrf28-humidity-sensor", "Humidity sensor", "CN60", "3 ↔ 7", ["humidity_sensor"]),
    sensor_proc("samsungrf28-ice-maker-sensor", "Ice maker (fridge) sensor", "CN90", "14 ↔ 24", ["ice_maker_sensor", "no_ice"], "ice_maker_module"),
    sensor_proc("samsungrf28-ice-room-sensor", "Ice room sensor", "CN90", "2 ↔ 4", ["ice_room_sensor", "no_ice"]),
    fan_proc("samsungrf28-freezer-fan", "Freezer evaporator fan (F-FAN)", "CN20", "16 ↔ 18", ["freezer_fan"]),
    fan_proc("samsungrf28-fridge-fan", "Fridge compartment fan", "CN20", "15 ↔ 17", ["fridge_fan", "weak_cooling_ff"]),
    fan_proc("samsungrf28-convertible-fan", "Convertible compartment fan (C-FAN)", "CN40", "11 ↔ 13", ["convertible_fan"]),
    fan_proc("samsungrf28-ice-room-fan", "Ice room fan", "CN20", "22 ↔ 24", ["ice_room_fan"]),
    proc(
        "samsungrf28-freezer-defrost-heater",
        "Freezer defrost heater (F-DEF)",
        "4-2-5",
        "F-DEF heater resistance",
        [58, 85],
        ["heater"],
        ["defrost_heater", "frost_buildup", "no_defrost"],
        [
            instr(
                "fz_def_disconnect",
                2,
                "Disconnect defrost harness",
                "Power off. Disconnect CN70/CN71 harness from MAIN PCB before resistance test.",
                "fz_def_ohms",
            ),
            meas(
                "fz_def_ohms",
                3,
                "F-DEF heater resistance",
                "CN70 pin 5 (BRN) ↔ CN71_1 pin 5 (BLK) — 63 (230) Ω ±7%.",
                "samsungRf28FreezerDefrostHeaterOhms",
                "CN70 / CN71_1",
                "5 ↔ 5",
                ohm_branches("fz_def", "fz_def_ok", "replace_fz_def"),
            ),
            outcome("replace_fz_def", 4, "Replace F-DEF heater", "Replace freezer defrost heater or bimetal when out of range."),
            outcome("fz_def_ok", 5, "F-DEF heater OK", "Freezer defrost heater resistance verified."),
        ],
    ),
    proc(
        "samsungrf28-fridge-defrost-heater",
        "Fridge defrost heater (R-DEF)",
        "4-2-5",
        "R-DEF heater resistance",
        [58, 85],
        ["heater"],
        ["defrost_heater", "frost_buildup", "no_defrost"],
        [
            instr(
                "ff_def_disconnect",
                2,
                "Disconnect defrost harness",
                "Power off. Disconnect CN70/CN71 harness from MAIN PCB.",
                "ff_def_ohms",
            ),
            meas(
                "ff_def_ohms",
                3,
                "R-DEF heater resistance",
                "CN70 pin 3 (WHT) ↔ CN71_1 pin 5 (BLK) — 120 Ω ±7%.",
                "samsungRf28FridgeDefrostHeaterOhms",
                "CN70 / CN71_1",
                "3 ↔ 5",
                ohm_branches("ff_def", "ff_def_ok", "replace_ff_def"),
            ),
            outcome("replace_ff_def", 4, "Replace R-DEF heater", "Replace fresh-food defrost heater or bimetal."),
            outcome("ff_def_ok", 5, "R-DEF heater OK", "Fridge defrost heater resistance verified."),
        ],
    ),
    proc(
        "samsungrf28-damper-heater",
        "Flex-Zone damper heater",
        "4-1-2",
        "Flex ROOM damper heater",
        [58, 81],
        ["damper_motor"],
        ["damper_heater"],
        [
            instr("damp_disconnect", 2, "Disconnect CN40", "Power off. Disconnect CN40 harness.", "damp_ohms"),
            meas(
                "damp_ohms",
                3,
                "Damper heater 135 Ω",
                "CN40 pin 25 ↔ pin 27 — 135 Ω ±7%.",
                "samsungRf28FlexDamperHeaterOhms",
                "CN40",
                "25 ↔ 27",
                ohm_branches("damp", "damp_ok", "replace_damp"),
            ),
            outcome("replace_damp", 4, "Replace damper heater", "Replace flex-zone damper heater."),
            outcome("damp_ok", 5, "Damper heater OK", "135 Ω in range."),
        ],
    ),
    proc(
        "samsungrf28-ice-duct-heater",
        "Fridge ice duct heater",
        "4-1-2",
        "Fridge ice duct heater",
        [59],
        ["ice_pipe_heater"],
        ["ice_duct_heater", "ice_maker", "no_ice"],
        [
            instr("duct_disconnect", 2, "Disconnect CN20", "Power off. Disconnect CN20 harness.", "duct_ohms"),
            meas(
                "duct_ohms",
                3,
                "Ice duct heater 63 Ω",
                "CN20 pin 21 ↔ pin 23 — 63 (230) Ω ±7%.",
                "samsungRf28IceDuctHeaterOhms",
                "CN20",
                "21 ↔ 23",
                ohm_branches("duct", "duct_ok", "replace_duct"),
            ),
            outcome("replace_duct", 4, "Replace ice duct heater", "Replace fridge ice duct heater."),
            outcome("duct_ok", 5, "Ice duct heater OK", "Resistance in range."),
        ],
    ),
    proc(
        "samsungrf28-ice-room-heater",
        "Fridge ice room heater",
        "4-1-2",
        "Fridge ice room heater",
        [59],
        ["heater"],
        ["ice_room_heater", "ice_maker", "no_ice"],
        [
            instr("irh_disconnect", 2, "Disconnect CN20", "Power off. Disconnect CN20 harness.", "irh_ohms"),
            meas(
                "irh_ohms",
                3,
                "Ice room heater 135 Ω",
                "CN20 pin 19 ↔ pin 23 — 135 Ω ±7%.",
                "samsungRf28IceRoomHeaterOhms",
                "CN20",
                "19 ↔ 23",
                ohm_branches("irh", "irh_ok", "replace_irh"),
            ),
            outcome("replace_irh", 4, "Replace ice room heater", "Replace fridge ice room heater."),
            outcome("irh_ok", 5, "Ice room heater OK", "135 Ω in range."),
        ],
    ),
    proc(
        "samsungrf28-ice-maker-function",
        "Ice maker (fridge) function",
        "4-1-2",
        "Ice Maker (Fridge) function error",
        [58, 84],
        ["ice_maker_module"],
        ["ice_maker", "no_ice"],
        [
            visual(
                "im_check",
                2,
                "Ice maker operation",
                "After service, reapply power and verify ice maker harvest/fill. Use ice maker test button per §4-2-4.",
                cp_yes_no("im_ok_yes", "im_verified", "im_fail", "replace_im", "Replace ice maker module or repair harness."),
            ),
            outcome("replace_im", 4, "Replace ice maker", "Replace fridge ice maker assembly."),
            outcome("im_verified", 5, "Ice maker OK", "Ice maker function verified."),
        ],
    ),
    proc(
        "samsungrf28-compressor-inverter",
        "Compressor / inverter IPM fault",
        "4-1-2",
        "Comp start / IPM / lock",
        [60, 87],
        ["inverter_board"],
        ["compressor", "not_cooling"],
        [
            visual(
                "comp_short",
                2,
                "Compressor terminal shorts",
                "Check for shorts between compressor terminals U/V/W before energizing.",
                cp_yes_no("no_short", "ipm_voltage", "short_found", "short_out", "Repair short or replace compressor."),
            ),
            meas(
                "ipm_voltage",
                3,
                "Inverter IPM DC bus",
                "Verify DC bus ≥13.5 V. Check IPM pin shorts and inverter soldering.",
                "samsungRf28FridgeInverterIpmVoltage",
                "Inverter PCB",
                "DC bus",
                volt_branches("ipm", "comp_ok", "replace_inverter"),
            ),
            outcome("short_out", 4, "Repair short", "Clear compressor or harness short before retest."),
            outcome("replace_inverter", 5, "Replace inverter", "Replace inverter PCB after verifying harness and compressor."),
            outcome("comp_ok", 6, "Compressor path OK", "No shorts; IPM voltage adequate — check sealed system if still not cooling."),
        ],
    ),
    proc(
        "samsungrf28-main-panel-comm",
        "Main ↔ display panel communication",
        "4-1-2",
        "Main ↔ Panel communication",
        [58, 90],
        ["display_panel"],
        ["hmi_check", "display_dead"],
        [
            visual(
                "panel_harness",
                2,
                "Panel harness",
                "Reseat display harness at hinge and MAIN PCB. Check for moisture or pin damage.",
                cp_yes_no("harness_ok", "comm_scope", "fix_harness", "harness_out", "Repair or replace display harness."),
            ),
            visual(
                "comm_scope",
                3,
                "Comm line check",
                "If harness OK, verify comm waveform between main and panel PCBs with oscilloscope.",
                cp_yes_no("comm_ok", "panel_comm_ok", "replace_boards", "replace_boards_out", "Replace main and/or panel PCB."),
            ),
            outcome("harness_out", 4, "Repair harness", "Replace display harness."),
            outcome("replace_boards_out", 5, "Replace PCB(s)", "Replace main and/or panel PCB per scope findings."),
            outcome("panel_comm_ok", 6, "Communication OK", "Panel communication restored."),
        ],
    ),
    proc(
        "samsungrf28-main-inverter-comm",
        "Main ↔ inverter communication",
        "4-1-2",
        "Main ↔ Inverter communication",
        [58, 87],
        ["inverter_board"],
        ["compressor"],
        [
            visual(
                "inv_harness",
                2,
                "Inverter harness",
                "Reseat inverter harness in machine compartment. Inspect for damage or corrosion.",
                cp_yes_no("inv_h_ok", "inv_scope", "fix_inv_h", "inv_h_out", "Repair inverter harness."),
            ),
            visual(
                "inv_scope",
                3,
                "Inverter comm scope",
                "Verify main↔inverter comm with oscilloscope if harness OK.",
                cp_yes_no("inv_comm_ok", "inv_comm_verified", "replace_inv", "replace_inv_out", "Replace main and/or inverter PCB."),
            ),
            outcome("inv_h_out", 4, "Repair harness", "Replace inverter communication harness."),
            outcome("replace_inv_out", 5, "Replace PCB(s)", "Replace inverter and/or main PCB."),
            outcome("inv_comm_verified", 6, "Inverter comm OK", "Main↔inverter communication restored."),
        ],
    ),
    proc(
        "samsungrf28-dispenser-panel-comm",
        "Main ↔ dispenser panel communication",
        "4-1-2",
        "Main ↔ Dispenser panel communication",
        [58, 91],
        ["display_panel"],
        ["hmi_check", "water_dispenser"],
        [
            visual(
                "disp_harness",
                2,
                "Dispenser harness",
                "Reseat dispenser panel harness at door and MAIN PCB. Check for moisture at dispenser PCB.",
                cp_yes_no("disp_h_ok", "disp_scope", "fix_disp_h", "disp_h_out", "Repair dispenser harness."),
            ),
            visual(
                "disp_scope",
                3,
                "Dispenser comm scope",
                "Verify comm between main and dispenser panel PCBs with oscilloscope if harness OK.",
                cp_yes_no("disp_comm_ok", "disp_comm_verified", "replace_disp", "replace_disp_out", "Replace main and/or dispenser panel PCB."),
            ),
            outcome("disp_h_out", 4, "Repair harness", "Replace dispenser panel harness."),
            outcome("replace_disp_out", 5, "Replace PCB(s)", "Replace dispenser and/or main PCB."),
            outcome("disp_comm_verified", 6, "Dispenser comm OK", "Dispenser panel communication restored."),
        ],
    ),
    proc(
        "samsungrf28-autofill-overflow",
        "AutoFill infuser overflow",
        "4-1-2",
        "AUTO FILL infuser overflow",
        [59, 93],
        ["ice_maker_module"],
        ["autofill", "water_dispenser"],
        [
            instr("overflow_check", 2, "Inspect infuser", "Check AutoFill pitcher for overflow or stuck float.", "overflow_voltage"),
            meas(
                "overflow_voltage",
                3,
                "Overflow sense voltage",
                "CN90 pin 11 ↔ pin 13 — 4.5–5 V normal; 0–4.5 V = overflow.",
                "samsungRf28AutofillOverflowVoltage",
                "CN90",
                "11 ↔ 13",
                volt_branches("af", "af_ok", "af_overflow"),
            ),
            outcome("af_overflow", 4, "Clear overflow", "Empty infuser and correct overflow condition."),
            outcome("af_ok", 5, "AutoFill OK", "No overflow detected."),
        ],
    ),
]


def test_mode_bundle() -> dict:
    return {
        "id": "samsungrf28-test-mode-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "Samsung RF28 — Test mode entry",
        "modeKind": "load_test",
        "uiVariants": ["console"],
        "description": "Fridge + FlexZone 6 s → FlexZone enters Test Mode (FF → OF r → rd → Fd).",
        "tags": ["service_diagnostic", "load_test", "defrost"],
        "entryStepId": "tm_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [51, 53]},
        "steps": [
            instr(
                "tm_enter",
                1,
                "Enter test mode",
                "Press Fridge + FlexZone ≥6 s until display blinks 0.5 s. Release and press FlexZone to enter Test Mode.",
                "tm_cycle",
            ),
            instr(
                "tm_cycle",
                2,
                "Test mode sequence",
                "Within 15 s press any key: FF (manual op 1) → OF r (manual op 2) → rd (R defrost) → Fd (F+R defrost) → cancel. Power cycle cancels.",
                "@continue",
            ),
        ],
    }


def self_diagnostic_bundle() -> dict:
    return {
        "id": "samsungrf28-self-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "Samsung RF28 — Self-diagnostic entry",
        "modeKind": "fault_codes",
        "uiVariants": ["console"],
        "description": "Fridge + FlexZone 10 s — ding-dong then fault LED checklist 30 s.",
        "tags": ["fault_codes", "service_diagnostic", "sensor_check"],
        "entryStepId": "sd_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [54, 55]},
        "steps": [
            instr(
                "sd_enter",
                1,
                "Run self-diagnosis",
                "Fridge + FlexZone 6 s (display blinks) then continue to 10 s total. Ding-dong confirms; fault LEDs display 30 s. Clear with 10 s hold after repair.",
                "@continue",
            ),
        ],
    }


def load_condition_bundle() -> dict:
    return {
        "id": "samsungrf28-load-condition-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "Samsung RF28 — Load condition display",
        "modeKind": "load_test",
        "uiVariants": ["console"],
        "description": "Fridge + FlexZone 6 s then Freezer key — shows MICOM load outputs 30 s.",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "lc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [62, 64]},
        "steps": [
            instr(
                "lc_enter",
                1,
                "Enter load condition mode",
                "Fridge + FlexZone 6 s (all segments blink 4 s). Press Freezer key — commanded loads blink 0.5 s for 30 s.",
                "@continue",
            ),
        ],
    }


BUNDLES = [test_mode_bundle(), self_diagnostic_bundle(), load_condition_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Samsung RF28 French-door refrigerator",
        "notes": "§4-1 test mode + §4-1-2 self-diagnostic CHECK LIST + §4-2 flowcharts. Inverter BLDC comp; Flex Zone + fridge ice maker.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [t for t in item.get("tags", []) if t.endswith("E")],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = f"""# Samsung RF28 French-door refrigerator (`{PLATFORM}`)

**Manual:** {SOURCE["manualId"]} — RF28R* / RF28*  
**Extraction:** `knowledge/pattern-catalog/SAMSUNG_RF28_FRIDGE_EXTRACTION.md`

{len(PROCEDURES)} procedures + {len(BUNDLES)} service-mode bundles.

Regenerate: `python backend/scripts/generate_samsung_rf28_fridge_procedure_seeds.py`

Smoke: `/solomon/procedures/dev` with Samsung + RF28R7201SR
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)
    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        (OUT / filename).write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {filename}")
    for item, filename in zip(BUNDLES, BUNDLE_FILES, strict=True):
        (BUNDLE_OUT / filename).write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote bundles/{filename}")
    write_catalog()
    write_readme()
    for script in (
        "attach_samsung_rf28_fridge_diagnostic_effects.py",
        "attach_samsung_rf28_fridge_service_modes.py",
    ):
        path = ROOT / "backend" / "scripts" / script
        if path.exists():
            subprocess.run([sys.executable, str(path)], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: global validate reported errors (may include other platforms).", file=sys.stderr)


if __name__ == "__main__":
    main()
