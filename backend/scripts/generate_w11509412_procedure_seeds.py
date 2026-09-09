#!/usr/bin/env python3
"""Generate W11509412 (Whirlpool/KitchenAid ACU French door refrigerator) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_ka_french_door"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_ka_french_door"

SOURCE = {
    "manualId": "W11509412",
    "manualTitle": "Whirlpool/KitchenAid ACU French Door Refrigerator (W11509412A, ~27 cu ft)",
    "extractedTextFile": "backend/docs/manuals/WPL WRF757SD tech-sheet-w11509412-reva-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": (
        "Disconnect power before servicing. Replace all parts and panels before operating. "
        "For live voltage checks, verify controls are off, use proper PPE, and disconnect power after measurements."
    ),
    "sourceExcerpt": "Disconnect power before servicing. Replace all parts and panels before operating.",
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


def ohm_branches(prefix, pass_next, fail_next, pass_label="In range"):
    return [
        {"id": f"{prefix}_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next, "terminal": True},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


def ntc_result_branches(prefix: str, pass_next: str, fail_next: str):
    return [
        {"id": f"{prefix}_pass", "label": "01 Pass", "when": {"kind": "checkpoint_yes"}, "nextStepId": pass_next},
        {"id": f"{prefix}_open", "label": "02 Open", "when": {"kind": "checkpoint_no"}, "nextStepId": fail_next},
        {"id": f"{prefix}_short", "label": "03 Short", "when": {"kind": "checkpoint_no"}, "nextStepId": fail_next},
    ]


def select_test_step(test_num: str, test_name: str, next_id: str) -> dict:
    display = test_num.zfill(2)
    return instr(
        f"select_test_{display}",
        2,
        f"Navigate to Service Test {display}",
        (
            f"In Service Diagnostics Mode, press SW5 to advance until the dispenser display shows {display}. "
            f"Press SW4 to go back. Amber Order Filter = step number; red Replace Filter = step result."
        ),
        next_id,
        f"Service Test {display} — {test_name}",
    )


PROCEDURES = [
    proc(
        "w11509412-test-01-fc-thermistor",
        "Service Test 1: Freezer compartment thermistor",
        "1",
        "FC Thermistor",
        [2],
        ["thermistor"],
        ["thermistor_check", "not_cooling", "sensor_fault"],
        [
            select_test_step("1", "FC thermistor", "fc_ntc_result"),
            visual(
                "fc_ntc_result",
                3,
                "FC thermistor service test result",
                "Board checks FC thermistor resistance. Temp display flashes: 01=pass, 02=open, 03=short. What result displays?",
                ntc_result_branches("fc", "fc_ntc_ok", "bench_fc_ntc"),
            ),
            instr(
                "bench_fc_ntc",
                4,
                "Bench FC thermistor ohms",
                "Disconnect power. Measure FC thermistor at P5-3/P5-4 — 2700 Ω ±5% @ 77°F; 7964 Ω @ 32°F; 23,345 Ω @ 0°F.",
                "fc_ntc_ohms",
            ),
            meas(
                "fc_ntc_ohms",
                5,
                "FC thermistor resistance",
                "Measure at harness with power off — 2700 Ω ±5% @ 77°F.",
                "whirlpoolKaFdThermistorOhms",
                "P5",
                "P5-3 ↔ P5-4",
                ohm_branches("fc_ntc", "fc_ntc_ok", "replace_fc_ntc", "2700 Ω @ 77°F"),
            ),
            outcome("replace_fc_ntc", 6, "Replace FC thermistor", "Replace freezer thermistor or repair harness when open, short, or out of range."),
            outcome("fc_ntc_ok", 7, "FC thermistor verified", "Service test 1 and bench ohms verified for freezer thermistor."),
        ],
    ),
    proc(
        "w11509412-test-02-rc-thermistor",
        "Service Test 2: Refrigerator compartment thermistor",
        "2",
        "RC Thermistor",
        [2],
        ["thermistor"],
        ["thermistor_check", "weak_cooling_ff", "sensor_fault"],
        [
            select_test_step("2", "RC thermistor", "rc_ntc_result"),
            visual(
                "rc_ntc_result",
                3,
                "RC thermistor service test result",
                "Board checks RC thermistor resistance. Temp display flashes: 01=pass, 02=open, 03=short. What result displays?",
                ntc_result_branches("rc", "rc_ntc_ok", "bench_rc_ntc"),
            ),
            instr(
                "bench_rc_ntc",
                4,
                "Bench RC thermistor ohms",
                "Disconnect power. Measure RC thermistor at P5-1/P5-2 — same R/T chart as FC (2700 Ω @ 77°F).",
                "rc_ntc_ohms",
            ),
            meas(
                "rc_ntc_ohms",
                5,
                "RC thermistor resistance",
                "Measure at harness with power off — 2700 Ω ±5% @ 77°F.",
                "whirlpoolKaFdThermistorOhms",
                "P5",
                "P5-1 ↔ P5-2",
                ohm_branches("rc_ntc", "rc_ntc_ok", "replace_rc_ntc", "2700 Ω @ 77°F"),
            ),
            outcome("replace_rc_ntc", 6, "Replace RC thermistor", "Replace refrigerator compartment thermistor or repair harness."),
            outcome("rc_ntc_ok", 7, "RC thermistor verified", "Service test 2 and bench ohms verified for RC thermistor."),
        ],
    ),
    proc(
        "w11509412-test-03-evap-fan-damper",
        "Service Test 3: Evaporator fan & air baffle",
        "3",
        "Evaporator Fan and Air Baffle Motors",
        [2],
        ["evap_fan", "damper_motor"],
        ["evap_fan", "damper_check", "airflow", "weak_cooling_ff"],
        [
            select_test_step("3", "Evaporator fan and air baffle", "evap_fan_on"),
            instr(
                "evap_fan_on",
                3,
                "Run test 3",
                "Test turns on FC evaporator fan and air baffle motor. Monitor air baffle feedback with SW3.",
                "baffle_open_check",
            ),
            visual(
                "baffle_open_check",
                4,
                "Air baffle open",
                "Press SW3 until display shows 01 (fan on, air baffle open). Does damper open and fan run (2800 RPM spec)?",
                cp_yes_no("baffle_open_ok", "baffle_closed_check", "baffle_open_fail", "baffle_closed_check", "Check evaporator fan motor, damper motor, or harness."),
            ),
            visual(
                "baffle_closed_check",
                5,
                "Air baffle closed",
                "Press SW3 until display shows 02 (fan on, air baffle closed). Does damper close?",
                cp_yes_no("baffle_ok", "evap_verified", "baffle_fail", "evap_verified", "Replace air baffle/damper motor or repair feedback circuit."),
            ),
            outcome("baffle_open_fail", 6, "Evap fan or damper fault", "FC evaporator fan or air baffle failed to open in service test 3."),
            outcome("baffle_fail", 7, "Damper fault", "Air baffle did not close or feedback incorrect in service test 3."),
            outcome("evap_verified", 8, "Evap fan and damper verified", "Service test 3 confirms evaporator fan and air baffle operation."),
        ],
    ),
    proc(
        "w11509412-test-04-compressor",
        "Service Test 4: Compressor & condenser fan",
        "4",
        "Compressor/Condenser Fan Motor",
        [2],
        ["compressor", "condenser_fan"],
        ["not_cooling", "compressor_check", "condenser_fan", "sealed_system"],
        [
            select_test_step("4", "Compressor/condenser fan", "comp_toggle"),
            instr(
                "comp_toggle",
                3,
                "Toggle sealed system loads",
                "Press SW3 to control compressor and condenser fan (01=on, 02=off).",
                "comp_runs",
            ),
            visual(
                "comp_runs",
                4,
                "Compressor and condenser fan run",
                "With SW3 set to 01 (on), do compressor (EMD55CLT) and condenser fan (940 RPM) operate normally?",
                cp_yes_no("comp_ok", "comp_verified", "comp_fail", "bench_compressor", "Compressor or condenser fan does not run — bench test windings and start device."),
            ),
            instr(
                "bench_compressor",
                5,
                "Disconnect power for compressor ohms",
                "Unplug unit. Access compressor terminals, relay TSD, and 12 µfd run capacitor.",
                "run_winding_ohms",
            ),
            meas(
                "run_winding_ohms",
                6,
                "Compressor run winding (EMD55CLT)",
                "Run winding 5.3 Ω ±8% between run and common.",
                "whirlpoolKaFdCompressorRunOhms",
                "compressor",
                "run ↔ common",
                ohm_branches("run", "start_winding_ohms", "replace_compressor", "5.3 Ω ±8%"),
            ),
            meas(
                "start_winding_ohms",
                7,
                "Compressor start winding",
                "Start winding 7.7 Ω ±8% @ 77°F. Run capacitor 12 µfd ±10%.",
                "whirlpoolKaFdCompressorStartOhms",
                "compressor",
                "start ↔ common",
                ohm_branches("start", "check_relay_cap", "replace_compressor", "7.7 Ω ±8%"),
            ),
            instr(
                "check_relay_cap",
                8,
                "Check relay and run capacitor",
                "Verify TSD relay and 12 µfd/180 VAC run capacitor. FLA 2.3 A; LRA 11.3 A per spec.",
                "comp_verified",
            ),
            outcome("replace_compressor", 9, "Replace compressor or start device", "Replace compressor, relay, or run capacitor when windings or start path failed."),
            outcome("comp_verified", 10, "Compressor path verified", "Service test 4 and compressor circuit verified."),
        ],
    ),
    proc(
        "w11509412-test-06-defrost",
        "Service Test 6: Defrost heater & bimetal",
        "6",
        "Defrost Heater/Bi-metal",
        [2],
        ["defrost_heater", "defrost_thermostat"],
        ["frost_buildup", "defrost_heater", "defrost_thermostat", "no_defrost"],
        [
            select_test_step("6", "Defrost heater/bimetal", "defrost_result"),
            instr(
                "defrost_result",
                3,
                "Run test 6",
                "Heater should energize when bimetal closed. If bimetal open, bypass only for heater verification. Display blank until valid reading.",
                "bimetal_display",
            ),
            visual(
                "bimetal_display",
                4,
                "Defrost bimetal state",
                "Result display: 01=bimetal closed, 02=bimetal open. Does display match evaporator temperature state?",
                [
                    {"id": "bimetal_ok", "label": "01 Closed (expected)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "power_off_heater_ohms"},
                    {"id": "bimetal_open", "label": "02 Open at frosted evap", "when": {"kind": "checkpoint_no"}, "nextStepId": "power_off_heater_ohms"},
                ],
            ),
            instr(
                "power_off_heater_ohms",
                5,
                "Disconnect power for ohms",
                "Unplug refrigerator for resistance checks on defrost heater and bimetal.",
                "heater_ohms",
            ),
            meas(
                "heater_ohms",
                6,
                "Defrost heater resistance",
                "Freezer evaporator heater 36.2 Ω ±5% (365 W @ 115 VAC).",
                "whirlpoolKaFdDefrostHeaterOhms",
                "defrost heater",
                "terminals",
                ohm_branches("heater", "bimetal_ohms", "replace_heater", "36.2 Ω ±5%"),
            ),
            meas(
                "bimetal_ohms",
                7,
                "Defrost thermostat (bimetal) resistance",
                "Closed below 12°F; open above 42°F. Must be closed (few Ω) when evaporator frosted.",
                "whirlpoolKaFdDefrostBimetalOhms",
                "bimetal",
                "terminals",
                ohm_branches("bimetal", "defrost_ok", "replace_bimetal", "Closed (few Ω)"),
            ),
            outcome("replace_heater", 8, "Replace defrost heater", "Replace evaporator heater when open or out of spec."),
            outcome("replace_bimetal", 9, "Replace defrost thermostat", "Replace defrost bimetal when open at frosted evaporator."),
            outcome("defrost_ok", 10, "Defrost circuit verified", "Service test 6, heater ohms, and bimetal verified."),
        ],
    ),
    proc(
        "w11509412-test-36-ice-box-fan",
        "Service Test 36: Ice box fan",
        "36",
        "Ice Box Fan",
        [3],
        ["evap_fan", "ice_maker"],
        ["ice_maker", "no_ice", "E1", "evap_fan"],
        [
            select_test_step("36", "Ice box fan", "ice_fan_toggle"),
            instr(
                "ice_fan_toggle",
                3,
                "Toggle ice box fan",
                "Press SW3 to control ice box fan. Temp display: 01=on, 02=off. Verify airflow from ice box fan (3500 RPM spec).",
                "ice_fan_runs",
            ),
            visual(
                "ice_fan_runs",
                4,
                "Ice box fan operation",
                "With display 01 (fan on), is airflow present from the ice compartment fan?",
                cp_yes_no("fan_ok", "ice_fan_verified", "fan_fail", "replace_ice_fan", "Ice box fan does not run — check P8-5/P8-4 harness and 12.7 VDC supply."),
            ),
            outcome("replace_ice_fan", 5, "Replace ice box fan", "Replace ice box fan motor when it does not run in service test 36."),
            outcome("ice_fan_verified", 6, "Ice box fan verified", "Ice box fan operates correctly in service test 36."),
        ],
    ),
    proc(
        "w11509412-test-37-ice-box-thermistor",
        "Service Test 37: Ice box thermistor",
        "37",
        "Ice Box Thermistor",
        [3],
        ["thermistor", "ice_maker"],
        ["thermistor_check", "no_ice", "E1", "E5"],
        [
            select_test_step("37", "Ice box thermistor", "ice_box_ntc_result"),
            visual(
                "ice_box_ntc_result",
                3,
                "Ice box thermistor service test result",
                "Board checks ice box thermistor at P8. Temp display: 01=pass, 02=open, 03=short. What displays?",
                ntc_result_branches("ice_box", "ice_box_ok", "bench_ice_box_ntc"),
            ),
            instr(
                "bench_ice_box_ntc",
                4,
                "Bench ice box thermistor ohms",
                "Disconnect power. Measure ice box thermistor at P8-1/P8-2 — 2700 Ω @ 77°F (same chart as cabinet NTC).",
                "ice_box_ntc_ohms",
            ),
            meas(
                "ice_box_ntc_ohms",
                5,
                "Ice box thermistor resistance",
                "Measure at harness with power off.",
                "whirlpoolKaFdThermistorOhms",
                "P8",
                "P8-1 ↔ P8-2",
                ohm_branches("ice_box_ntc", "ice_box_ok", "replace_ice_box_ntc", "2700 Ω @ 77°F"),
            ),
            outcome("replace_ice_box_ntc", 6, "Replace ice box thermistor", "Replace ice box thermistor or repair harness."),
            outcome("ice_box_ok", 7, "Ice box thermistor verified", "Service test 37 and bench ohms verified."),
        ],
    ),
    proc(
        "w11509412-test-19-fill-tube-heater",
        "Service Test 19: Fill tube & fascia heater",
        "19",
        "Ice Maker Fill Tube and Fascia Heater Status",
        [3],
        ["ice_maker", "water_valve"],
        ["no_ice", "E4", "fill_tube_heater", "ice_maker"],
        [
            select_test_step("19", "Fill tube and fascia heater", "fill_tube_toggle"),
            instr(
                "fill_tube_toggle",
                3,
                "Toggle fill tube/fascia heater",
                "Press SW3 to toggle ice maker fill tube heater and fascia heater (01=on, 02=off). P3-1 output energizes.",
                "fill_tube_heat",
            ),
            visual(
                "fill_tube_heat",
                4,
                "Fill tube heater warms",
                "With heaters on (01), does fill tube area warm within expected time? Check for ice blockage in tube.",
                cp_yes_no("tube_ok", "fill_tube_verified", "tube_fail", "clear_fill_tube", "Fill tube frozen or heater failed — common E4 dry-cycle path."),
            ),
            outcome("clear_fill_tube", 5, "Clear or replace fill tube heater", "Clear frozen fill tube or replace fill tube/fascia heater assembly."),
            outcome("fill_tube_verified", 6, "Fill tube heater verified", "Fill tube and fascia heater operate in service test 19."),
        ],
    ),
    proc(
        "w11509412-test-45-ice-water-fill",
        "Service Test 45: Ice maker water fill",
        "45",
        "Ref. Compartment Ice Maker Water Fill Test",
        [3, 4],
        ["water_valve", "ice_maker"],
        ["no_ice", "E4", "water_valve_check", "ice_maker"],
        [
            instr(
                "harvest_first",
                2,
                "Harvest ice before fill test",
                "Before test 45, run Service Test 57 and initiate harvest so mold is empty (per manual NOTE).",
                "select_test_45",
            ),
            select_test_step("45", "Ice maker water fill", "fill_state"),
            instr(
                "fill_state",
                4,
                "Observe fill state",
                "After 3-second delay, display shows ice maker water fill state. Press SW3 to start fill; toggles 02=off, 03=on, 04=paused.",
                "water_fills",
            ),
            visual(
                "water_fills",
                5,
                "Water enters mold",
                "With fill on (03), does water enter the ice maker mold? P3-3 ice maker valve should energize.",
                cp_yes_no("fill_ok", "fill_verified", "fill_fail", "check_valve_tube", "No water at mold — valve, supply, or frozen fill tube (see test 19)."),
            ),
            outcome("check_valve_tube", 6, "Check valve and fill tube", "Verify household supply, dual water valve (green 20 W / red 35 W), and fill tube heater path."),
            outcome("fill_verified", 7, "Ice maker fill verified", "Water fill operates correctly in service test 45."),
        ],
    ),
    proc(
        "w11509412-test-56-ice-maker-errors",
        "Service Test 56: Ice maker error codes (E0–E5)",
        "56",
        "Ref. Compartment Ice Maker Error Codes",
        [4],
        ["ice_maker"],
        ["no_ice", "ice_maker", "E0", "E1", "E2", "E3", "E4", "E5"],
        [
            select_test_step("56", "Ice maker error codes", "read_im_code"),
            visual(
                "read_im_code",
                3,
                "Active ice maker error code",
                "Display shows active ice maker error. Which code is displayed?",
                [
                    {"id": "code_e0", "label": "E0 — No errors", "when": {"kind": "checkpoint_yes"}, "nextStepId": "e0_ok"},
                    {"id": "code_e1", "label": "E1 — No cooling", "when": {"kind": "checkpoint_no"}, "nextStepId": "e1_outcome"},
                    {"id": "code_e2", "label": "E2 — Motor lost position", "when": {"kind": "checkpoint_no"}, "nextStepId": "e2_outcome"},
                    {"id": "code_e3", "label": "E3 — Heater time-out", "when": {"kind": "checkpoint_no"}, "nextStepId": "e3_outcome"},
                    {"id": "code_e4", "label": "E4 — Dry cycle", "when": {"kind": "checkpoint_no"}, "nextStepId": "e4_outcome"},
                    {"id": "code_e5", "label": "E5 — IM thermistor fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "e5_outcome"},
                ],
            ),
            outcome("e0_ok", 4, "Ice maker OK", "E0 — ice maker reports no errors. If no ice, check fill (test 45), fill tube (test 19), and ice box cooling (tests 36–37)."),
            outcome("e1_outcome", 5, "E1 — No cooling in ice compartment", "E1 — ice compartment unable to reach temperature. Run tests 36 (ice box fan) and 37 (ice box thermistor); verify sealed system."),
            outcome("e2_outcome", 6, "E2 — Motor home not found", "E2 — harvest motor did not find home. Run test 59; check for obstructions in ice maker module."),
            outcome("e3_outcome", 7, "E3 — Mold heater time-out", "E3 — mold heater on too long without reaching temperature. Run test 58 heater/thermistor path."),
            outcome("e4_outcome", 8, "E4 — Dry cycle", "E4 — dry cycles above minimum. Run test 45 water fill and test 19 fill tube heater; verify water valve P3-3."),
            outcome("e5_outcome", 9, "E5 — Ice maker thermistor fault", "E5 — mold thermistor fault. Run test 58; measure IM thermistor at P7-1/P7-2."),
        ],
    ),
    proc(
        "w11509412-test-57-ice-harvest",
        "Service Test 57: Ice maker harvest",
        "57",
        "Ref. Compartment Ice Maker Harvest",
        [4],
        ["ice_maker"],
        ["no_ice", "E2", "ice_maker", "harvest_check"],
        [
            select_test_step("57", "Ice maker harvest", "start_harvest"),
            instr(
                "start_harvest",
                3,
                "Initiate harvest",
                "Press SW3 to activate harvest. Doors must be closed. Digit 1=sequence state; digit 2=outcome (0=in progress, 1=completed, 2=not completed / 70 s timeout).",
                "harvest_result",
            ),
            visual(
                "harvest_result",
                4,
                "Harvest completed",
                "Did harvest complete (digit 2 = 1)? Sequence cannot be exited once initiated.",
                cp_yes_no("harvest_ok", "harvest_verified", "harvest_fail", "harvest_fail_out", "Harvest not completed — obstruction, motor, or heater issue (E2 path)."),
            ),
            outcome("harvest_fail_out", 5, "Harvest failed", "Harvest timed out or did not complete — run test 59 motor and test 58 heater/thermistor."),
            outcome("harvest_verified", 6, "Harvest verified", "Ice maker harvest sequence completed in service test 57."),
        ],
    ),
    proc(
        "w11509412-test-58-ice-heater-thermistor",
        "Service Test 58: Ice maker heater & thermistor",
        "58",
        "Ref. Compartment Ice Maker Heater Activation and Thermistor",
        [4],
        ["ice_maker"],
        ["no_ice", "E3", "E5", "ice_maker", "thermistor_check"],
        [
            select_test_step("58", "Ice maker heater and thermistor", "heater_toggle"),
            instr(
                "heater_toggle",
                3,
                "Toggle mold heater",
                "Press SW3 to activate ice maker heater and toggle on/off. Digit 1: 0=heater off, 1=heater on. Digit 2 thermistor: 0=warmer than harvest, 1=cooler, 2=open, 3=short.",
                "thermistor_state",
            ),
            visual(
                "thermistor_state",
                4,
                "Mold thermistor state",
                "With heater on, what does digit 2 show for thermistor state?",
                [
                    {"id": "thm_ok", "label": "0 or 1 (valid reading)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bench_im_thm"},
                    {"id": "thm_open", "label": "2 Open", "when": {"kind": "checkpoint_no"}, "nextStepId": "bench_im_thm"},
                    {"id": "thm_short", "label": "3 Short", "when": {"kind": "checkpoint_no"}, "nextStepId": "bench_im_thm"},
                ],
            ),
            instr(
                "bench_im_thm",
                5,
                "Bench IM thermistor ohms",
                "Disconnect power. Measure ice maker mold thermistor at P7-1/P7-2.",
                "im_thm_ohms",
            ),
            meas(
                "im_thm_ohms",
                6,
                "Ice maker mold thermistor",
                "2700 Ω ±5% @ 77°F — same R/T chart as cabinet thermistors.",
                "whirlpoolKaFdIceMakerThermistorOhms",
                "P7",
                "P7-1 ↔ P7-2",
                ohm_branches("im_thm", "heater_thm_ok", "replace_im_thm", "2700 Ω @ 77°F"),
            ),
            outcome("replace_im_thm", 7, "Replace IM thermistor or module", "Ice maker mold thermistor open, short, or out of range (E5)."),
            outcome("heater_thm_ok", 8, "Heater and thermistor verified", "Service test 58 and mold thermistor ohms verified."),
        ],
    ),
    proc(
        "w11509412-test-59-ice-motor",
        "Service Test 59: Ice maker motor",
        "59",
        "Ref. Compartment Ice Maker Motor",
        [4],
        ["ice_maker"],
        ["no_ice", "E2", "ice_maker", "motor_check"],
        [
            select_test_step("59", "Ice maker motor", "motor_sequence"),
            instr(
                "motor_sequence",
                3,
                "Run motor sequence",
                "Press SW3 to step motor sequence. Digit 1: 0=off, 1=CW to home, 2=off, 3=CCW to home. Digit 2: 0=in progress, 1=completed, 2=timeout (70 s).",
                "motor_home",
            ),
            visual(
                "motor_home",
                4,
                "Motor finds home",
                "Did motor complete home position (digit 2 = 1) without timeout?",
                cp_yes_no("motor_ok", "motor_verified", "motor_fail", "motor_fail_out", "Motor lost position — E2. Check for ice obstruction or replace ice maker module."),
            ),
            outcome("motor_fail_out", 5, "Replace ice maker module", "Ice maker motor did not find home — obstruction or failed motor/driver."),
            outcome("motor_verified", 6, "Ice maker motor verified", "Motor sequence completed in service test 59."),
        ],
    ),
]


def service_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11509412-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "W11509412 — Service Diagnostics Mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter ACU service diagnostics for cooling tests 1–7, 32–39 and ice maker tests 19, 45, 56–59.",
        "tags": ["service_test", "service_diagnostic", "control_board"],
        "entryStepId": "sd_enter",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [2],
        },
        "steps": [
            instr(
                "sd_enter",
                1,
                "Enter Service Diagnostics Mode",
                (
                    "Refrigerator must not be in lockout mode. Press SW1 and SW2 simultaneously for 3 seconds. "
                    "Release when CHIME sounds — display shows 01. Press SW5 to advance steps, SW4 to go back. "
                    "Exit: SW1+SW2 for 3 sec, disconnect power, or wait 20 minutes."
                ),
                "@continue",
                "Press SW1 and SW2 simultaneously for 3 seconds.",
            ),
        ],
    }


BUNDLES = [service_diagnostic_entry_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Whirlpool/KitchenAid ACU French door refrigerator (W11509412)",
        "notes": "Dispenser UI service diagnostics; RC ice-in-compartment; IM error codes E0–E5 via test 56. EMD55CLT compressor.",
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
                "relatedCodes": [t for t in item["tags"] if t.startswith("E") and len(t) == 2],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print("Wrote procedureCatalog.json")


def write_readme() -> None:
    readme = """# whirlpool_ka_french_door — W11509412 procedure seeds

