#!/usr/bin/env python3
"""Generate W11296289 (Whirlpool/Maytag/Amana/IKEA SxS refrigerator) procedure seed JSON."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_sxs_w11296289"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_sxs_w11296289"

SOURCE = {
    "manualId": "W11296289",
    "manualTitle": "Whirlpool/Maytag/Amana/IKEA Side-by-Side Refrigerator (W11296289)",
    "extractedTextFile": "backend/docs/manuals/Service-Manual-W11296289-Side-X-Side-Refrigerator-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": (
        "Unplug the refrigerator or disconnect power before servicing. "
        "For live voltage checks, use proper PPE and disconnect power after measurements."
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
        {"id": f"{prefix}_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {
            "id": no_id,
            "label": "No / fault",
            "when": {"kind": "checkpoint_no"},
            "nextStepId": no_next,
            "terminal": True,
            "oemOutcome": no_outcome,
        },
    ]


def select_step(step_num: str, component: str, next_id: str) -> dict:
    return instr(
        f"navigate_step_{step_num}",
        2,
        f"Navigate to service step {step_num}",
        (
            f"Use Light key (SW2) to advance until Freezer TEMP LEDs show step {step_num} ({component}). "
            "Wait at least 1 second between key presses."
        ),
        next_id,
        f"Service step {step_num} — {component}",
    )


def sensor_service_proc(
    pid: str,
    title: str,
    step_num: str,
    sensor_name: str,
    theseus_conn: str,
    theseus_pins: str,
    athena_conn: str,
    athena_pins: str,
    tags: list[str],
    pages: list[int],
):
    return proc(
        pid,
        title,
        step_num,
        f"{sensor_name} sensor check",
        pages,
        ["thermistor"],
        tags,
        [
            select_step(step_num, sensor_name, "read_sensor_leds"),
            instr(
                "read_sensor_leds",
                3,
                "Read sensor LED feedback",
                (
                    f"At step {step_num}, board reads {sensor_name} thermistor. "
                    "Refrigeration TEMP LEDs: Open = LED6+7 on; Short = LED8 on; Pass = LED6–8 on; "
                    "Blank = awaiting valid reading."
                ),
                "sensor_led_result",
            ),
            visual(
                "sensor_led_result",
                4,
                f"{sensor_name} sensor service result",
                "What does the refrigeration TEMP LED pattern show?",
                [
                    {"id": "pass_leds", "label": "Pass (LED6–8 on)", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bench_ohms"},
                    {"id": "open_leds", "label": "Open (LED6+7)", "when": {"kind": "checkpoint_no"}, "nextStepId": "bench_ohms"},
                    {"id": "short_leds", "label": "Short (LED8)", "when": {"kind": "checkpoint_no"}, "nextStepId": "bench_ohms"},
                ],
            ),
            instr(
                "bench_ohms",
                5,
                "Disconnect power for bench ohms",
                "Unplug unit. Measure thermistor at harness.",
                "ntc_ohms",
            ),
            meas(
                "ntc_ohms",
                6,
                f"{sensor_name} thermistor resistance",
                (
                    f"THESEUS {theseus_conn} {theseus_pins} or ATHENA {athena_conn} {athena_pins} — "
                    "2.7 kΩ @ 25°C (5 VDC input circuit)."
                ),
                "whirlpoolSxsW11296289ThermistorOhms",
                theseus_conn,
                f"{theseus_pins} / {athena_conn} {athena_pins}",
                ohm_branches("ntc", "sensor_ok", "replace_sensor", "~2.7 kΩ @ 25°C"),
            ),
            outcome("replace_sensor", 7, f"Replace {sensor_name} thermistor", f"Replace {sensor_name} sensor or repair harness."),
            outcome("sensor_ok", 8, f"{sensor_name} sensor verified", f"Service step {step_num} and bench ohms verified."),
        ],
    )


PROCEDURES = [
    sensor_service_proc(
        "w11296289-test-01-fc-thermistor",
        "Service step 1: Freezer (FC) thermistor",
        "1",
        "FC",
        "P5",
        "P5-3 ↔ P5-4",
        "J2",
        "J2-1 ↔ J2-2",
        ["thermistor_check", "not_cooling", "sensor_fault"],
        [22, 23],
    ),
    sensor_service_proc(
        "w11296289-test-03-rc-thermistor",
        "Service step 3: Refrigerator (RC) thermistor",
        "3",
        "RC",
        "P5",
        "P5-1 ↔ P5-2",
        "J2",
        "J2-3 ↔ J2-4",
        ["thermistor_check", "weak_cooling_ff", "sensor_fault"],
        [22, 23],
    ),
    sensor_service_proc(
        "w11296289-test-05-defrost-thermistor",
        "Service step 5: Defrost thermistor",
        "5",
        "Defrost",
        "P8",
        "P8-1 ↔ P8-2",
        "J2",
        "J2-1 ↔ J2-2",
        ["thermistor_check", "defrost", "frost_buildup", "sensor_fault"],
        [22, 23],
    ),
    proc(
        "w11296289-test-07-compressor-cond-fan",
        "Service step 7: Compressor & condenser fan",
        "7",
        "Compressor & Condenser Fan",
        [22, 24],
        ["compressor", "condenser_fan"],
        ["not_cooling", "compressor_check", "condenser_fan", "sealed_system"],
        [
            select_step("7", "Compressor & cond fan", "activate_step_7"),
            instr(
                "activate_step_7",
                3,
                "Monitor compressor and condenser fan",
                "At step 7, condenser fan turns on. Use RC TEMP key (SW5) to toggle load ON/OFF. Monitor compressor and condenser fan operation.",
                "comp_runs",
            ),
            visual(
                "comp_runs",
                4,
                "Compressor and condenser fan run",
                "With load ON, do compressor and condenser fan operate normally?",
                cp_yes_no(
                    "comp_ok",
                    "deactivate_step_7",
                    "comp_fail",
                    "bench_compressor",
                    "Compressor or condenser fan does not run — bench test windings.",
                ),
            ),
            instr(
                "deactivate_step_7",
                5,
                "Deactivate step 7",
                "Toggle load OFF with RC TEMP key before leaving step.",
                "comp_verified",
            ),
            instr(
                "bench_compressor",
                6,
                "Disconnect power for ohms",
                "Unplug unit. Access compressor terminals and fan motors.",
                "run_winding_ohms",
            ),
            meas(
                "run_winding_ohms",
                7,
                "Compressor run windings",
                "EGX60HLC / EM3Y60HLP run windings 1–5 Ω.",
                "whirlpoolSxsW11296289CompressorRunOhms",
                "compressor",
                "run ↔ common",
                ohm_branches("run", "cond_fan_ohms", "replace_compressor", "1–5 Ω"),
            ),
            meas(
                "cond_fan_ohms",
                8,
                "Condenser fan motor",
                "Condenser fan motor 3–12 Ω.",
                "whirlpoolSxsW11296289CondenserFanOhms",
                "cond_fan",
                "motor terminals",
                ohm_branches("cond", "comp_path_ok", "replace_cond_fan", "3–12 Ω"),
            ),
            instr(
                "live_comp_voltage",
                9,
                "Optional: compressor voltage",
                "Restore power at step 7. THESEUS P1-2 ↔ P1-4 or ATHENA JP1-4 ↔ JP1-6 — 120 VAC when cooling.",
                "comp_voltage",
            ),
            meas(
                "comp_voltage",
                10,
                "Compressor supply voltage",
                "120 VAC at compressor output when load commanded.",
                "whirlpoolSxsW11296289LineVoltage120",
                "P1 / JP1",
                "P1-2↔P1-4 / JP1-4↔JP1-6",
                ohm_branches("cv", "comp_path_ok", "replace_board", "108–132 VAC"),
            ),
            outcome("replace_compressor", 11, "Replace compressor or start device", "Replace compressor when windings failed."),
            outcome("replace_cond_fan", 12, "Replace condenser fan", "Replace condenser fan motor when out of range."),
            outcome("replace_board", 13, "Replace main control", "Replace ACU when voltage absent with good supply."),
            outcome("comp_verified", 14, "Compressor path verified", "Service step 7 and compressor circuit verified."),
            outcome("comp_path_ok", 15, "Compressor circuit OK", "Windings and voltage verified."),
        ],
    ),
    proc(
        "w11296289-test-09-damper-open",
        "Service step 9: Damper open",
        "9",
        "Damper Open",
        [24, 25],
        ["damper_motor"],
        ["damper_check", "weak_cooling_ff", "airflow"],
        [
            select_step("9", "Damper open", "damper_open_check"),
            instr(
                "damper_open_check",
                3,
                "Monitor damper open",
                "At step 9, damper opens. Verify cold air baffle/damper moves to open position. Step 10 closes damper automatically.",
                "damper_moves",
            ),
            visual(
                "damper_moves",
                4,
                "Damper opens",
                "Does damper move to fully open position?",
                cp_yes_no(
                    "damper_ok",
                    "damper_verified",
                    "damper_fail",
                    "damper_fail_out",
                    "Damper stuck — check stepper motor P70/P11 or linkage.",
                ),
            ),
            outcome("damper_fail_out", 5, "Replace damper assembly", "Replace electric air baffle/damper when it fails step 9."),
            outcome("damper_verified", 6, "Damper verified", "Damper opens correctly in service step 9."),
        ],
    ),
    proc(
        "w11296289-test-11-damper-heater",
        "Service step 11: Damper heater",
        "11",
        "Damper Heater ON",
        [25, 26],
        ["damper_motor", "heater"],
        ["damper_check", "frost_buildup", "weak_cooling_ff"],
        [
            select_step("11", "Damper heater", "damper_heater_on"),
            visual(
                "damper_heater_on",
                3,
                "Damper heater energizes",
                "At step 11, damper heater turns on. Can you verify heat at damper housing?",
                cp_yes_no(
                    "heater_ok",
                    "damper_heater_verified",
                    "heater_fail",
                    "damper_heater_fail",
                    "No heat — check P11-3 ↔ P11-4 (12 VDC) or damper heater element.",
                ),
            ),
            outcome("damper_heater_fail", 4, "Replace damper heater", "Replace damper heater or damper assembly."),
            outcome("damper_heater_verified", 5, "Damper heater verified", "Damper heater operates in service step 11."),
        ],
    ),
    proc(
        "w11296289-test-13-defrost-heater",
        "Service step 13: Defrost heater",
        "13",
        "Defrost Heater ON",
        [25, 26],
        ["defrost_heater"],
        ["defrost_heater", "frost_buildup", "no_defrost"],
        [
            select_step("13", "Defrost heater", "activate_defrost"),
            instr(
                "activate_defrost",
                3,
                "Energize defrost heater",
                "At step 13, defrost heater turns on. Monitor heat at evaporator heater.",
                "heater_heat",
            ),
            visual(
                "heater_heat",
                4,
                "Defrost heater heat",
                "Does defrost heater produce heat at evaporator?",
                cp_yes_no(
                    "heat_ok",
                    "power_off_heater_ohms",
                    "no_heat",
                    "power_off_heater_ohms",
                    "No heat in step 13 — bench test heater ohms and ACU output.",
                ),
            ),
            instr(
                "power_off_heater_ohms",
                5,
                "Disconnect power for ohms",
                "Unplug refrigerator for resistance checks.",
                "heater_ohms",
            ),
            meas(
                "heater_ohms",
                6,
                "Defrost heater resistance",
                "550–650 Ω @ 115 VAC. THESEUS P2-7 or ATHENA JP1-2 when defrosting outputs 120 VAC.",
                "whirlpoolSxsW11296289DefrostHeaterOhms",
                "defrost_heater",
                "heater terminals",
                ohm_branches("heater", "defrost_ok", "replace_heater", "550–650 Ω"),
            ),
            meas(
                "heater_voltage",
                7,
                "Defrost heater voltage (optional)",
                "At step 13 with power on: THESEUS P2-7 ↔ P1-2 or ATHENA JP1-2 ↔ JP1-6 — 120 VAC.",
                "whirlpoolSxsW11296289LineVoltage120",
                "P2 / JP1",
                "P2-7↔P1-2 / JP1-2↔JP1-6",
                ohm_branches("hv", "defrost_ok", "replace_board_defrost", "108–132 VAC"),
            ),
            outcome("replace_heater", 8, "Replace defrost heater", "Replace evaporator heater when open or out of spec."),
            outcome("replace_board_defrost", 9, "Replace main control", "Replace ACU when heater good but no voltage at step 13."),
            outcome("defrost_ok", 10, "Defrost circuit verified", "Service step 13 and heater ohms verified."),
        ],
    ),
    proc(
        "w11296289-test-15-evap-fan",
        "Service step 15: Evaporator fan",
        "15",
        "Evaporator Fan ON",
        [26, 27],
        ["evap_fan"],
        ["evap_fan", "airflow", "not_cooling", "frost_buildup"],
        [
            select_step("15", "Evaporator fan", "fan_on"),
            visual(
                "fan_on",
                3,
                "Evaporator fan runs",
                "At step 15, evaporator fan turns on. Verify rotation and airflow at evaporator.",
                cp_yes_no(
                    "fan_ok",
                    "fan_verified",
                    "fan_fail",
                    "bench_fan",
                    "Fan does not run — bench test motor and harness.",
                ),
            ),
            instr(
                "bench_fan",
                4,
                "Disconnect power for fan ohms",
                "Unplug unit. Measure evaporator fan motor.",
                "fan_ohms",
            ),
            meas(
                "fan_ohms",
                5,
                "Evaporator fan motor resistance",
                "2–9 Ω. THESEUS P2-6 outputs 120 VAC to fan when cooling.",
                "whirlpoolSxsW11296289EvapFanOhms",
                "evap_fan",
                "motor terminals",
                ohm_branches("fan", "fan_path_ok", "replace_fan", "2–9 Ω"),
            ),
            outcome("replace_fan", 6, "Replace evaporator fan", "Replace fan motor when out of range or seized."),
            outcome("fan_verified", 7, "Evaporator fan verified", "Fan operates in service step 15."),
            outcome("fan_path_ok", 8, "Fan circuit OK", "Fan ohms verified."),
        ],
    ),
    proc(
        "w11296289-test-19-water-valve",
        "Service step 19: Water dispenser valve",
        "19",
        "Water Dispenser Valve",
        [27, 28],
        ["water_valve"],
        ["water_dispenser", "no_water", "leak"],
        [
            select_step("19", "Water valve", "water_valve_test"),
            instr(
                "water_valve_test",
                3,
                "Activate water valve",
                "At step 19, press water paddle to activate valve. Valve stays on after paddle release — press Light key (SW2) to exit.",
                "valve_flows",
            ),
            visual(
                "valve_flows",
                4,
                "Water valve flows",
                "Does water valve open and dispense when paddle pressed?",
                cp_yes_no(
                    "valve_ok",
                    "valve_verified",
                    "valve_fail",
                    "valve_fail_out",
                    "No flow — check P3-4 120 VAC output, valve, or filter.",
                ),
            ),
            outcome("valve_fail_out", 5, "Replace water valve", "Replace dispenser water valve or repair harness."),
            outcome("valve_verified", 6, "Water valve verified", "Water valve operates in service step 19."),
        ],
    ),
    proc(
        "w11296289-test-21-rc-door-switch",
        "Service step 21: RC door switch",
        "21",
        "RC Door Switch Input",
        [27, 28],
        ["door_switch"],
        ["door_switch_check", "lighting"],
        [
            select_step("21", "RC door switch", "rc_door_test"),
            visual(
                "rc_door_test",
                3,
                "RC compartment lights",
                "At step 21: Door open = RC lights ON; Door closed = RC lights OFF.",
                cp_yes_no(
                    "rc_door_ok",
                    "rc_door_verified",
                    "rc_door_fail",
                    "rc_door_fail_out",
                    "RC lights do not respond to door — check door switch and harness.",
                ),
            ),
            outcome("rc_door_fail_out", 4, "Replace RC door switch", "Replace or adjust RC door switch."),
            outcome("rc_door_verified", 5, "RC door switch verified", "RC door switch operates in step 21."),
        ],
    ),
    proc(
        "w11296289-test-23-fc-door-switch",
        "Service step 23: FC door switch",
        "23",
        "FC Door Switch Input",
        [27, 28],
        ["door_switch"],
        ["door_switch_check", "lighting", "not_cooling"],
        [
            select_step("23", "FC door switch", "fc_door_test"),
            visual(
                "fc_door_test",
                3,
                "FC compartment lights",
                "At step 23: Door open = FC lights ON; Door closed = FC lights OFF. THESEUS P3-5 FC door switch.",
                cp_yes_no(
                    "fc_door_ok",
                    "fc_door_verified",
                    "fc_door_fail",
                    "fc_door_fail_out",
                    "FC lights do not respond — check P3-5 door switch.",
                ),
            ),
            outcome("fc_door_fail_out", 4, "Replace FC door switch", "Replace FC door switch or repair harness."),
            outcome("fc_door_verified", 5, "FC door switch verified", "FC door switch operates in step 23."),
        ],
    ),
    proc(
        "w11296289-athena-fail-display",
        "Athena service mode: Display fail message decode",
        "6",
        "Display Fail Message State",
        [26, 27],
        ["control_board", "thermistor"],
        ["hmi_check", "sensor_fault", "control_board", "not_cooling"],
        [
            instr(
                "enter_athena_service",
                2,
                "Enter Athena service mode",
                (
                    "Within 30 s of power-up, set TEMP to minimum. Hold door switch closed and press RC TEMP 5 s. "
                    "Advance with SW1 (3 s between presses) to step 6."
                ),
                "read_fail_leds",
            ),
            visual(
                "read_fail_leds",
                3,
                "Fail LED pattern at step 6",
                (
                    "Which fail pattern is displayed? (D9/D8/D7/D6) "
                    "All blank = drivers and sensors OK. "
                    "D6 only = main board driver; D7 = RC sensor; D8 = defrost sensor; "
                    "D7+D8 = both sensors; D6+D7 or D6+D8 = board + sensor; all on = multiple failures."
                ),
                [
                    {"id": "all_blank", "label": "All blank — no fault", "when": {"kind": "checkpoint_yes"}, "nextStepId": "athena_ok"},
                    {"id": "rc_sensor", "label": "D7 — RC sensor", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_rc_sensor"},
                    {"id": "def_sensor", "label": "D8 — defrost sensor", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_def_sensor"},
                    {"id": "board_fault", "label": "D6 — main board driver", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_board"},
                    {"id": "multi", "label": "Multiple LEDs / combined", "when": {"kind": "checkpoint_no"}, "nextStepId": "route_multi"},
                ],
            ),
            instr(
                "route_rc_sensor",
                4,
                "RC sensor follow-up",
                "Run w11296289-test-03-rc-thermistor or measure ATHENA J2-3 ↔ J2-4 — 2.7 kΩ @ 25°C.",
                "athena_sensor_out",
            ),
            instr(
                "route_def_sensor",
                5,
                "Defrost sensor follow-up",
                "Run w11296289-test-05-defrost-thermistor or measure evaporator thermistor circuit.",
                "athena_sensor_out",
            ),
            instr(
                "route_board",
                6,
                "Main board driver fault",
                "Verify heater and compressor outputs at JP1 before replacing ATHENA control.",
                "athena_board_out",
            ),
            instr(
                "route_multi",
                7,
                "Multiple failures",
                "Address sensor faults first, then retest step 6. Replace board if sensors verified good.",
                "athena_board_out",
            ),
            outcome("athena_ok", 8, "Athena diagnostics clear", "No stored fail pattern at step 6."),
            outcome("athena_sensor_out", 9, "Service sensor circuit", "Replace thermistor or harness per fail LED."),
            outcome("athena_board_out", 10, "Service main control", "Replace ATHENA ACU when outputs failed with good loads."),
        ],
    ),
    proc(
        "w11296289-test-33-im-tray-thermistor",
        "Service step 33: IDI ice tray thermistor (SANKYO)",
        "33",
        "Ice Tray Thermistor",
        [28, 29],
        ["thermistor", "ice_maker_module"],
        ["ice_maker", "no_ice", "thermistor_check"],
        [
            select_step("33", "Ice tray thermistor", "tray_ntc_read"),
            instr(
                "tray_ntc_read",
                3,
                "Read tray thermistor",
                "Step 33 for twist-tray door ice maker only. Board reads tray thermistor — same open/short/pass LED pattern as cabinet sensors.",
                "tray_led_result",
            ),
            visual(
                "tray_led_result",
                4,
                "Tray thermistor LED result",
                "Open = LED6+7; Short = LED8; Pass = LED6–8. Models without twist tray read open.",
                [
                    {"id": "tray_pass", "label": "Pass", "when": {"kind": "checkpoint_yes"}, "nextStepId": "tray_ok"},
                    {"id": "tray_fault", "label": "Open / short / N/A", "when": {"kind": "checkpoint_no"}, "nextStepId": "tray_bench"},
                ],
            ),
            instr(
                "tray_bench",
                5,
                "Bench tray thermistor",
                "Disconnect power. Measure ice maker tray thermistor — 2.7 kΩ @ 25°C if equipped.",
                "tray_ohms",
            ),
            meas(
                "tray_ohms",
                6,
                "Tray thermistor resistance",
                "2.7 kΩ @ 25°C at ice maker harness.",
                "whirlpoolSxsW11296289ThermistorOhms",
                "ice_maker",
                "tray NTC",
                ohm_branches("tray", "tray_ok", "replace_im", "~2.7 kΩ @ 25°C"),
            ),
            outcome("replace_im", 7, "Replace ice maker", "Replace SANKYO twist-tray module when tray NTC failed."),
            outcome("tray_ok", 8, "Tray thermistor OK", "Ice tray thermistor verified or not equipped."),
        ],
    ),
]


def theseus_service_entry_bundle() -> dict:
    return {
        "id": "w11296289-theseus-service-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "W11296289 — THESEUS/CUDA service mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["lcd_in_door"],
        "description": "Enter dispenser UI service mode for steps 1–35 (THESEUS ACU).",
        "tags": ["service_test", "service_diagnostic", "control_board"],
        "entryStepId": "svc_enter",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [22],
        },
        "steps": [
            instr(
                "svc_enter",
                1,
                "Enter THESEUS service mode",
                (
                    "First 5 min after power-on: set RC and FC temp to minimum. "
                    "Hold FREEZER TEMP + ICE TYPE 3 seconds. All LEDs verify, then press all 5 keys "
                    "left-to-right to turn LEDs off. Use Light (SW2) to advance steps; RC TEMP (SW5) toggles loads."
                ),
                "@continue",
            ),
        ],
    }


def athena_service_entry_bundle() -> dict:
    return {
        "id": "w11296289-athena-service-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "W11296289 — ATHENA service mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["console"],
        "description": "Enter ATHENA auto service mode (7 steps + fail display).",
        "tags": ["service_test", "service_diagnostic", "control_board"],
        "entryStepId": "athena_enter",
        "source": {
            "manualTitle": SOURCE["manualTitle"],
            "extractedTextFile": SOURCE["extractedTextFile"],
            "pages": [26],
        },
        "steps": [
            instr(
                "athena_enter",
                1,
                "Enter ATHENA service mode",
                (
                    "Within 30 s of power-up, set TEMP to minimum. Hold door switch closed and press RC TEMP 5 s. "
                    "Advance with SW1 — wait 3 s between presses. Step 6 shows fail LED pattern if fault stored."
                ),
                "@continue",
            ),
        ],
    }


BUNDLES = [theseus_service_entry_bundle(), athena_service_entry_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]

def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Whirlpool/Maytag/Amana/IKEA SxS refrigerator (W11296289)",
        "notes": "THESEUS steps 1–35; ATHENA 7-step auto service + fail LEDs. Batch46 measurements.",
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
                "relatedCodes": [],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print("Wrote procedureCatalog.json")


def write_readme() -> None:
    readme = """# whirlpool_sxs_w11296289 — W11296289 procedure seeds

