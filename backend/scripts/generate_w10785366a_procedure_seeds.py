#!/usr/bin/env python3
"""Generate W10785366A (Whirlpool Connected Smart Appliances Gen III) procedure seed JSON."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_connected_smart_gen3"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_connected_smart_gen3"

SOURCE = {
    "manualId": "W10785366A",
    "manualTitle": "Whirlpool Connected Smart Appliances — Third Generation (Job Aid W10785366A)",
    "extractedTextFile": (
        "backend/docs/manuals/Job Aid - W10785366A (CA-02) smart appliances-extracted.txt"
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
        "Unplug the appliance or disconnect power before resistance checks and board access. "
        "Live voltage steps require controls off and safe access. Replace all parts and panels before operating."
    ),
    "sourceExcerpt": "Disconnect power before servicing.",
    "requiresInput": False,
}

LAUNDRY_TEMPLATES = ["washer", "electric_dryer", "gas_dryer"]
ALL_SMART_TEMPLATES = ["washer", "electric_dryer", "gas_dryer", "dishwasher", "refrigerator"]


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
        raise ValueError(f"{pid} must define steps")
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
        {"id": f"{prefix}_open", "label": "Open (OL)", "when": {"kind": "measurement_open"}, "nextStepId": fail_next},
        {"id": f"{prefix}_warn", "label": "Outside range", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next},
        {"id": f"{prefix}_crit", "label": "Critical", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next},
        {"id": f"{prefix}_pass", "label": pass_label, "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def volt_branches(prefix, pass_next, fail_next):
    return [
        {"id": f"{prefix}_low", "label": "Below range", "when": {"kind": "measurement_critical"}, "nextStepId": fail_next},
        {"id": f"{prefix}_warn", "label": "Marginal", "when": {"kind": "measurement_warning"}, "nextStepId": fail_next},
        {"id": f"{prefix}_pass", "label": "~5 VDC present", "when": {"kind": "measurement_normal"}, "nextStepId": pass_next},
    ]


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


PIN_WIFI_J4 = [
    {"pin": "1", "signal": "+5 VDC", "wireColor": "BK", "wireColorConfidence": "verified"},
    {"pin": "6", "signal": "GND", "wireColor": "Y", "wireColorConfidence": "verified"},
]
PIN_PM_J4_CT1 = [
    {"pin": "1", "signal": "CT1+", "wireColor": "W", "wireColorConfidence": "verified"},
    {"pin": "2", "signal": "CT1-", "wireColor": "BK", "wireColorConfidence": "verified"},
]
PIN_PM_J4_CT2 = [
    {"pin": "3", "signal": "CT2+", "wireColor": "W", "wireColorConfidence": "verified"},
    {"pin": "4", "signal": "CT2-", "wireColor": "BK", "wireColorConfidence": "verified"},
]
PIN_PM_J2 = [
    {"pin": "1", "signal": "+5 VDC", "wireColor": "BK", "wireColorConfidence": "verified"},
    {"pin": "3", "signal": "GND", "wireColor": "R", "wireColorConfidence": "verified"},
]


PROCEDURES = [
    proc(
        "w10785366a-wifi-module",
        "§4-14: WiFi module diagnostics",
        "4-14",
        "Troubleshooting the WiFi Module",
        [48, 49],
        ["wifi_module"],
        ["wifi_check", "connectivity_issue", "hmi_check"],
        [
            visual(
                "customer_connect",
                2,
                "Customer connectivity attempt",
                "Have customer run Whirlpool app or WPS connect. After process, is console WiFi icon steady ON?",
                cp_yes_no("wifi_icon_on", "wifi_module_ok", "no_wifi_icon", "access_wifi_module", "WiFi icon off — appliance-side fault path."),
                "After connectivity process, does appliance connect? WiFi icon on steady.",
            ),
            instr(
                "access_wifi_module",
                3,
                "Access WiFi module",
                "Unplug appliance. Remove console/control to expose WiFi module. Verify J4 WIDE/WIN and antenna connectors fully seated.",
                "restore_power_wifi",
            ),
            instr(
                "restore_power_wifi",
                4,
                "Restore power — allow initialize",
                "Plug in appliance. Allow ~1 minute for boards to initialize before live checks.",
                "wifi_5vdc",
            ),
            meas(
                "wifi_5vdc",
                5,
                "WiFi module +5 VDC (J4-1 to J4-6)",
                "Set meter to DC. Red to J4-1, black to J4-6. Expect ~5 VDC (may read higher per tech sheet).",
                "whirlpoolConnectedSmartGen3WifiModule5Vdc",
                "WiFi J4",
                "1 & 6",
                volt_branches("wifi5v", "wifi_led_check", "wifi_supply_fault"),
                pin_details=PIN_WIFI_J4,
            ),
            visual(
                "wifi_led_check",
                6,
                "WiFi status LED during connect",
                "Press CONNECT and observe module LED window. Green fast blink (10 Hz) during connect = module good. Off/amber only after connect attempt = replace module after harness check.",
                [
                    {"id": "led_active", "label": "Green fast blink or steady green", "when": {"kind": "checkpoint_yes"}, "nextStepId": "wifi_module_ok"},
                    {"id": "led_fault", "label": "Off or amber only", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_wifi_module", "terminal": True},
                ],
                "Green fast blinking = trying to connect; green on = connected to router.",
            ),
            outcome("wifi_supply_fault", 7, "Repair harness or control supply", "Missing 5 VDC — check harness to control; verify 5 VDC at control before replacing WiFi module."),
            outcome("wifi_module_ok", 8, "WiFi module verified", "Module powered and LED behavior normal — if console icon still off, inspect UI harness before replacing HMI."),
            outcome("replace_wifi_module", 9, "Replace WiFi module", "Replace WiFi module per §4-13. Customer must reconnect and re-register SAID."),
        ],
        template_ids=ALL_SMART_TEMPLATES,
    ),
    proc(
        "w10785366a-pmm-ct",
        "§4-17: Power Management board & CT",
        "4-17",
        "Troubleshooting Power Management Board",
        [51, 52],
        ["power_management", "current_transformer"],
        ["connectivity_issue", "energy_monitoring"],
        [
            instr("access_pm_board", 2, "Access PM board", "Unplug appliance. Access Power Management board under console (washer/dryer). Confirm J4 CT, J1 AC sense, and J2/J3 WIDE/WIN seated.", "ct1_ohms"),
            meas(
                "ct1_ohms",
                3,
                "CT1 resistance (J4 pins 1 & 2)",
                "Remove J4. Measure CT1 across pins 1 & 2 — 135 Ω ±5%.",
                "whirlpoolConnectedSmartGen3CtOhms",
                "PM J4",
                "1 & 2",
                ohm_branches("ct1", "ct2_check", "replace_ct1", "135 Ω ±5%"),
                pin_details=PIN_PM_J4_CT1,
            ),
            visual(
                "ct2_check",
                4,
                "Appliance uses L2 (CT2)?",
                "Electric dryers use two CTs at terminal block. Gas dryer and smart washer typically CT1 only.",
                [
                    {"id": "uses_l2", "label": "Yes — check CT2", "when": {"kind": "checkpoint_yes"}, "nextStepId": "ct2_ohms"},
                    {"id": "ct1_only", "label": "No — CT1 only", "when": {"kind": "checkpoint_no"}, "nextStepId": "reconnect_j4"},
                ],
            ),
            meas(
                "ct2_ohms",
                5,
                "CT2 resistance (J4 pins 3 & 4)",
                "Measure CT2 across pins 3 & 4 — 135 Ω ±5%.",
                "whirlpoolConnectedSmartGen3CtOhms",
                "PM J4",
                "3 & 4",
                ohm_branches("ct2", "reconnect_j4", "replace_ct2", "135 Ω ±5%"),
                pin_details=PIN_PM_J4_CT2,
            ),
            instr("reconnect_j4", 6, "Reconnect J4 — restore power", "Reconnect J4. Restore power for live PM board supply check.", "pmm_5vdc"),
            meas(
                "pmm_5vdc",
                7,
                "PM board +5 VDC (J2-1 to J2-3)",
                "Live DC check at J2 pins 1 & 3 (J3 interchangeable). Expect 5 VDC.",
                "whirlpoolConnectedSmartGen3Pmm5Vdc",
                "PM J2",
                "1 & 3",
                volt_branches("pmm5v", "pmm_ok", "pmm_supply_fault"),
                pin_details=PIN_PM_J2,
            ),
            outcome("replace_ct1", 8, "Replace CT1 or harness", "CT1 open or out of range — replace current transformer or internal harness."),
            outcome("replace_ct2", 9, "Replace CT2 or harness", "CT2 open or out of range on L2 appliance."),
            outcome("pmm_supply_fault", 10, "Repair PM harness or control", "Missing 5 VDC at PM board — check harness to control."),
            outcome("pmm_ok", 11, "PM/CT path verified", "CT and PM supply OK — if app still shows no live kW, replace PM board."),
        ],
        template_ids=LAUNDRY_TEMPLATES,
    ),
    proc(
        "w10785366a-hmi-wifi-comm",
        "§4-10: HMI ↔ WiFi communication",
        "4-10",
        "Software version communication check",
        [45, 46],
        ["hmi_control", "wifi_module"],
        ["F6E2", "hmi_check", "connectivity_issue", "wifi_check"],
        [
            instr(
                "enter_service_diag",
                2,
                "Enter Service Diagnostic mode",
                "Use laundry 3-button × 3 entry (washer §5-5 / dryer §6-5) or dishwasher 1-2-3 cycle entry as applicable.",
                "software_version_display",
            ),
            instr(
                "software_version_display",
                3,
                "Open Software Version Display",
                "Laundry: hold 2nd button used for diagnostic entry 5 seconds. Display cycles UI, ACU, WiFi (n), and PMM (p) revision codes.",
                "wifi_version_check",
            ),
            visual(
                "wifi_version_check",
                4,
                "WiFi software version (n label)",
                "Does display show WiFi revision (n major.minor.test) — not n--?",
                [
                    {"id": "n_ok", "label": "n version shown", "when": {"kind": "checkpoint_yes"}, "nextStepId": "comm_ok"},
                    {"id": "n_dash", "label": "n-- (dashes)", "when": {"kind": "checkpoint_no"}, "nextStepId": "wifi_comm_fault"},
                ],
                "n-- means UI and WiFi module are not communicating.",
            ),
            visual(
                "all_dash_check",
                5,
                "All versions show -- ?",
                "If every software version is --, UI or harness fault; F6E2 should also be present.",
                cp_yes_no("all_dash", "ui_harness_fault", "partial_comm", "inspect_wifi_harness", "Only WiFi n-- — harness or WiFi module."),
            ),
            instr("inspect_wifi_harness", 6, "Inspect WiFi harness", "Unplug power. Verify WiFi module connector and WIDE/WIN harness. Restore power and retest version display.", "wifi_comm_fault"),
            outcome("comm_ok", 7, "HMI ↔ WiFi communicating", "WiFi version displayed — connectivity issue likely home network or registration."),
            outcome("wifi_comm_fault", 8, "Replace WiFi module or harness", "WiFi n-- only — repair harness or replace WiFi module (not both HMI and WiFi unless required)."),
            outcome("ui_harness_fault", 9, "Repair UI harness or replace HMI", "All -- with F6E2 — UI or harness to UI; do not replace WiFi and HMI together unless necessary."),
        ],
        template_ids=["washer", "electric_dryer", "gas_dryer", "dishwasher"],
    ),
    proc(
        "w10785366a-connectivity-console",
        "§4-7–4-11: Console connectivity indicators",
        "4-7",
        "Connectivity status troubleshooting",
        [43, 46],
        ["hmi_control", "wifi_module"],
        ["connectivity_issue", "wifi_check"],
        [
            visual(
                "power_and_connect",
                2,
                "Power on before CONNECT",
                "Appliance ON (POWER pressed). Press CONNECT — does WiFi console icon light or blink?",
                cp_yes_no("icon_blinks", "recycle_power", "icon_dead", "wifi_module_path", "WiFi icon dead — run WiFi module procedure."),
            ),
            instr("recycle_power", 3, "Recycle power", "Unplug 60 seconds. Restore power and repeat connect. If still failing and appliance otherwise OK, check software versions.", "version_or_wifi"),
            visual(
                "version_or_wifi",
                4,
                "Software versions or WiFi LED?",
                "Can you read WiFi (n) version in Service Diagnostic? If no, inspect WiFi module LED during connect.",
                [
                    {"id": "versions_ok", "label": "n version OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "han_issue"},
                    {"id": "versions_bad", "label": "n-- or cannot enter diag", "when": {"kind": "checkpoint_no"}, "nextStepId": "wifi_module_path"},
                ],
            ),
            outcome("han_issue", 5, "Home network / WISE / registration", "Appliance smart layer OK — refer customer to router/WPS/WPA-2 and Whirlpool Help Line 866-333-4591 for HAN issues."),
            outcome("wifi_module_path", 6, "Run WiFi module test", "Proceed with w10785366a-wifi-module and HMI communication procedures."),
        ],
        template_ids=ALL_SMART_TEMPLATES,
    ),
    proc(
        "w10785366a-dishwasher-wifi",
        "§7: Clean-connect dishwasher WiFi",
        "7",
        "Clean-connect dishwasher smart components",
        [70, 72],
        ["wifi_module", "hmi_control"],
        ["wifi_check", "connectivity_issue"],
        [
            instr(
                "dw_access_wifi",
                2,
                "Access rear WiFi module",
                "Dishwasher smart delta: HMI + WiFi only (no PM board). WiFi module at rear bottom; SAID/MAC on enclosure.",
                "dw_wifi_led",
            ),
            visual(
                "dw_wifi_led",
                3,
                "WiFi LED during CONNECT",
                "Run connect process. Observe LED through plastic enclosure (no window). Green fast blink = module active.",
                cp_yes_no("dw_led_ok", "dw_wifi_ok", "dw_wifi_fault", "dw_wifi_fault_out", "Replace WiFi module or check antennas after harness inspection."),
            ),
            instr(
                "dw_antenna_check",
                4,
                "Check dual antennas",
                "Verify internal radio antenna and external tub antenna routed to UI area per §7-3.",
                "dw_service_diag",
            ),
            instr(
                "dw_service_diag",
                5,
                "Service Diagnostics cycle",
                "Standby: press 1-2-3-1-2-3-1-2-3 within 1 sec between keys. Close door to start cycle. Note: WiFi fault sends error to ACU but no WiFi status step in diagnostics.",
                "dw_wifi_ok",
            ),
            outcome("dw_wifi_ok", 6, "Dishwasher WiFi path OK", "LED and antennas verified — HAN/registration issues are customer network scope."),
            outcome("dw_wifi_fault_out", 7, "Replace WiFi module or HMI", "Inspect harness before board replacement; do not replace WiFi and HMI together unless required."),
        ],
        template_ids=["dishwasher"],
    ),
    proc(
        "w10785366a-fridge-wifi-service",
        "§8-4: Smart refrigerator WiFi service tests",
        "8-4",
        "WiFi link and antenna service tests",
        [78, 79],
        ["wifi_module", "hmi_control"],
        ["wifi_check", "connectivity_issue"],
        [
            instr(
                "fridge_service_entry",
                2,
                "Enter refrigerator service mode",
                "Hold Recommended + Drawer buttons simultaneously 5 seconds (chime). Use Icemaker2 = Enter; Up/Down navigate; Fast Cool = Back.",
                "fridge_wifi_test_106",
            ),
            instr(
                "fridge_wifi_test_106",
                3,
                "Test 106 — WiFi link self-test",
                "Hold Up arrow to advance to WiFi Service Test 106. Display shows 00 while testing, then 01/02/03 result.",
                "fridge_link_result",
            ),
            visual(
                "fridge_link_result",
                4,
                "Link test result code",
                "01 = cannot link AP/WISE; 02 = AP OK but not WISE; 03 = connected to AP and WISE.",
                [
                    {"id": "code_03", "label": "03 — fully connected", "when": {"kind": "checkpoint_yes"}, "nextStepId": "fridge_antenna_tests"},
                    {"id": "code_01_02", "label": "01 or 02", "when": {"kind": "checkpoint_no"}, "nextStepId": "fridge_han_path"},
                ],
            ),
            instr(
                "fridge_antenna_tests",
                5,
                "Tests 108–109 antenna signal",
                "Navigate to tests 108 and 109. Record antenna 1 and 2 signal strength (0–100%).",
                "fridge_wifi_ok",
            ),
            instr(
                "fridge_han_path",
                6,
                "Check 12.7 VDC WiFi supply",
                "WiFi board fed from Orion P16-1 to WiFi J3-1. Verify board seating and antenna coupler under right hinge cover.",
                "fridge_replace_wifi",
            ),
            outcome("fridge_wifi_ok", 7, "Refrigerator WiFi verified", "Link and antenna tests acceptable — registration/HAN issues are customer scope."),
            outcome("fridge_replace_wifi", 8, "Replace WiFi board or harness", "Failed link test with good Orion 12.7 VDC — replace WiFi board/antenna per §8-2."),
        ],
        template_ids=["refrigerator"],
    ),
]


def laundry_service_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w10785366a-laundry-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W10785366A",
        "title": "W10785366A — Laundry Service Diagnostic entry",
        "modeKind": "service_diagnostic_entry",
        "templateIds": LAUNDRY_TEMPLATES,
        "uiVariants": ["console"],
        "description": "Smart washer/dryer 3-button × 3 Service Diagnostic entry within 8 seconds.",
        "tags": ["service_diagnostic", "software_version"],
        "entryStepId": "laundry_diag_entry",
        "source": {**SOURCE, "pages": [57, 65]},
        "steps": [
            {
                "id": "laundry_diag_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Service Diagnostic mode",
                "body": (
                    "Standby (plugged in, indicators off). Pick any 3 buttons except POWER. "
                    "Within 8 seconds press/release 1st, 2nd, 3rd — repeat that same sequence two more times (3 rounds). "
                    "Success: all indicators on 5 sec with 888 on display and a tone."
                ),
                "sourceExcerpt": "Press and Release the 1st, 2nd, 3rd selected button; Repeat 2 more times.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


def laundry_software_version_bundle() -> dict:
    return {
        "id": "w10785366a-laundry-software-version-display",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W10785366A",
        "title": "W10785366A — Software Version Display",
        "modeKind": "hmi_test",
        "templateIds": LAUNDRY_TEMPLATES,
        "uiVariants": ["any"],
        "description": "Hold 2nd diagnostic-entry button 5 seconds to cycle n (WiFi) and p (PMM) versions.",
        "tags": ["service_diagnostic", "software_version", "wifi_check"],
        "entryStepId": "sw_version_entry",
        "source": {**SOURCE, "pages": [57, 65]},
        "steps": [
            {
                "id": "sw_version_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter Software Version Display",
                "body": (
                    "From Service Diagnostic mode, press and hold the 2nd button used for entry for 5 seconds. "
                    "Display cycles UI, ACU, WiFi (n), and PMM (p) revision codes. POWER exits."
                ),
                "sourceExcerpt": "Hold 2nd button 5 seconds for Software Version Display.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


def dishwasher_service_diagnostic_bundle() -> dict:
    return {
        "id": "w10785366a-dishwasher-service-diagnostic-cycle",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W10785366A",
        "title": "W10785366A — Dishwasher Service Diagnostics cycle",
        "modeKind": "service_diagnostic_entry",
        "templateIds": ["dishwasher"],
        "uiVariants": ["any"],
        "description": "1-2-3 × 3 key sequence invokes Service Diagnostics cycle when door closes.",
        "tags": ["service_diagnostic"],
        "entryStepId": "dw_diag_entry",
        "source": {**SOURCE, "pages": [72]},
        "steps": [
            {
                "id": "dw_diag_entry",
                "order": 1,
                "type": "instruction",
                "title": "Invoke Service Diagnostics cycle",
                "body": (
                    "Standby: press any 3 keys 1-2-3-1-2-3-1-2-3 with no more than 1 second between presses. "
                    "Close door to start. START/RESUME rapid-advances intervals."
                ),
                "sourceExcerpt": "Press any 3 keys in the sequence 1-2-3-1-2-3-1-2-3.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


def fridge_service_mode_bundle() -> dict:
    return {
        "id": "w10785366a-fridge-service-mode-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": "W10785366A",
        "title": "W10785366A — Refrigerator service mode entry",
        "modeKind": "service_diagnostic_entry",
        "templateIds": ["refrigerator"],
        "uiVariants": ["any"],
        "description": "Recommended + Drawer 5 sec; navigate with Icemaker2 / Up / Down / Fast Cool.",
        "tags": ["service_diagnostic", "wifi_check"],
        "entryStepId": "fridge_diag_entry",
        "source": {**SOURCE, "pages": [78]},
        "steps": [
            {
                "id": "fridge_diag_entry",
                "order": 1,
                "type": "instruction",
                "title": "Enter refrigerator service mode",
                "body": (
                    "Hold Recommended and Drawer buttons together 5 seconds (chime). "
                    "Icemaker2 = Enter; Up/Down = navigate; Fast Cool = Back. Hold Up to reach WiFi tests 106+."
                ),
                "sourceExcerpt": "Press and hold Recommended and Drawer simultaneously 5 seconds.",
                "requiresInput": False,
                "defaultNextStepId": "@continue",
            }
        ],
    }


BUNDLES = [
    laundry_service_diagnostic_entry_bundle(),
    laundry_software_version_bundle(),
    dishwasher_service_diagnostic_bundle(),
    fridge_service_mode_bundle(),
]

PROCEDURE_FILES = [
    "w10785366a-wifi-module.json",
    "w10785366a-pmm-ct.json",
    "w10785366a-hmi-wifi-comm.json",
    "w10785366a-connectivity-console.json",
    "w10785366a-dishwasher-wifi.json",
    "w10785366a-fridge-wifi-service.json",
]

BUNDLE_FILES = [
    "w10785366a-laundry-service-diagnostic-entry.json",
    "w10785366a-laundry-software-version-display.json",
    "w10785366a-dishwasher-service-diagnostic-cycle.json",
    "w10785366a-fridge-service-mode-entry.json",
]


def write_catalog() -> None:
    catalog = {
        "manualId": "W10785366A",
        "platformId": PLATFORM,
        "templateId": "washer",
        "label": "Whirlpool Connected Smart Appliances Gen III (smart-layer add-on)",
        "notes": (
            "Smart-layer delta only — WiFi, PMM/CT, HMI connectivity, service diagnostic entry. "
            "Does not duplicate base washer/dryer/dishwasher/fridge component tests. "
            "templateIds gate laundry vs dishwasher vs refrigerator procedures."
        ),
        "plannedProcedures": [
            {
                "id": p["id"],
                "oemSection": p["source"]["oemTestNumber"],
                "title": p["title"],
                "status": "generated",
                "templateIds": p.get("templateIds"),
                "knowledgeIds": [
                    s["measurementKnowledgeId"]
                    for s in p["steps"]
                    if s.get("measurementKnowledgeId")
                ],
                "relatedCodes": [t for t in p.get("tags", []) if t.startswith("F")],
            }
            for p in PROCEDURES
        ],
    }
    path = OUT / "procedureCatalog.json"
    path.write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")
    print(f"Wrote {path.name}")


def write_readme() -> None:
    readme = """# whirlpool_connected_smart_gen3 — W10785366A smart-layer procedures

