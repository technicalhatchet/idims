#!/usr/bin/env python3
"""Generate Samsung FL BB8700 washer (WF50/53BB, WF51CG) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_fl_washer_bb8700"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "SAMSUNG-FL-BB8700-WASHER",
    "manualTitle": "Samsung Front-Load Washer BB8700 Family (WF50/53BB, WF51CG)",
    "extractedTextFile": "backend/docs/manuals/samsung fl washer new style wf50bb8700-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the washer or disconnect power before servicing. Discharge PBA terminals per manual. Replace all parts before operating.",
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
        "platformId": "samsung_fl_washer_bb8700",
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
        "samsungbb8700-motor-circuit",
        "§4-3: Washing motor (3C)",
        "4-3",
        "Washing Motor Error 3C",
        [47, 48],
        ["drive_motor"],
        ["3C", "motor_check", "spin_issue", "wont_spin"],
        [
            visual("motor_overload", 2, "Rule out overload (3E)", "Too much laundry can display 3E — redistribute load before motor diagnosis.", cp_yes_no("load_ok", "disconnect_motor", "redistribute_load", "redistribute_load_out", "Redistribute load and retest."), "3E is displayed because overloading occurs."),
            instr("disconnect_motor", 3, "Disconnect motor connector", "Disconnect motor harness. Inspect stator cover and coil for foreign material or damage.", "motor_ohms"),
            meas("motor_ohms", 4, "Motor winding resistance", "Measure Blue-White, White-Red, and Red-Blue. Each pair should read ~15 Ω (§3). §4-3 3C cites 6.0 Ω @ 25°C at any two terminals — verify at connector.", "samsungFlBb8700WasherMotorOhms", "Motor", "Blue-White, White-Red, Red-Blue", ohm_branches("motor", "reconnect_motor", "replace_motor", "~15 Ω each pair")),
            instr("reconnect_motor", 5, "Reconnect motor — restore power", "Reconnect motor harness. Restore power for Smart Install manual check step 8 (dehydration/spin).", "live_motor_check"),
            visual("live_motor_check", 6, "Motor runs in manual check", "In Smart Install manual mode, advance to dehydration test. Does drum spin?", cp_yes_no("motor_runs", "motor_ok", "suspect_pba", "suspect_pba_out", "Motor ohms OK but no run — replace main PBA or check inverter comm (AC6).")),
            outcome("redistribute_load_out", 7, "Redistribute load", "Correct load size and balance before condemning motor."),
            outcome("replace_motor", 8, "Replace motor", "Replace motor when windings open or out of OEM range."),
            outcome("motor_ok", 9, "Motor verified", "Motor resistance and live spin verified."),
            outcome("suspect_pba_out", 10, "Suspect main/inverter PBA", "Replace PBA after confirming motor and harness."),
        ],
    ),
    proc(
        "samsungbb8700-wash-heater",
        "§4-3: Wash heater (HC, HC1)",
        "4-3",
        "Heater Error HC",
        [47, 48],
        ["wash_heater", "wash_ntc"],
        ["HC", "HC1", "no_heat", "heating_element_check"],
        [
            instr("heater_access", 2, "Access heater terminals", "Disconnect power. Access wash heater at tub front (terminals A and B per §4-3 TYPE 1).", "heater_in_circuit"),
            meas("heater_in_circuit", 3, "Heater A–B resistance (TYPE 1)", "Measure between A and B. Expected 16.05 ± 0.65 Ω.", "samsungFlBb8700WasherHeaterInCircuitOhms", "Heater", "A & B", ohm_branches("hc_ab", "heater_ok_in_circuit", "bench_heater", "~16 Ω")),
            instr("bench_heater", 4, "Bench heater element", "Remove heater per §3. Measure element: 27.1 Ω (1900 W) or 26.2 Ω (2000 W).", "heater_bench"),
            meas("heater_bench", 5, "Heater bench ohms", "Measure heater element resistance.", "samsungFlBb8700WasherHeaterOhms", "Heater element", "Terminals", ohm_branches("hc_bench", "check_thermistor", "replace_heater", "27.1/26.2 Ω")),
            instr("check_thermistor", 6, "TYPE 2 — wash thermistor", "If heater ohms OK, check wash thermistor at back of tub (§4-3 TYPE 2).", "thermistor_ohms"),
            meas("thermistor_ohms", 7, "Wash thermistor @ room", "Expected ~12 kΩ at room temperature.", "samsungFlBb8700WasherThermistorOhms", "Thermistor", "Connector", ohm_branches("ntc", "heater_path_ok", "replace_thermistor", "~12 kΩ")),
            outcome("heater_ok_in_circuit", 8, "Heater in-circuit OK", "A–B in range — if HC persists, replace wash thermistor."),
            outcome("replace_heater", 9, "Replace heater", "Replace wash heater when open or out of range."),
            outcome("replace_thermistor", 10, "Replace thermistor", "Replace wash thermistor when out of range."),
            outcome("heater_path_ok", 11, "Heater path verified", "Heater and thermistor in spec — inspect wiring; replace PBA if fault remains."),
        ],
    ),
    proc(
        "samsungbb8700-wash-thermistor",
        "§4-3: Wash temperature sensor (TC1)",
        "4-3",
        "Temperature Sensor Error TC1",
        [47],
        ["wash_ntc"],
        ["TC1", "thermistor"],
        [
            instr("tc1_connector", 2, "Check thermistor connector", "Verify washing heater temperature sensor connector seated. Rule out frozen hose in winter.", "tc1_ohms"),
            meas("tc1_ohms", 3, "Wash thermistor resistance", "Measure at thermistor connector — ~12 kΩ at room temp.", "samsungFlBb8700WasherThermistorOhms", "Thermistor", "Connector", ohm_branches("tc1", "tc1_verified", "replace_tc1_ntc", "~12 kΩ")),
            outcome("replace_tc1_ntc", 4, "Replace thermistor", "Replace washing temperature sensor when faulty."),
            outcome("tc1_verified", 5, "Thermistor OK", "TC1 path verified — suspect main PBA if code returns."),
        ],
    ),
    proc(
        "samsungbb8700-door-lock",
        "§4-3: Door lock and switch (DC, DC1)",
        "4-3",
        "Door Error DC / DC1",
        [47, 48],
        ["door_lock"],
        ["DC", "DC1", "DC3", "DDC", "door_lock_check"],
        [
            visual("dc_boil_check", 2, "DC during Boil cycle?", "If DC occurs during Boil cycle, verify door fully closed and not caught.", cp_yes_no("door_closed", "door_type_check", "close_door", "close_door_out", "Close door securely and retest.")),
            visual("door_type_check", 3, "Door switch type", "TYPE 1 door switch (pins 1–3 ~175 Ω) or TYPE 2 lock switch (pins 2–3 60–90 Ω with slider pushed)?", [
                {"id": "type1", "label": "TYPE 1 door switch", "when": {"kind": "checkpoint_yes"}, "nextStepId": "door_switch_ohms"},
                {"id": "type2", "label": "TYPE 2 lock switch", "when": {"kind": "checkpoint_no"}, "nextStepId": "door_lock_ohms"},
            ]),
            meas("door_switch_ohms", 4, "TYPE 1 door switch (pins 1–3)", "Approximately 175 Ω.", "samsungFlBb8700WasherDoorSwitchOhms", "Door switch", "1 & 3", ohm_branches("ds", "door_verified", "replace_door_switch", "~175 Ω")),
            meas("door_lock_ohms", 4, "TYPE 2 lock switch (pins 2–3)", "Push slider — expect 60–90 Ω.", "samsungFlBb8700WasherDoorLockOhms", "Door lock", "2 & 3", ohm_branches("dl", "lock_motor_ohms", "replace_door_lock", "60–90 Ω")),
            meas("lock_motor_ohms", 5, "Add-door lock motor (1–2)", "For DDC/DC3: lock motor 46.57 ± 15 Ω at pins 1–2.", "samsungFlBb8700WasherDoorLockMotorOhms", "Lock motor", "1 & 2", ohm_branches("lm", "door_verified", "replace_lock_module", "46.57 ± 15 Ω")),
            outcome("close_door_out", 6, "Close door", "Ensure door closed and laundry not caught."),
            outcome("replace_door_switch", 7, "Replace door switch", "Replace faulty door switch."),
            outcome("replace_door_lock", 8, "Replace door lock", "Replace door lock assembly."),
            outcome("replace_lock_module", 9, "Replace lock module", "Replace add-door lock module when motor out of range."),
            outcome("door_verified", 10, "Door circuit OK", "Door switch/lock in spec — inspect main PBA door sensing if code persists."),
        ],
    ),
    proc(
        "samsungbb8700-water-level-sensor",
        "§4-3: Water level sensor (1C)",
        "4-3",
        "Water Level Sensor 1C",
        [47],
        ["water_level_sensor"],
        ["1C", "fill_issue"],
        [
            visual("wls_hose", 2, "Level sensor hose", "Check hose to water level sensor — not folded, cut, or damaged. Verify correct material code sensor installed.", cp_yes_no("hose_ok", "wls_frequency", "fix_hose", "fix_hose_out", "Correct hose routing and sensor part.")),
            instr("wls_frequency", 3, "Frequency check", "Connect sensor and connector. Measure frequency on pink and orange wires — approx. 25.5 kHz with no load.", "wls_connector"),
            visual("wls_connector", 4, "Terminal connections", "Water level sensor terminals secure and correct sensor part number?", cp_yes_no("wls_conn_ok", "wls_verified", "replace_wls", "replace_wls_out", "Replace water level sensor or repair connections.")),
            outcome("fix_hose_out", 5, "Fix hose/sensor install", "Correct hose and sensor installation."),
            outcome("replace_wls_out", 6, "Replace level sensor", "Replace water level sensor; replace PBA if fault persists."),
            outcome("wls_verified", 7, "Level sensor OK", "Frequency and connections verified."),
        ],
    ),
    proc(
        "samsungbb8700-drain-pump",
        "§4-3: Drain / leakage (LC, LC1)",
        "4-3",
        "Water Leakage Error LC",
        [47, 48],
        ["drain_pump"],
        ["LC", "LC1", "drain_issue", "leak_check"],
        [
            visual("leak_inspection", 2, "Leak inspection", "Check base, hoses, valves, tub connections, and drain bellows for foreign material or leaks.", cp_yes_no("no_leak", "drain_motor_check", "repair_leak", "repair_leak_out", "Repair leak source and clear drain bellows.")),
            visual("drain_motor_check", 3, "Drain motor operation", "Verify drain motor/pump operates during natural drain. Clear bellows of wires/coins.", cp_yes_no("pump_runs", "drain_verified", "replace_drain_pump", "replace_pump_out", "Replace drain pump or motor when inoperative.")),
            outcome("repair_leak_out", 4, "Repair leak path", "Correct hose, valve, or tub leak; clear bellows obstruction."),
            outcome("replace_pump_out", 5, "Replace drain pump", "Replace drain pump motor assembly."),
            outcome("drain_verified", 6, "Drain path OK", "No leak; drain motor operates — retest LC."),
        ],
    ),
    proc(
        "samsungbb8700-inlet-valves",
        "§4-2: Inlet valves (Co / Ho manual check)",
        "4-2",
        "Cold/Hot water valves",
        [46],
        ["inlet_valve"],
        ["fill_issue", "water_valve_check", "no_fill"],
        [
            instr("smart_install_valves", 2, "Smart Install valve tests", "Enter Smart Install manual check. Steps Co (cold) and Ho (hot) exercise inlet valves. Drum must be empty.", "valve_visual"),
            visual("valve_visual", 3, "Valves operate in manual check", "Do cold and hot valves open and fill when commanded in manual check?", cp_yes_no("valves_run", "inlet_verified", "check_supply", "check_supply_out", "Verify taps open, screens clean, harness to valves; replace valve assembly.")),
            outcome("check_supply_out", 4, "Check water supply", "Open taps, clean mesh filters, verify pressure and hose routing."),
            outcome("inlet_verified", 5, "Inlet valves OK", "Valves operate in Smart Install — supply and harness verified."),
        ],
    ),
    proc(
        "samsungbb8700-communication",
        "§4-3: PBA communication (AC, AC6)",
        "4-3",
        "Communication Error AC / AC6",
        [45, 47],
        ["main_control", "inverter"],
        ["AC", "AC6", "hmi_check"],
        [
            instr("comm_harness", 2, "Inspect sub/main harness", "AC: verify wire connections and contacts between sub and main PBAs. Check for moisture on sub PBA.", "comm_ac6"),
            instr("comm_ac6", 3, "AC6 inverter path", "AC6: check main ↔ inverter PBA harness. Machine may auto-recover — power cycle and retest.", "comm_verified"),
            visual("comm_verified", 4, "Comm restored after power cycle?", "After reconnecting harnesses and power cycle, does washer run without AC/AC6?", cp_yes_no("comm_ok", "comm_path_ok", "replace_pba", "replace_pba_out", "Replace main PBA communication circuit.")),
            outcome("replace_pba_out", 5, "Replace PBA", "Replace main or inverter PBA per fault code."),
            outcome("comm_path_ok", 6, "Communication OK", "Harness and PBA communication verified."),
        ],
    ),
    proc(
        "samsungbb8700-overflow",
        "§4-3: Overflow (OC)",
        "4-3",
        "Overflow Error OC",
        [45, 47],
        ["water_level_sensor"],
        ["OC", "overflow"],
        [
            visual("oc_hose", 2, "Level sensor hose", "Inspect hose to water level sensor — torn, hole, or frozen. Defrost if winter.", cp_yes_no("hose_intact", "oc_spin_retry", "repair_hose", "repair_hose_out", "Repair or replace level sensor hose; defrost if frozen.")),
            instr("oc_spin_retry", 3, "Restart after spin", "Restart cycle after spin. If OC remains, replace water level sensor.", "oc_verified"),
            outcome("repair_hose_out", 4, "Repair hose", "Correct hose damage or freezing condition."),
            outcome("oc_verified", 5, "Overflow resolved", "OC cleared — monitor level sensor if recurrence."),
        ],
    ),
    proc(
        "samsungbb8700-power-supply",
        "§4-3: Power / current sense (9C5)",
        "4-3",
        "Power 9C5",
        [49],
        ["supply", "main_control"],
        ["9C5", "no_power"],
        [
            visual("supply_voltage", 2, "Supply voltage", "Verify outlet voltage and dedicated circuit. Check for low voltage or shared outlet overload.", cp_yes_no("supply_ok", "ac_connector", "fix_supply", "fix_supply_out", "Correct supply — dedicated 120 V circuit.")),
            visual("ac_connector", 3, "AC connector / motor short", "Inspect AC connector for short. Check motor connector for short to ground.", cp_yes_no("no_short", "pba_ok", "replace_motor_pba", "replace_motor_pba_out", "Replace motor and main PBA if motor shorted; PBA only if motor clean.")),
            outcome("fix_supply_out", 4, "Fix supply", "Correct installation and supply voltage."),
            outcome("replace_motor_pba_out", 5, "Replace motor and/or PBA", "Replace shorted motor and PBA per §4-3 9C5."),
            outcome("pba_ok", 6, "Power path OK", "Supply and connectors verified — replace PBA if 9C5 persists."),
        ],
    ),
]


def smart_install_entry_bundle() -> dict:
    return {
        "id": "samsungbb8700-smart-install-entry",
        "version": "1.0.0",
        "platformId": "samsung_fl_washer_bb8700",
        "manualId": SOURCE["manualId"],
        "title": "Samsung BB8700 — Smart Install entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter Smart Install (AS) for automatic/manual component checks and diagnostic code display.",
        "tags": ["service_diagnostic", "smart_install"],
        "entryStepId": "si_prep",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [46]},
        "steps": [
            instr("si_prep", 1, "Standby — empty drum", "Washer standby. Drum empty. Schedule +17 hr (or 17:00) for Smart Install path per manual.", "si_enter"),
            instr("si_enter", 2, "Enter Smart Install", "Press Start/Pause for 7 seconds after scheduled time setup. Display shows AS when Smart Install is active.", "@continue", "Press Start/Pause for 7 seconds."),
        ],
    }


def manual_check_bundle() -> dict:
    return {
        "id": "samsungbb8700-manual-check-mode",
        "version": "1.0.0",
        "platformId": "samsung_fl_washer_bb8700",
        "manualId": SOURCE["manualId"],
        "title": "Samsung BB8700 — Manual check mode",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "Manual Smart Install — press Delay End to step components; Spin advances steps.",
        "tags": ["service_diagnostic", "load_test"],
        "entryStepId": "mc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [46]},
        "steps": [
            instr("mc_enter", 1, "Enter manual check", "From AS display: press Delay End to enter manual mode. Press Spin to advance: 1 door lock, 2 drain, 3 prep valve, Co cold, Ho hot, 6 water shot/heater/rinse, 7 drain, 8 spin, 9 dry heater/fan, 10 door.", "@continue"),
        ],
    }


def diagnostic_code_bundle() -> dict:
    return {
        "id": "samsungbb8700-diagnostic-code-check",
        "version": "1.0.0",
        "platformId": "samsung_fl_washer_bb8700",
        "manualId": SOURCE["manualId"],
        "title": "Samsung BB8700 — Diagnostic code display",
        "modeKind": "fault_codes",
        "uiVariants": ["any"],
        "description": "Review stored diagnostic codes (up to 7 digits) from Smart Install.",
        "tags": ["fault_codes", "error_code"],
        "entryStepId": "dc_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [46]},
        "steps": [
            instr("dc_enter", 1, "Diagnostic information display", "From AS: press ALARM OFF or SMART CONTROL → OPTION → jog dial CW. Or from CR display turn jog dial CW — up to 7 stored codes.", "@continue"),
        ],
    }


BUNDLES = [smart_install_entry_bundle(), manual_check_bundle(), diagnostic_code_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "samsung_fl_washer_bb8700",
        "templateId": "washer",
        "label": "Samsung FL washer BB8700 (WF50/53BB, WF51CG)",
        "notes": "Smart Install §4-2 + corrective actions §4-3. No OEM TEST # index.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [t for t in item.get("tags", []) if t[0].isdigit() or t in ("DC", "AC", "OC", "LC", "HC", "TC1", "UB")],
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
        "attach_samsung_fl_bb8700_washer_diagnostic_effects.py",
        "attach_samsung_fl_bb8700_washer_service_modes.py",
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