**Manual:** Whirlpool/KitchenAid ACU French Door Refrigerator (W11509412A, ~27 cu ft)  
**Platform:** `whirlpool_ka_french_door` — WRF7/8, KRMF70/706, KRFF7, MFI7/MFT7/MFF7  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_KITCHENAID_FRENCH_DOOR_PLATFORM_EXTRACTION.md`  
**Knowledge:** batch36 (`whirlpoolKaFd*`)

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11509412
```

## Procedures (13)

| ID | OEM | Tags / codes |
|----|-----|--------------|
| w11509412-test-01-fc-thermistor | 1 | thermistor, not_cooling |
| w11509412-test-02-rc-thermistor | 2 | thermistor, weak_cooling_ff |
| w11509412-test-03-evap-fan-damper | 3 | evap_fan, damper |
| w11509412-test-04-compressor | 4 | compressor, sealed_system |
| w11509412-test-06-defrost | 6 | defrost_heater, frost_buildup |
| w11509412-test-36-ice-box-fan | 36 | E1, no_ice |
| w11509412-test-37-ice-box-thermistor | 37 | E1, E5 |
| w11509412-test-19-fill-tube-heater | 19 | E4, fill_tube |
| w11509412-test-45-ice-water-fill | 45 | E4, water_valve |
| w11509412-test-56-ice-maker-errors | 56 | **E0–E5** |
| w11509412-test-57-ice-harvest | 57 | E2, harvest |
| w11509412-test-58-ice-heater-thermistor | 58 | E3, E5 |
| w11509412-test-59-ice-motor | 59 | E2, motor |

## Bundle (1)

- `w11509412-service-diagnostic-entry` — SW1+SW2 ×3 sec → step 01

## WO smoke

Whirlpool `WRF757SDHZ` → `whirlpool_ka_french_door`; no ice + E4 → `w11509412-test-56-ice-maker-errors` then `w11509412-test-45-ice-water-fill`
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")
    print("Wrote README.md")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)

    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        path = OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {filename}")

    for item, filename in zip(BUNDLES, BUNDLE_FILES, strict=True):
        path = BUNDLE_OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote bundles/{filename}")

    write_catalog()
    write_readme()

    for script in (
        "attach_w11509412_diagnostic_effects.py",
        "attach_w11509412_service_modes.py",
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
