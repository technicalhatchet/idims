#!/usr/bin/env python3
"""One-shot generator for remaining W11169652 procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_fl_dd"

SOURCE = {
    "manualId": "W11169652",
    "manualTitle": "Whirlpool & Maytag 27 in. Front-Load Washers",
    "extractedTextFile": "backend/docs/manuals/service-manual-w11169652-reva-27in-front-load-washers-extracted.txt",
    "verifiedAt": "2026-03-07",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the washer or disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "WARNING — Electrical Shock Hazard. Disconnect power before servicing.",
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
    service_modes: list[dict] | None = None,
) -> dict:
    if not steps:
        raise ValueError(f"{pid} must define at least one step after safety")
    safety = {**SAFETY, "defaultNextStepId": steps[0]["id"]}
    return {
        "id": pid,
        "version": "1.0.0",
        "title": title,
        "platformId": "whirlpool_fl_dd",
        "componentIds": component_ids,
        "tags": tags,
        "source": {
            **SOURCE,
            "oemTestNumber": oem_num,
            "oemTestTitle": oem_title,
            "pages": pages,
        },
        "entryStepId": "safety_power_off",
        **({"serviceModes": service_modes} if service_modes else {}),
        "steps": [safety, *steps],
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
    pin_details: list[dict] | None = None,
) -> dict:
    test_point: dict = {"connector": connector, "pins": pins, "label": title}
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


def pin_detail(
    pin: str,
    signal: str,
    wire: str | None = None,
    confidence: str = "verified",
) -> dict:
    detail: dict = {"pin": pin, "signal": signal}
    if wire:
        detail["wireColor"] = wire
        detail["wireColorConfidence"] = confidence
    return detail


# W11169652 ACU pinout + strip-circuit wire colors (manual pp. 3-7, 3-12–3-26)
PIN_RFI_LINE = [
    pin_detail("Line", "Filter input — cord line", "BK", "verified"),
    pin_detail("Neutral", "Filter input — cord neutral", "WT", "verified"),
]
PIN_J2_AC = [
    pin_detail("1", "LINE input", "BK", "verified"),
    pin_detail("2", "Neutral input", "WT", "verified"),
]
PIN_J19_5V = [
    pin_detail("2", "5V_UI", "BU", "inferred"),
    pin_detail("4", "DGND", "BK", "inferred"),
]
PIN_J19_12V = [
    pin_detail("1", "12.7_Lim_UI", "RD", "inferred"),
    pin_detail("4", "DGND", "BK", "inferred"),
]
PIN_J16_DRUM = [
    pin_detail("1", "Drum light +", "R", "verified"),
    pin_detail("3", "Drum light −", "BK", "verified"),
]
PIN_J8_C1 = [
    pin_detail("1", "Valves line (L)", "BK", "verified"),
    pin_detail("2", "Cold 1 EV −", "W", "verified"),
]
PIN_J14_APS_5V = [
    pin_detail("2", "APS GND", "BK", "inferred"),
    pin_detail("3", "+5 VDC Vcc", "R", "inferred"),
]
PIN_J15_WASH_NTC = [
    pin_detail("1", "5V switched", "BK", "verified"),
    pin_detail("3", "Wash NTC", "BK", "verified"),
]
PIN_J10_PUMP = [
    pin_detail("1", "Dosing pump N", "Y", "verified"),
    pin_detail("3", "Dosing pump L", "R", "verified"),
]
PIN_LEVEL_SW = [
    pin_detail("1", "Level switch", "BK", "verified"),
    pin_detail("2", "Level switch return", "BU", "verified"),
]
PIN_J12_VENT_FAN = [
    pin_detail("1", "Vent fan L", "BR", "verified"),
    pin_detail("2", "Vent fan N", "W", "verified"),
]
PIN_J9_BAFFLE = [
    pin_detail("1", "Baffle solenoid L", "BK", "verified"),
    pin_detail("2", "Baffle solenoid N", "BK", "verified"),
]
PIN_J4_DRY_HEATER = [
    pin_detail("1", "Dry heater L", "BK", "verified"),
    pin_detail("2", "Dry heater N", "W", "verified"),
]
PIN_J13_DRY_NTC = [
    pin_detail("1", "5V switched", "BK", "verified"),
    pin_detail("3", "Dry NTC output", "BK", "verified"),
]
PIN_DRY_NTC_SENSOR = [
    pin_detail("1", "Dry NTC", "BK", "verified"),
    pin_detail("2", "Dry NTC return", "BK", "verified"),
]
PIN_BLOWER_MOTOR = [
    pin_detail("1", "Blower L", "BR", "verified"),
    pin_detail("2", "Blower N", "W", "verified"),
]


def instr(sid: str, order: int, title: str, body: str, nxt: str | None = None, excerpt: str = "") -> dict:
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


def visual(sid: str, order: int, title: str, body: str, branches: list[dict], excerpt: str = "") -> dict:
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


def outcome(sid: str, order: int, title: str, text: str) -> dict:
    return {
        "id": sid,
        "order": order,
        "type": "outcome",
        "title": title,
        "oemOutcome": text,
        "requiresInput": False,
    }


def ohm_branches(prefix: str, pass_next: str, fail_next: str, pass_label: str = "In range") -> list[dict]:
    return [
        {"id": f"{prefix}_open", "label": "Open circuit (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next},
        {"id": f"{prefix}_crit", "label": "Critical out of range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


PROCEDURES = [
    proc(
        "w11169652-test-01-acu-power",
        "TEST #1: ACU Power Check",
        "1",
        "ACU Power Check",
        [44, 45],
        ["supply"],
        ["voltage_check", "supply_issue", "F3E1", "error_code"],
        [
            instr("access_electronics", 2, "Access machine electronics", "Remove the top panel. Visually verify all RFI filter and ACU connections are fully seated.", "visual_if_acu"),
            visual(
                "visual_if_acu",
                3,
                "RFI filter and ACU connections OK",
                "Are all interference filter and ACU harness connections secure and fully inserted?",
                [
                    {"id": "vis_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "restore_power_line"},
                    {"id": "vis_bad", "label": "Loose or damaged connection", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_connections", "terminal": True, "oemOutcome": "Repair or reconnect loose harness/connector terminals, then repeat TEST #1."},
                ],
            ),
            instr("restore_power_line", 4, "Restore power for voltage checks", "Plug in or reconnect power for live voltage measurements only. Use needle probes on connectors.", "line_if_input"),
            meas(
                "line_if_input",
                5,
                "Line voltage at RFI filter input",
                "With AC voltmeter, measure line voltage at the interference filter input (power cord side).",
                "supplyVoltage120",
                "RFI",
                "Line in",
                [
                    {"id": "line_in_ok", "label": "Line voltage present", "when": {"kind": "measurement_normal"}, "nextStepId": "line_if_output"},
                    {"id": "line_in_bad", "label": "No line voltage", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_cord", "terminal": True, "oemOutcome": "Verify outlet and cord continuity; replace power cord if cord fails continuity check."},
                    {"id": "line_in_warn", "label": "Low/out of range voltage", "when": {"kind": "measurement_warning"}, "nextStepId": "replace_cord", "terminal": True, "oemOutcome": "Correct supply voltage issue or replace power cord before further ACU testing."},
                ],
                pin_details=PIN_RFI_LINE,
            ),
            meas(
                "line_if_output",
                6,
                "Line voltage at RFI filter output",
                "Measure AC line voltage at the interference filter output toward the ACU.",
                "supplyVoltage120",
                "RFI",
                "Line out",
                [
                    {"id": "line_out_ok", "label": "Line voltage present", "when": {"kind": "measurement_normal"}, "nextStepId": "line_j2"},
                    {"id": "line_out_bad", "label": "No voltage at output", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_rfi", "terminal": True, "oemOutcome": "Replace the interference (RFI) filter."},
                    {"id": "line_out_warn", "label": "Out of range", "when": {"kind": "measurement_warning"}, "nextStepId": "replace_rfi", "terminal": True, "oemOutcome": "Replace the interference (RFI) filter."},
                ],
                pin_details=PIN_RFI_LINE,
            ),
            meas(
                "line_j2",
                7,
                "AC input at ACU J2 pins 1 & 2",
                "Measure AC line voltage across J2 pins 1 (LINE) and 2 (Neutral) at the ACU with IF connected.",
                "supplyVoltage120",
                "J2",
                "1 & 2",
                [
                    {"id": "j2_ok", "label": "Line voltage at ACU", "when": {"kind": "measurement_normal"}, "nextStepId": "acu_led_status"},
                    {"id": "j2_bad", "label": "No voltage at J2", "when": {"kind": "measurement_critical"}, "nextStepId": "repair_j2_harness", "terminal": True, "oemOutcome": "Inspect harness between RFI filter and ACU J2; repair bent terminals or replace harness."},
                ],
                pin_details=PIN_J2_AC,
            ),
            visual(
                "acu_led_status",
                8,
                "ACU service LED healthy",
                "After power-up, does the ACU status LED blink slowly (0.5s on/off) within 30 seconds? (Not off, not rapid constant blink.)",
                [
                    {"id": "led_ok", "label": "LED blinks slowly", "when": {"kind": "checkpoint_yes"}, "nextStepId": "hmi_5v"},
                    {"id": "led_bad", "label": "LED off or not slow-blinking", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_led", "terminal": True, "oemOutcome": "Replace the ACU — microcontroller or 5 VDC supply fault indicated."},
                ],
            ),
            meas(
                "hmi_5v",
                9,
                "HMI 5 VDC at J19 pins 2 & 4",
                "Verify 5 VDC between J19 pin 2 (+5V_UI) and pin 4 (DGND).",
                "whirlpoolFlWasherHmi5Vdc",
                "J19",
                "2 & 4",
                [
                    {"id": "hmi5_ok", "label": "5 VDC present", "when": {"kind": "measurement_normal"}, "nextStepId": "hmi_12v"},
                    {"id": "hmi5_bad", "label": "5 VDC missing", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_acu_hmi", "terminal": True, "oemOutcome": "Replace ACU — HMI supply fault."},
                ],
                pin_details=PIN_J19_5V,
            ),
            meas(
                "hmi_12v",
                10,
                "HMI 12 VDC at J19 pins 1 & 4",
                "Verify 12 VDC between J19 pin 1 (12.7_Lim_UI) and pin 4 (DGND).",
                "whirlpoolFlWasherHmi12Vdc",
                "J19",
                "1 & 4",
                [
                    {"id": "hmi12_ok", "label": "12 VDC present", "when": {"kind": "measurement_normal"}, "nextStepId": "power_verified"},
                    {"id": "hmi12_bad", "label": "12 VDC missing", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_acu_hmi", "terminal": True, "oemOutcome": "Replace ACU — HMI supply fault."},
                ],
                pin_details=PIN_J19_12V,
            ),
            outcome("power_verified", 11, "ACU power verified", "Incoming power, ACU LED, and HMI supplies verified — problem is likely downstream. Reassemble and verify with Quick Service Cycle."),
            outcome("repair_connections", 12, "Repair connections", "Secure all IF and ACU connections, then repeat TEST #1."),
            outcome("replace_cord", 13, "Replace power cord", "Replace power cord or correct outlet supply, then repeat TEST #1."),
            outcome("replace_rfi", 14, "Replace RFI filter", "Replace interference filter and retest."),
            outcome("repair_j2_harness", 15, "Repair J2 harness", "Repair harness between filter and ACU J2."),
            outcome("replace_acu_led", 16, "Replace ACU", "Replace ACU per service LED fault indication."),
            outcome("replace_acu_hmi", 17, "Replace ACU", "Replace ACU — HMI voltage supply failure."),
        ],
    ),
    proc(
        "w11169652-test-02-hmi",
        "TEST #2: Human-Machine Interface (HMI)",
        "2",
        "Human-Machine Interface",
        [46, 47],
        ["hmi_control"],
        ["hmi_check", "error_code", "F3E1"],
        [
            visual(
                "ui_variant",
                2,
                "Identify HMI type",
                "Is this an LCD-in-door model (display in door) or a console model (controls on top panel)?",
                [
                    {"id": "ui_lcd", "label": "LCD in door", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lcd_visual_acu"},
                    {"id": "ui_console", "label": "Console model", "when": {"kind": "checkpoint_no"}, "nextStepId": "console_symptom"},
                ],
                "TEST #2A LCD in door vs TEST #2B console models.",
            ),
            instr("lcd_visual_acu", 3, "LCD model — visual checks", "Remove top panel. Verify ACU connectors, HMI connectors, and door harness are fully seated.", "lcd_test1"),
            visual(
                "lcd_test1",
                4,
                "LCD — all connections seated",
                "Are ACU, HMI, and door harness connections fully inserted?",
                [
                    {"id": "lcd_vis_ok", "label": "All seated", "when": {"kind": "checkpoint_yes"}, "nextStepId": "lcd_acu_power"},
                    {"id": "lcd_vis_bad", "label": "Connection issue found", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_hmi_wiring", "terminal": True, "oemOutcome": "Reconnect harnesses and repeat HMI test."},
                ],
            ),
            visual(
                "lcd_acu_power",
                5,
                "LCD — TEST #1 voltages and LED OK",
                "After TEST #1 ACU Power Check: are HMI 5V/12V present and ACU LED healthy?",
                [
                    {"id": "lcd_pwr_ok", "label": "Supplies OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_hmi_lcd", "terminal": True, "oemOutcome": "Replace HMI and housing assembly; verify with HMI test."},
                    {"id": "lcd_pwr_bad", "label": "Supplies or LED failed", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_hmi", "terminal": True, "oemOutcome": "Replace ACU — supply voltages not present or microcontroller fault."},
                ],
            ),
            visual(
                "console_symptom",
                3,
                "Console symptom category",
                "Primary symptom: display/indicators completely off (no partial buttons)?",
                [
                    {"id": "console_dead", "label": "Nothing lights / no display", "when": {"kind": "checkpoint_yes"}, "nextStepId": "console_dead_checks"},
                    {"id": "console_partial", "label": "Some buttons or beep issue", "when": {"kind": "checkpoint_no"}, "nextStepId": "console_partial_checks"},
                ],
            ),
            instr("console_dead_checks", 4, "Console — access and inspect", "Remove top panel and console assembly (do not strain wires). Verify ACU and HMI connectors fully seated.", "console_dead_test1"),
            visual(
                "console_dead_test1",
                5,
                "Console dead — TEST #1 passed",
                "After TEST #1: HMI supplies present and ACU LED blinking slowly?",
                [
                    {"id": "cde_ok", "label": "TEST #1 passed", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_hmi_console", "terminal": True, "oemOutcome": "Replace HMI and housing assembly."},
                    {"id": "cde_bad", "label": "TEST #1 failed", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_hmi", "terminal": True, "oemOutcome": "Replace ACU — LED off or supplies missing."},
                ],
            ),
            instr("console_partial_checks", 4, "Console — partial UI / beep", "Verify HMI seated in console. Check Use & Care for muted button sounds.", "replace_hmi_partial", excerpt="Some buttons do not light / no beep — replace HMI and housing if visual checks pass."),
            outcome("replace_hmi_partial", 5, "Replace HMI assembly", "Replace HMI and housing assembly; run HMI test to verify."),
            outcome("replace_hmi_lcd", 6, "Replace LCD HMI", "Replace HMI and housing assembly; run HMI test."),
            outcome("replace_hmi_console", 6, "Replace console HMI", "Replace HMI and housing assembly; run HMI test."),
            outcome("repair_hmi_wiring", 7, "Repair HMI wiring", "Repair connector issues and retest."),
            outcome("replace_acu_hmi", 8, "Replace ACU", "Replace ACU when HMI supplies or microcontroller fault confirmed."),
        ],
    ),
    proc(
        "w11169652-test-05-drum-light",
        "TEST #5: Drum Light",
        "5",
        "Drum Light",
        [50, 51],
        ["supply"],
        ["voltage_check"],
        [
            instr("access_j16", 2, "Access ACU J16", "Remove top panel. Verify drum light connector J16 is secure at ACU and drum light harness.", "j16_ok"),
            visual(
                "j16_ok",
                3,
                "J16 and harness OK",
                "Are J16 and drum light harness connections secure?",
                [
                    {"id": "j16_yes", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "unplug_drum_light"},
                    {"id": "j16_no", "label": "Harness issue", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_drum_harness", "terminal": True, "oemOutcome": "Repair or replace drum light harness, then retest."},
                ],
            ),
            instr("unplug_drum_light", 4, "Unplug drum light", "Unplug drum light from harness at ACU side. Restore power for voltage check.", "drum_light_v"),
            meas(
                "drum_light_v",
                5,
                "Drum light driver J16 pins 1 & 3",
                "Measure VDC across J16 pins 1 and 3 with drum light disconnected. Expected 2.9–3.5 VDC.",
                "whirlpoolFlWasherDrumLightVdc",
                "J16",
                "1 & 3",
                [
                    {"id": "dl_v_ok", "label": "2.9–3.5 VDC", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_drum_led", "terminal": True, "oemOutcome": "Replace drum LED — driver voltage present."},
                    {"id": "dl_v_bad", "label": "Voltage not present", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_acu_drum", "terminal": True, "oemOutcome": "Replace ACU — drum light driver fault."},
                ],
                pin_details=PIN_J16_DRUM,
            ),
            outcome("replace_drum_led", 6, "Replace drum LED", "Replace drum LED assembly."),
            outcome("replace_acu_drum", 7, "Replace ACU", "Replace ACU when driver voltage missing."),
            outcome("repair_drum_harness", 8, "Repair harness", "Repair drum light harness connections."),
        ],
    ),
    proc(
        "w11169652-test-06-inlet-valves",
        "TEST #6: Water Inlet Valves",
        "6",
        "Water Inlet Valves",
        [51, 52],
        ["inlet_valve"],
        ["water_valve_check", "fill_issue", "no_fill", "F8E1"],
        [
            instr("qsc_assumed_fail", 2, "Live valve test failed", "This procedure continues after Quick Service Cycle / load test did not activate the suspect valve.", "access_j8"),
            instr("access_j8", 3, "Disconnect J8 at ACU", "Remove top panel. Disconnect connector J8. Verify harness continuity to valve coils.", "valve_ohms"),
            meas(
                "valve_ohms",
                4,
                "Inlet valve coil resistance",
                "Measure coil resistance: C1 J8-1&2, C2 J8-1&3, Hot J8-1&5. Expected 1.1–1.35 kΩ each.",
                "whirlpoolFlWasherInletValveOhms",
                "J8",
                "1 & 2 (C1)",
                ohm_branches("valve", "reconnect_j8", "replace_valve", "1.1–1.35 kΩ"),
                pin_details=PIN_J8_C1,
            ),
            instr("reconnect_j8", 5, "Reconnect J8", "Reconnect J8 to ACU. Restore power for live activation test via QSC/load test.", "live_valve_test"),
            visual(
                "live_valve_test",
                6,
                "Valve energizes with line voltage",
                "During load test or component activation, does the suspect valve receive line voltage and open?",
                [
                    {"id": "lv_yes", "label": "Voltage present, valve opens", "when": {"kind": "checkpoint_yes"}, "nextStepId": "valve_verified"},
                    {"id": "lv_no_volt", "label": "No line voltage at valve", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_acu_valve", "terminal": True, "oemOutcome": "Replace ACU — no drive voltage to valve."},
                ],
            ),
            outcome("replace_valve", 7, "Replace valve assembly", "Replace inlet valve assembly when coil open or out of range."),
            outcome("valve_verified", 8, "Valve verified", "Valve operates — reassemble and verify with Quick Service Cycle."),
            outcome("replace_acu_valve", 9, "Replace ACU", "Replace ACU when ohms good but no activation voltage."),
        ],
        [{"bundleId": "w11169652-service-mode", "modeKind": "combined_qsc", "attachAfterStepId": "reconnect_j8", "continueToStepId": "live_valve_test"}],
    ),
    proc(
        "w11169652-test-07-water-level-sensor",
        "TEST #7: Water Level Sensor",
        "7",
        "Water Level Sensor",
        [52, 53],
        ["water_level_sensor"],
        ["fill_issue", "F8E1", "no_fill"],
        [
            visual(
                "hose_trap_ok",
                2,
                "Air trap and pressure hose clear",
                "Are tub-to-trap, trap-to-hose, and hose-to-APS connections secure with no kinks, leaks, or debris?",
                [
                    {"id": "hose_ok", "label": "Plumbing path OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "access_j14"},
                    {"id": "hose_bad", "label": "Hose/trap issue", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_hose_trap", "terminal": True, "oemOutcome": "Clear hose/air trap, repair routing, replace leaking hose; retest fill."},
                ],
            ),
            instr("access_j14", 3, "Verify J14 at ACU", "Remove top/rear access as needed. Verify J14 fully seated and APS harness connected.", "j14_continuity"),
            visual(
                "j14_continuity",
                4,
                "Harness continuity ACU to APS",
                "Is there continuity in the harness between ACU J14 and the water level sensor?",
                [
                    {"id": "cont_yes", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "aps_5v_power"},
                    {"id": "cont_no", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_aps_harness", "terminal": True, "oemOutcome": "Repair or replace harness between ACU and APS."},
                ],
            ),
            instr("aps_5v_power", 5, "Restore power for APS supply", "Plug in washer for DC measurement at J14.", "aps_5v"),
            meas(
                "aps_5v",
                6,
                "+5 VDC at J14 (pin 2 GND, pin 3 Vcc)",
                "Black probe to J14 pin 2 (GND), red to pin 3. Expect +5 VDC.",
                "whirlpoolFlWasherAps5Vdc",
                "J14",
                "2 & 3",
                [
                    {"id": "aps5_ok", "label": "+5 VDC present", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_aps", "terminal": True, "oemOutcome": "Drain tub, replace water level sensor (APS)."},
                    {"id": "aps5_bad", "label": "+5 VDC missing", "when": {"kind": "measurement_critical"}, "nextStepId": "run_test1_aps", "terminal": True, "oemOutcome": "Perform TEST #1 ACU Power Check; replace ACU if supply fault persists."},
                ],
                pin_details=PIN_J14_APS_5V,
            ),
            outcome("clear_hose_trap", 7, "Clear air trap/hose", "Service pressure hose and air trap; retest."),
            outcome("repair_aps_harness", 8, "Repair APS harness", "Repair harness continuity fault."),
            outcome("replace_aps", 9, "Replace water level sensor", "Replace APS after confirming tub drained."),
            outcome("run_test1_aps", 10, "Run TEST #1", "Correct ACU supply per TEST #1."),
        ],
    ),
    proc(
        "w11169652-test-10-wash-temp-sensor",
        "TEST #10: Wash Temperature Sensor",
        "10",
        "Wash Temperature Sensor",
        [55, 56],
        ["wash_ntc"],
        ["thermistor", "F4E1", "no_heat"],
        [
            instr("disconnect_j15", 2, "Disconnect J15 at ACU", "Remove top panel. Disconnect wash temperature sensor connector J15 from ACU.", "j15_ntc"),
            meas(
                "j15_ntc",
                3,
                "Wash NTC J15 pins 1 & 3",
                "Measure resistance across J15 pins 1 and 3. Compare to OEM thermistor table at ambient temperature (~20 kΩ @ 77°F).",
                "whirlpoolFlWasherWashNtcOhms",
                "J15",
                "1 & 3",
                ohm_branches("j15", "suspect_acu_ntc", "access_ntc_sensor", "Within R/T table range"),
                pin_details=PIN_J15_WASH_NTC,
            ),
            instr("access_ntc_sensor", 4, "Access wash NTC at heater bracket", "Remove back panel. Disconnect wash temperature sensor at heating element bracket.", "ntc_at_sensor"),
            meas(
                "ntc_at_sensor",
                5,
                "Wash NTC at sensor terminals",
                "Measure resistance at the temperature sensor terminals on the heater bracket.",
                "whirlpoolFlWasherWashNtcOhms",
                "Wash NTC",
                "Sensor pins",
                [
                    {"id": "ntc_open", "label": "Open", "when": {"kind": "measurement_open"}, "nextStepId": "replace_wash_ntc", "terminal": True, "oemOutcome": "Replace wash temperature sensor."},
                    {"id": "ntc_bad", "label": "Out of range", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_wash_ntc", "terminal": True, "oemOutcome": "Replace wash temperature sensor."},
                    {"id": "ntc_good", "label": "In range at sensor", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_lower_harness_ntc", "terminal": True, "oemOutcome": "Sensor good — replace lower main harness."},
                ],
                pin_details=PIN_J15_WASH_NTC,
            ),
            outcome("replace_wash_ntc", 6, "Replace wash NTC", "Replace wash temperature sensor; verify with QSC."),
            outcome("replace_lower_harness_ntc", 7, "Replace lower harness", "Replace lower main harness between ACU and sensor."),
            outcome("suspect_acu_ntc", 8, "Replace ACU", "NTC and harness good at J15 — replace ACU if fault persists."),
        ],
    ),
    proc(
        "w11169652-test-11a-single-dose-dispenser",
        "TEST #11A: Single Dose Dispenser",
        "11A",
        "Single Dose Dispenser",
        [56, 57],
        ["dosing_pump"],
        ["dispenser_check", "fill_issue"],
        [
            visual("water_supply", 2, "Water supply and drawer", "Are house water supply, fill hoses, and dispenser drawer clear of clogs?", [
                {"id": "ws_ok", "label": "Supply and drawer OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "valves_via_test6"},
                {"id": "ws_bad", "label": "Clog or supply issue", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_dispenser", "terminal": True, "oemOutcome": "Clear clogged drawer/chambers and verify water supply."},
            ]),
            visual("valves_via_test6", 3, "Inlet valves operate (TEST #6)", "Did TEST #6 confirm Cold 1, Cold 2, and Hot valves operate for detergent/bleach/softener paths?", [
                {"id": "v6_ok", "label": "Valves OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_dispenser_asm", "terminal": True, "oemOutcome": "Replace dispensing system — valves functional but dispense fails."},
                {"id": "v6_bad", "label": "Valve fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "run_test6", "terminal": True, "oemOutcome": "Complete TEST #6 Water Inlet Valves first."},
            ]),
            outcome("clear_dispenser", 4, "Service dispenser", "Clean drawer and verify water paths."),
            outcome("run_test6", 5, "Run TEST #6", "Repair inlet valves per TEST #6."),
            outcome("replace_dispenser_asm", 6, "Replace dispenser", "Replace single-dose dispensing system."),
        ],
    ),
    proc(
        "w11169652-test-11b-dosing-pump",
        "TEST #11B: Optimal Dosing Pump",
        "11B",
        "Optimal Dosing Pump",
        [57, 58],
        ["dosing_pump"],
        ["dispenser_check"],
        [
            visual("reservoir_clear", 2, "Reservoir not clogged", "Are dosing reservoirs clean and free of hardened detergent?", [
                {"id": "res_ok", "label": "Reservoirs clear", "when": {"kind": "checkpoint_yes"}, "nextStepId": "access_j10"},
                {"id": "res_bad", "label": "Clogged", "when": {"kind": "checkpoint_no"}, "nextStepId": "clean_reservoir", "terminal": True, "oemOutcome": "Remove and rinse reservoirs with hot water; retest."},
            ]),
            instr("access_j10", 3, "Verify J10 and pump harness", "Remove top panel. Verify J10 seated and dosing pump harness secure at metering bracket.", "pump_continuity"),
            visual("pump_continuity", 4, "Harness continuity to pump", "Is there continuity between ACU J10 and dosing pump connector?", [
                {"id": "pc_yes", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pump_ohms"},
                {"id": "pc_no", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_pump", "terminal": True, "oemOutcome": "Replace lower harness and retest."},
            ]),
            meas("pump_ohms", 5, "Dosing pump pins 1 & 3", "Disconnect pump connector. Measure ohms across pins 1 and 3. Expected 1.6–1.96 kΩ.", "whirlpoolFlWasherDosingPumpOhms", "J10", "Pump 1 & 3", ohm_branches("pump", "replace_acu_pump", "replace_pump", "1.6–1.96 kΩ"), pin_details=PIN_J10_PUMP),
            outcome("clean_reservoir", 6, "Clean reservoirs", "Clean clogged reservoirs and retest QSC."),
            outcome("replace_lower_harness_pump", 7, "Replace lower harness", "Replace lower harness between ACU and pump."),
            outcome("replace_pump", 8, "Replace dosing pump", "Replace dosing pump when open or out of range."),
            outcome("replace_acu_pump", 9, "Replace ACU", "Pump ohms good but no dispense — replace ACU."),
        ],
    ),
    proc(
        "w11169652-test-12a-bulk-dispenser",
        "TEST #12A: Drawer Bulk Dispenser",
        "12A",
        "Drawer Bulk Dispenser",
        [58, 59],
        ["bulk_level_switch"],
        ["dispenser_check"],
        [
            visual("tanks_clear", 2, "Dispenser tanks and docking clean", "Are bulk tanks, docking interfaces, hoses, and recirc nozzle free of clogs/kinks?", [
                {"id": "tanks_ok", "label": "Mechanical path OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "refer_pump_test"},
                {"id": "tanks_bad", "label": "Clog/kink found", "when": {"kind": "checkpoint_no"}, "nextStepId": "service_bulk_path", "terminal": True, "oemOutcome": "Clean tanks, hoses, nozzle; verify drain/recirc path."},
            ]),
            visual("refer_pump_test", 3, "Dosing pump electrical (J10)", "Run dosing pump ohms/test per TEST #11B / pump section of TEST #12A.", [
                {"id": "pump_ok", "label": "Pump circuit OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "bulk_verified"},
                {"id": "pump_bad", "label": "Pump/harness fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "run_11b", "terminal": True, "oemOutcome": "Complete TEST #11B dosing pump procedure."},
            ]),
            outcome("service_bulk_path", 4, "Service bulk dispenser path", "Clear mechanical faults in bulk dispense system."),
            outcome("run_11b", 5, "Run TEST #11B", "Repair dosing pump per TEST #11B."),
            outcome("bulk_verified", 6, "Bulk dispense verified", "Mechanical and pump checks pass — verify with Quick Service Cycle."),
        ],
    ),
    proc(
        "w11169652-test-12b-bulk-level-sensing",
        "TEST #12B: Bulk Dispenser Level Sensing",
        "12B",
        "Bulk Dispenser Level Sensing",
        [59, 60],
        ["bulk_level_switch"],
        ["dispenser_check"],
        [
            visual("float_ok", 2, "Reservoir float moves freely", "With reservoir empty, does float move freely when rotated? Fill with water to test.", [
                {"id": "float_yes", "label": "Float OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "access_j17"},
                {"id": "float_no", "label": "Float stuck/damaged", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_reservoir", "terminal": True, "oemOutcome": "Replace bulk dispenser reservoir — not serviceable."},
            ]),
            instr("access_j17", 3, "Verify J17 at ACU", "Remove top panel. Verify J17 fully seated at ACU.", "j17_continuity"),
            visual("j17_continuity", 4, "Harness continuity to level sensors", "Continuity from ACU J17 to level sensor connectors?", [
                {"id": "j17_yes", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "level_open"},
                {"id": "j17_no", "label": "Harness open", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_lower_harness_lvl", "terminal": True, "oemOutcome": "Replace lower harness."},
            ]),
            visual("level_open", 5, "Level sensor open without magnet", "With reservoir removed, sensor reads open across pins 1 & 2?", [
                {"id": "open_yes", "label": "Open at rest", "when": {"kind": "checkpoint_yes"}, "nextStepId": "magnet_close"},
                {"id": "open_no", "label": "Not open at rest", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_level_sensor", "terminal": True, "oemOutcome": "Replace level sensor."},
            ]),
            meas("magnet_close", 6, "Sensor closes with magnet (<3 Ω)", "Place magnet over sensor cavity while measuring pins 1 & 2. Should read less than 3 Ω.", "whirlpoolFlWasherBulkLevelSwitchClosedOhms", "J17", "Level SW 1 & 2", [
                {"id": "mag_ok", "label": "<3 Ω with magnet", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_acu_level", "terminal": True, "oemOutcome": "Sensor good — replace ACU if level still not detected."},
                {"id": "mag_bad", "label": "Stays open", "when": {"kind": "measurement_open"}, "nextStepId": "replace_level_sensor", "terminal": True, "oemOutcome": "Replace level sensor."},
                {"id": "mag_crit", "label": "Out of range", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_level_sensor", "terminal": True, "oemOutcome": "Replace level sensor."},
            ], pin_details=PIN_LEVEL_SW),
            outcome("replace_reservoir", 7, "Replace reservoir", "Replace bulk dispenser reservoir."),
            outcome("replace_lower_harness_lvl", 8, "Replace lower harness", "Replace lower harness to level sensors."),
            outcome("replace_level_sensor", 9, "Replace level sensor", "Replace detergent or softener level sensor."),
            outcome("replace_acu_level", 10, "Replace ACU", "Replace ACU when sensor and harness verified."),
        ],
    ),
    proc(
        "w11169652-test-13-vent-fan",
        "TEST #13: Vent Fan Motor",
        "13",
        "Vent Fan Motor",
        [60, 61],
        ["vent_fan"],
        ["vent_fan_check"],
        [
            visual("vent_clear", 2, "Rear vent unobstructed", "Is rear vent free of obstruction preventing fan spin?", [
                {"id": "vent_ok", "label": "Vent clear", "when": {"kind": "checkpoint_yes"}, "nextStepId": "access_j12_fan"},
                {"id": "vent_bad", "label": "Obstructed", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_vent", "terminal": True, "oemOutcome": "Clear vent obstruction and retest component activation."},
            ]),
            instr("access_j12_fan", 3, "Verify J12 and fan harness", "Remove top panel. Verify J12 seated and vent fan harness connected.", "fan_continuity"),
            visual("fan_continuity", 4, "Harness continuity to vent fan", "Continuity between ACU J12 and vent fan?", [
                {"id": "fc_yes", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "fan_ohms"},
                {"id": "fc_no", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_upper_harness_fan", "terminal": True, "oemOutcome": "Replace upper machine harness."},
            ]),
            meas("fan_ohms", 5, "Vent fan motor resistance", "Measure across fan motor terminals. Expected 1.78–2.3 kΩ.", "whirlpoolFlWasherVentFanOhms", "J12", "Motor 1 & 2", ohm_branches("fan", "replace_acu_fan", "replace_vent_fan", "1.78–2.3 kΩ"), pin_details=PIN_J12_VENT_FAN),
            outcome("clear_vent", 6, "Clear vent", "Remove vent obstruction."),
            outcome("replace_upper_harness_fan", 7, "Replace upper harness", "Replace upper harness J12 to fan."),
            outcome("replace_vent_fan", 8, "Replace vent fan", "Replace vent fan assembly."),
            outcome("replace_acu_fan", 9, "Replace ACU", "Fan ohms in range but does not run — replace ACU."),
        ],
    ),
    proc(
        "w11169652-test-14-vent-baffle",
        "TEST #14: Vent Baffle Solenoid",
        "14",
        "Vent Baffle Solenoid",
        [61, 62],
        ["vent_baffle"],
        ["vent_fan_check"],
        [
            visual("baffle_clear", 2, "Vent/baffle unobstructed", "Rear vent and baffle path clear?", [
                {"id": "baf_ok", "label": "Clear", "when": {"kind": "checkpoint_yes"}, "nextStepId": "access_j9"},
                {"id": "baf_bad", "label": "Obstructed", "when": {"kind": "checkpoint_no"}, "nextStepId": "clear_baffle_vent", "terminal": True, "oemOutcome": "Clear obstruction and retest."},
            ]),
            instr("access_j9", 3, "Verify J9 at ACU", "Remove top panel. Verify J9 seated and solenoid harness connected.", "solenoid_continuity"),
            visual("solenoid_continuity", 4, "Harness continuity to solenoid", "Continuity between ACU and vent baffle solenoid?", [
                {"id": "sol_yes", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "solenoid_ohms"},
                {"id": "sol_no", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_upper_harness_baffle", "terminal": True, "oemOutcome": "Replace upper machine harness."},
            ]),
            meas("solenoid_ohms", 5, "Baffle solenoid resistance", "Measure across solenoid terminals. Should be less than 10 MΩ (not open).", "whirlpoolFlWasherVentBaffleSolenoidOhms", "J9", "1 & 2", ohm_branches("baffle", "replace_acu_baffle", "replace_baffle_solenoid", "<10 MΩ"), pin_details=PIN_J9_BAFFLE),
            outcome("clear_baffle_vent", 6, "Clear vent", "Clear vent/baffle obstruction."),
            outcome("replace_upper_harness_baffle", 7, "Replace upper harness", "Replace upper harness to solenoid."),
            outcome("replace_baffle_solenoid", 8, "Replace solenoid", "Replace vent baffle solenoid when open."),
            outcome("replace_acu_baffle", 9, "Replace ACU", "Solenoid good but does not activate — replace ACU."),
        ],
    ),
    proc(
        "w11169652-test-15-dry-heater",
        "TEST #15: Dry Heating Element",
        "15",
        "Dry Heating Element",
        [62, 63],
        ["dry_heater"],
        ["heating_element_check", "dry_heat", "no_heat"],
        [
            instr("disconnect_j4", 2, "Disconnect J4 at ACU", "Remove top panel. Disconnect dry heater connector J4 from ACU.", "heater_variant"),
            visual("heater_variant", 3, "Dry heater wattage variant", "Which dry heater is equipped: 1100 W (~12.3–13.6 Ω) or 450 W (~30–35 Ω)?", [
                {"id": "hv_1100", "label": "1100 W heater", "when": {"kind": "checkpoint_yes"}, "nextStepId": "j4_1100"},
                {"id": "hv_450", "label": "450 W heater", "when": {"kind": "checkpoint_no"}, "nextStepId": "j4_450"},
            ]),
            meas("j4_1100", 4, "Dry heater J4 — 1100 W", "Measure J4 pins 1 & 2. Expected 12.32–13.6 Ω.", "whirlpoolFlWasherDryHeater1100WOms", "J4", "1 & 2", ohm_branches("dh1100", "dry_heater_good", "access_dry_heater", "12.32–13.6 Ω"), pin_details=PIN_J4_DRY_HEATER),
            meas("j4_450", 4, "Dry heater J4 — 450 W", "Measure J4 pins 1 & 2. Expected 30.1–34.9 Ω.", "whirlpoolFlWasherDryHeater450WOms", "J4", "1 & 2", ohm_branches("dh450", "dry_heater_good", "access_dry_heater", "30.1–34.9 Ω"), pin_details=PIN_J4_DRY_HEATER),
            instr("access_dry_heater", 5, "Access dry heater element", "Access dry heating element. Disconnect wires at element terminals.", "dry_heater_at_element"),
            visual("dry_heater_at_element", 6, "Element ohms at terminals", "Measure element terminals — in range for your heater wattage variant?", [
                {"id": "de_ok", "label": "In range at element", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_upper_harness_dh", "terminal": True, "oemOutcome": "Element good — check harness continuity J4 to element; replace upper harness if open."},
                {"id": "de_bad", "label": "Open/out of range", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_heater_channel", "terminal": True, "oemOutcome": "Replace Heater Channel Assembly (dry heater not separately serviceable)."},
            ]),
            outcome("dry_heater_good", 7, "Dry heater circuit OK", "J4 resistance in range — if heat fault persists, replace ACU."),
            outcome("replace_upper_harness_dh", 8, "Replace upper harness", "Replace upper harness to dry heater."),
            outcome("replace_heater_channel", 9, "Replace heater channel", "Replace Heater Channel Assembly."),
        ],
    ),
    proc(
        "w11169652-test-16-dry-temp-sensor",
        "TEST #16: Dry Temperature Sensor",
        "16",
        "Dry Temperature Sensor",
        [63, 64],
        ["dry_ntc"],
        ["thermistor", "dry_heat"],
        [
            instr("disconnect_j13", 2, "Disconnect J13 at ACU", "Empty washer at ambient temp. Disconnect dry NTC connector J13 from ACU.", "j13_ntc"),
            meas("j13_ntc", 3, "Dry NTC J13 pins 1 & 3", "Measure resistance J13 pins 1 & 3. Compare to OEM thermistor table (~20 kΩ @ 77°F).", "whirlpoolFlWasherDryNtcOhms", "J13", "1 & 3", ohm_branches("j13", "suspect_acu_dry_ntc", "access_dry_ntc", "Within R/T table"), pin_details=PIN_J13_DRY_NTC),
            instr("access_dry_ntc", 4, "Access dry NTC at sensor", "Disconnect dry temperature sensor connector from NTC.", "dry_ntc_sensor"),
            meas("dry_ntc_sensor", 5, "Dry NTC at sensor pins 1 & 2", "Measure across pins 1 and 2 of dry temperature sensor.", "whirlpoolFlWasherDryNtcOhms", "Dry NTC", "1 & 2", [
                {"id": "dntc_good", "label": "In range", "when": {"kind": "measurement_normal"}, "nextStepId": "replace_main_harness_dntc", "terminal": True, "oemOutcome": "Sensor good — replace main harness."},
                {"id": "dntc_bad", "label": "Open/out of range", "when": {"kind": "measurement_open"}, "nextStepId": "replace_dry_ntc", "terminal": True, "oemOutcome": "Replace dry temperature sensor."},
                {"id": "dntc_crit", "label": "Critical", "when": {"kind": "measurement_critical"}, "nextStepId": "replace_dry_ntc", "terminal": True, "oemOutcome": "Replace dry temperature sensor."},
            ], pin_details=PIN_DRY_NTC_SENSOR),
            outcome("replace_dry_ntc", 6, "Replace dry NTC", "Replace dry temperature sensor."),
            outcome("replace_main_harness_dntc", 7, "Replace main harness", "Replace main harness between ACU and dry NTC."),
            outcome("suspect_acu_dry_ntc", 8, "Replace ACU", "NTC in range at J13 — replace ACU if fault persists."),
        ],
    ),
    proc(
        "w11169652-test-17-dry-blower",
        "TEST #17: Dry Blower Motor",
        "17",
        "Dry Blower Motor",
        [64, 65],
        ["dry_blower"],
        ["vent_fan_check", "dry_heat"],
        [
            instr("access_j12_blower", 2, "Verify J12 and blower harness", "Remove top panel. Verify J12 seated and blower motor harness secure.", "blower_continuity"),
            visual("blower_continuity", 3, "Harness continuity to blower", "Continuity between ACU J12 and blower motor?", [
                {"id": "bc_yes", "label": "Continuity OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "blower_ohms"},
                {"id": "bc_no", "label": "Open harness", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_upper_harness_blower", "terminal": True, "oemOutcome": "Replace upper machine harness."},
            ]),
            meas("blower_ohms", 4, "Blower motor resistance", "Measure across blower motor terminals. Expected 9.0–10.6 Ω.", "whirlpoolFlWasherDryBlowerOhms", "J12", "Motor 1 & 2", ohm_branches("blower", "check_blower_wheel", "replace_heater_channel_blower", "9.0–10.6 Ω"), pin_details=PIN_BLOWER_MOTOR),
            visual("check_blower_wheel", 5, "Blower wheel free", "With Heater Channel Assembly removed, does blower wheel turn freely without obstruction?", [
                {"id": "bw_ok", "label": "Turns freely", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_acu_blower", "terminal": True, "oemOutcome": "Replace ACU — motor and wheel OK but no run."},
                {"id": "bw_bad", "label": "Obstructed or seized", "when": {"kind": "checkpoint_no"}, "nextStepId": "service_blower_wheel", "terminal": True, "oemOutcome": "Clear obstruction or replace Heater Channel Assembly if wheel does not turn freely."},
            ]),
            outcome("replace_upper_harness_blower", 6, "Replace upper harness", "Replace upper harness to blower."),
            outcome("replace_heater_channel_blower", 7, "Replace heater channel", "Replace Heater Channel Assembly — motor not separately serviceable."),
            outcome("service_blower_wheel", 8, "Service blower wheel", "Remove debris or replace Heater Channel Assembly."),
            outcome("replace_acu_blower", 9, "Replace ACU", "Replace ACU and verify with Quick Service Cycle."),
        ],
    ),
]

NEW_FILES = [
    "w11169652-test-01-acu-power.json",
    "w11169652-test-02-hmi.json",
    "w11169652-test-05-drum-light.json",
    "w11169652-test-06-inlet-valves.json",
    "w11169652-test-07-water-level-sensor.json",
    "w11169652-test-10-wash-temp-sensor.json",
    "w11169652-test-11a-single-dose-dispenser.json",
    "w11169652-test-11b-dosing-pump.json",
    "w11169652-test-12a-bulk-dispenser.json",
    "w11169652-test-12b-bulk-level-sensing.json",
    "w11169652-test-13-vent-fan.json",
    "w11169652-test-14-vent-baffle.json",
    "w11169652-test-15-dry-heater.json",
    "w11169652-test-16-dry-temp-sensor.json",
    "w11169652-test-17-dry-blower.json",
]


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for item, filename in zip(PROCEDURES, NEW_FILES, strict=True):
        path = OUT / filename
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")

    attach_script = ROOT / "backend" / "scripts" / "attach_w11169652_procedure_diagrams.py"
    subprocess.run([sys.executable, str(attach_script)], check=True)

    effects_script = ROOT / "backend" / "scripts" / "attach_w11169652_diagnostic_effects.py"
    subprocess.run([sys.executable, str(effects_script)], check=True)


if __name__ == "__main__":
    main()
