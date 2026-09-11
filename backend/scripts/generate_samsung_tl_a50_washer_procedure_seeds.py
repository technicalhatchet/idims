#!/usr/bin/env python3
"""Generate Samsung TL A50 washer (WA50R / WA51DG / WF45A) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_tl_washer_a50"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-TL-A50-WASHER",
    "manualTitle": "Samsung Top-Load Washer A50 Family (WA50R, WA51DG, WF45A)",
    "extractedTextFile": "backend/docs/manuals/samsung tl washer wa50r5200-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the washer or disconnect power before servicing. Discharge PBA terminals per manual.",
    "sourceExcerpt": "Make sure to disconnect the power plug before servicing.",
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
        "platformId": "samsung_tl_washer_a50",
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


def cp_yes_no(yes_id, yes_next, no_id, no_next, no_outcome):
    return [
        {"id": yes_id, "label": "Yes / OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": yes_next},
        {"id": no_id, "label": "No / fault", "when": {"kind": "checkpoint_no"}, "nextStepId": no_next, "terminal": True, "oemOutcome": no_outcome},
    ]


PROCEDURES = [
    proc(
        "samsungtla50-water-level-sensor",
        "§5-3: Water level sensor (1C)",
        "5-3",
        "Water Level Sensor 1C",
        [31, 33],
        ["water_level_sensor"],
        ["1C", "fill_issue"],
        [
            visual("wls_hose", 2, "Level sensor hose and terminals", "Check hose not broken; sensor terminals connected; correct part code installed.", cp_yes_no("hose_ok", "wls_frequency", "fix_hose", "fix_hose_out", "Repair hose routing or replace incorrect sensor part.")),
            instr("wls_frequency", 3, "Frequency check", "Connect sensor and connector. Measure frequency Blue–Orange — approx 26.4 kHz without water (min 25.9 kHz).", "wls_verified"),
            outcome("fix_hose_out", 4, "Fix hose/sensor", "Correct hose and sensor installation."),
            outcome("wls_verified", 5, "Level sensor OK", "Frequency and connections verified — replace PBA if 1C persists."),
        ],
    ),
    proc(
        "samsungtla50-motor-circuit",
        "§5-3: Washing motor (3C)",
        "5-3",
        "Washing Motor 3C",
        [31, 33],
        ["drive_motor"],
        ["3C", "motor_check", "spin_issue"],
        [
            instr("disconnect_motor", 2, "Inspect motor connector", "Check motor connector seated. Inspect stator cover and coil for moisture or foreign material.", "motor_ohms"),
            meas("motor_ohms", 3, "Motor winding resistance", "Disconnect connector. Measure any two of three motor terminals — 19.3 Ω @ 25°C.", "samsungTlA50WasherMotorOhms", "Motor", "Any two of three", ohm_branches("motor", "reconnect_motor", "replace_motor", "~19.3 Ω")),
            instr("reconnect_motor", 4, "Reconnect motor", "Reconnect harness. Use Smart Install manual check step 8 (dehydration) to verify spin.", "live_motor_check"),
            visual("live_motor_check", 5, "Motor runs in manual check", "Does drum spin in Smart Install dehydration test?", cp_yes_no("motor_runs", "motor_ok", "suspect_pba", "suspect_pba_out", "Replace main PBA after confirming motor and harness.")),
            outcome("replace_motor", 6, "Replace motor", "Replace motor when windings open or out of OEM range."),
            outcome("motor_ok", 7, "Motor verified", "Motor ohms and live spin verified."),
            outcome("suspect_pba_out", 8, "Suspect main PBA", "Replace PBA when motor checks pass but 3C remains."),
        ],
    ),
    proc(
        "samsungtla50-inlet-valves",
        "§5-3: Water supply (4C)",
        "5-3",
        "Water Supply 4C",
        [31, 33],
        ["inlet_valve"],
        ["4C", "4C2", "fill_issue", "water_valve_check"],
        [
            visual("supply_precheck", 2, "Supply and hoses", "Verify taps open, hoses not kinked/frozen, cold on cold tap. Clean mesh filters.", cp_yes_no("supply_ok", "valve_ohms", "fix_supply", "fix_supply_out", "Correct water supply routing and pressure.")),
            meas("valve_ohms", 3, "Inlet valve resistance", "Measure water supply valve terminals — 0.9–1.1 kΩ.", "samsungTlA50WasherInletValveOhms", "Inlet valve", "Coil terminals", ohm_branches("valve", "smart_install_valves", "replace_valve_out", "0.9–1.1 kΩ")),
            instr("smart_install_valves", 4, "Smart Install valve test", "Enter Smart Install manual check. Co and Ho steps exercise cold and hot valves.", "valve_visual"),
            visual("valve_visual", 5, "Valves operate", "Do cold and hot valves open in manual check?", cp_yes_no("valves_run", "inlet_verified", "replace_valve_out", "replace_valve_out", "Replace valve assembly or PBA relay.")),
            outcome("fix_supply_out", 6, "Fix supply", "Open taps, clear filters, verify hose routing."),
            outcome("replace_valve_out", 7, "Replace inlet valve", "Replace valve when coil open or inoperative."),
            outcome("inlet_verified", 8, "Inlet OK", "Supply and valves verified."),
        ],
    ),
    proc(
        "samsungtla50-drain-pump",
        "§5-3: Drain pump (5C)",
        "5-3",
        "Drain Pump 5C",
        [31, 33],
        ["drain_pump"],
        ["5C", "drain_issue"],
        [
            visual("pump_debris", 2, "Pump housing", "Check drain pump for foreign material. Verify wiring connections.", cp_yes_no("pump_clear", "pump_ohms", "clear_pump", "clear_pump_out", "Remove debris from pump housing.")),
            meas("pump_ohms", 3, "Drain pump resistance", "Measure drain pump motor — 13.5–16.5 Ω.", "samsungTlA50WasherDrainPumpOhms", "Drain pump", "Motor terminals", ohm_branches("pump", "pump_run_check", "replace_pump_out", "13.5–16.5 Ω")),
            visual("pump_run_check", 4, "Pump runs", "Natural drain test — pump operates?", cp_yes_no("pump_runs", "drain_verified", "replace_pump_out", "replace_pump_out", "Replace drain pump motor.")),
            outcome("clear_pump_out", 5, "Clear pump", "Remove obstruction and retest."),
            outcome("replace_pump_out", 6, "Replace drain pump", "Replace pump when open or inoperative."),
            outcome("drain_verified", 7, "Drain OK", "Pump resistance and operation verified."),
        ],
    ),
    proc(
        "samsungtla50-communication",
        "§5-3: PBA communication (AC)",
        "5-3",
        "Communication AC",
        [31, 33],
        ["main_control"],
        ["AC", "AC6", "hmi_check"],
        [
            instr("comm_harness", 2, "Sub/main harness", "Verify wire connections and contacts between sub and main PBAs. Check for moisture on sub PBA.", "comm_verified"),
            visual("comm_verified", 3, "Comm restored?", "After harness repair and power cycle, does AC/AC6 clear?", cp_yes_no("comm_ok", "comm_path_ok", "replace_pba", "replace_pba_out", "Replace main PBA communication circuit.")),
            outcome("replace_pba_out", 4, "Replace PBA", "Replace main PBA when communication circuit failed."),
            outcome("comm_path_ok", 5, "Communication OK", "Harness and PBA communication verified."),
        ],
    ),
    proc(
        "samsungtla50-door-lock",
        "§5-3: Door lock (DC, DC1, DC2)",
        "5-3",
        "Door Lock DC",
        [31, 34],
        ["door_lock"],
        ["dC", "DC", "DC1", "DC2", "door_lock_check"],
        [
            visual("door_closed", 2, "Door fully closed", "Ensure door closed with no laundry caught. Check door lock tray for debris.", cp_yes_no("door_ok", "reed_ohms", "close_door", "close_door_out", "Close door and clear debris from lock tray.")),
            meas("reed_ohms", 3, "Reed switch (White–Green)", "Approx 0.2 Ω at reed switch.", "samsungTlA50WasherDoorReedOhms", "Reed SW", "White-Green", ohm_branches("reed", "lock_motor_ohms", "replace_reed", "~0.2 Ω")),
            meas("lock_motor_ohms", 4, "Lock motor (Black–Brown)", "33–46 Ω at lock motor.", "samsungTlA50WasherDoorLockMotorOhms", "Lock motor", "Black-Brown", ohm_branches("lm", "lock_contact_ohms", "replace_lock_motor", "33–46 Ω")),
            meas("lock_contact_ohms", 5, "Lock/unlock contacts", "Lock White–Red and Unlock White–Blue — approx 0.2 Ω in each state.", "samsungTlA50WasherDoorLockContactOhms", "Lock contacts", "White-Red / White-Blue", ohm_branches("lc", "door_verified", "replace_lock_unit", "~0.2 Ω")),
            outcome("close_door_out", 6, "Close door", "Secure door and clear obstruction."),
            outcome("replace_reed", 7, "Replace reed switch", "Replace reed switch when open."),
            outcome("replace_lock_motor", 8, "Replace lock motor", "Replace door lock motor when out of range."),
            outcome("replace_lock_unit", 9, "Replace lock switch unit", "Replace door lock switch unit when contacts fail."),
            outcome("door_verified", 10, "Door circuit OK", "Door lock circuit verified — inspect main PBA if code persists."),
        ],
    ),
    proc(
        "samsungtla50-hmi-check",
        "§5-3: Control panel (BC2)",
        "5-3",
        "Switch Check BC2",
        [33],
        ["user_interface"],
        ["BC2", "hmi_check"],
        [
            visual("button_gap", 2, "Button gap check", "Gap required between control panel buttons and tact switches — stuck button triggers BC2 after ~30 s.", cp_yes_no("gap_ok", "hmi_verified", "loosen_screws", "loosen_screws_out", "Loosen over-tightened service PBA screws; replace main PBA if IC fault.")),
            outcome("loosen_screws_out", 3, "Adjust panel", "Loosen service screws and verify button free play."),
            outcome("hmi_verified", 4, "HMI OK", "Control panel and tact switches verified."),
        ],
    ),
    proc(
        "samsungtla50-leak-check",
        "§5-3: Water leakage (LC, LC1)",
        "5-3",
        "Water Leakage LC",
        [33, 35],
        ["drain_pump"],
        ["LC", "LC1", "leak_check", "drain_issue"],
        [
            visual("bellows_check", 2, "Drain bellows", "Check draining bellows for underwear, wires, coins. Remove alien substance.", cp_yes_no("bellows_clear", "leak_inspection", "clear_bellows", "clear_bellows_out", "Clear bellows obstruction.")),
            visual("leak_inspection", 3, "Leak source", "Inspect tub connections, internal hoses, and drain motor for leaks.", cp_yes_no("no_leak", "leak_verified", "repair_leak", "repair_leak_out", "Repair leak path or replace drain motor.")),
            outcome("clear_bellows_out", 4, "Clear bellows", "Remove foreign material from drain bellows."),
            outcome("repair_leak_out", 5, "Repair leak", "Correct hose, tub, or pump leak."),
            outcome("leak_verified", 6, "Leak path OK", "No leak found — retest LC."),
        ],
    ),
    proc(
        "samsungtla50-unbalance",
        "§5-2: Unbalance (UB)",
        "5-2",
        "Unbalance UB",
        [30, 32],
        ["drive_motor"],
        ["UB", "spin_issue"],
        [
            visual("load_balance", 2, "Load distribution", "Redistribute laundry evenly. Level machine. Single heavy items (robes, jeans) may trigger UB.", cp_yes_no("load_ok", "ub_verified", "redistribute", "redistribute_out", "Redistribute load and verify level.")),
            outcome("redistribute_out", 3, "Redistribute load", "Balance load and confirm unit level."),
            outcome("ub_verified", 4, "Unbalance resolved", "UB cleared after load correction."),
        ],
    ),
    proc(
        "samsungtla50-mems-sensor",
        "§5-3: MEMS sensor (8C)",
        "5-3",
        "MEMS PBA 8C",
        [35],
        ["main_control"],
        ["8C", "8C1", "8C2"],
        [
            visual("mems_wiring", 2, "MEMS harness", "Check wire connections to MEMS PBA. Rule out disconnection.", cp_yes_no("wiring_ok", "mems_verified", "replace_mems", "replace_mems_out", "Replace MEMS PBA.")),
            outcome("replace_mems_out", 3, "Replace MEMS PBA", "Replace MEMS PBA when wiring intact but 8C persists."),
            outcome("mems_verified", 4, "MEMS OK", "MEMS connections verified."),
        ],
    ),
    proc(
        "samsungtla50-overflow",
        "§5-3: Overflow (OC)",
        "5-3",
        "Overflow OC",
        [34, 36],
        ["water_level_sensor", "inlet_valve"],
        ["OC", "overflow"],
        [
            visual("oc_valve", 2, "Continuous fill check", "Check for frozen or obstructed inlet valve causing continuous water supply.", cp_yes_no("valve_ok", "oc_level_sensor", "service_valve", "service_valve_out", "Replace inlet valve or clear obstruction.")),
            instr("oc_level_sensor", 3, "Water level sensor", "If inlet path OK, replace water level sensor per §5-3 OC.", "oc_verified"),
            outcome("service_valve_out", 4, "Service inlet valve", "Clear foreign material or replace stuck valve."),
            outcome("oc_verified", 5, "Overflow resolved", "OC path addressed — monitor fill."),
        ],
    ),
    proc(
        "samsungtla50-wash-heater",
        "§5-3: Wash heater (HC, HC1)",
        "5-3",
        "Heater Check HC",
        [34, 36],
        ["wash_heater", "wash_ntc"],
        ["HC", "HC1", "no_heat", "heating_element_check"],
        [
            visual("heater_wiring", 2, "Heater connections", "Verify wire connections to wash heater.", cp_yes_no("heater_wired", "heater_replace", "repair_wiring", "repair_wiring_out", "Repair heater wiring.")),
            instr("heater_replace", 3, "Heater fault path", "If wash heater faulty per TYPE 1, replace heater. If heater OK, replace wash thermistor TYPE 2.", "heater_verified"),
            outcome("repair_wiring_out", 4, "Repair wiring", "Correct heater harness connections."),
            outcome("heater_verified", 5, "Heater path OK", "Heater/thermistor service completed."),
        ],
    ),
    proc(
        "samsungtla50-wash-thermistor",
        "§5-3: Temperature sensors (TC1–TC4)",
        "5-3",
        "Temperature Sensor TC",
        [34, 36],
        ["wash_ntc"],
        ["TC1", "TC2", "TC3", "TC4", "thermistor"],
        [
            visual("tc_connectors", 2, "Thermistor connectors", "Check washing and dry heater temperature sensor connectors. Rule out winter freeze.", cp_yes_no("conn_ok", "tc_verified", "replace_ntc", "replace_ntc_out", "Replace faulty temperature sensor per active TC code.")),
            outcome("replace_ntc_out", 3, "Replace thermistor", "Replace washing or dry temperature sensor as indicated by TC1–TC4."),
            outcome("tc_verified", 4, "Thermistor OK", "Sensor connections verified."),
        ],
    ),
    proc(
        "samsungtla50-power-supply",
        "§5-3: Power (UC, 9C1, 9C2)",
        "5-3",
        "Power Check UC",
        [34, 36],
        ["supply", "main_control"],
        ["UC", "9C1", "9C2", "no_power"],
        [
            visual("voltage_check", 2, "Supply voltage", "Verify operating voltage during Boil or Dry. Check for plug receptacle extension causing voltage drop.", cp_yes_no("supply_ok", "power_verified", "fix_supply", "fix_supply_out", "Correct outlet and dedicated circuit.")),
            outcome("fix_supply_out", 3, "Fix supply", "Correct installation voltage and wiring."),
            outcome("power_verified", 4, "Power OK", "Supply verified — replace main PBA if UC/9C persists."),
        ],
    ),
    proc(
        "samsungtla50-clutch",
        "§5-2: Clutch position (PC, PC1)",
        "5-2",
        "Clutch PC",
        [30, 32],
        ["clutch"],
        ["PC", "PC1"],
        [
            instr("clutch_power_cycle", 2, "Power cycle", "Unplug 1 minute and retry. PC = clutch position not detected; PC1 = hall signal incorrect after detection.", "clutch_inspect"),
            visual("clutch_inspect", 3, "Clutch and harness", "Inspect clutch assembly, hall sensor wiring, and motor module connections.", cp_yes_no("clutch_ok", "clutch_verified", "replace_clutch", "replace_clutch_out", "Replace clutch/motor module or main PBA.")),
            outcome("replace_clutch_out", 4, "Replace clutch module", "Replace clutch or motor module when PC/PC1 persists."),
            outcome("clutch_verified", 5, "Clutch OK", "Clutch position detected after service."),
        ],
    ),
]


def smart_install_bundle() -> dict:
    return {
        "id": "samsungtla50-smart-install-entry",
        "version": "1.0.0",
        "platformId": "samsung_tl_washer_a50",
        "manualId": SOURCE["manualId"],
        "title": "Samsung TL A50 — Smart Install entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter Smart Install (AS) from Self Clean course for automatic/manual component checks.",
        "tags": ["service_diagnostic", "smart_install"],
        "entryStepId": "si_prep",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [28]},
        "steps": [
            instr("si_prep", 1, "Standby — empty drum", "Washer standby. Drum empty. Set course to Self Clean.", "si_enter"),
            instr("si_enter", 2, "Enter Smart Install", "Press Start/Pause for 7 seconds. Display shows AS when Smart Install is active.", "@continue", "Standby → Self Clean → Start/Pause 7 s."),
        ],
    }


def manual_check_bundle() -> dict:
    return {
        "id": "samsungtla50-manual-check-mode",
        "version": "1.0.0",
        "platformId": "samsung_tl_washer_a50",
        "manualId": SOURCE["manualId"],
        "title": "Samsung TL A50 — Manual check mode",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "Manual Smart Install — press Spin to advance component tests.",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "mc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [28]},
        "steps": [
            instr("mc_enter", 1, "Enter manual check", "From AS: press Spin. Spin advances: 1 door lock, 2 drain, 3 prep valve, Co cold, Ho hot, 6 water shot/heater/rinse, 7 drain, 8 spin, 9 dry heater/fan, 10 door.", "@continue"),
        ],
    }


def diagnostic_code_bundle() -> dict:
    return {
        "id": "samsungtla50-diagnostic-code-check",
        "version": "1.0.0",
        "platformId": "samsung_tl_washer_a50",
        "manualId": SOURCE["manualId"],
        "title": "Samsung TL A50 — Diagnostic code display",
        "modeKind": "fault_codes",
        "uiVariants": ["any"],
        "description": "Review stored diagnostic codes (up to 7 digits) from Smart Install.",
        "tags": ["fault_codes", "error_code"],
        "entryStepId": "dc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [28]},
        "steps": [
            instr("dc_enter", 1, "Diagnostic information display", "From AS: press Soil → CR appears. Turn jog dial CW — up to 7 stored codes display.", "@continue"),
        ],
    }


BUNDLES = [smart_install_bundle(), manual_check_bundle(), diagnostic_code_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "samsung_tl_washer_a50",
        "templateId": "washer",
        "label": "Samsung TL washer A50 (WA50R, WA51DG, WF45A)",
        "notes": "§5 Test Mode + §5-3 corrective actions. Separate from samsung_fl_washer_bb8700.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [t for t in item.get("tags", []) if t[0].isdigit() or t in ("dC", "DC", "AC", "OC", "LC", "HC", "UB", "PC", "UC")],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


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
    for script in (
        "attach_samsung_tl_a50_washer_diagnostic_effects.py",
        "attach_samsung_tl_a50_washer_service_modes.py",
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