**Manual:** Whirlpool/Maytag/Amana/IKEA Side-by-Side Refrigerator (W11296289)  
**Platform:** `whirlpool_sxs_w11296289` — WRS321/325/315/311/312, ASI2575, WRSA15  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W11296289_SXS_REFRIGERATOR_EXTRACTION.md`

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11296289
```

## Procedures (13)

| ID | OEM step | Notes |
|----|----------|-------|
| w11296289-test-01-fc-thermistor | 1 | FC NTC LED + 2.7 kΩ |
| w11296289-test-03-rc-thermistor | 3 | RC NTC |
| w11296289-test-05-defrost-thermistor | 5 | Defrost NTC |
| w11296289-test-07-compressor-cond-fan | 7 | Compressor/cond fan + ohms |
| w11296289-test-09-damper-open | 9 | Damper open |
| w11296289-test-11-damper-heater | 11 | Damper heater |
| w11296289-test-13-defrost-heater | 13 | Defrost heater 550–650 Ω |
| w11296289-test-15-evap-fan | 15 | Evap fan 2–9 Ω |
| w11296289-test-19-water-valve | 19 | Dispenser valve |
| w11296289-test-21-rc-door-switch | 21 | RC door switch |
| w11296289-test-23-fc-door-switch | 23 | FC door switch |
| w11296289-athena-fail-display | Athena 6 | Fail LED decode |
| w11296289-test-33-im-tray-thermistor | 33 | IDI SANKYO tray NTC |

## Bundles (2)

- `w11296289-theseus-service-entry` — FREEZER TEMP + ICE TYPE ×3
- `w11296289-athena-service-entry` — door switch + RC TEMP 5 s

## WO smoke

Whirlpool `WRS325SDHZ` → `whirlpool_sxs_w11296289`; warm FF → `w11296289-test-09-damper-open`
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
        "attach_w11296289_sxs_fridge_diagnostic_effects.py",
        "attach_w11296289_sxs_fridge_service_modes.py",
        "attach_w11296289_sxs_fridge_procedure_diagrams.py",
    ):
        path = ROOT / "backend" / "scripts" / script
        if path.exists():
            subprocess.run([sys.executable, str(path)], check=True, cwd=ROOT)

    crop = ROOT / "backend/scripts/crop_w11296289_procedure_figures.py"
    if crop.exists():
        subprocess.run([sys.executable, str(crop)], check=True, cwd=ROOT)

    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: global validate reported errors (may include other platforms).", file=sys.stderr)


if __name__ == "__main__":
    main()
