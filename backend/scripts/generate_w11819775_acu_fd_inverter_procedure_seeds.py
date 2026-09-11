#!/usr/bin/env python3
"""Generate W11819775 (Whirlpool 31 cu ft ACU inverter French door) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_acu_fd_inverter"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_acu_fd_inverter"

SOURCE = {
    "manualId": "W11819775",
    "manualTitle": "Whirlpool 36 in 31 cu ft French Door Refrigerator (W11819775B)",
    "extractedTextFile": "backend/docs/manuals/technical-manual-w11819775-revb 2026 frenchdoor-extracted.txt",
    "verifiedAt": "2026-09-10",
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


def proc(pid, title, oem_num, oem_title, pages, component_ids, tags, steps):
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


def select_test_step(test_num: str, test_name: str, next_id: str) -> dict:
    display = test_num.zfill(2)
    return instr(
        f"select_test_{display}",
        2,
        f"Navigate to Service Test {display}",
        (
            f"In Service Diagnostic Mode use ▲/▼ to reach step {display}. "
            f"Press Freezer button to enter test. Amber step number; result on display."
        ),
        next_id,
        f"Service Test {display} — {test_name}",
    )


def thermistor_proc(pid, st_num, zone, connector, pins, tags):
    return proc(
        pid,
        f"Service Test {st_num}: {zone} thermistor",
        st_num,
        f"{zone} Thermistor",
        [57, 97],
        ["thermistor"],
        tags,
        [
            select_test_step(st_num, f"{zone} thermistor", "read_temp"),
            visual(
                "read_temp",
                3,
                f"{zone} thermistor reading",
                f"Service test reads thermistor temperature in °C. Does display show a valid temperature (not Er)?",
                cp_yes_no("temp_ok", "ntc_verified", "temp_bad", "bench_ntc", f"{zone} thermistor Er or out of range — bench test harness."),
            ),
            instr(
                "bench_ntc",
                4,
                f"Bench {zone} thermistor ohms",
                f"Disconnect power. Measure at {connector} {pins} — 2k Ω @ 77°F (1929–2083 Ω); 17.3k @ 0°F.",
                "ntc_ohms",
            ),
            meas(
                "ntc_ohms",
                5,
                f"{zone} thermistor resistance",
                "Measure at harness with power off.",
                "whirlpoolAcuFdInverterThermistorOhms",
                connector,
                pins,
                ohm_branches("ntc", "ntc_verified", "replace_ntc", "2k Ω @ 77°F"),
            ),
            outcome("replace_ntc", 6, f"Replace {zone} thermistor", f"Replace {zone} thermistor or repair harness at {connector}."),
            outcome("ntc_verified", 7, f"{zone} thermistor verified", f"Service test {st_num} and bench ohms verified."),
        ],
    )


PROCEDURES = [
    thermistor_proc("w11819775-test-01-rc-thermistor", "01", "RC compartment", "CN6", "CN6-1 ↔ CN6-2", ["thermistor_check", "weak_cooling_ff", "F3E1"]),
    thermistor_proc("w11819775-test-03-fc-thermistor", "03", "FC compartment", "CN6", "CN6-7 ↔ CN6-8", ["thermistor_check", "not_cooling", "F3E2"]),
    thermistor_proc("w11819775-test-05-fc-evap-thermistor", "05", "FC evaporator", "CN6", "CN6-9 ↔ CN6-10", ["thermistor_check", "frost_buildup", "F3E4"]),
    proc(
        "w11819775-test-07-im-tray-thermistor",
        "Service Test 7: FC ice maker tray thermistor",
        "07",
        "FC Ice Maker Tray Thermistor",
        [57, 98],
        ["thermistor", "ice_maker"],
        ["thermistor_check", "no_ice", "FBEB"],
        [
            select_test_step("07", "IM tray thermistor", "read_im_temp"),
            visual(
                "read_im_temp",
                3,
                "IM tray thermistor reading",
                "Service test 07 reads tray temperature °C. Valid reading or Er?",
                cp_yes_no("im_ok", "im_verified", "im_bad", "bench_im", "Tray thermistor Er — part of ice maker assembly."),
            ),
            instr("bench_im", 4, "Bench IM tray thermistor", "Disconnect power. CN13-3 V-R to CN13-4 GND — 5k Ω @ 77°F (4950–5050 Ω).", "im_ohms"),
            meas("im_ohms", 5, "IM tray thermistor", "5k NTC chart — replace IM assembly if failed.", "whirlpoolAcuFdInverterImTrayThermistorOhms", "CN13", "CN13-3 ↔ CN13-4", ohm_branches("im", "im_verified", "replace_im", "5k Ω @ 77°F")),
            outcome("replace_im", 6, "Replace ice maker", "FBEB — replace ice maker assembly (tray thermistor not separately serviceable)."),
            outcome("im_verified", 7, "IM tray thermistor verified", "Service test 7 and tray thermistor verified."),
        ],
    ),
    proc(
        "w11819775-test-10-rh-sensor",
        "Service Test 10: Ambient humidity sensor",
        "10",
        "Ambient Humidity Sensor",
        [57, 99],
        ["humidity_sensor"],
        ["sensor_fault", "moisture", "F3E8"],
        [
            select_test_step("10", "RH sensor", "read_rh"),
            visual(
                "read_rh",
                3,
                "Relative humidity reading",
                "Displays RH percentage. Er indicates sensor fault.",
                cp_yes_no("rh_ok", "rh_verified", "rh_bad", "check_rh_voltage", "RH sensor Er — check CN13-8 +5V and CN13-7 RT signal."),
            ),
            instr("check_rh_voltage", 4, "Check RH sensor voltage", "CN13-8 +5V to CN13-6 GND = 5 VDC. Sensor pin 1 white to pin 2 black = 5 VDC.", "rh_verified"),
            outcome("rh_verified", 5, "RH sensor verified", "Humidity sensor reads within range or voltage path confirmed."),
        ],
    ),
    proc(
        "w11819775-test-23-compressor",
        "Service Test 23: Inverter compressor speed",
        "23",
        "Compressor Speed Change With Ramping",
        [58, 93],
        ["compressor"],
        ["not_cooling", "compressor_check", "sealed_system"],
        [
            select_test_step("23", "Compressor speed ramp", "set_speed"),
            instr(
                "set_speed",
                3,
                "Ramp compressor speed",
                "Use ▲ to select speed 00–09 (0–4500 rpm). Press Freezer to activate — compressor and condenser fan run until exit. 5 min protection delay between state changes.",
                "comp_runs",
            ),
            visual(
                "comp_runs",
                4,
                "Compressor runs",
                "At selected speed, does compressor run? Check CN18 U/V/W to CN20-3 ACN ≈ 150 VAC each.",
                cp_yes_no("comp_ok", "comp_verified", "comp_fail", "bench_comp", "No 150 VAC at CN18 — ACU inverter fault (check LED below CN10)."),
            ),
            instr("bench_comp", 5, "Bench compressor windings", "Disconnect power. Ohm compressor windings = 11.7 Ω.", "comp_ohms"),
            meas("comp_ohms", 6, "Compressor windings", "11.7 Ω between windings.", "whirlpoolAcuFdInverterCompressorOhms", "compressor", "windings", ohm_branches("comp", "comp_verified", "replace_comp", "11.7 Ω")),
            outcome("replace_comp", 7, "Replace compressor or ACU", "Compressor windings failed or inverter LED fault — replace per inverter fault table."),
            outcome("comp_verified", 8, "Compressor path verified", "Service test 23 and compressor circuit verified."),
        ],
    ),
    proc(
        "w11819775-test-27-fc-fan",
        "Service Test 27: FC evaporator fan",
        "27",
        "FC Fan Test",
        [59, 95],
        ["evap_fan"],
        ["evap_fan", "frost_buildup", "not_cooling"],
        [
            select_test_step("27", "FC evap fan", "fan_on"),
            instr("fan_on", 3, "Enable FC fan", "Select on/oF with ▲; confirm with Freezer. Fan runs 100% PWM when on.", "fan_runs"),
            visual(
                "fan_runs",
                4,
                "FC evap fan operation",
                "CN4-1 +12V to CN4-3 F FAN = 12.7 VDC; CN4-5 F/PWM to CN4-3 = 3–6 VDC. Fan runs?",
                cp_yes_no("fan_ok", "fan_verified", "fan_fail", "replace_fan", "FC evap fan does not run with voltage present."),
            ),
            outcome("replace_fan", 5, "Replace FC evap fan", "Replace fan motor or repair harness CN4."),
            outcome("fan_verified", 6, "FC evap fan verified", "Service test 27 confirms fan operation."),
        ],
    ),
    proc(
        "w11819775-test-28-condenser-fan",
        "Service Test 28: Condenser fan",
        "28",
        "Condenser Fan Test",
        [59, 94],
        ["condenser_fan"],
        ["condenser_fan", "not_cooling"],
        [
            select_test_step("28", "Condenser fan", "cfan_on"),
            instr("cfan_on", 3, "Enable condenser fan", "Select on/oF with ▲; confirm with Freezer. Speed modes 01–06 all run fan.", "cfan_runs"),
            visual(
                "cfan_runs",
                4,
                "Condenser fan operation",
                "CN4-2 +12V to CN4-4 C-FAN = 12.7 VDC; CN4-6 C/PWM to CN4-4 = 3–6 VDC. Fan runs?",
                cp_yes_no("cfan_ok", "cfan_verified", "cfan_fail", "replace_cfan", "Condenser fan does not run with voltage present."),
            ),
            outcome("replace_cfan", 5, "Replace condenser fan", "Replace condenser fan motor or repair harness."),
            outcome("cfan_verified", 6, "Condenser fan verified", "Service test 28 confirms condenser fan."),
        ],
    ),
    proc(
        "w11819775-test-25-damper",
        "Service Test 25: Refrigerator damper",
        "25",
        "Refrigerator Damper State",
        [59, 102],
        ["damper_motor"],
        ["damper_check", "weak_cooling_ff", "airflow"],
        [
            select_test_step("25", "RC damper", "damper_cycle"),
            instr("damper_cycle", 3, "Cycle damper", "Select on/oF — damper cycles open/closed while fan runs. Modes 00=closed, 01=open.", "damper_moves"),
            visual(
                "damper_moves",
                4,
                "Damper opens and closes",
                "CN7 stepper pins = 6.3 VDC while moving. Does damper cycle?",
                cp_yes_no("damper_ok", "damper_verified", "damper_fail", "replace_damper", "Damper motor or feedback failed."),
            ),
            outcome("replace_damper", 5, "Replace RC damper", "Replace damper assembly when it fails to move in test 25."),
            outcome("damper_verified", 6, "Damper verified", "RC damper cycles correctly in service test 25."),
        ],
    ),
    proc(
        "w11819775-test-38-defrost",
        "Service Test 38: Defrost heater",
        "38",
        "Run Defrost Heater",
        [60, 96],
        ["defrost_heater"],
        ["defrost_heater", "frost_buildup", "F4E1"],
        [
            select_test_step("38", "Defrost heater", "heater_on"),
            instr("heater_on", 3, "Run defrost heater", "Select on — heater runs 5 min or until evap >60°F. CN12-2 F-H to CN12-4 ACN = 115 VAC.", "heater_heat"),
            visual(
                "heater_heat",
                4,
                "Defrost heater energizes",
                "Heater warms and voltage present at CN12?",
                cp_yes_no("heat_ok", "bench_heater", "heat_fail", "bench_heater", "No heat — check wiring or heater."),
            ),
            instr("bench_heater", 5, "Bench defrost heater ohms", "Disconnect power. Heater = 58 Ω (non-resettable thermofuse at 72°C).", "heater_ohms"),
            meas("heater_ohms", 6, "Defrost heater resistance", "58 Ω spec.", "whirlpoolAcuFdInverterDefrostHeaterOhms", "CN12", "heater terminals", ohm_branches("heater", "defrost_ok", "replace_heater", "58 Ω")),
            outcome("replace_heater", 7, "Replace defrost heater", "Replace FC defrost heater when open or out of spec."),
            outcome("defrost_ok", 8, "Defrost circuit verified", "Service test 38 and heater ohms verified."),
        ],
    ),
    proc(
        "w11819775-test-40-mullion-heater",
        "Service Test 40: Vertical mullion heater",
        "40",
        "Vertical Mullion Heater Activation Mode",
        [60, 103],
        ["heater"],
        ["heater_check", "moisture"],
        [
            select_test_step("40", "Mullion heater", "mullion_on"),
            instr("mullion_on", 3, "Activate mullion heater", "Select on/oF. CN7-5 VR/H to CN7-11 +12V = 12.7 VDC at heater (two orange wires).", "mullion_heat"),
            visual("mullion_heat", 4, "Mullion heater warms", "Heater energizes with 12.7 VDC?", cp_yes_no("mh_ok", "bench_mh", "mh_fail", "bench_mh", "Mullion heater failed to heat.")),
            instr("bench_mh", 5, "Bench mullion heater ohms", "Disconnect power. Vertical mullion heater = 11.4 Ω.", "mh_ohms"),
            meas("mh_ohms", 6, "Mullion heater resistance", "11.4 Ω spec.", "whirlpoolAcuFdInverterMullionHeaterOhms", "mullion", "heater terminals", ohm_branches("mh", "mh_verified", "replace_mh", "11.4 Ω")),
            outcome("replace_mh", 7, "Replace mullion heater", "Replace vertical mullion heater when open or out of spec."),
            outcome("mh_verified", 8, "Mullion heater verified", "Service test 40 and heater ohms verified."),
        ],
    ),
    proc(
        "w11819775-test-13-fc-ice-maker",
        "FC ice maker test mode & FBEC/FBEB faults",
        "13",
        "FC Ice Maker",
        [62, 104],
        ["ice_maker"],
        ["no_ice", "ice_maker", "FBEC", "FBEB"],
        [
            instr(
                "enter_im_test",
                2,
                "Enter FC ice maker test mode",
                "Empty ice tray. Lock button 3 sec. Both RC and FC doors open — hold Freezer + Mode 3 sec. Freezer Ice Off light blinks.",
                "run_im_test",
            ),
            instr("run_im_test", 3, "Run IM test cycle", "IM initializes, harvests, then fills with water. Listen for fill — no error code if fill fails.", "im_result"),
            visual(
                "im_result",
                4,
                "Ice maker test result",
                "Did test complete without FBEC/FBEB error on display?",
                [
                    {"id": "im_pass", "label": "Completed OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "im_voltage_ok"},
                    {"id": "imbec", "label": "FBEC — IM malfunction", "when": {"kind": "checkpoint_no"}, "nextStepId": "im_fbec_outcome"},
                    {"id": "imbeb", "label": "FBEB — tray thermistor", "when": {"kind": "checkpoint_no"}, "nextStepId": "im_tray_proc"},
                ],
            ),
            instr("im_voltage_ok", 5, "Verify IM voltages during harvest", "CN2-1 A+ to CN2-2 A- = 12.7 VDC motor; CN2-6 CE/SW to CN2-7 GND = 5 VDC switch.", "im_verified"),
            outcome("im_fbec_outcome", 6, "FBEC — replace ice maker", "FC ice maker malfunction — obstruction, motor, or module failure."),
            instr("im_tray_proc", 7, "Check tray thermistor", "Run service test 07 for tray thermistor. FBEB = tray thermistor fault.", "im_verified"),
            outcome("im_verified", 8, "FC ice maker verified", "IM test mode completed or voltages verified."),
        ],
    ),
    proc(
        "w11819775-test-14-water-valve",
        "Service Test / Test 14: Isolation water valve",
        "14",
        "Water Valve",
        [105],
        ["water_valve"],
        ["no_ice", "water_valve_check", "no_water"],
        [
            instr("run_im_for_fill", 2, "Activate valve via IM test", "Run FC IM test mode — water valve energizes at end of cycle. Or verify household supply and pressure.", "valve_voltage"),
            instr("valve_voltage", 3, "Check valve voltage", "CN15-1 V-L to CN15-3 ACN = 115 VAC at ACU. At valve: blue to red = 115 VAC.", "water_flows"),
            visual(
                "water_flows",
                4,
                "Water enters system",
                "Water flows when valve energized?",
                cp_yes_no("valve_ok", "valve_verified", "valve_fail", "replace_valve", "No water — valve, supply, or frozen line."),
            ),
            outcome("replace_valve", 5, "Replace isolation water valve", "Replace valve when 115 VAC present but no flow."),
            outcome("valve_verified", 6, "Water valve verified", "Isolation valve and supply verified."),
        ],
    ),
]


def service_diagnostic_entry_bundle() -> dict:
    return {
        "id": "w11819775-service-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "W11819775 — Service Diagnostic Mode entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Enter service diagnostics for thermistor, fan, compressor, defrost, and damper tests.",
        "tags": ["service_test", "service_diagnostic", "control_board"],
        "entryStepId": "sd_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [56]},
        "steps": [
            instr(
                "sd_enter",
                1,
                "Enter Service Diagnostic Mode",
                (
                    "Side UI unlocked and awake. Press Refrigerator, Freezer, Mode — three times (1-2-3 pattern). "
                    "Navigate with ▲/▼; Freezer = enter/back. Exit: test 00, hold Refrigerator+Freezer 5 sec, or power cycle."
                ),
                "@continue",
            ),
        ],
    }


def fc_im_test_mode_bundle() -> dict:
    return {
        "id": "w11819775-fc-im-test-mode-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "W11819775 — FC ice maker test mode entry",
        "modeKind": "component_activation",
        "uiVariants": ["any"],
        "description": "Lock + Freezer/Mode with both doors open — harvest and fill test cycle.",
        "tags": ["ice_maker", "service_test"],
        "entryStepId": "im_enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [62]},
        "steps": [
            instr(
                "im_enter",
                1,
                "Enter FC IM test mode",
                "Empty tray. Lock 3 sec. RC+FC doors open. Freezer + Mode 3 sec — Freezer Ice Off blinks.",
                "@continue",
            ),
        ],
    }


BUNDLES = [service_diagnostic_entry_bundle(), fc_im_test_mode_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLE_FILES = [f"{b['id']}.json" for b in BUNDLES]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "refrigerator",
        "label": "Whirlpool ACU inverter French door refrigerator (W11819775, 31 cu ft)",
        "notes": "CN* ACU pinouts; inverter compressor; 2k/5k NTC; fault codes F3E*/F4E1/FBEB/FBEC.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "knowledgeIds": [s["measurementKnowledgeId"] for s in item["steps"] if s.get("measurementKnowledgeId")],
                "relatedCodes": [t for t in item["tags"] if t.startswith("F")],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# whirlpool_acu_fd_inverter — W11819775 procedure seeds

**Manual:** Whirlpool 36 in 31 cu ft French Door (W11819775B)
**Platform:** `whirlpool_acu_fd_inverter` — 31 cu ft ACU inverter French door (WRF31* class)
**Extraction:** `WHIRLPOOL_W11819775_ACU_FD_INVERTER_EXTRACTION.md`
**Knowledge:** batch46 (`whirlpoolAcuFdInverter*`)

## Regenerate

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual W11819775
```

## Procedures (13)

Thermistors 01/03/05/07, RH 10, compressor 23, fans 27/28, damper 25, defrost 38, mullion 40, IM 13, water valve 14.

## Bundles (2)

- `w11819775-service-diagnostic-entry`
- `w11819775-fc-im-test-mode-entry`
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
        "attach_w11819775_diagnostic_effects.py",
        "attach_w11819775_service_modes.py",
        "attach_w11819775_procedure_diagrams.py",
    ):
        path = ROOT / "backend" / "scripts" / script
        if path.exists():
            subprocess.run([sys.executable, str(path)], check=True, cwd=ROOT)
    crop = ROOT / "backend/scripts/crop_w11819775_procedure_figures.py"
    if crop.exists():
        subprocess.run([sys.executable, str(crop)], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: global validate reported errors.", file=sys.stderr)


if __name__ == "__main__":
    main()
