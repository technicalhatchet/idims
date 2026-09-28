#!/usr/bin/env python3
"""Generate LG LSC27926 SxS refrigerator procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "lg_sxs"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "lg_sxs"

SOURCE = {
    "manualId": "LG-LSC27926-SXS",
    "manualTitle": "LG LSC27926 Side-by-Side Refrigerator",
    "extractedTextFile": "backend/docs/manuals/LGSxS-extracted.txt",
    "verifiedAt": "2026-09-16",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": (
        "Unplug the refrigerator before servicing. Wait 3 minutes after unplugging before measuring "
        "SMPS terminals (160 Vdc may remain). R-134a sealed-system precautions apply."
    ),
    "sourceExcerpt": "Disconnect power before servicing electrical parts.",
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


def meas_branches(prefix, pass_next, fail_next, pass_label="In range"):
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


def thermistor_proc(pid, title, oem_section, connector, pins, tags, pages):
    return proc(
        pid,
        title,
        oem_section,
        title.split(": ", 1)[-1],
        pages,
        ["thermistor"],
        tags,
        [
            visual(
                "check_connector",
                2,
                "Harness seated at main PCB?",
                f"Verify {connector} harness is fully seated before resistance tests.",
                cp_yes_no("conn_ok", "sensor_ohms", "repair_conn", "repair_conn_out", "Repair or reconnect harness at main PCB."),
            ),
            instr("repair_conn", 3, "Repair harness", "Reseat or repair connector, then retest.", "check_connector"),
            outcome("repair_conn_out", 4, "Repair harness", "Repair main PCB harness connection."),
            meas(
                "sensor_ohms",
                5,
                "Thermistor resistance",
                f"Power off. Disconnect {connector}. Measure {pins} — compare to §1-12 NTC table at measured cabinet temperature.",
                "cabinetThermistorOhms",
                connector,
                pins,
                meas_branches("ntc", "sensor_ok", "replace_sensor", "In table range"),
            ),
            outcome("replace_sensor", 6, "Replace sensor", "Replace thermistor when open, shorted, or out of table range."),
            outcome("sensor_ok", 7, "Sensor verified", "Thermistor resistance and connections verified."),
        ],
    )


def fan_voltage_proc(pid, title, fan_label, connector, pins, component_ids, tags, pages):
    return proc(
        pid,
        title,
        "2-17",
        f"{fan_label} fan voltage (Test 1)",
        pages,
        component_ids,
        tags,
        [
            instr(
                "test_mode_1",
                2,
                "Enter Test Mode 1",
                "Push main PCB test button once — compressor, F-FAN, C-FAN run; main damper opens; all display segments on.",
                "fan_voltage",
            ),
            meas(
                "fan_voltage",
                3,
                f"{fan_label} fan supply voltage",
                f"Measure {connector} {pins} vs GND — 11.4–12.6 V in Test Mode 1 per LG BLDC fan spec.",
                "lgRefrigeratorFanVoltage",
                connector,
                pins,
                meas_branches("fan", "fan_ok", "replace_fan", "11.4–12.6 V"),
            ),
            outcome("replace_fan", 4, "Replace fan or PCB", f"Replace {fan_label} BLDC fan when voltage low; main PCB if motor verified good."),
            outcome("fan_ok", 5, "Fan verified", f"{fan_label} fan supply verified in Test Mode 1."),
        ],
    )


PROCEDURES = [
    thermistor_proc(
        "lgsxs-freezer-sensor",
        "§1-12: Freezer cabinet sensor (CON7)",
        "1-12",
        "CON7",
        "sensor ↔ GND",
        ["thermistor", "not_cooling", "sensor_check"],
        [34, 35],
    ),
    thermistor_proc(
        "lgsxs-fresh-food-sensor",
        "§1-12: Cold storage sensors 1 & 2 (CON8)",
        "1-12",
        "CON8",
        "sensor ↔ GND",
        ["thermistor", "weak_cooling_ff", "sensor_check"],
        [34, 35],
    ),
    thermistor_proc(
        "lgsxs-defrost-sensor",
        "§8 flow: Defrost sensor resistance",
        "defrost-sensor",
        "defrost sensor",
        "NTC ↔ GND",
        ["thermistor", "defrost", "frost_buildup", "no_defrost"],
        [73, 74],
    ),
    thermistor_proc(
        "lgsxs-ambient-sensor",
        "§2-16: Ambient sensor (Better1 models)",
        "2-16-ambient",
        "ambient",
        "NTC ↔ GND",
        ["thermistor", "Er", "ambient", "sensor_check"],
        [20, 21],
    ),
    fan_voltage_proc(
        "lgsxs-fz-fan",
        "§2-17: Freezer BLDC fan (F-FAN)",
        "F-FAN",
        "F-FAN harness",
        "supply ↔ GND",
        ["evap_fan"],
        ["F-FAN", "evap_fan", "airflow", "not_cooling", "frost_buildup"],
        [21, 24],
    ),
    fan_voltage_proc(
        "lgsxs-condenser-fan",
        "§2-17: Condenser BLDC fan (C-FAN)",
        "C-FAN",
        "C-FAN harness",
        "supply ↔ GND",
        ["condenser_fan"],
        ["C-FAN", "condenser_fan", "airflow", "not_cooling"],
        [21, 24],
    ),
    proc(
        "lgsxs-damper",
        "§2-17: Stepping damper + OptiChill (Test 1/2)",
        "2-17-damper",
        "Stepping motor damper",
        [21, 22],
        ["damper_motor"],
        ["damper", "airflow", "weak_cooling_ff"],
        [
            instr(
                "test1_damper",
                2,
                "Test Mode 1 — damper open",
                "Press main PCB test button once — main stepping damper fully OPEN (baffle open); OptiChill damper CLOSED.",
                "damper_open_ok",
            ),
            visual(
                "damper_open_ok",
                3,
                "Main damper open?",
                "Verify fresh-food airflow increases when main damper opens in Test Mode 1.",
                cp_yes_no("open_yes", "test2_damper", "open_no", "replace_damper_out", "Replace stepping damper motor or main PCB driver."),
            ),
            instr(
                "test2_damper",
                4,
                "Test Mode 2 — damper closed",
                "From Test 1, press test button once — compressor and fans OFF, defrost heater ON, main damper CLOSED.",
                "damper_closed_ok",
            ),
            visual(
                "damper_closed_ok",
                5,
                "Main damper closed?",
                "Verify damper closes in Test Mode 2 (forced defrost).",
                cp_yes_no("closed_yes", "damper_ok", "closed_no", "replace_damper_out", "Replace stepping damper motor when stuck open/closed."),
            ),
            outcome("replace_damper_out", 6, "Replace damper", "Replace stepping damper motor or main PCB driver output."),
            outcome("damper_ok", 7, "Damper verified", "Main and OptiChill damper motion verified via Test 1/2."),
        ],
    ),
    proc(
        "lgsxs-defrost-heater",
        "§2-17: Defrost heater (Test Mode 2)",
        "2-17-defrost",
        "Forced defrost heater",
        [21, 22],
        ["defrost_heater"],
        ["defrost_heater", "frost_buildup", "no_defrost"],
        [
            instr(
                "enter_test2",
                2,
                "Enter Test Mode 2",
                "Press test button once (Test 1), then once more — forced defrost: heater ON, compressor/fans OFF, damper closed.",
                "heater_voltage",
            ),
            meas(
                "heater_voltage",
                3,
                "Defrost heater voltage",
                "Measure CON2 pin 1 ↔ 7 — 112–116 VAC when heater energized in Test Mode 2. Should read 0 V in Test Mode 1.",
                "lgDefrostHeaterVoltage",
                "CON2",
                "1 ↔ 7",
                meas_branches("defrost_v", "heater_ok", "replace_heater_pcb", "112–116 V"),
            ),
            outcome("replace_heater_pcb", 4, "Replace heater or PCB", "Replace defrost heater or relay RY7 / main PCB when voltage missing with good heater."),
            outcome("heater_ok", 5, "Defrost heater OK", "Defrost heater and PCB output verified in Test Mode 2."),
        ],
    ),
    proc(
        "lgsxs-compressor",
        "§2-17: Compressor relay drive (Test Mode 1)",
        "2-17-comp",
        "Conventional compressor relay",
        [21, 24],
        ["compressor"],
        ["compressor", "not_cooling", "relay"],
        [
            instr(
                "test1_comp",
                2,
                "Enter Test Mode 1",
                "Press main PCB test button once — compressor runs continuously with F-FAN and C-FAN (conventional relay, not linear inverter).",
                "comp_running",
            ),
            visual(
                "comp_running",
                3,
                "Compressor running?",
                "Confirm compressor starts in Test Mode 1 (7-minute delay may apply after recent stop).",
                cp_yes_no("comp_yes", "comp_ok", "comp_no", "check_relay", "Compressor did not start in Test Mode 1."),
            ),
            instr(
                "check_relay",
                4,
                "Check relay RY2",
                "Power off. Inspect compressor relay RY2 and AC converting relay per load driving circuit §1-4.",
                "replace_relay",
            ),
            outcome("replace_relay", 5, "Replace relay or PCB", "Replace compressor driving relay RY2 or main PCB when relay coil/open fault."),
            outcome("comp_ok", 6, "Compressor path OK", "Compressor relay drive verified in Test Mode 1."),
        ],
    ),
    proc(
        "lgsxs-door-switch",
        "§1-4: Door switches A/B/C/D (Test 1 fan stop)",
        "1-4",
        "Door open sensing",
        [24, 25],
        ["door_switch"],
        ["door_switch", "door_left_open", "fan_stops"],
        [
            instr(
                "test1_door",
                2,
                "Enter Test Mode 1",
                "Press main PCB test button once — F-FAN runs continuously.",
                "door_open_test",
            ),
            visual(
                "door_open_test",
                3,
                "Fan stops when door opens?",
                "Open freezer or refrigerator door during Test 1 — F-FAN should stop; resumes when door closes (switches A/B/C/D in parallel).",
                cp_yes_no("fan_stops_yes", "door_ok", "fan_stops_no", "replace_switch", "Replace door switch or repair harness to main PCB."),
            ),
            outcome("replace_switch", 4, "Replace door switch", "Replace failed door switch (A/B/C/D) or repair parallel sense circuit."),
            outcome("door_ok", 5, "Door switch OK", "Door switch input and Test Mode fan-stop behavior verified."),
        ],
    ),
    proc(
        "lgsxs-display-communication",
        "§1-11: Main ↔ display MICOM communication",
        "1-11",
        "Display MICOM communication",
        [33, 34],
        ["display_panel", "main_control"],
        ["hmi_check", "display_dead", "comm_fault"],
        [
            visual(
                "display_partial",
                2,
                "Display fault or partial segments?",
                "Poor main↔display MICOM exchange >2 min causes display faults — check 4-wire L/Wire FD/H harness at door hinge.",
                cp_yes_no("comm_yes", "check_harness", "comm_no", "comm_ok", "Display communication appears normal."),
            ),
            instr(
                "check_harness",
                3,
                "Inspect display harness",
                "Verify 4-wire harness between main PCB and display PCB — 12 V and 5 V supplies plus TX/RX per §1-11.",
                "comm_restored",
            ),
            visual(
                "comm_restored",
                4,
                "Display restored?",
                "After harness repair and power cycle, is display fully functional?",
                cp_yes_no("restored_yes", "comm_path_ok", "replace_pcbs", "replace_pcbs_out", "Replace main and/or display PCB."),
            ),
            outcome("comm_ok", 5, "No comm fault", "Display communication normal."),
            outcome("replace_pcbs_out", 6, "Replace PCB(s)", "Replace main PCB and/or display PCB when harness verified."),
            outcome("comm_path_ok", 7, "Communication OK", "Display MICOM communication restored."),
        ],
    ),
    proc(
        "lgsxs-lcd-check",
        "§2-16: LCD / LED graphics check",
        "2-16",
        "LCD check function",
        [20, 21],
        ["display_panel"],
        ["hmi_check", "user_interface", "display_test"],
        [
            instr(
                "lcd_check_enter",
                2,
                "Enter LCD check",
                "Simultaneously press Express Freezer + Freezer temp adjust ~1 s — all LCD/LED graphics and backlight turn on.",
                "lcd_all_on",
            ),
            visual(
                "lcd_all_on",
                3,
                "All segments illuminate?",
                "Every LCD/LED graphic region (C–G) should turn on. Hidden faults: R2, OptiChill, water tank, ice maker, ambient (Better1).",
                cp_yes_no("segments_yes", "lcd_ok", "segments_no", "segment_fault", "Segment(s) failed — note which region (C–G) stayed off."),
            ),
            outcome("segment_fault", 4, "Segment or sensor fault", "Follow LCD check map: region C=R2/micom comm, D=OptiChill/water tank, E=ice sensor, F=ice unit, G=ambient."),
            outcome("lcd_ok", 5, "LCD check passed", "All display segments and backlight verified."),
        ],
    ),
    proc(
        "lgsxs-ice-maker",
        "§3: Ice maker electrical (LSC27926**)",
        "3-ice",
        "Ice maker unit and test switch",
        [42, 49],
        ["ice_maker_module"],
        ["ice_maker", "no_ice", "LSC27926"],
        [
            visual(
                "no_ice",
                2,
                "No ice production?",
                "LSC27926** models — verify ice maker harness, test switch on ice maker unit, and LCD check region F (ice maker unit).",
                cp_yes_no("ice_fault_yes", "check_im", "ice_fault_no", "ice_ok", "Ice maker path not faulting."),
            ),
            instr(
                "check_im",
                3,
                "Ice maker harness and test switch",
                "Verify ice maker connector seating. Press ice maker test switch — ice should eject when kit healthy. Check relays RY4/RY5/RY12.",
                "replace_im",
            ),
            outcome("replace_im", 4, "Replace ice maker parts", "Replace ice maker kit, tray sensor, or dispenser relays per §3 troubleshooting."),
            outcome("ice_ok", 5, "Ice maker OK", "Ice maker electrical path verified."),
        ],
    ),
    proc(
        "lgsxs-water-dispenser",
        "§2-18: Water / ice dispenser valves",
        "2-18",
        "Dispenser water and ice solenoids",
        [22, 23],
        ["water_valve"],
        ["water_dispenser", "no_water", "dispenser"],
        [
            visual(
                "no_water",
                2,
                "No water or ice dispense?",
                "Select water/cube/crushed at dispenser — pressing rubber button opens solenoids. Stops when freezer door open.",
                cp_yes_no("disp_yes", "check_valve", "disp_no", "disp_ok", "Dispenser functions normally."),
            ),
            instr(
                "check_valve",
                3,
                "Water valve and relays",
                "Verify water solenoid on back plate and relay RY7 (water), RY4/RY5/RY12 (ice) per §2-18 and troubleshooting.",
                "replace_valve",
            ),
            outcome("replace_valve", 4, "Replace valve or relay", "Replace water inlet valve, duct door solenoid, or dispenser relays."),
            outcome("disp_ok", 5, "Dispenser OK", "Water/ice dispenser path verified."),
        ],
    ),
]


def test_mode_bundle() -> dict:
    return {
        "id": "lgsxs-test-mode-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "LG LSC27926 SxS — Main PCB test modes",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Main PCB test button: ×1 all loads (Test 1), ×2 forced defrost (Test 2).",
        "tags": ["service_diagnostic", "defrost", "load_test", "damper", "control_board"],
        "entryStepId": "tm_1",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [21]},
        "steps": [
            instr(
                "tm_1",
                1,
                "Test Mode 1 — strong cold",
                "Push main PCB test button once: compressor, F-FAN, C-FAN run; defrost heater OFF; main damper OPEN; all display segments ON.",
                "tm_2",
            ),
            instr(
                "tm_2",
                2,
                "Test Mode 2 — forced defrost",
                "From Test 1, push test button once: compressor/fans OFF; defrost heater ON; damper CLOSED; display segments OFF.",
                "@continue",
            ),
        ],
    }


BUNDLES = [test_mode_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "LG LSC27926 side-by-side refrigerator",
        "notes": "§2-17 PCB test modes, §1-12 NTC table, §1-11 display MICOM. Separate from lg_lrmvs linear platform.",
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
                "relatedCodes": [t for t in item.get("tags", []) if t in ("Er",)],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# LG LSC27926 SxS refrigerator (`lg_sxs`)

**Manual:** LG-LSC27926-SXS — LSC27926** side-by-side with dispenser  
**Platform:** `lg_sxs` — **not** `lg_lrmvs` (French-door linear)  
**Extraction:** `knowledge/pattern-catalog/LG_LSC27926_SXS_EXTRACTION.md`

14 procedures + 1 service-mode bundle (PCB Test 1/2).

Regenerate: `python backend/scripts/generate_lg_lsc27926_sxs_fridge_procedure_seeds.py`
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
        "attach_lg_lsc27926_sxs_fridge_diagnostic_effects.py",
        "attach_lg_lsc27926_sxs_fridge_service_modes.py",
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
