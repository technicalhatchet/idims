#!/usr/bin/env python3
"""Generate LG LRE/LRGL/LSG freestanding & slide-in range procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "lg_freestanding_range"
BUNDLE_OUT = OUT / "bundles"
PLATFORM = "lg_freestanding_range"

SOURCE = {
    "manualId": "LG-LRE-RANGE",
    "manualTitle": "LG Freestanding & Slide-In Ranges (LRE30451/LRE30755, LRGL5821S, LSG4513)",
    "extractedTextFile": "backend/docs/manuals/LG electric freestanding range-extracted.txt",
    "verifiedAt": "2026-09-10",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power (and gas if applicable)",
    "body": (
        "Unplug the range or disconnect power. Turn off gas supply on gas models. "
        "Resistance checks require power off and disconnected harnesses. "
        "Replace all panels before operating."
    ),
    "sourceExcerpt": "Resistance checks must be made with power cord unplugged from outlet.",
    "requiresInput": False,
}


def proc(pid, title, oem_num, oem_title, pages, component_ids, tags, steps, template_ids=None):
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


PROCEDURES = [
    proc(
        "lg-range-oven-sensor",
        "§4-3: Main oven temperature sensor",
        "4-3",
        "Oven Sensor",
        [38, 39],
        ["temp_sensor"],
        ["sensor_check", "F1", "F2", "F3", "F4", "F6", "sensing_fail"],
        [
            instr(
                "cool_sensor",
                2,
                "Allow sensor to cool",
                "Oven sensor is temperature-sensitive. Allow cavity and sensor to cool to room temp before measuring.",
                "sensor_ohms",
            ),
            meas(
                "sensor_ohms",
                3,
                "Oven sensor resistance",
                "Disconnect sensor harness. Measure at connector — expect ≈1.09 kΩ ±10% at 77°F (25°C).",
                "lgRangeOvenSensorOhms",
                "Oven sensor",
                "terminals",
                ohm_branches("sensor", "sensor_verified", "replace_sensor"),
            ),
            outcome("replace_sensor", 4, "Replace oven sensor", "RTD out of range — replace oven temperature sensor."),
            outcome("sensor_verified", 5, "Oven sensor OK", "Sensor 1.09 kΩ ±10% — clear F-1/F-2 sensing codes if applicable."),
        ],
    ),
    proc(
        "lg-range-door-switch",
        "§4-3: Oven door switch",
        "4-3",
        "Door switch",
        [38, 39],
        ["door_switch"],
        ["door_switch_check"],
        [
            visual(
                "door_switch_states",
                2,
                "Door switch continuity",
                "Power off. Door open = infinite Ω; door closed = continuity (0 Ω) at door switch.",
                [
                    {"id": "sw_ok", "label": "States correct", "when": {"kind": "checkpoint_yes"}, "nextStepId": "switch_verified"},
                    {"id": "sw_bad", "label": "Wrong state", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_switch"},
                ],
            ),
            outcome("replace_switch", 3, "Replace door switch", "Door switch fails continuity check — replace switch."),
            outcome("switch_verified", 4, "Door switch OK", "Door switch continuity verified."),
        ],
    ),
    proc(
        "lg-range-oven-lamp",
        "§4-5: Oven lamp",
        "4-5",
        "Oven lamp",
        [40, 41],
        ["heater"],
        ["oven_lamp"],
        [
            meas(
                "lamp_ohms",
                2,
                "Oven lamp resistance",
                "Cool lamp. Measure resistance — expect below 5 Ω (gas manual ≈5 Ω ±10%).",
                "lgRangeOvenLampOhms",
                "Oven lamp",
                "terminals",
                ohm_branches("lamp", "lamp_ok", "replace_lamp"),
            ),
            outcome("replace_lamp", 3, "Replace oven lamp", "Lamp open or high resistance — replace bulb/socket."),
            outcome("lamp_ok", 4, "Oven lamp OK", "Lamp resistance verified."),
        ],
    ),
    proc(
        "lg-range-door-latch",
        "§4-2: Door latch motor & micro switch",
        "4-2",
        "Door locking Motor / Micro Switch",
        [37, 38],
        ["door_lock"],
        ["door_latch_check", "F2"],
        [
            meas(
                "latch_motor_ohms",
                2,
                "Door latch motor resistance",
                "Disconnect latch motor leads. R × 1 — expect ≈27 Ω ±10%.",
                "lgRangeDoorLatchMotorOhms",
                "Latch motor",
                "leads",
                ohm_branches("latch", "micro_switch_ohms", "replace_latch"),
            ),
            meas(
                "micro_switch_ohms",
                3,
                "Latch micro switch (NO)",
                "R × 1000 at NO–COM — ≈2.6 kΩ ±10%. Latch open = infinite; locked = continuity.",
                "lgRangeMicroSwitchOhms",
                "Micro switch",
                "NO–COM",
                ohm_branches("micro", "latch_verified", "replace_latch"),
            ),
            outcome("replace_latch", 4, "Replace door latch assembly", "Latch motor or micro switch out of spec — replace latch."),
            outcome("latch_verified", 5, "Door latch OK", "Latch motor and micro switch verified — clear F-2."),
        ],
    ),
    proc(
        "lg-range-bake-element",
        "§4-4: Bake element",
        "4-4",
        "Bake element",
        [39, 40],
        ["bake_element"],
        ["no_heat", "F9", "bake_element"],
        [
            instr("cool_bake", 2, "Cool bake element", "Allow bake element to cool before resistance check.", "bake_ohms"),
            meas(
                "bake_ohms",
                3,
                "Bake element resistance",
                "Disconnect element leads. R × 1 — expect ≈14 Ω ±10% at room temperature.",
                "lgRangeBakeElementOhms",
                "Bake element",
                "terminals",
                ohm_branches("bake", "bake_ok", "replace_bake"),
            ),
            outcome("replace_bake", 4, "Replace bake element", "Bake element open or out of range."),
            outcome("bake_ok", 5, "Bake element OK", "Bake element ≈14 Ω verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "lg-range-broil-element",
        "§4-4: Broil element",
        "4-4",
        "Broil element",
        [39, 40],
        ["broil_element"],
        ["no_heat", "broil_element"],
        [
            instr("cool_broil", 2, "Cool broil element", "Allow broil element to cool before measuring.", "broil_ohms"),
            meas(
                "broil_ohms",
                3,
                "Broil element resistance",
                "Disconnect leads. R × 1 — expect ≈17 Ω ±10%.",
                "lgRangeBroilElementOhms",
                "Broil element",
                "terminals",
                ohm_branches("broil", "broil_ok", "replace_broil"),
            ),
            outcome("replace_broil", 4, "Replace broil element", "Broil element open or out of range."),
            outcome("broil_ok", 5, "Broil element OK", "Broil element ≈17 Ω verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "lg-range-convection-element",
        "§4-4: Convection element",
        "4-4",
        "Convection element",
        [39, 40],
        ["convection_element"],
        ["no_heat", "convection_element"],
        [
            instr("cool_conv_el", 2, "Cool convection element", "Cool element before Ω test.", "conv_el_ohms"),
            meas(
                "conv_el_ohms",
                3,
                "Convection element resistance",
                "Disconnect leads. R × 1 — expect ≈17 Ω ±10%.",
                "lgRangeConvectionElementOhms",
                "Convection element",
                "terminals",
                ohm_branches("conv_el", "conv_el_ok", "replace_conv_el"),
            ),
            outcome("replace_conv_el", 4, "Replace convection element", "Convection element failed."),
            outcome("conv_el_ok", 5, "Convection element OK", "Convection element verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "lg-range-convection-motor",
        "§4-1: Convection fan motor",
        "4-1",
        "Convection Motor",
        [36, 37],
        ["convection_fan"],
        ["convection_fan", "motor_check"],
        [
            meas(
                "conv_motor_ohms",
                2,
                "Convection motor resistance",
                "Disconnect motor leads. R × 1 — expect ≈33.5 Ω ±10%.",
                "lgRangeConvectionMotorOhms",
                "Convection motor",
                "leads",
                ohm_branches("conv_motor", "conv_motor_ok", "replace_conv_motor"),
            ),
            outcome("replace_conv_motor", 3, "Replace convection motor", "Motor open or shorted."),
            outcome("conv_motor_ok", 4, "Convection motor OK", "Motor ≈33.5 Ω verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "lg-range-warming-drawer",
        "§4-3/4: Warming drawer sensor & element",
        "4-3",
        "Warming Drawer Sensor / element",
        [38, 40],
        ["warming_drawer"],
        ["warming_drawer", "no_heat"],
        [
            instr(
                "model_check",
                2,
                "Confirm LRE30755 warming drawer",
                "Warming drawer element (95 Ω) applies to LRE30755 only. Skip element if not equipped.",
                "wd_sensor_ohms",
            ),
            meas(
                "wd_sensor_ohms",
                3,
                "Warming drawer sensor",
                "Cool sensor. R × 1000 — expect ≈4.6 kΩ ±10% at room temp.",
                "lgRangeWarmingDrawerSensorOhms",
                "Warming drawer sensor",
                "terminals",
                ohm_branches("wd_sen", "wd_element_ohms", "replace_wd_sensor"),
            ),
            meas(
                "wd_element_ohms",
                4,
                "Warming drawer element",
                "R × 1 — expect ≈95 Ω ±10% (LRE30755).",
                "lgRangeWarmingDrawerElementOhms",
                "Warming drawer element",
                "terminals",
                ohm_branches("wd_el", "wd_ok", "replace_wd_element"),
            ),
            outcome("replace_wd_sensor", 5, "Replace warming drawer sensor", "Sensor out of range."),
            outcome("replace_wd_element", 6, "Replace warming drawer element", "Element open or shorted."),
            outcome("wd_ok", 7, "Warming drawer OK", "Sensor and element verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "lg-range-cooktop-single",
        "§4-6: Single surface elements (LF/LR/RR)",
        "4-6",
        "Single surface units",
        [41, 42],
        ["surface_element"],
        ["cooktop_element", "no_heat"],
        [
            instr(
                "disconnect_cooktop",
                2,
                "Disconnect cooktop element leads",
                "Remove back cover. Disconnect wires from target element (LF, LR, or RR).",
                "element_ohms",
            ),
            meas(
                "element_ohms",
                3,
                "Element coil resistance",
                "R × 1 at element terminal to 1A — expect ≈46 Ω ±10%.",
                "lgRangeCooktopElementOhms",
                "Surface element",
                "terminal–1A",
                ohm_branches("surf", "limiter_check", "replace_element"),
            ),
            visual(
                "limiter_check",
                4,
                "Limiter continuity (1A–2A, 1B–2B)",
                "1A–2A: continuity. 1B–2B: open below 150°F, continuity above 150°F.",
                [
                    {"id": "lim_ok", "label": "Limiters OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "cooktop_ok"},
                    {"id": "lim_bad", "label": "Limiter fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_element"},
                ],
            ),
            outcome("replace_element", 5, "Replace surface element", "Element or limiter failed."),
            outcome("cooktop_ok", 6, "Surface element OK", "Element ≈46 Ω and limiters verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "lg-range-warming-zone",
        "§4-7: Center warming zone (CR)",
        "4-7",
        "Warming Zone",
        [42, 43],
        ["warming_zone"],
        ["warming_zone", "no_heat"],
        [
            meas(
                "wz_ohms",
                2,
                "Warming zone element",
                "Disconnect CR element. R × 1 terminal to 1A — expect ≈565 Ω ±10%.",
                "lgRangeWarmingZoneOhms",
                "CR element",
                "terminal–1A",
                ohm_branches("wz", "wz_limiter", "replace_wz"),
            ),
            visual(
                "wz_limiter",
                3,
                "Warming zone limiters",
                "Verify 1A–2A continuity and 1B–2B thermal limiter same as single elements.",
                [
                    {"id": "wz_lim_ok", "label": "OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "wz_ok"},
                    {"id": "wz_lim_bad", "label": "Fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_wz"},
                ],
            ),
            outcome("replace_wz", 4, "Replace warming zone element", "Warming zone failed."),
            outcome("wz_ok", 5, "Warming zone OK", "Warming zone verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "lg-range-dual-rf-element",
        "§4-8: Dual surface element (RF)",
        "4-8",
        "Dual surface element Right Front",
        [43, 44],
        ["surface_element"],
        ["dual_element", "cooktop_element", "no_heat"],
        [
            meas(
                "rf_inner_ohms",
                2,
                "RF inner coil (E1–1A)",
                "R × 1 — expect ≈32 Ω ±10%.",
                "lgRangeDualSurfaceInnerOhms",
                "RF dual",
                "E1–1A",
                ohm_branches("rf_in", "rf_outer_ohms", "replace_rf"),
            ),
            meas(
                "rf_outer_ohms",
                3,
                "RF outer coil (E2–1A)",
                "R × 1 — expect ≈55 Ω ±10%.",
                "lgRangeDualSurfaceOuterOhms",
                "RF dual",
                "E2–1A",
                ohm_branches("rf_out", "rf_limiter", "replace_rf"),
            ),
            visual(
                "rf_limiter",
                4,
                "RF limiter continuity",
                "Check 1A–2A continuity and 1B–2B thermal limiter per §4-6.",
                [
                    {"id": "rf_lim_ok", "label": "OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "rf_ok"},
                    {"id": "rf_lim_bad", "label": "Fault", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_rf"},
                ],
            ),
            outcome("replace_rf", 5, "Replace dual RF element", "Dual element or limiter failed."),
            outcome("rf_ok", 6, "Dual RF element OK", "Inner/outer coils and limiters verified."),
        ],
        template_ids=["electric_range"],
    ),
    proc(
        "lg-range-oven-igniter",
        "§4-3: Oven bake/broil igniter",
        "4-3",
        "Broil or bake igniter",
        [37, 38],
        ["igniter"],
        ["igniter_check", "F9", "no_heat"],
        [
            instr("cool_igniter", 2, "Cool igniter", "Allow igniter to cool to room temperature.", "igniter_ohms"),
            meas(
                "igniter_ohms",
                3,
                "Oven igniter resistance",
                "Disconnect igniter. R × 1 — expect 45–400 Ω at room temperature.",
                "lgRangeOvenIgniterOhms",
                "Oven igniter",
                "terminals",
                ohm_branches("ign", "igniter_ok", "replace_igniter"),
            ),
            outcome("replace_igniter", 4, "Replace oven igniter", "Igniter open or out of range — replace igniter."),
            outcome("igniter_ok", 5, "Oven igniter OK", "Igniter 45–400 Ω verified."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "lg-range-oven-gas-valve",
        "§4-3: Oven safety valve",
        "4-3",
        "Oven (safety) valve",
        [37, 38],
        ["gas_valve"],
        ["gas_valve_check", "F9", "no_heat"],
        [
            instr("gas_off", 2, "Turn off gas supply", "Shut gas supply before disconnecting valve coils.", "valve_ohms"),
            meas(
                "valve_ohms",
                3,
                "Oven safety valve coil resistance",
                "R × 1 upside/downside coil — expect ≈1–3 Ω.",
                "lgRangeOvenGasValveOhms",
                "Oven valve",
                "coil",
                ohm_branches("valve", "valve_ok", "replace_valve"),
            ),
            outcome("replace_valve", 4, "Replace oven safety valve", "Valve coil open or shorted."),
            outcome("valve_ok", 5, "Oven gas valve OK", "Valve 1–3 Ω verified."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "lg-range-ignition-switch",
        "§4-3: Surface ignition switch",
        "4-3",
        "Ignition switch",
        [37, 38],
        ["surface_ignition"],
        ["surface_burner", "no_heat", "spark_issue"],
        [
            visual(
                "ign_switch_cam",
                2,
                "Ignition switch cam continuity",
                "Rotate cam slowly. Continuity at ≈40°–80°; infinite at other positions (R × 1).",
                [
                    {"id": "cam_ok", "label": "Switch OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "ign_sw_ok"},
                    {"id": "cam_bad", "label": "Switch failed", "when": {"kind": "checkpoint_no"}, "nextStepId": "replace_ign_sw"},
                ],
            ),
            outcome("replace_ign_sw", 3, "Replace ignition switch", "Surface burner ignition switch failed."),
            outcome("ign_sw_ok", 4, "Ignition switch OK", "Cam continuity verified."),
        ],
        template_ids=["gas_range"],
    ),
    proc(
        "lg-range-no-power",
        "§6-1: No display / no power",
        "6-1",
        "No display (No power)",
        [69, 72],
        ["supply", "main_control"],
        ["no_power", "display_dead", "supply_issue"],
        [
            visual(
                "check_connections",
                2,
                "Inspect connections and corrosion",
                "Power off. Disconnect and reconnect all Main PCB and harness connectors. Check for corrosion.",
                [
                    {"id": "conn_ok", "label": "Connections OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "supply_voltage"},
                    {"id": "conn_bad", "label": "Corrosion/loose", "when": {"kind": "checkpoint_no"}, "nextStepId": "repair_harness"},
                ],
            ),
            instr("repair_harness", 3, "Repair harness", "Repair terminals and reseat connectors.", "supply_voltage"),
            visual(
                "supply_voltage",
                4,
                "Line voltage at outlet",
                "Restore power. Verify 120/240 VAC at wall outlet and range cord per tech sheet.",
                [
                    {"id": "vac_ok", "label": "Voltage OK", "when": {"kind": "checkpoint_yes"}, "nextStepId": "pcb_check"},
                    {"id": "vac_bad", "label": "No/low voltage", "when": {"kind": "checkpoint_no"}, "nextStepId": "fix_supply"},
                ],
            ),
            outcome("fix_supply", 5, "Correct supply issue", "Restore proper line voltage to range."),
            visual(
                "pcb_check",
                6,
                "Main PCB power LED / display",
                "If supply OK but no display — inspect Main PCB (6871W1N009A) and cooktop display PCB.",
                [
                    {"id": "pcb_bad", "label": "PCB fault", "when": {"kind": "checkpoint_yes"}, "nextStepId": "replace_pcb"},
                    {"id": "pcb_ok", "label": "PCB appears OK", "when": {"kind": "checkpoint_no"}, "nextStepId": "power_verified"},
                ],
            ),
            outcome("replace_pcb", 7, "Replace Main PCB or display PCB", "No display with good supply — replace failed PCB assembly."),
            outcome("power_verified", 8, "Power path verified", "Supply and connections verified."),
        ],
    ),
]

PROCEDURE_FILES = [f"{p['id']}.json" for p in PROCEDURES]
BUNDLES: list[dict] = []
BUNDLE_FILES: list[str] = []


def write_catalog() -> None:
    code_tags = ("F1", "F2", "F3", "F4", "F6", "F9")
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "electric_range",
        "label": "LG freestanding & slide-in range (LRE/LRGL/LSG)",
        "notes": "Dual fuel: electric_range (LRE*) + gas_range (LRGL*, LSG*). §4 component tests + §6-1 no power.",
        "plannedProcedures": [
            {
                "id": item["id"],
                "oemSection": item["source"]["oemTestNumber"],
                "title": item["title"],
                "status": "generated",
                "knowledgeIds": [
                    s.get("measurementKnowledgeId")
                    for s in item.get("steps", [])
                    if s.get("measurementKnowledgeId")
                ],
                "relatedCodes": [t for t in item.get("tags", []) if t in code_tags],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = """# LG freestanding & slide-in range (`lg_freestanding_range`)

