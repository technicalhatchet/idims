#!/usr/bin/env python3
"""Generate W10901168 (Whirlpool Bella 32 cu ft French door) procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "whirlpool_bella_french_door"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "whirlpool_bella_french_door"

SOURCE = {
    "manualId": "W10901168",
    "manualTitle": "Whirlpool Bella 32 cu ft French Door Refrigerator (W10901168, WRF992/993/995)",
    "extractedTextFile": "backend/docs/manuals/service-manual-w10901168-bella-extracted.txt",
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
        "id": pid, "version": "1.0.0", "title": title, "platformId": PLATFORM,
        "componentIds": component_ids, "tags": tags,
        "source": {**SOURCE, "oemTestNumber": oem_num, "oemTestTitle": oem_title, "pages": pages},
        "entryStepId": "safety_power_off", "steps": [safety, *steps],
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
    display = test_num.zfill(2)
    return instr(
        f"select_test_{display}",
        2,
        f"Select Service Test {display}",
        f"In Diagnostics (Recommended+Drawer hold 5 s), use Up/Down to test {display}. Press Icemaker2 to select. Fast Cool backs out.",
        next_id,
        f"Service Test {display} — {test_name}",
    )


def thermistor_st(pid, st, zone, tags):
    return proc(
        pid, f"Service Test {st}: {zone} thermistor", st, f"{zone} Thermistor", [19, 33],
        ["thermistor"], tags,
        [
            select_test_step(st, f"{zone} thermistor", "read"),
            visual("read", 3, f"{zone} thermistor", "Ensure not OP (open) or SH (short).", cp_yes_no("ok", "verified", "bad", "replace", f"Replace {zone} thermistor.")),
            outcome("replace", 4, f"Replace {zone} thermistor", f"Service test {st} shows OP or SH."),
            outcome("verified", 5, f"{zone} verified", f"Thermistor {st} OK."),
        ],
    )


PROCEDURES = [
    thermistor_st("w10901168-test-01-rc-thermistor", "01", "RC", ["thermistor_check", "weak_cooling_ff"]),
    thermistor_st("w10901168-test-02-fc-thermistor", "02", "FC", ["thermistor_check", "not_cooling"]),
    thermistor_st("w10901168-test-05-pantry-thermistor", "05", "Pantry", ["thermistor_check", "weak_cooling_ff"]),
    thermistor_st("w10901168-test-14-ice-box-thermistor", "14", "Door ice box", ["thermistor_check", "no_ice"]),
    proc(
        "w10901168-test-58-condenser-fan", "Service Test 58: Condenser fan", "58", "Condenser Fan Test", [19, 33],
        ["condenser_fan"], ["condenser_fan", "not_cooling"],
        [
            select_test_step("58", "Condenser fan", "cfan"),
            visual("cfan", 3, "Display on & fan runs", "LED shows on. Orion P16-4/P16-5 to GF2 P8-7 — 12.7 VDC PWM.", cp_yes_no("ok", "verified", "fail", "replace_gf2", "Replace GF2 board if no on display; fan if no run with voltage.")),
            outcome("replace_gf2", 4, "Replace GF2 or fan", "GF2 board or condenser fan per voltage path."),
            outcome("verified", 5, "Condenser fan verified", "Test 58 OK."),
        ],
    ),
    proc(
        "w10901168-test-40-compressor-sealed-system", "Service Test 40: Compressor & sealed system", "40", "Compressor and Compartment Freezing Cooling Test", [19, 34],
        ["compressor"], ["not_cooling", "compressor_check", "sealed_system"],
        [
            select_test_step("40", "Compressor cooling", "st40"),
            instr("st40", 3, "Run test 40 steps", "Steps 01–05: 3-way valve chatter, compressor on, RC/FC fans. Time compressor run.", "analyze"),
            visual("analyze", 4, "Test 40 results", "3-way repositions? Compressor runs sustained? RC/FC fans blow cold air?", cp_yes_no("ok", "verified", "fail", "bench_comp", "Path 1A–1D troubleshooting per manual.")),
            instr("bench_comp", 5, "Compressor resistances", "Power off. Common-sensor 14–19 Ω; line-common 7–13 Ω; line-sensor 21–32 Ω.", "comp_ohms"),
            meas("comp_ohms", 6, "Compressor sensor winding", "Sensor winding 14–19 Ω.", "whirlpoolBellaFdCompressorSensorOhms", "compressor", "common ↔ sensor", ohm_branches("cs", "valve_ohms", "replace_comp", "14–19 Ω")),
            meas("valve_ohms", 7, "3-way valve coil", "43–49 Ω center to each outer pin.", "whirlpoolBellaFdThreeWayValveOhms", "3-way valve", "coil pins", ohm_branches("v", "verified", "replace_valve", "43–49 Ω")),
            outcome("replace_comp", 8, "Replace compressor & Orion", "Compressor resistances out of range — replace compressor and Orion board."),
            outcome("replace_valve", 9, "Replace 3-way valve", "Valve coil failed — no reposition in step 01/02."),
            outcome("verified", 10, "Sealed system path verified", "Test 40 and compressor/valve checks OK."),
        ],
    ),
    proc(
        "w10901168-test-57-rc-fan", "Service Test 57: RC fan", "57", "RC Fan Test", [19],
        ["evap_fan"], ["evap_fan", "weak_cooling_ff"],
        [select_test_step("57", "RC fan", "fan"), visual("fan", 3, "RC fan on", "Display on and fan operates?", cp_yes_no("ok", "verified", "fail", "replace", "Replace RC fan or GF2.")),
         outcome("replace", 4, "Replace RC fan", "RC fan failed."), outcome("verified", 5, "RC fan verified", "Test 57 OK.")],
    ),
    proc(
        "w10901168-test-56-fc-fan", "Service Test 56: FC fan", "56", "FC Fan Test", [19],
        ["evap_fan"], ["evap_fan", "frost_buildup"],
        [select_test_step("56", "FC fan", "fan"), visual("fan", 3, "FC fan on", "Display on and fan operates?", cp_yes_no("ok", "verified", "fail", "replace", "Replace FC fan or GF2.")),
         outcome("replace", 4, "Replace FC fan", "FC fan failed."), outcome("verified", 5, "FC fan verified", "Test 56 OK.")],
    ),
    proc(
        "w10901168-test-42-pantry-baffle", "Service Test 42: Pantry air baffle", "42", "Main Pantry Air Baffle State", [19],
        ["damper_motor"], ["damper_check", "weak_cooling_ff"],
        [select_test_step("42", "Pantry baffle", "baffle"), visual("baffle", 3, "Baffle state", "Baffle opens/closes per test?", cp_yes_no("ok", "verified", "fail", "replace", "Replace pantry baffle motor.")),
         outcome("replace", 4, "Replace pantry baffle", "Baffle failed."), outcome("verified", 5, "Pantry baffle verified", "Test 42 OK.")],
    ),
    proc(
        "w10901168-test-89-defrost-heater", "Service Test 89/91: FC defrost", "89", "Run FC Defrost Heater", [19],
        ["defrost_heater"], ["defrost_heater", "frost_buildup"],
        [
            select_test_step("89", "FC defrost heater", "defrost"),
            instr("defrost", 3, "Forced defrost option", "Test 91 forced defrost ON if heavy frost — exit diagnostics to execute.", "heat"),
            visual("heat", 4, "Defrost heater on", "Test 89 energizes FC defrost heater?", cp_yes_no("ok", "verified", "fail", "replace", "Defrost heater or GF2 fault.")),
            outcome("replace", 5, "Replace defrost components", "Defrost heater or board failed."),
            outcome("verified", 6, "Defrost verified", "Test 89/91 path OK."),
        ],
    ),
    proc(
        "w10901168-test-59-ice-box-fan", "Service Test 59: Ice box fan", "59", "Ice Box Fan Test", [19, 46],
        ["evap_fan", "ice_maker"], ["no_ice", "evap_fan"],
        [select_test_step("59", "Ice box fan", "fan"), visual("fan", 3, "Ice box fan on", "Display on and airflow from ice box?", cp_yes_no("ok", "verified", "fail", "replace", "Replace ice box fan or GF2.")),
         outcome("replace", 4, "Replace ice box fan", "Fan failed."), outcome("verified", 5, "Ice box fan verified", "Test 59 OK.")],
    ),
    proc(
        "w10901168-test-97-98-im-water-fill", "Service Test 97/98: Ice maker water fill", "97", "Door Ice Maker Valve General Test", [19, 46],
        ["water_valve", "ice_maker"], ["no_ice", "E4", "water_valve_check"],
        [
            select_test_step("97", "Door IM valve (or 98 freezer)", "fill"),
            visual("fill", 3, "Water fills tray", "Display on ~5 s then oFF. Water in door IM tray? Also runs isolation valve.", cp_yes_no("ok", "fill_tube", "fail", "fill_tube", "No fill — valve or supply.")),
            instr("fill_tube", 4, "Fill tube heater", "Run test 66 (door) or 67 (freezer) — display on 15 min, re-test 97/98.", "verified"),
            outcome("fail", 5, "Check valves & tubing", "Isolation valve, IM valve, fill tube heater resistances."),
            outcome("verified", 6, "IM water fill verified", "Tests 97/98 fill OK."),
        ],
    ),
    proc(
        "w10901168-test-120-121-im-harvest", "Service Test 120/121: Ice maker harvest", "120", "Check Door Ice Maker Harvest", [19, 47],
        ["ice_maker"], ["no_ice", "E1", "E2", "E3", "E4"],
        [
            select_test_step("120", "Door IM harvest (or 121 freezer)", "harvest"),
            visual(
                "harvest",
                3,
                "Harvest result",
                "Errors E1–E4 = replace IM. IB = bin full (verify bin). 00/01 on test 79 bin switch?",
                [
                    {"id": "ok", "label": "Harvest OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "verified"},
                    {"id": "err", "label": "E1–E4 error", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_im"},
                    {"id": "ib", "label": "IB bin full", "when": {"kind": "checkpoint_no"}, "nextStepId": "check_bin"},
                ],
            ),
            instr("check_bin", 4, "Ice bin switch", "Test 79: 00 no bin, 01 bin installed.", "verified"),
            outcome("replace_im", 5, "Replace ice maker", "Harvest error E1–E4 — replace ice maker module."),
            outcome("verified", 6, "Harvest verified", "Tests 120/121 OK."),
        ],
    ),
    proc(
        "w10901168-test-96-water-valve", "Service Test 96: Water valve general", "96", "Water Valve General Test", [19, 46],
        ["water_valve"], ["no_water", "water_valve_check"],
        [
            select_test_step("96", "Water valve", "valve"),
            visual("valve", 3, "Water dispenses", "Display on ~5 s — water from dispenser? Test 93 paddle = 1.", cp_yes_no("ok", "verified", "fail", "replace_ui", "Dispenser UI or valve fault.")),
            outcome("replace_ui", 4, "Replace UI or valve", "UI if no on display; valve/tubing if no flow."),
            outcome("verified", 5, "Water valve verified", "Test 96 OK."),
        ],
    ),
]


def diagnostic_entry_bundle():
    return {
        "id": "w10901168-diagnostic-entry",
        "version": "1.0.0",
        "platformId": PLATFORM,
        "manualId": SOURCE["manualId"],
        "title": "W10901168 — Bella Diagnostics entry",
        "modeKind": "service_diagnostic_entry",
        "uiVariants": ["any"],
        "description": "Eyebrow UI diagnostics — Recommended + Drawer hold 5 s.",
        "tags": ["service_test", "service_diagnostic"],
        "entryStepId": "enter",
        "source": {"manualTitle": SOURCE["manualTitle"], "extractedTextFile": SOURCE["extractedTextFile"], "pages": [19]},
        "steps": [instr("enter", 1, "Enter Diagnostics", "Hold Recommended + Drawer 5 s (chime, lights out). Up/Down navigate; Icemaker2 select; Fast Cool back; test 00 or 20 min timeout to exit.", "@continue")],
    }


BUNDLES = [diagnostic_entry_bundle()]
PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]


def write_catalog():
    (OUT / "procedureCatalog.json").write_text(json.dumps({
        "manualId": SOURCE["manualId"], "platformId": PLATFORM, "templateId": "refrigerator",
        "label": "Whirlpool Bella 32 cu ft French door (W10901168)",
        "notes": "Orion + GF2 dual-board; dual IM option; linear compressor; pantry zone.",
        "plannedProcedures": [{"id": i["id"], "oemSection": i["source"]["oemTestNumber"], "title": i["title"], "status": "generated",
                               "knowledgeIds": [s["measurementKnowledgeId"] for s in i["steps"] if s.get("measurementKnowledgeId")],
                               "relatedCodes": [t for t in i["tags"] if t.startswith("E")]} for i in PROCEDURES],
    }, indent=2) + "\n", encoding="utf-8")


def write_readme():
    (OUT / "README.md").write_text(
        "# whirlpool_bella_french_door — W10901168\n\n"
        "**Platform:** `whirlpool_bella_french_door` — WRF992/993/995\n"
        "**Procedures:** 14 + 1 bundle\n"
        "```bash\npython backend/scripts/run_procedure_manual_pipeline.py --manual W10901168\n```\n",
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
        "attach_w10901168_diagnostic_effects.py",
        "attach_w10901168_service_modes.py",
        "attach_w10901168_procedure_diagrams.py",
    ):
        p = ROOT / "backend/scripts" / script
        if p.exists():
            subprocess.run([sys.executable, str(p)], check=True, cwd=ROOT)
    crop = ROOT / "backend/scripts/crop_w10901168_procedure_figures.py"
    if crop.exists():
        subprocess.run([sys.executable, str(crop)], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)


if __name__ == "__main__":
    main()
