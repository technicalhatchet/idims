#!/usr/bin/env python3
"""Generate W11803249 (Whirlpool Theseus counter-depth French door) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_theseus_cdfd"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_theseus_cdfd"

SOURCE = {
    "manualId": "W11803249",
    "manualTitle": "Whirlpool 36 in Counter-Depth 24 cu ft French Door (W11803249B)",
    "extractedTextFile": "backend/docs/manuals/technical-manual-w11803249-revb cdfd2024-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": "Disconnect power before servicing. Replace all parts and panels before operating.",
    "sourceExcerpt": "Disconnect power before servicing.",
    "requiresInput": False,
}


def proc(pid, title, oem_num, oem_title, pages, component_ids, tags, steps):
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
        "id": sid, "order": order, "type": "measurement", "title": title, "body": body,
        "sourceExcerpt": excerpt or body, "measurementKnowledgeId": kid,
        "testPoint": {"connector": connector, "pins": pins, "label": title},
        "requiresInput": True, "branches": branches,
    }


def instr(sid, order, title, body, nxt=None, excerpt=""):
    step = {"id": sid, "order": order, "type": "instruction", "title": title, "body": body,
            "sourceExcerpt": excerpt or body, "requiresInput": False}
    if nxt:
        step["defaultNextStepId"] = nxt
    return step


def visual(sid, order, title, body, branches, excerpt=""):
    return {"id": sid, "order": order, "type": "visual_check", "title": title, "body": body,
            "sourceExcerpt": excerpt or body, "requiresInput": True, "branches": branches}


def outcome(sid, order, title, text):
    return {"id": sid, "order": order, "type": "outcome", "title": title, "oemOutcome": text, "requiresInput": False}


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


def select_test_step(test_num: str, test_name: str, next_id: str) -> dict:
    return instr(
        f"select_test_{test_num}",
        2,
        f"Navigate to manual test {test_num}",
        (
            f"Enter Service Test Mode (any 3 keys ×3 within 8 s). Manual control: 1st button short = enter step list; "
            f"3rd button advances to step {test_num}. Confirm with 1st button."
        ),
        next_id,
        f"Manual test {test_num} — {test_name}",
    )


def ntc_proc(pid, st, zone, connector, pins, tags):
    return proc(
        pid, f"Service Test {st}: {zone} thermistor", st, f"{zone} Thermistor", [77, 122],
        ["thermistor"], tags,
        [
            select_test_step(st, f"{zone} thermistor", "read_ntc"),
            visual("read_ntc", 3, f"{zone} reading", "Displays °C/°F or oC (open) / sC (short). Valid temp?", cp_yes_no("ok", "verified", "bad", "bench", f"{zone} thermistor fault.")),
            instr("bench", 4, "Bench ohms", f"Power off. {connector} {pins} — 2700 Ω @ 77°F (2692–2858 Ω).", "ohms"),
            meas("ohms", 5, f"{zone} resistance", "2.7k NTC chart.", "whirlpoolTheseusCdfdThermistorOhms", connector, pins, ohm_branches("ntc", "verified", "replace", "2700 Ω @ 77°F")),
            outcome("replace", 6, f"Replace {zone} thermistor", "Replace thermistor or harness."),
            outcome("verified", 7, f"{zone} verified", f"Test {st} and bench ohms OK."),
        ],
    )


PROCEDURES = [
    ntc_proc("w11803249-test-13-rc-thermistor", "13", "RC compartment", "P5", "P5-1 ↔ P5-2", ["thermistor_check", "weak_cooling_ff"]),
    ntc_proc("w11803249-test-12-fc-thermistor", "12", "FC compartment", "P10", "P10-6 ↔ P10-7", ["thermistor_check", "not_cooling"]),
    ntc_proc("w11803249-test-10-fc-evap-thermistor", "10", "FC evaporator", "P5", "P5-3 ↔ P5-4", ["thermistor_check", "frost_buildup"]),
    ntc_proc("w11803249-test-17-pantry-thermistor", "17", "Pantry", "P70", "P70-1 ↔ P70-2", ["thermistor_check", "weak_cooling_ff"]),
    proc(
        "w11803249-test-29-rh-sensor", "Service Test 29: External RH sensor", "29", "Relative Humidity Sensor", [77, 124],
        ["humidity_sensor"], ["sensor_fault", "moisture"],
        [
            select_test_step("29", "RH sensor", "read_rh"),
            visual("read_rh", 3, "RH percentage", "Reads RH % or oC/sC fault.", cp_yes_no("rh_ok", "rh_ok_out", "rh_bad", "rh_voltage", "RH sensor fault — may force mullion heater 100%.")),
            instr("rh_voltage", 4, "Check RH voltage", "HMI J4-4 to J3-3 = 12.7 VDC power; J4-2 to J3-3 = signal per RH table.", "rh_ok_out"),
            outcome("rh_ok_out", 5, "RH sensor verified", "External humidity sensor reads correctly."),
        ],
    ),
    proc(
        "w11803249-test-72-compressor", "Service Test 72/75: Compressor & inverter", "72", "Compressor Cooling Test", [78, 117],
        ["compressor"], ["not_cooling", "compressor_check", "sealed_system"],
        [
            select_test_step("72", "Compressor cooling", "comp_test"),
            instr("comp_test", 3, "Run compressor test", "Test 72: compressor + condenser fan 100% until exit. Test 75: step speeds with Enter.", "comp_runs"),
            visual("comp_runs", 4, "Compressor runs", "120 VAC black-white and 12.7 VDC orange-blue at inverter?", cp_yes_no("ok", "verified", "fail", "bench", "Check inverter LED fault codes.")),
            instr("bench", 5, "Bench windings", "Power off. Compressor = 24.7 Ω.", "ohms"),
            meas("ohms", 6, "Compressor windings", "24.7 Ω — if good, replace inverter.", "whirlpoolTheseusCdfdCompressorOhms", "compressor", "windings", ohm_branches("c", "verified", "replace_comp", "24.7 Ω")),
            outcome("replace_comp", 7, "Replace compressor/inverter", "Windings failed or inverter fault."),
            outcome("verified", 8, "Compressor verified", "Tests 72/75 and compressor path OK."),
        ],
    ),
    proc(
        "w11803249-test-113-condenser-fan", "Service Test 113: Condenser fan", "113", "Condenser Fan Test", [78, 118],
        ["condenser_fan"], ["condenser_fan", "not_cooling"],
        [
            select_test_step("113", "Condenser fan", "cfan"),
            visual("cfan", 3, "Fan runs", "Display on — P9-1 to P9-3 = 12.7 VDC; P9-2 PWM.", cp_yes_no("ok", "verified", "fail", "replace", "Condenser fan failed.")),
            outcome("replace", 4, "Replace condenser fan", "Replace fan when voltage present but no run."),
            outcome("verified", 5, "Condenser fan verified", "Test 113 OK."),
        ],
    ),
    proc(
        "w11803249-test-111-fc-evap-fan", "Service Test 111: FC evaporator fan", "111", "FC Evap Fan", [78, 119],
        ["evap_fan"], ["evap_fan", "frost_buildup"],
        [
            select_test_step("111", "FC evap fan", "fan"),
            visual("fan", 3, "Fan runs", "Display on — P8-6/P8-4 = 12.7 VDC; P8-5 PWM.", cp_yes_no("ok", "verified", "fail", "replace", "FC evap fan failed.")),
            outcome("replace", 4, "Replace FC evap fan", "Replace fan motor."),
            outcome("verified", 5, "FC evap fan verified", "Test 111 OK."),
        ],
    ),
    proc(
        "w11803249-test-80-rc-damper", "Service Test 80/81: RC & pantry dampers", "80", "RC Damper", [78, 120],
        ["damper_motor"], ["damper_check", "weak_cooling_ff"],
        [
            select_test_step("80", "RC damper", "damper"),
            visual("damper", 3, "Damper cycles", "Test 80 RC or 81 pantry — display oP/CL or FF feedback fault. P70/P12 = 6.4 VDC stepper.", cp_yes_no("ok", "verified", "fail", "replace", "Damper motor failed.")),
            outcome("replace", 4, "Replace damper", "Replace RC or pantry damper assembly."),
            outcome("verified", 5, "Damper verified", "Tests 80/81 OK."),
        ],
    ),
    proc(
        "w11803249-test-131-defrost", "Service Test 131: FC defrost heater", "131", "FC Defrost Heater", [79, 121],
        ["defrost_heater"], ["defrost_heater", "frost_buildup"],
        [
            select_test_step("131", "Defrost heater", "heat"),
            visual("heat", 3, "Heater on", "Display on — P2-7 to P1-2 = 115 VAC.", cp_yes_no("ok", "bench", "fail", "bench", "No heat at board.")),
            instr("bench", 4, "Bench heater ohms", "43 Ω FC defrost heater.", "ohms"),
            meas("ohms", 5, "Defrost heater", "43 Ω spec.", "whirlpoolTheseusCdfdDefrostHeaterOhms", "P2", "P2-7 ↔ P1-2", ohm_branches("h", "verified", "replace", "43 Ω")),
            outcome("replace", 6, "Replace defrost heater", "Heater open or out of spec."),
            outcome("verified", 7, "Defrost verified", "Test 131 and heater ohms OK."),
        ],
    ),
    proc(
        "w11803249-test-181-fc-ice-maker", "Service Test 181: FC ice maker harvest", "181", "FC IM Harvest Test", [79, 128],
        ["ice_maker"], ["no_ice", "ice_maker"],
        [
            instr("im_on", 2, "Enable IM switch", "Verify FC IM switch ON at ice maker.", "select_test_181"),
            select_test_step("181", "IM harvest", "harvest"),
            visual("harvest", 4, "Harvest completes", "Display on then oF — P11-1/P11-2 motor; P70-3/P70-4 position switch. Bale arm up at home?", cp_yes_no("ok", "verified", "fail", "replace_im", "Replace IM — motor or bale arm down at home.")),
            outcome("replace_im", 5, "Replace ice maker", "IM motor or position switch failed."),
            outcome("verified", 6, "FC ice maker verified", "Harvest test 181 OK."),
        ],
    ),
    proc(
        "w11803249-test-13-water-valve", "Test 13: Water dispenser / ISO valve", "13", "Water Dispenser / ISO Valve", [129],
        ["water_valve"], ["no_water", "water_valve_check"],
        [
            instr("paddle", 2, "Depress water paddle", "Verify supply on. Collect water — energizes iso + dispenser valve.", "voltage"),
            instr("voltage", 3, "Check valve voltage", "P2-6 to P1-2 = 115 VAC at ACU while dispensing.", "flows"),
            visual("flows", 4, "Water flows", "Water dispenses with 115 VAC present?", cp_yes_no("ok", "verified", "fail", "replace", "Valve or line blockage.")),
            outcome("replace", 5, "Replace valve", "Replace iso/dual valve."),
            outcome("verified", 6, "Water valve verified", "Dispenser and iso valve OK."),
        ],
    ),
    proc(
        "w11803249-test-15-heaters", "Service Test 134/144: Mullion & fill tube heaters", "15", "Heaters", [79, 131],
        ["heater"], ["heater_check", "moisture", "no_ice"],
        [
            select_test_step("134", "Flipper mullion heater", "mullion"),
            visual("mullion", 3, "Mullion heater on", "Test 134 — J4-3/J4-2 = 12.7 VDC. Heater warms?", cp_yes_no("m_ok", "fill_tube", "m_fail", "bench_m", "Mullion heater failed.")),
            instr("fill_tube", 4, "Fill tube heater", "Test 144 — P11-4/P11-5 = 12.7 VDC.", "bench_m"),
            instr("bench_m", 5, "Bench ohms", "Mullion 15 Ω; fill tube 32 Ω.", "m_ohms"),
            meas("m_ohms", 6, "Fill tube heater", "32 Ω spec.", "whirlpoolTheseusCdfdFillTubeHeaterOhms", "P11", "P11-4 ↔ P11-5", ohm_branches("ft", "verified", "replace", "32 Ω")),
            outcome("replace", 7, "Replace heater", "Heater open or out of spec."),
            outcome("verified", 8, "Heaters verified", "Mullion and fill tube heaters OK."),
        ],
    ),
]


def service_entry_bundle():
    return {
        "id": "w11803249-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "W11803249 — Service Diagnostic Mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Three-key ×3 entry; manual control, auto test, and fault modes.",
        "tags": ["service_test", "service_diagnostic"],
        "entryStepId": "sd_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [76]},
        "steps": [instr("sd_enter", 1, "Enter Service Test Mode", "Press any 3 keypad buttons three times (1,2,3; 1,2,3; 1,2,3) within 8 s. Hold 1st button 5 s to exit.", "@continue")],
    }


BUNDLES = [service_entry_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def write_catalog():
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Whirlpool Theseus counter-depth French door (W11803249, 24 cu ft)",
        "notes": "Theseus ACU P* pinouts; external inverter; pantry damper; RH on HMI J4.",
        "plannedProcedures": [{"id": i["id"], "oemSection": i["source"]["oemTestNumber"], "title": i["title"], "status": "generated",
                               "knowledgeIds": [s["measurementKnowledgeId"] for s in i["steps"] if s.get("measurementKnowledgeId")], "relatedCodes": []} for i in PROCEDURES],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme():
    (OUT / "README.md").write_text(
        "# whirlpool_theseus_cdfd — W11803249\n\n"
        "**Platform:** `whirlpool_theseus_cdfd` — counter-depth WRF24* class\n"
        "**Procedures:** 13 + 1 bundle\n"
        "```bash\npython backend/scripts/run_procedure_manual_pipeline.py --manual W11803249\n```\n",
        encoding="utf-8",
    )


def main():
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)
    for item, fn in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        (OUT / fn).write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {fn}")
    for b in BUNDLES:
        (BUNDLE_OUT / f"{b['id']}.json").write_text(json.dumps(b, indent=2) + "\n", encoding="utf-8")
    write_catalog()
    write_readme()
    for script in (
        "attach_w11803249_diagnostic_effects.py",
        "attach_w11803249_service_modes.py",
        "attach_w11803249_procedure_diagrams.py",
    ):
        p = ROOT / "backend/scripts" / script
        if p.exists():
            subprocess.run([sys.executable, str(p)], check=True, cwd=ROOT)
    crop = ROOT / "backend/scripts/crop_w11803249_procedure_figures.py"
    if crop.exists():
        subprocess.run([sys.executable, str(crop)], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)


if __name__ == "__main__":
    main()