**Manual:** LG-LRE-RANGE — LRE30451/LRE30755 electric, LRGL5821S gas freestanding, LSG4513 slide-in gas  
**Extraction:** `knowledge/pattern-catalog/LG_LRE_RANGE_EXTRACTION.md`

16 procedures (dual fuel via `templateIds`).

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual LG-LRE-RANGE
```
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    BUNDLE_OUT.mkdir(parents=True, exist_ok=True)
    for item, filename in zip(PROCEDURES, PROCEDURE_FILES, strict=True):
        (OUT / filename).write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {filename}")
    write_catalog()
    write_readme()
    for script in (
        "attach_lg_range_diagnostic_effects.py",
        "attach_lg_range_service_modes.py",
    ):
        path = ROOT / "backend" / "scripts" / script
        if path.exists():
            subprocess.run([sys.executable, str(path)], check=True, cwd=ROOT)
    subprocess.run([sys.executable, str(ROOT / "backend/scripts/generate_procedure_registry.py")], check=True, cwd=ROOT)
    result = subprocess.run([sys.executable, str(ROOT / "backend/scripts/validate_procedure_seed.py")], cwd=ROOT)
    if result.returncode != 0:
        print("Note: validate reported errors.", file=sys.stderr)


if __name__ == "__main__":
    main()
