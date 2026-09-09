#!/usr/bin/env python3
"""Generate LG LRMVS3006 InstaView 4-door refrigerator procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "lg_lrmvs"
BUNDLE_OUT = OUT / "bundles"

SOURCE = {
    "manualId": "LG-LRMVS-FRIDGE",
    "manualTitle": "LG LRMVS3006 InstaView 4-Door Refrigerator",
    "extractedTextFile": "backend/docs/manuals/Lg-lrmvs3006s-refrigerator-svc manual-extracted.txt",
    "verifiedAt": "2026-09-09",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Unplug the refrigerator before servicing electrical parts. R-600a is flammable — follow sealed-system precautions for CH/CL codes.",
    "sourceExcerpt": "Disconnect power before servicing. R-600a refrigerant precautions apply.",
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
        "platformId": "lg_lrmvs",
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
                f"Verify {connector} harness is fully seated — loose connections are the first check in §8 flowcharts.",
                cp_yes_no("conn_ok", "sensor_ohms", "repair_conn", "repair_conn_out", "Repair or reconnect harness at main PCB."),
            ),
            instr("repair_conn", 3, "Repair harness", "Reseat or repair connector, then retest.", "check_connector"),
            outcome("repair_conn_out", 4, "Repair harness", "Repair main PCB harness connection."),
            meas(
                "sensor_ohms",
                5,
                "Thermistor resistance",
                f"Power off. Measure {connector} {pins} — compare to §8 NTC table at measured cabinet temperature (8k–40k Ω typical).",
                "cabinetThermistorOhms",
                connector,
                pins,
                meas_branches("ntc", "sensor_ok", "replace_sensor", "In table range"),
            ),
            outcome("replace_sensor", 6, "Replace sensor", "Replace thermistor or harness when open, shorted, or out of table range."),
            outcome("sensor_ok", 7, "Sensor verified", "Thermistor resistance and connections verified."),
        ],
    )


def fan_voltage_proc(pid, title, fan_label, pins, tags, pages):
    return proc(
        pid,
        title,
        "8-fan",
        f"{fan_label} fan voltage",
        pages,
        ["evap_fan"] if "condenser" not in fan_label.lower() else ["condenser_fan"],
        tags,
        [
            instr(
                "test_mode_1",
                2,
                "Enter Test Mode 1",
                "Push main PCB test button once — compressor, damper, and all fans run (all display segments on).",
                "fan_voltage",
            ),
            meas(
                "fan_voltage",
                3,
                f"{fan_label} fan supply voltage",
                f"Measure CON3 {pins} vs GND — 11.4–12.6 V in Test Mode 1. Feedback/PWM lines should not be stuck at 0 V or 5 V.",
                "lgRefrigeratorFanVoltage",
                "CON3",
                pins,
                meas_branches("fan", "fan_ok", "replace_fan", "11.4–12.6 V"),
            ),
            outcome("replace_fan", 4, "Replace fan or PCB", f"Replace {fan_label} fan motor when voltage low or feedback/PWM stuck; main PCB if motor verified good."),
            outcome("fan_ok", 5, "Fan verified", f"{fan_label} fan supply and feedback verified."),
        ],
    )


PROCEDURES = [
    thermistor_proc(
        "lglrmvs-fz-sensor",
        "§8-1: Freezer cabinet sensor (E FS)",
        "8-1",
        "CON4",
        "18 ↔ 17",
        ["E_FS", "E FS", "thermistor", "sensor_check", "not_cooling"],
        [36, 37],
    ),
    thermistor_proc(
        "lglrmvs-ff-sensor",
        "§8-2: Fresh-food cabinet sensor (E rS)",
        "8-2",
        "CON4",
        "16 ↔ 15",
        ["E_rS", "E rS", "thermistor", "sensor_check", "weak_cooling_ff"],
        [38, 39],
    ),
    thermistor_proc(
        "lglrmvs-icing-sensor",
        "§8-3: Icing room sensor (E IS)",
        "8-3",
        "CON5",
        "18 ↔ 17",
        ["E_IS", "E IS", "thermistor", "ice_maker", "sensor_check"],
        [40, 41],
    ),
    thermistor_proc(
        "lglrmvs-fz-defrost-sensor",
        "§8-4: Freezer defrost sensor (F dS)",
        "8-4",
        "CON4",
        "22 ↔ 21",
        ["F_dS", "F dS", "thermistor", "defrost", "frost_buildup"],
        [42, 43],
    ),
    thermistor_proc(
        "lglrmvs-ff-defrost-sensor",
        "§8-5: Fresh-food defrost sensor (r dS)",
        "8-5",
        "CON4",
        "20 ↔ 19",
        ["r_dS", "r dS", "thermistor", "defrost", "frost_buildup"],
        [44, 45],
    ),
    proc(
        "lglrmvs-fz-defrost-heater",
        "§8-6: Freezer defrost heater (F dH)",
        "8-6",
        "Defrost Heater Error (F dH)",
        [46, 47],
        ["heater"],
        ["F_dH", "F dH", "defrost_heater", "frost_buildup", "no_defrost"],
        [
            visual(
                "door_gasket",
                2,
                "Door gasket sealing?",
                "Heavy ice or warm air leak can trigger F dH — inspect freezer door gasket before electrical tests.",
                cp_yes_no("gasket_ok", "heater_ohms", "replace_gasket", "replace_gasket_out", "Replace damaged door gasket."),
            ),
            outcome("replace_gasket_out", 3, "Replace gasket", "Replace freezer door gasket and allow manual defrost if heavily iced."),
            meas(
                "heater_ohms",
                4,
                "F defrost heater resistance",
                "Power off. CON9 pin 5 ↔ 13 — 62–70 Ω heater; Fuse-M should read 0 Ω.",
                "lgDefrostHeaterOhmsFreezer",
                "CON9",
                "5 ↔ 13",
                meas_branches("fz_heater", "test_mode_3", "replace_heater", "62–70 Ω"),
            ),
            outcome("replace_heater", 5, "Replace heater", "Replace freezer defrost heater or Fuse-M when open/short."),
            instr(
                "test_mode_3",
                6,
                "Enter Test Mode 3",
                "Push main PCB test button three times — display shows 33 33 (forced defrost).",
                "heater_voltage",
            ),
            meas(
                "heater_voltage",
                7,
                "F defrost heater voltage",
                "CON9 pin 5 ↔ 13 — 112–116 V in Test Mode 3. Should read 0 V in Test Mode 1.",
                "lgDefrostHeaterVoltage",
                "CON9",
                "5 ↔ 13",
                meas_branches("fz_v", "heater_ok", "replace_pcb", "112–116 V"),
            ),
            outcome("replace_pcb", 8, "Replace main PCB", "Replace main PCB when heater Ω good but no 112–116 V output."),
            outcome("heater_ok", 9, "Defrost heater OK", "Freezer defrost heater and PCB output verified."),
        ],
    ),
    proc(
        "lglrmvs-ff-defrost-heater",
        "§8-7: Fresh-food defrost heater (r dH)",
        "8-7",
        "Defrost Heater Error (r dH)",
        [48, 49],
        ["heater"],
        ["r_dH", "r dH", "defrost_heater", "frost_buildup", "no_defrost"],
        [
            visual(
                "door_gasket_r",
                2,
                "Door gasket sealing?",
                "Inspect fresh-food door gasket — air leaks can cause r dH after failed defrost.",
                cp_yes_no("gasket_r_ok", "heater_ohms_r", "replace_gasket_r", "replace_gasket_r_out", "Replace damaged door gasket."),
            ),
            outcome("replace_gasket_r_out", 3, "Replace gasket", "Replace refrigerator door gasket."),
            meas(
                "heater_ohms_r",
                4,
                "R defrost heater resistance",
                "Power off. CON9 pin 7 ↔ 13 — 103–119 Ω per §8-7.",
                "lgDefrostHeaterOhmsFridge",
                "CON9",
                "7 ↔ 13",
                meas_branches("ff_heater", "test_mode_3_r", "replace_heater_r", "103–119 Ω"),
            ),
            outcome("replace_heater_r", 5, "Replace heater", "Replace fresh-food defrost heater when out of range."),
            instr(
                "test_mode_3_r",
                6,
                "Enter Test Mode 3",
                "Push main PCB test button three times — display shows 33 33 (forced defrost).",
                "heater_voltage_r",
            ),
            meas(
                "heater_voltage_r",
                7,
                "R defrost heater voltage",
                "CON9 pin 7 ↔ 13 — 112–116 V in Test Mode 3.",
                "lgDefrostHeaterVoltage",
                "CON9",
                "7 ↔ 13",
                meas_branches("ff_v", "heater_r_ok", "replace_pcb_r", "112–116 V"),
            ),
            outcome("replace_pcb_r", 8, "Replace main PCB", "Replace main PCB when heater verified but voltage missing."),
            outcome("heater_r_ok", 9, "Defrost heater OK", "Fresh-food defrost heater path verified."),
        ],
    ),
    fan_voltage_proc(
        "lglrmvs-ff-fan",
        "§8-8: Refrigerator evaporator fan (E rF)",
        "R-fan",
        "28 ↔ 25",
        ["E_rF", "E rF", "evap_fan", "airflow", "weak_cooling_ff"],
        [50, 51],
    ),
    fan_voltage_proc(
        "lglrmvs-fz-fan",
        "§8-9: Freezer evaporator fan (E FF)",
        "F-fan",
        "16 ↔ 13",
        ["E_FF", "E FF", "evap_fan", "airflow", "not_cooling", "frost_buildup"],
        [52, 53],
    ),
    fan_voltage_proc(
        "lglrmvs-icing-fan",
        "§8-10: Icing compartment fan (E IF)",
        "I-fan",
        "24 ↔ 21",
        ["E_IF", "E IF", "ER", "evap_fan", "ice_maker", "frost_buildup"],
        [54, 55],
    ),
    fan_voltage_proc(
        "lglrmvs-condenser-fan",
        "§8-11: Condenser fan (E CF)",
        "C-fan",
        "12 ↔ 9",
        ["E_CF", "E CF", "condenser_fan", "airflow", "not_cooling"],
        [56, 57],
    ),
    proc(
        "lglrmvs-display-communication",
        "§8-12: Main ↔ display communication (E CO)",
        "8-12",
        "Communication Error (E CO)",
        [58, 59],
        ["display_panel", "main_control"],
        ["E_CO", "E CO", "hmi_check", "display_dead"],
        [
            visual(
                "co_active",
                2,
                "E CO on display?",
                "E CO indicates main PCB ↔ display PCB communication fault — often hinge harness CON101.",
                cp_yes_no("co_yes", "check_hinge", "co_no", "comm_ok", "Communication error not present."),
            ),
            instr(
                "check_hinge",
                3,
                "Inspect hinge harness",
                "Check CON101 at door hinge for loose pins or damage. Verify 12 V (pins 5–4) and 5 V (pins 1–4) per §8-12.",
                "comm_restored",
            ),
            visual(
                "comm_restored",
                4,
                "E CO cleared?",
                "After harness repair and power cycle, is E CO cleared?",
                cp_yes_no("comm_ok_yes", "comm_path_ok", "replace_boards", "replace_boards_out", "Replace main and/or display PCB per voltage tree."),
            ),
            outcome("comm_ok", 5, "No comm fault", "Display communication normal."),
            outcome("replace_boards_out", 6, "Replace PCB(s)", "Replace main PCB and/or display PCB when harness verified."),
            outcome("comm_path_ok", 7, "Communication OK", "E CO cleared after harness or PCB service."),
        ],
    ),
    thermistor_proc(
        "lglrmvs-convert-sensor",
        "§8-22: Convert drawer sensor (E CS)",
        "8-22-CS",
        "CON4",
        "13 ↔ 14",
        ["E_CS", "E CS", "thermistor", "sensor_check"],
        [78, 79],
    ),
    proc(
        "lglrmvs-sealed-system",
        "§8-22: Sealed-system leak cycle (E CH / E CL)",
        "8-22-CHCL",
        "High/Low side cycle leakage",
        [80, 87],
        ["sealed_system", "compressor"],
        ["E_CH", "E CH", "E_CL", "E CL", "sealed_system", "not_cooling"],
        [
            visual(
                "leak_code",
                2,
                "E CH or E CL active?",
                "CH = high-side leak cycle; CL = low-side leak cycle on R-600a linear compressor platform.",
                cp_yes_no("leak_yes", "uv_leak_check", "leak_no", "no_leak_code", "Sealed-system leak code not displayed."),
            ),
            instr(
                "uv_leak_check",
                3,
                "UV leak detection",
                "Follow §8-22 steps: verify error code, inspect sealed system, check restriction/compressor, high/low side parts, then UV driver leak check.",
                "sealed_repair",
            ),
            outcome("sealed_repair", 4, "Sealed-system repair", "Repair refrigerant leak, restriction, or compressor per OEM sealed-system procedure."),
            outcome("no_leak_code", 5, "No leak code", "E CH/E CL not present — investigate other cooling faults."),
        ],
    ),
    proc(
        "lglrmvs-wifi-modem",
        "§8-20: Wi-Fi modem communication (E Od)",
        "8-20",
        "Wi-Fi Modem Error (E Od)",
        [77, 78],
        ["control_board"],
        ["E_Od", "E Od", "hmi_check"],
        [
            visual(
                "od_active",
                2,
                "E Od on display?",
                "E Od is ThinQ WiFi modem communication — cooling usually unaffected.",
                cp_yes_no("od_yes", "check_modem_harness", "od_no", "modem_ok", "WiFi error not displayed."),
            ),
            instr(
                "check_modem_harness",
                3,
                "Modem harness J1/J3",
                "Verify WiFi modem connector seating and voltage at J1/J3 per §8-20 flowchart.",
                "modem_restored",
            ),
            visual(
                "modem_restored",
                4,
                "E Od cleared?",
                "After harness or modem replacement, is E Od cleared?",
                cp_yes_no("modem_ok_yes", "modem_path_ok", "replace_modem", "replace_modem_out", "Replace WiFi modem or main PCB."),
            ),
            outcome("modem_ok", 5, "No WiFi fault", "WiFi modem communication normal."),
            outcome("replace_modem_out", 6, "Replace modem/PCB", "Replace WiFi modem assembly or main PCB."),
            outcome("modem_path_ok", 7, "WiFi OK", "E Od cleared after service."),
        ],
    ),
    proc(
        "lglrmvs-display-mode",
        "§13-1-15: Display / demo mode (OFF)",
        "13-1-15",
        "Display mode cancel",
        [127],
        ["display_panel", "main_control"],
        ["cooling_off", "display_mode", "not_cooling"],
        [
            visual(
                "display_off",
                2,
                "Panel shows OFF or O?",
                "Display mode disables all cooling (lamp/UI only). Ice Plus ×3 while holding Fridge button toggles mode §13-1-15.",
                cp_yes_no("demo_yes", "cancel_demo", "demo_no", "cooling_ok", "Display mode not active."),
            ),
            instr(
                "cancel_demo",
                3,
                "Cancel display mode",
                "Door open: press Ice Plus 3 times while holding Refrigerator button until special beep — repeat to confirm OFF cleared.",
                "demo_cleared",
            ),
            visual(
                "demo_cleared",
                4,
                "Cooling restored?",
                "After canceling display mode, does unit resume normal cooling?",
                cp_yes_no("cooling_restored", "demo_resolved", "investigate_cooling", "still_warm", "Cooling fault remains — continue diagnostics."),
            ),
            outcome("cooling_ok", 5, "Not display mode", "Unit not in display/demo mode."),
            outcome("demo_resolved", 6, "Display mode cleared", "Display mode canceled — verify temperatures recover."),
            outcome("still_warm", 7, "Continue diagnostics", "Display mode ruled out — run cooling/error-code procedures."),
        ],
    ),
    proc(
        "lglrmvs-ice-maker-electrical",
        "§8-24: Ice maker kit electrical (E ID / E IU)",
        "8-24",
        "Ice maker tray sensor / kit electrical",
        [33, 34],
        ["ice_maker_module"],
        ["E_ID", "E ID", "E_IU", "E IU", "ice_maker", "no_ice"],
        [
            visual(
                "ice_error",
                2,
                "E ID or E IU displayed?",
                "E ID = ice tray sensor short/open; E IU = ice maker kit motor, gear, hall IC, or heater open.",
                cp_yes_no("ice_err_yes", "check_im_harness", "ice_err_no", "ice_ok", "Ice maker electrical fault not displayed."),
            ),
            instr(
                "check_im_harness",
                3,
                "Ice maker harness and test switch",
                "Verify ice maker connector seating. Press I/M test switch — ice should drop when kit healthy. Check tray sensor and kit resistance per §8-24.",
                "im_repair",
            ),
            outcome("im_repair", 4, "Replace ice maker parts", "Replace tray sensor (E ID) or complete ice maker kit (E IU) per OEM parts table."),
            outcome("ice_ok", 5, "No ice maker fault", "Ice maker electrical path not faulting."),
        ],
    ),
]


def test_mode_bundle() -> dict:
    return {
        "id": "lglrmvs-test-mode-entry",
        "version": "1.0.0",
        "platformId": "lg_lrmvs",
        "manualId": SOURCE["manualId"],
        "title": "LG LRMVS — Main PCB test mode",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Main PCB test button: ×1 all loads, ×2 damper closed, ×3 forced defrost.",
        "tags": ["service_diagnostic", "defrost", "load_test", "damper"],
        "entryStepId": "tm_1",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [88]},
        "steps": [
            instr(
                "tm_1",
                1,
                "Test Mode 1 — all loads",
                "Push main PCB test button once: compressor, damper, and all fans run (all display segments on). Fan voltage checks use CON3.",
                "tm_2",
            ),
            instr(
                "tm_2",
                2,
                "Test Mode 2 — damper closed",
                "Push test button twice: damper closed (display shows 22 22).",
                "tm_3",
            ),
            instr(
                "tm_3",
                3,
                "Test Mode 3 — forced defrost",
                "Push test button three times: forced defrost (display shows 33 33). Defrost heater voltage at CON9.",
                "@continue",
            ),
        ],
    }


def damper_test_bundle() -> dict:
    return {
        "id": "lglrmvs-damper-test",
        "version": "1.0.0",
        "platformId": "lg_lrmvs",
        "manualId": SOURCE["manualId"],
        "title": "LG LRMVS — Damper test (Test Mode 2)",
        "modeKind": "load_test",
        "uiVariants": ["any"],
        "description": "Test button ×2 closes damper — display 22 22.",
        "tags": ["damper", "airflow"],
        "entryStepId": "damper_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [88]},
        "steps": [
            instr(
                "damper_enter",
                1,
                "Enter damper test",
                "Push main PCB test button twice — damper closes (22 22 on display). Verify chill-room airflow changes.",
                "@continue",
            ),
        ],
    }


BUNDLES = [test_mode_bundle(), damper_test_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": "lg_lrmvs",
        "templateId": "refrigerator",
        "label": "LG LRMVS3006 InstaView 4-door refrigerator",
        "notes": "§8 error-code flowcharts + §9 PCB test modes (×1/×2/×3). Measurements batch7.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "relatedCodes": [
                    t
                    for t in item.get("tags", [])
                    if t.startswith("E_") or t.startswith("F_") or t.startswith("r_")
                ],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# LG LRMVS3006 InstaView refrigerator (`lg_lrmvs`)

**Manual:** LG-LRMVS-FRIDGE — LRMVS3006* 4-door French door InstaView  
**Platform:** `lg_lrmvs` — LRMVS3006*  
**Extraction:** `knowledge/pattern-catalog/LG_LRMVS3006S_EXTRACTION.md`

17 procedures + 2 service-mode bundles (PCB test ×1/×2/×3).

Regenerate: `python backend/scripts/generate_lg_lrmvs_fridge_procedure_seeds.py`
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
        "attach_lg_lrmvs_fridge_diagnostic_effects.py",
        "attach_lg_lrmvs_fridge_service_modes.py",
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
