#!/usr/bin/env python3
"""Generate Samsung NE58F9710WS Flex Duo electric range procedure seed JSON files."""

from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed" / "samsung_range_ne58"
PLATFORM = "samsung_range_ne58"

SOURCE = {
    "manualId": "SAMSUNG-NE58-RANGE",
    "manualTitle": "Samsung NE58F9710WS Flex Duo Electric Range (FER710DRS)",
    "sourcePdf": "backend/docs/manuals/SamsunNE58F electric range.pdf",
    "extractedTextFile": "backend/docs/manuals/samsung ne58f9710ws-extracted.txt",
    "verifiedAt": "2026-09-16",
    "verifiedBy": "manual-extraction",
}

SAFETY = {
    "id": "safety_power_off",
    "order": 1,
    "type": "safety",
    "title": "Disconnect power",
    "body": (
        "Disconnect electrical power at breaker before servicing. Replace all panels before operating. "
        "240 VAC present at terminal block when energized."
    ),
    "sourceExcerpt": "Disconnect power before servicing the range. Replace all panels before operating range.",
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
        "samsungne58-power",
        "§4-2: No power / main ↔ sub PCB",
        "4-2",
        "Electrical malfunction — power",
        [39, 42],
        ["supply", "main_control"],
        ["no_power", "display_dead", "E-83"],
        [
            instr("restore_pwr", 2, "Check breaker and terminal block", "Verify 240 VAC 60 Hz at terminal block.", "smps_check"),
            meas(
                "smps_check",
                3,
                "Main PCB SMPS",
                "CN08/CN09 on main PCB — 120 VAC L–N. SMPS input 120 V, output 12 V / 5 V.",
                "supplyVoltage120",
                "CN08/CN09",
                "L1 ↔ N",
                ohm_branches("pwr", "comm_check", "replace_pcb", "120 VAC"),
            ),
            instr(
                "comm_check",
                4,
                "Main ↔ sub harness",
                "Verify TE400/CN201 harness between main PCB and sub PCB seated — E-83 path.",
                "power_ok",
            ),
            outcome("replace_pcb", 5, "Replace PCB or harness", "Replace defected main PCB, sub PCB, or communication harness."),
            outcome("power_ok", 6, "Power path OK", "Supply and PCB power verified."),
        ],
    ),
    proc(
        "samsungne58-hmi-touch",
        "§4-1: Touch keypad / SE / tE",
        "4-1",
        "Failure display — touch communication",
        [28, 33, 34],
        ["display_panel"],
        ["hmi_check", "SE", "tE"],
        [
            instr(
                "keypad_check",
                2,
                "Keypad cable TE201",
                "Disconnect power. Inspect keypad cable at sub PCB TE201 — -SE- key short path.",
                "touch_comm",
            ),
            instr(
                "touch_comm",
                3,
                "Touch glass ↔ sub PCB",
                "Verify touch glass connector and TE201 on sub PCB — -tE- communication error path.",
                "hmi_ok",
            ),
            outcome("replace_touch", 4, "Replace touch control PCB", "Replace control box (touch PCB + glass) or sub PCB when harness verified."),
            outcome("hmi_ok", 5, "HMI path OK", "Touch and keypad communication verified."),
        ],
    ),
    proc(
        "samsungne58-oven-sensor",
        "§4-2: Oven temperature sensor",
        "4-2",
        "Oven sensor resistance — E-21/E-22",
        [28, 47],
        ["thermistor"],
        ["E-21", "E-22", "sensor_check"],
        [
            instr("disconnect_sensor", 2, "Disconnect sensor harness", "Power off. Access oven sensor at CN201/CN02 path.", "sensor_ohms"),
            meas(
                "sensor_ohms",
                3,
                "Oven sensor resistance",
                "Measure oven sensor at room temperature — ~1080 Ω nominal.",
                "samsungNx60OvenSensorOhms",
                "Oven sensor",
                "terminals",
                ohm_branches("rtd", "sensor_ok", "replace_sensor", "~1080 Ω"),
            ),
            outcome("replace_sensor", 4, "Replace oven sensor or PCB", "Replace open/short sensor or main PCB when connectors verified."),
            outcome("sensor_ok", 5, "Oven sensor OK", "Oven temperature sensor verified."),
        ],
    ),
    proc(
        "samsungne58-bake-element",
        "§4-2: Bake element",
        "4-2",
        "Bake heater harness and voltage",
        [44],
        ["bake_element"],
        ["no_bake_heat_issue", "heating_element_check"],
        [
            instr("bake_off", 2, "Disconnect bake harness", "Power off. Access bake element harness terminals.", "bake_ohms"),
            meas(
                "bake_ohms",
                3,
                "Bake element resistance",
                "Measure bake element harness resistance at room temperature.",
                "bakeElementOhms",
                "Bake heater",
                "terminals",
                ohm_branches("bake", "bake_voltage", "replace_bake", "In range"),
            ),
            instr(
                "bake_voltage",
                4,
                "Bake terminal voltage",
                "Press bake keypad. Measure bake heater terminals — AC 240 V (allow >1 min on-off cycling).",
                "bake_ok",
            ),
            outcome("replace_bake", 5, "Replace bake element or sub PCB", "Replace open bake element, harness, or sub PCB relay path."),
            outcome("bake_ok", 6, "Bake path OK", "Bake element and relay path verified."),
        ],
    ),
    proc(
        "samsungne58-broil-element",
        "§4-2: Broil element",
        "4-2",
        "Broil heater harness and voltage",
        [44],
        ["broil_element"],
        ["no_broil_heat_issue", "heating_element_check"],
        [
            instr("broil_off", 2, "Disconnect broil harness", "Power off. Access broil element harness terminals.", "broil_ohms"),
            meas(
                "broil_ohms",
                3,
                "Broil element resistance",
                "Measure broil element harness resistance at room temperature.",
                "broilElementOhms",
                "Broil heater",
                "terminals",
                ohm_branches("broil", "broil_voltage", "replace_broil", "In range"),
            ),
            instr(
                "broil_voltage",
                4,
                "Broil terminal voltage",
                "Press broil keypad. Measure broil heater terminals — AC 240 V.",
                "broil_ok",
            ),
            outcome("replace_broil", 5, "Replace broil element or sub PCB", "Replace open broil element, harness, or sub PCB relay path."),
            outcome("broil_ok", 6, "Broil path OK", "Broil element and relay path verified."),
        ],
    ),
    proc(
        "samsungne58-convection-element",
        "§4-2: Convection element",
        "4-2",
        "Convection heater harness and voltage",
        [44],
        ["convection_element"],
        ["convection_issue", "heating_element_check"],
        [
            instr("conv_off", 2, "Disconnect convection harness", "Power off. Access convection element harness.", "conv_ohms"),
            meas(
                "conv_ohms",
                3,
                "Convection element resistance",
                "Measure convection element harness resistance at room temperature.",
                "bakeElementOhms",
                "Convection heater",
                "terminals",
                ohm_branches("conv", "conv_voltage", "replace_conv", "In range"),
            ),
            instr(
                "conv_voltage",
                4,
                "Convection terminal voltage",
                "Press convection bake keypad. Measure convection heater — AC 240 V (>1 min cycling).",
                "conv_ok",
            ),
            outcome("replace_conv", 5, "Replace convection element or sub PCB", "Replace convection element, harness, or sub PCB relay."),
            outcome("conv_ok", 6, "Convection heat OK", "Convection element path verified."),
        ],
    ),
    proc(
        "samsungne58-convection-fan",
        "§4-2: Convection fan motor",
        "4-2",
        "Convection fan relay and motor",
        [41, 45],
        ["convection_fan"],
        ["convection_issue", "fan_motor_check"],
        [
            instr("fan_disconnect", 2, "Disconnect fan motor harness", "Power off. Access convection fan motor terminals.", "fan_ohms"),
            meas(
                "fan_ohms",
                3,
                "Convection fan motor resistance",
                "Measure motor terminal resistance with harness disconnected.",
                "samsungNx60ConvectionFanOhms",
                "Fan motor",
                "terminals",
                ohm_branches("fan", "fan_relay", "replace_fan", "In range"),
            ),
            instr(
                "fan_relay",
                4,
                "Ry08 relay and CN01",
                "Verify convection fan relay Ry08 on sub PCB and connector CN01. Harness CN04/CN05 sub ↔ main.",
                "fan_ok",
            ),
            outcome("replace_fan", 5, "Replace fan motor or relay", "Replace fan motor, Ry08 relay, or sub PCB."),
            outcome("fan_ok", 6, "Convection fan OK", "Convection fan motor and relay verified."),
        ],
    ),
    proc(
        "samsungne58-heater-relays",
        "§4-1: Heater relays E-24",
        "4-1",
        "DLB / bake / broil / convection relays",
        [30],
        ["main_control"],
        ["E-24", "relay_check"],
        [
            meas(
                "relay_contacts",
                2,
                "Sub PCB relay contacts",
                "Power off. Measure DLB, bake, broil, convection relay contacts — open (∞ Ω) at rest.",
                "samsungNx60HeaterRelayContactsOhms",
                "Sub PCB relays",
                "contacts",
                ohm_branches("relay", "relay_ok", "replace_sub_pcb", "Open at rest"),
            ),
            outcome("replace_sub_pcb", 3, "Replace sub PCB", "Replace sub PCB when relay contacts shorted or damaged — E-24 path."),
            outcome("relay_ok", 4, "Heater relays OK", "Oven heater relay contacts verified."),
        ],
    ),
    proc(
        "samsungne58-door-lock",
        "§4-2: Door lock motor",
        "4-2",
        "Lock motor and micro switch — E-0E",
        [45],
        ["door_lock"],
        ["E-0E", "door_latch_check"],
        [
            meas(
                "lock_motor",
                2,
                "Lock motor resistance",
                "Measure lock motor coil at room temperature with harness disconnected.",
                "samsungNx60DoorLockMotorOhms",
                "Lock motor",
                "coil",
                ohm_branches("lock", "lock_switch", "replace_lock", "In range"),
            ),
            instr(
                "lock_switch",
                3,
                "Micro switch COM-NO",
                "Verify micro switch state. Command lock (cooking time + delay start 3 s) — 120 V at lock motor.",
                "lock_ok",
            ),
            outcome("replace_lock", 4, "Replace lock motor or switch", "Replace lock motor, micro switch, or harness — E-0E."),
            outcome("lock_ok", 5, "Door lock OK", "Door lock motor and switch verified."),
        ],
    ),
    proc(
        "samsungne58-door-switch",
        "§4-2: Door plunger switch",
        "4-2",
        "Door plunger switch continuity",
        [46],
        ["door_switch"],
        ["door_switch_check"],
        [
            instr(
                "plunger_check",
                2,
                "Door plunger switch",
                "Check plunger switch normal-close state. Inspect wire, housing, and terminals for damage.",
                "door_sw_ok",
            ),
            outcome("replace_plunger", 3, "Replace door switch", "Replace or repair door plunger switch or harness."),
            outcome("door_sw_ok", 4, "Door switch OK", "Door plunger switch verified."),
        ],
    ),
    proc(
        "samsungne58-thermal-cutoff",
        "§4-2: Thermostat / thermal fuse",
        "4-2",
        "Thermostat continuity — E-08 over-temp",
        [39],
        ["thermal_fuse"],
        ["overheat", "E-08"],
        [
            meas(
                "thermostat_ohms",
                2,
                "Thermostat resistance",
                "Measure both ends of thermostat terminals — normal 0 Ω. Thermal fuse out if open.",
                "bakeElementOhms",
                "Thermostat",
                "both terminals",
                ohm_branches("therm", "therm_ok", "replace_therm", "0 Ω"),
            ),
            outcome("replace_therm", 3, "Replace thermostat", "Replace thermostat / thermal fuse when open."),
            outcome("therm_ok", 4, "Thermal protection OK", "Thermostat continuity verified — also verify oven sensor for E-08."),
        ],
    ),
    proc(
        "samsungne58-surface-radiant",
        "§3-5: Surface radiant elements",
        "3-5",
        "Ceramic cooktop radiant elements — knob control",
        [13],
        ["surface_element"],
        ["surface_burner", "cooktop_no_heat"],
        [
            instr(
                "surface_access",
                2,
                "Access surface harness",
                "Disconnect power. Remove ceramic glass cooktop per §3-5. Inspect radiant element harness connectors.",
                "surface_check",
            ),
            instr(
                "surface_check",
                3,
                "Radiant element / infinite switch",
                "Verify knob-controlled infinite switch sends power to radiant element. Measure element continuity at terminals.",
                "surface_ok",
            ),
            outcome("replace_surface", 4, "Replace surface element or switch", "Replace radiant element or infinite switch — platform implementation."),
            outcome("surface_ok", 5, "Surface heat path OK", "Surface heating path verified at platform level."),
        ],
    ),
]