**Manual:** Job Aid W10785366A — Connected Smart Appliances Gen III  
**Platform:** `whirlpool_connected_smart_gen3` — routes before generic WTW/WED/WRF patterns  
**Extraction:** `frontend/components/diagnostics/knowledge/pattern-catalog/WHIRLPOOL_W10785366A_SMART_APPLIANCE_EXTRACTION.md`

## Models

| Template | Patterns |
|----------|----------|
| washer | WTW8700*, MTW8700* |
| electric_dryer | WED8700*, MED8700* |
| gas_dryer | WGD8700*, MGD8700* |
| dishwasher | WDT995* |
| refrigerator | WRF989*, WRF995* |

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W10785366A
```

## Procedures (6)

| ID | Scope | Notes |
|----|-------|-------|
| w10785366a-wifi-module | all smart | §4-14 LED chart, J4 5 VDC |
| w10785366a-pmm-ct | laundry | CT 135 Ω J4, PM 5 VDC |
| w10785366a-hmi-wifi-comm | laundry + DW | n-- / F6E2 software version check |
| w10785366a-connectivity-console | all smart | Console WiFi/Smart Grid indicators |
| w10785366a-dishwasher-wifi | dishwasher | HMI + WiFi only (no PMM) |
| w10785366a-fridge-wifi-service | refrigerator | Service tests 106–109 |

## Bundles (4)

- `w10785366a-laundry-service-diagnostic-entry` — 3-button × 3
- `w10785366a-laundry-software-version-display` — hold 2nd button 5 sec
- `w10785366a-dishwasher-service-diagnostic-cycle` — 1-2-3 × 3
- `w10785366a-fridge-service-mode-entry` — Recommended + Drawer

## WO smoke

Whirlpool `WTW8700EC0` → `whirlpool_connected_smart_gen3`; connectivity → `w10785366a-wifi-module`
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")
    print("Wrote README.md")


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


if __name__ == "__main__":
    main()
