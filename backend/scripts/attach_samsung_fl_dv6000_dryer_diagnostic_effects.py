#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung FL DV6000 dryer procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_fl_dryer_dv6000"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungdv6000-thermistor": "exhaust_thermistor",
    "samsungdv6000-heater-electric": "heating_element",
    "samsungdv6000-thermal-cutoff": "thermal_fuse",
    "samsungdv6000-motor-circuit": "drive_motor",
    "samsungdv6000-heat-pump-compressor": "compressor",
}

KNOWLEDGE_EVIDENCE = {
    "samsungFlDv6000DryerThermistor10KOhms": (
        "exhaust_thermistor",
        "confirm_exhaust_thermistor_ol_exhaust_thermistor_failed",
        "eliminate_exhaust_thermistor_ol_exhaust_thermistor_ok",
    ),
    "samsungFlDv6000DryerHeaterSingleOhms": (
        "heating_element",
        "confirm_heating_element_ol_heating_element_failed",
        "eliminate_heating_element_ol_heating_element_ok",
    ),
    "samsungFlDv6000DryerHeaterDualLowOhms": (
        "heating_element",
        "confirm_heating_element_ol_heating_element_failed",
        "eliminate_heating_element_ol_heating_element_ok",
    ),
    "samsungFlDv6000DryerHeaterDualHighOhms": (
        "heating_element",
        "confirm_heating_element_ol_heating_element_failed",
        "eliminate_heating_element_ol_heating_element_ok",
    ),
    "samsungFlDv6000DryerMotorWinding34Ohms": (
        "drive_motor",
        "confirm_drive_motor_ol_drive_motor_failed",
        "eliminate_drive_motor_ol_drive_motor_ok",
    ),
    "samsungFlDv6000DryerMotorWinding45Ohms": (
        "drive_motor",
        "confirm_drive_motor_ol_drive_motor_failed",
        "eliminate_drive_motor_ol_drive_motor_ok",
    ),
    "samsungFlDv6000DryerHiLimitOhms": (
        "high_limit_thermostat",
        "confirm_high_limit_ol_high_limit_failed",
        "eliminate_high_limit_ol_high_limit_ok",
    ),
}


def attach_effects(data: dict) -> int:
    pid = data.get("id", "")
    component = PROCEDURE_COMPONENT.get(pid, "")
    count = 0
    for step in data.get("steps", []):
        kid = step.get("measurementKnowledgeId")
        comp, confirm, eliminate = KNOWLEDGE_EVIDENCE.get(kid, (component, "", ""))
        for branch in step.get("branches", []):
            if branch.get("diagnosticEffects"):
                continue
            kind = branch.get("when", {}).get("kind", "")
            effects = []
            if kind in PASS_MEAS and eliminate:
                effects.append({"action": "eliminate", "evidenceId": eliminate, "componentId": comp})
            elif kind in FAIL_MEAS and confirm:
                effects.append({"action": "confirm", "evidenceId": confirm, "componentId": comp})
            elif kind == "checkpoint_no" and confirm:
                effects.append({"action": "confirm", "evidenceId": confirm, "componentId": comp})
            elif kind == "checkpoint_yes" and eliminate:
                effects.append({"action": "eliminate", "evidenceId": eliminate, "componentId": comp})
            if effects:
                branch["diagnosticEffects"] = effects
                count += 1
    return count


def main() -> None:
    total = 0
    for path in sorted(SEED_DIR.glob("samsungdv6000-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        n = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {n} branches")
        total += n
    print(f"Total: {total}")


if __name__ == "__main__":
    main()