def write_catalog() -> None:
    catalog = {
        "manualId": SOURCE["manualId"],
        "platformId": PLATFORM,
        "templateId": "electric_range",
        "label": "Samsung NE58 Flex Duo electric range",
        "notes": "CG-10 R4 manufacturer boundary — electric only. Not NX60 gas platform.",
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
                "relatedCodes": [t for t in item.get("tags", []) if t.startswith("E") or t in {"SE", "tE"}],
            }
            for item in PROCEDURES
        ],
    }
    (OUT / "procedureCatalog.json").write_text(json.dumps(catalog, indent=2) + "\n", encoding="utf-8")


def write_readme() -> None:
    readme = f"""# Samsung NE58 Flex Duo electric range (`{PLATFORM}`)

**Manual:** SAMSUNG-NE58-RANGE — NE58F9710WS / FER710DRS electric convection  
**Extraction:** `knowledge/pattern-catalog/SAMSUNG_NE58_RANGE_EXTRACTION.md`

{len(PROCEDURES)} procedures for CG-10 R4 manufacturer-boundary validation.

```bash
python backend/scripts/run_procedure_manual_pipeline.py --manual SAMSUNG-NE58-RANGE
```
"""
    (OUT / "README.md").write_text(readme, encoding="utf-8")


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    for item in PROCEDURES:
        path = OUT / f"{item['id']}.json"
        path.write_text(json.dumps(item, indent=2) + "\n", encoding="utf-8")
        print(f"Wrote {path.name}")
    write_catalog()
    write_readme()
    for script in (
        "attach_samsung_ne58_range_diagnostic_effects.py",
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
