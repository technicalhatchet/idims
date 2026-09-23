#!/usr/bin/env python3
"""Attach diagnosticEffects to Samsung RF28 refrigerator procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/samsung_fridge_rf28"

FAIL_MEAS = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEAS = {"measurement_normal"}

PROCEDURE_COMPONENT = {
    "samsungrf28-freezer-sensor": "thermistor",
    "samsungrf28-fridge-sensor": "thermistor",
    "samsungrf28-freezer-defrost-sensor": "thermistor",
    "samsungrf28-fridge-defrost-sensor": "thermistor",
    "samsungrf28-ambient-sensor": "thermistor",
    "samsungrf28-flex-sensor": "thermistor",
    "samsungrf28-humidity-sensor": "thermistor",
    "samsungrf28-ice-maker-sensor": "ice_maker_module",
    "samsungrf28-ice-room-sensor": "thermistor",
    "samsungrf28-freezer-fan": "evap_fan",
    "samsungrf28-fridge-fan": "evap_fan",
    "samsungrf28-convertible-fan": "evap_fan",
    "samsungrf28-ice-room-fan": "evap_fan",
    "samsungrf28-freezer-defrost-heater": "heater",
    "samsungrf28-fridge-defrost-heater": "heater",
    "samsungrf28-damper-heater": "damper_motor",
    "samsungrf28-ice-duct-heater": "ice_pipe_heater",
    "samsungrf28-ice-room-heater": "heater",
    "samsungrf28-compressor-inverter": "inverter_board",
    "samsungrf28-main-panel-comm": "display_panel",
    "samsungrf28-main-inverter-comm": "inverter_board",
    "samsungrf28-dispenser-panel-comm": "display_panel",
    "samsungrf28-autofill-overflow": "ice_maker_module",
    "samsungrf28-ice-room-frozen-prep": "ice_maker_module",
    "samsungrf28-ice-room-frozen-service": "ice_maker_module",
}

KNOWLEDGE_EVIDENCE = {
    "samsungRf28FridgeThermistorVoltage": ("thermistor", "defrost_thermistor_bad_component", ""),
    "samsungRf28FridgeEvapFanFeedbackVoltage": ("evap_fan", "ref_ms_evap_fan_voltage_low", ""),
    "samsungRf28FridgeInverterIpmVoltage": ("inverter_board", "ref_ms_inverter_ipm_low", ""),
    "samsungRf28FreezerDefrostHeaterOhms": ("heater", "ref_ms_samsung_defrost_heater", ""),
    "samsungRf28FridgeDefrostHeaterOhms": ("heater", "ref_ms_samsung_defrost_heater", ""),
    "samsungRf28FlexDamperHeaterOhms": ("damper_motor", "ref_ms_damper_bad_weak_ff", ""),
    "samsungRf28IceDuctHeaterOhms": ("ice_pipe_heater", "ref_ms_007_heavy_frost_heater_open", ""),
    "samsungRf28IceRoomHeaterOhms": ("heater", "ref_ms_007_heavy_frost_heater_open", ""),
    "samsungRf28AutofillOverflowVoltage": ("ice_maker_module", "", ""),
}


def attach_effects(data: dict) -> int:
    pid = data.get("id", "")
    component = PROCEDURE_COMPONENT.get(pid, "")
    count = 0
    for step in data.get("steps", []):
        kid = step.get("measurementKnowledgeId")
        comp, confirm, eliminate = KNOWLEDGE_EVIDENCE.get(kid, (component, "", ""))
        for branch in step.get("branches", []) or []:
            if branch.get("diagnosticEffects"):
                continue
            when = branch.get("when", {})
            kind = when.get("kind", "")
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
    for path in sorted(SEED_DIR.glob("samsungrf28-*.json")):
        data = json.loads(path.read_text(encoding="utf-8"))
        count = attach_effects(data)
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        print(f"{path.name}: {count} branch(es)")
        total += count
    print(f"Attached effects on {total} branches total.")


if __name__ == "__main__":
    main()
