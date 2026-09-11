#!/usr/bin/env python3
"""Generate Samsung Bespoke 4-door refrigerator (RF23BB + RF32CG) procedure seed JSON."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_fridge_bespoke"
BUNDLE_OUT = OUT / "bundles"

MANUAL_RF23BB = {
    "manualId": "SAMSUNG-RF23BB-FRIDGE",
    "manualTitle": "Samsung Bespoke French-door RF23BB/RF24BB/RF29BB/RF30BB",
    "extractedTextFile": "backend/docs/manuals/samsung fridge rf23bb-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

MANUAL_RF32CG = {
    "manualId": "SAMSUNG-RF32CG-FRIDGE",
    "manualTitle": "Samsung Bespoke French-door RF32CG/RF31CG/RF26CG",
    "extractedTextFile": "backend/docs/manuals/samsung fridge rf32cg-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

PLATFORM = "samsung_fridge_bespoke"

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug refrigerator before resistance checks. Discharge PCB per manual. High voltage on inverter PCB.",
    "sourceExcerpt": "Disconnect power before servicing heater or harness resistance tests.",
    "requiresInput": False,
}


def proc(pid, title, oem_num, oem_title, pages, manual, component_ids, tags, steps):
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
        "source": {**manual, "oemTestNumber": oem_num, "oemTestTitle": oem_title, "pages": pages},
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


def sensor_proc(pid, title, connector, pins, tag, component="thermistor"):
    return proc(
        pid,
        title,
        "5-1-2",
        "Self-diagnosis CHECK LIST — sensor",
        [89, 97],
        MANUAL_RF23BB,
        [component],
        [tag, "sensor_check"],
        [
            instr("run_self_diag", 2, "Run self-diagnosis", "Enter Engineer Mode → mode 3, or hold service keys 10 s per UI variant. Note blinking LED for this sensor.", "sensor_voltage"),
            meas(
                "sensor_voltage",
                3,
                f"Thermistor voltage {connector} {pins}",
                f"Measure MAIN PCB {connector} {pins} — 4.5 V warm → 1.0 V cold.",
                "samsungBespokeFridgeThermistorVoltage",
                connector,
                pins,
                volt_branches("ntc", "sensor_ok", "replace_sensor"),
            ),
            outcome("replace_sensor", 4, "Replace sensor", "Replace thermistor or repair harness when voltage out of range."),
            outcome("sensor_ok", 5, "Sensor OK", "Voltage in range — clear error after power cycle if harness verified."),
        ],
    )


PROCEDURES = [
    sensor_proc("samsungbespoke-freezer-sensor", "Freezer compartment sensor (F)", "CN20", "10 ↔ 12", "freezer_sensor"),
    sensor_proc("samsungbespoke-fridge-sensor", "Fridge compartment sensor (R)", "CN20", "9 ↔ 11", "fridge_sensor"),
    sensor_proc("samsungbespoke-freezer-defrost-sensor", "Freezer defrost sensor", "CN20", "6 ↔ 8", "defrost_sensor"),
    sensor_proc("samsungbespoke-fridge-defrost-sensor", "Fridge defrost sensor", "CN20", "5 ↔ 7", "defrost_sensor"),
    proc(
        "samsungbespoke-ambient-sensor",
        "External / ambient air sensor",
        "5-1-2",
        "Ambient sensor",
        [89, 97],
        MANUAL_RF23BB,
        ["thermistor"],
        ["ambient_sensor", "sensor_check"],
        [
            instr("ambient_note", 2, "Connector variant", "RF23BB: CN60 3↔5. RF32CG ambient/ice-room may use CN40 18↔20 — confirm model.", "ambient_voltage"),
            meas("ambient_voltage", 3, "Ambient thermistor voltage", "Measure listed ambient pin pair — 4.5 V warm → 1.0 V cold.", "samsungBespokeFridgeThermistorVoltage", "CN60 or CN40", "3↔5 or 18↔20", volt_branches("amb", "ambient_ok", "replace_ambient")),
            outcome("replace_ambient", 4, "Replace ambient sensor", "Replace sensor or harness."),
            outcome("ambient_ok", 5, "Ambient sensor OK", "Voltage in range."),
        ],
    ),
    sensor_proc("samsungbespoke-flex-sensor", "Flex-Zone sensor (optional)", "CN40", "18 ↔ 20", "flex_sensor"),
    proc(
        "samsungbespoke-humidity-sensor",
        "Humidity sensor",
        "5-1-2",
        "Humidity sensor",
        [89, 97],
        MANUAL_RF23BB,
        ["thermistor"],
        ["humidity_sensor", "14E", "sensor_check"],
        [
            instr("humid_pins", 2, "Pin pair by model", "RF23BB: CN60 3↔7. RF32CG: CN40 14↔16.", "humid_voltage"),
            meas("humid_voltage", 3, "Humidity sensor voltage", "4.5 V warm → 1.0 V cold at humidity sensor pins.", "samsungBespokeFridgeThermistorVoltage", "CN60/CN40", "per model", volt_branches("hum", "humid_ok", "replace_humid")),
            outcome("replace_humid", 4, "Replace humidity sensor", "Replace humidity sensor assembly."),
            outcome("humid_ok", 5, "Humidity sensor OK", "Voltage in range."),
        ],
    ),
    proc(
        "samsungbespoke-ice-maker-sensor",
        "Ice maker temperature sensor",
        "5-1-2",
        "Ice maker sensor",
        [89, 97],
        MANUAL_RF23BB,
        ["ice_maker_module"],
        ["ice_maker_sensor", "sensor_check"],
        [
            instr("im_pins", 2, "Ice maker sensor pins", "Cubed RF23BB: CN90 14↔26. Ice Bites: CN90 2↔4. RF32CG cubed: CN90 11↔13; fridge IM: CN90 11↔21.", "im_voltage"),
            meas("im_voltage", 3, "Ice maker sensor voltage", "4.5 V warm → 1.0 V cold at ice maker sensor pins.", "samsungBespokeFridgeThermistorVoltage", "CN90", "per ice maker type", volt_branches("im", "im_ok", "replace_im_sensor")),
            outcome("replace_im_sensor", 4, "Replace ice maker sensor", "Replace ice maker or sensor harness."),
            outcome("im_ok", 5, "Ice maker sensor OK", "Voltage in range."),
        ],
    ),
    proc(
        "samsungbespoke-freezer-fan",
        "Freezer evaporator fan (F-FAN)",
        "5-1-2",
        "F-FAN error",
        [89, 120],
        MANUAL_RF23BB,
        ["evap_fan"],
        ["22E", "evap_fan", "frost_buildup"],
        [
            instr("fan_cmd", 2, "Command fan on", "Use Test Mode manual operation or Load Condition to command F-fan. Door may stop fan — allow 1 min after close.", "fan_fb"),
            meas("fan_fb", 3, "F-FAN feedback voltage", "MAIN PCB CN20 16↔18 — 7–12 V while fan commanded.", "samsungBespokeFridgeEvapFanFeedbackVoltage", "CN20", "16 ↔ 18", volt_branches("ffan", "fan_ok", "replace_fan")),
            outcome("replace_fan", 4, "Replace F-FAN", "Replace freezer evaporator fan motor or repair harness."),
            outcome("fan_ok", 5, "F-FAN OK", "Feedback voltage in range while fan runs."),
        ],
    ),
    proc(
        "samsungbespoke-fridge-fan",
        "Fridge compartment fan",
        "5-1-2",
        "Fridge fan error",
        [89, 120],
        MANUAL_RF23BB,
        ["evap_fan"],
        ["evap_fan", "weak_cooling_ff"],
        [
            instr("rfan_cmd", 2, "Command fridge fan", "Use Test Mode or Load Condition display to verify fridge fan command.", "rfan_fb"),
            meas("rfan_fb", 3, "Fridge fan feedback", "MAIN PCB CN20 15↔17 — 7–12 V while commanded.", "samsungBespokeFridgeEvapFanFeedbackVoltage", "CN20", "15 ↔ 17", volt_branches("rfan", "rfan_ok", "replace_rfan")),
            outcome("replace_rfan", 4, "Replace fridge fan", "Replace fridge evaporator fan or harness."),
            outcome("rfan_ok", 5, "Fridge fan OK", "Feedback in range."),
        ],
    ),
    proc(
        "samsungbespoke-convertible-fan",
        "Convertible compartment fan (C-FAN)",
        "5-1-2",
        "C-FAN error",
        [89, 126],
        MANUAL_RF23BB,
        ["evap_fan"],
        ["22C", "evap_fan"],
        [
            instr("cfan_pins", 2, "C-FAN pin variant", "RF23BB: CN40 11↔13. RF32CG: CN40 13↔15.", "cfan_fb"),
            meas("cfan_fb", 3, "C-FAN feedback voltage", "7–12 V while C-fan commanded on.", "samsungBespokeFridgeEvapFanFeedbackVoltage", "CN40", "11↔13 or 13↔15", volt_branches("cfan", "cfan_ok", "replace_cfan")),
            outcome("replace_cfan", 4, "Replace C-FAN", "Replace convertible fan motor."),
            outcome("cfan_ok", 5, "C-FAN OK", "Feedback in range."),
        ],
    ),
    proc(
        "samsungbespoke-ice-room-fan",
        "Ice room fan",
        "5-1-2",
        "Ice room fan error",
        [97, 128],
        MANUAL_RF32CG,
        ["evap_fan"],
        ["ice_room_fan", "evap_fan"],
        [
            instr("ice_fan_cmd", 2, "Command ice room fan", "RF32CG: verify ice room fan operation in Test Mode or Load Condition.", "ice_fan_fb"),
            meas("ice_fan_fb", 3, "Ice room fan feedback", "MAIN PCB CN20 22↔24 — 7–12 V while commanded.", "samsungBespokeFridgeEvapFanFeedbackVoltage", "CN20", "22 ↔ 24", volt_branches("irf", "ice_fan_ok", "replace_ice_fan")),
            outcome("replace_ice_fan", 4, "Replace ice room fan", "Replace ice room fan motor."),
            outcome("ice_fan_ok", 5, "Ice room fan OK", "Feedback in range."),
        ],
    ),
    proc(
        "samsungbespoke-freezer-defrost-heater",
        "Freezer defrost heater",
        "5-1-2",
        "Freezer defrosting error",
        [89, 123],
        MANUAL_RF23BB,
        ["heater"],
        ["defrost_heater", "frost_buildup", "no_defrost"],
        [
            instr("fdef_disconnect", 2, "Disconnect harness", "Power off. RF23BB: disconnect CN20, measure 6↔8. RF32CG: disconnect CN70 & CN81, measure CN70-5 ↔ CN81-1.", "fdef_ohms"),
            meas("fdef_ohms", 3, "Defrost heater resistance", "63(230) Ω ±7% — 0 Ω short, ∞ open bimetal/heater.", "samsungBespokeFridgeDefrostHeaterOhms63", "CN20 or CN70/CN81", "per model", ohm_branches("fdef", "fdef_ok", "replace_fdef_heater")),
            outcome("replace_fdef_heater", 4, "Replace defrost heater", "Replace heater or defrost bimetal/thermal fuse."),
            outcome("fdef_ok", 5, "Defrost heater OK", "Resistance in OEM range."),
        ],
    ),
    proc(
        "samsungbespoke-damper-heater-135",
        "Flex-Zone damper heater (135 Ω)",
        "5-1-2",
        "Flex ROOM damper heater",
        [90, 91],
        MANUAL_RF23BB,
        ["damper_motor"],
        ["damper_heater", "RD"],
        [
            instr("damp135_off", 2, "Disconnect CN40", "Power off. Disconnect CN40 harness.", "damp135_ohms"),
            meas("damp135_ohms", 3, "Damper heater 135 Ω", "CN40 25↔27 — 135 Ω ±7%.", "samsungBespokeFridgeDamperHeaterOhms135", "CN40", "25 ↔ 27", ohm_branches("d135", "damp135_ok", "replace_damp135")),
            outcome("replace_damp135", 4, "Replace damper heater", "Replace flex-zone damper heater."),
            outcome("damp135_ok", 5, "Damper heater OK", "135 Ω in range."),
        ],
    ),
    proc(
        "samsungbespoke-damper-heater-24",
        "Damper heater (24 Ω — RF32CG)",
        "5-1-2",
        "Damper heater error",
        [98, 99],
        MANUAL_RF32CG,
        ["damper_motor"],
        ["damper_heater"],
        [
            instr("damp24_off", 2, "Disconnect CN40", "Power off. Disconnect CN40.", "damp24_ohms"),
            meas("damp24_ohms", 3, "Damper heater 24 Ω", "CN40 25↔27 — 24 Ω ±7%.", "samsungBespokeFridgeDamperHeaterOhms24", "CN40", "25 ↔ 27", ohm_branches("d24", "damp24_ok", "replace_damp24")),
            outcome("replace_damp24", 4, "Replace damper heater", "Replace damper heater assembly."),
            outcome("damp24_ok", 5, "Damper heater OK", "24 Ω in range."),
        ],
    ),
    proc(
        "samsungbespoke-ice-pipe-heater-72",
        "Freezer ice pipe heater (72 Ω — RF23BB)",
        "5-1-2",
        "Ice pipe heater cubed / ice bites",
        [90, 91],
        MANUAL_RF23BB,
        ["ice_pipe_heater"],
        ["ice_pipe_heater", "33E", "ice_maker"],
        [
            instr("pipe72_pins", 2, "Ice pipe pin pair", "Cubed: CN20 19↔23. Ice Bites: CN20 21↔23. Power off, CN20 disconnected.", "pipe72_ohms"),
            meas("pipe72_ohms", 3, "Ice pipe heater 72 Ω", "72 Ω ±7%.", "samsungBespokeFridgeIcePipeHeaterOhms72", "CN20", "19↔23 or 21↔23", ohm_branches("p72", "pipe72_ok", "replace_pipe72")),
            outcome("replace_pipe72", 4, "Replace ice pipe heater", "Replace ice pipe heater or thermal fuse."),
            outcome("pipe72_ok", 5, "Ice pipe heater OK", "72 Ω in range."),
        ],
    ),
    proc(
        "samsungbespoke-ice-pipe-heater-24",
        "Ice pipe heater (24 Ω — RF32CG)",
        "5-1-2",
        "Ice pipe heater cubed",
        [98, 99],
        MANUAL_RF32CG,
        ["ice_pipe_heater"],
        ["ice_pipe_heater", "ice_maker"],
        [
            instr("pipe24_off", 2, "Disconnect CN20", "Power off. CN20 19↔23.", "pipe24_ohms"),
            meas("pipe24_ohms", 3, "Ice pipe heater 24 Ω", "24 Ω ±7%.", "samsungBespokeFridgeIcePipeHeaterOhms24", "CN20", "19 ↔ 23", ohm_branches("p24", "pipe24_ok", "replace_pipe24")),
            outcome("replace_pipe24", 4, "Replace ice pipe heater", "Replace ice pipe heater."),
            outcome("pipe24_ok", 5, "Ice pipe heater OK", "24 Ω in range."),
        ],
    ),
    proc(
        "samsungbespoke-ice-duct-heater",
        "Fridge ice duct heater (63 Ω)",
        "5-2-2",
        "Fridge ice duct heater",
        [100, 101],
        MANUAL_RF32CG,
        ["ice_pipe_heater"],
        ["ice_duct_heater", "ice_maker"],
        [
            instr("duct_off", 2, "Disconnect CN90", "Power off. CN90 1↔5.", "duct_ohms"),
            meas("duct_ohms", 3, "Ice duct heater 63 Ω", "63(230) Ω ±7%.", "samsungBespokeFridgeIceDuctHeaterOhms63", "CN90", "1 ↔ 5", ohm_branches("duct", "duct_ok", "replace_duct")),
            outcome("replace_duct", 4, "Replace ice duct heater", "Replace fridge ice duct heater."),
            outcome("duct_ok", 5, "Ice duct heater OK", "Resistance in range."),
        ],
    ),
    proc(
        "samsungbespoke-ice-room-heater",
        "Ice room heater (135 Ω)",
        "5-2-2",
        "Fridge ice room heater",
        [100, 101],
        MANUAL_RF32CG,
        ["heater"],
        ["ice_room_heater", "ice_maker"],
        [
            instr("irh_off", 2, "Disconnect CN60", "Power off. CN60 21↔23.", "irh_ohms"),
            meas("irh_ohms", 3, "Ice room heater 135 Ω", "135 Ω ±7%.", "samsungBespokeFridgeDamperHeaterOhms135", "CN60", "21 ↔ 23", ohm_branches("irh", "irh_ok", "replace_irh")),
            outcome("replace_irh", 4, "Replace ice room heater", "Replace ice room heater."),
            outcome("irh_ok", 5, "Ice room heater OK", "135 Ω in range."),
        ],
    ),
    proc(
        "samsungbespoke-compressor-inverter",
        "Compressor / inverter IPM fault",
        "5-1-2",
        "Comp start / IPM / lock",
        [91, 125],
        MANUAL_RF23BB,
        ["inverter_board"],
        ["44E", "84C", "compressor", "not_cooling"],
        [
            visual("comp_short", 2, "Compressor terminal shorts", "Check for shorts between compressor terminals U/V/W.", cp_yes_no("no_short", "ipm_voltage", "short_found", "short_out", "Repair short or replace compressor before energizing.")),
            instr("ipm_voltage", 3, "IPM DC bus voltage", "Verify inverter DC output — under 13.5 V indicates comp starting failure.", "ipm_read"),
            meas("ipm_read", 4, "Inverter IPM voltage", "Read IPM DC supply — must be ≥13.5 V for reliable start.", "samsungBespokeFridgeInverterIpmVoltage", "Inverter PCB", "DC bus", volt_branches("ipm", "comp_ok", "replace_inverter")),
            outcome("short_out", 5, "Repair short", "Clear compressor or harness short before retest."),
            outcome("replace_inverter", 6, "Replace inverter", "Replace inverter PCB after verifying harness and compressor."),
            outcome("comp_ok", 7, "Compressor path OK", "No shorts; IPM voltage adequate — check sealed system if still not cooling."),
        ],
    ),
    proc(
        "samsungbespoke-main-panel-comm",
        "Main ↔ display panel communication",
        "5-1-2",
        "Main ↔ Panel communication",
        [91, 137],
        MANUAL_RF23BB,
        ["display_panel"],
        ["41E", "display_dead", "hmi_check"],
        [
            visual("harness_check", 2, "Display harness", "Reseat display/UI harness. Check for hinge pinch or corrosion.", cp_yes_no("harness_ok", "scope_check", "fix_harness", "harness_out", "Repair or replace display harness.")),
            visual("scope_check", 3, "Oscilloscope comm line", "If harness OK, verify comm waveform between main and panel PCBs.", cp_yes_no("comm_ok", "panel_ok", "replace_boards", "replace_boards_out", "Replace main and/or display PCB after harness ruled out.")),
            outcome("harness_out", 4, "Repair harness", "Replace display harness."),
            outcome("replace_boards_out", 5, "Replace PCB(s)", "Replace main and/or display PCB per scope findings."),
            outcome("panel_ok", 6, "Communication OK", "41Er cleared — panel communication restored."),
        ],
    ),
    proc(
        "samsungbespoke-main-inverter-comm",
        "Main ↔ inverter communication",
        "5-1-2",
        "Main ↔ Inverter communication",
        [91, 125],
        MANUAL_RF23BB,
        ["inverter_board"],
        ["44E", "compressor"],
        [
            visual("inv_harness", 2, "Inverter harness", "Reseat CN70 inverter harness. Inspect for damage at machine compartment.", cp_yes_no("inv_h_ok", "inv_scope", "fix_inv_h", "inv_h_out", "Repair inverter harness.")),
            visual("inv_scope", 3, "Comm line scope", "Verify main↔inverter comm with oscilloscope if harness OK.", cp_yes_no("inv_comm_ok", "inv_comm_verified", "replace_inv", "replace_inv_out", "Replace main and/or inverter PCB.")),
            outcome("inv_h_out", 4, "Repair harness", "Replace inverter communication harness."),
            outcome("replace_inv_out", 5, "Replace PCB(s)", "Replace inverter and/or main PCB."),
            outcome("inv_comm_verified", 6, "Inverter comm OK", "44Er cleared."),
        ],
    ),
    proc(
        "samsungbespoke-autofill-overflow",
        "AutoFill infuser overflow",
        "5-1-2",
        "AUTO FILL overflow",
        [92, 101],
        MANUAL_RF23BB,
        ["ice_maker_module"],
        ["autofill", "water_dispenser"],
        [
            instr("overflow_check", 2, "Check infuser bottle", "Inspect AutoFill pitcher for overflow or stuck float.", "overflow_voltage"),
            meas("overflow_voltage", 3, "Overflow sense voltage", "CN90 11↔13 — 4.5–5 V normal; 0–4.5 V = overflow.", "samsungBespokeFridgeAutofillOverflowVoltage", "CN90", "11 ↔ 13", volt_branches("af", "af_ok", "af_overflow")),
            outcome("af_overflow", 4, "Clear overflow", "Empty infuser and correct overflow condition."),
            outcome("af_ok", 5, "AutoFill OK", "No overflow detected."),
        ],
    ),
]


def engineer_mode_bundle_rf23bb_inner() -> dict:
    return {
        "id": "samsungbespoke-engineer-mode-rf23bb-inner",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": MANUAL_RF23BB["manualId"],
        "title": "RF23BB inner display — Engineer Mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["lcd_in_door"],
        "description": "< + > 6 s → Engineer Mode → select Test (1), Self-diagnosis (3), or Load (7).",
        "tags": ["service_diagnostic", "engineer_mode"],
        "entryStepId": "em_enter",
        "source": {"manualTitle": MANUAL_RF23BB["manualTitle"], "extractedTextFile": MANUAL_RF23BB["extractedTextFile"], "pages": [76, 86]},
        "steps": [
            instr("em_enter", 1, "Enter Engineer Mode", "Press < and > together ≥6 s until blink. Press > to enter Engineer Mode. Use < / > to select mode, O to confirm.", "@continue"),
        ],
    }


def test_mode_bundle_rf23bb_digital() -> dict:
    return {
        "id": "samsungbespoke-test-mode-rf23bb-digital",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": MANUAL_RF23BB["manualId"],
        "title": "RF23BB8/29 digital — Test Mode entry",
        "modeKind": "load_test",
        "uiVariants": ["lcd_in_door"],
        "description": "Fridge + FlexZone 6 s → FlexZone enters Test Mode (FF → Fd sequence).",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "tm_enter",
        "source": {"manualTitle": MANUAL_RF23BB["manualTitle"], "extractedTextFile": MANUAL_RF23BB["extractedTextFile"], "pages": [81, 84]},
        "steps": [
            instr("tm_enter", 1, "Enter Test Mode", "Fridge + FlexZone ≥6 s → press FlexZone. Cycle keys: FF → FF r → FF F → FF A → Fd defrost.", "@continue"),
        ],
    }


def test_mode_bundle_rf32cg_buttons() -> dict:
    return {
        "id": "samsungbespoke-test-mode-rf32cg-buttons",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": MANUAL_RF32CG["manualId"],
        "title": "RF32CG button UI — Test Mode entry",
        "modeKind": "load_test",
        "uiVariants": ["console"],
        "description": "Fridge + Dot Line or AutoFill 6 s → enter Test Mode.",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "cg_tm",
        "source": {"manualTitle": MANUAL_RF32CG["manualTitle"], "extractedTextFile": MANUAL_RF32CG["extractedTextFile"], "pages": [84, 87]},
        "steps": [
            instr("cg_tm", 1, "Enter Test Mode", "RF31/26CG: Fridge + dot line 6 s → dot line. RF32CG5300: Fridge + AutoFill 6 s → AutoFill. Cycle FF → FF F2 → FF F1 → FF A → Fd.", "@continue"),
        ],
    }


def fhub_engineer_bundle() -> dict:
    return {
        "id": "samsungbespoke-fhub-engineer-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": MANUAL_RF32CG["manualId"],
        "title": "Family Hub — Fridge Function Test entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["lcd_in_door"],
        "description": "Touch A-B-A-B-A-B within 3 s → Engineer mode → Fridge Function Test.",
        "tags": ["service_diagnostic", "engineer_mode", "family_hub"],
        "entryStepId": "fh_enter",
        "source": {"manualTitle": MANUAL_RF32CG["manualTitle"], "extractedTextFile": MANUAL_RF32CG["extractedTextFile"], "pages": [92, 96]},
        "steps": [
            instr("fh_enter", 1, "Family Hub engineer mode", "Touch A-B-A-B-A-B within 3 s. Choose Fridge Function Test → Force Run or Self Diagnosis.", "@continue"),
        ],
    }


def self_diagnosis_bundle() -> dict:
    return {
        "id": "samsungbespoke-self-diagnosis-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": MANUAL_RF23BB["manualId"],
        "title": "Self-diagnosis function entry",
        "modeKind": "fault_codes",
        "uiVariants": ["any"],
        "description": "Engineer mode 3, or hold service keys 10 s — ding-dong then LED blink checklist.",
        "tags": ["fault_codes", "error_code", "service_diagnostic"],
        "entryStepId": "sd_enter",
        "source": {"manualTitle": MANUAL_RF23BB["manualTitle"], "extractedTextFile": MANUAL_RF23BB["extractedTextFile"], "pages": [85, 88]},
        "steps": [
            instr("sd_enter", 1, "Run self-diagnosis", "Inner display: Engineer mode → 3. Digital: Fridge+FlexZone 10 s. Family Hub: Self Diagnosis menu. Errors display 30–60 s.", "@continue"),
        ],
    }


BUNDLES = [
    engineer_mode_bundle_rf23bb_inner(),
    test_mode_bundle_rf23bb_digital(),
    test_mode_bundle_rf32cg_buttons(),
    fhub_engineer_bundle(),
    self_diagnosis_bundle(),
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualIds": [MANUAL_RF23BB["manualId"], MANUAL_RF32CG["manualId"]],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Samsung Bespoke 4-door refrigerator (RF23BB + RF32CG)",
        "notes": "Shared platform — self-diagnosis CHECK LIST §5-1-2 / §5-2-2. Heater variants: 63/72/135 Ω (RF23BB) vs 63/24/135 Ω (RF32CG).",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "manualId": item["source"]["manualId"],
                "relatedCodes": [t for t in item.get("tags", []) if t.endswith("E") or t in ("22C", "33E", "41E", "44E", "46E", "47E", "52E", "84C", "14E", "RD")],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = f"""# Samsung Bespoke refrigerator procedures

**Platform:** `{PLATFORM}`  
**Manuals:** `{MANUAL_RF23BB["manualId"]}`, `{MANUAL_RF32CG["manualId"]}`

## Regenerate

```bash
python backend/scripts/generate_samsung_fridge_bespoke_procedure_seeds.py
```

## Smoke test

`/solomon/procedures/dev` with make Samsung + model RF23BB8600 or RF32CG5300.

## Procedure count

{len(PROCEDURES)} procedures + {len(BUNDLES)} service-mode bundles.
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
        "attach_samsung_fridge_bespoke_diagnostic_effects.py",
        "attach_samsung_fridge_bespoke_service_modes.py",
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
