#!/usr/bin/env python3
"""Attach diagnosticEffects to W10785366A smart-layer procedure branches."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SEED_DIR = ROOT / "frontend/components/diagnostics/procedures/seed/whirlpool_connected_smart_gen3"

FAIL_MEASUREMENT = {"measurement_open", "measurement_warning", "measurement_critical"}
PASS_MEASUREMENT = {"measurement_normal"}

PROCEDURE_COMPONENT: dict[str, str] = {
    "w10785366a-wifi-module": "wifi_module",
    "w10785366a-pmm-ct": "current_transformer",
    "w10785366a-hmi-wifi-comm": "wifi_module",
    "w10785366a-connectivity-console": "wifi_module",
    "w10785366a-dishwasher-wifi": "wifi_module",
    "w10785366a-fridge-wifi-service": "wifi_module",
}

COMPONENT_DEFAULT_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "wifi_module": (
        "wifi_module",
        "confirm_wifi_module_comm_wifi_module_failed",
        "eliminate_wifi_module_comm_wifi_module_ok",
    ),
    "current_transformer": (
        "current_transformer",
        "confirm_current_transformer_ol_current_transformer_failed",
        "eliminate_current_transformer_ol_current_transformer_ok",
    ),
    "hmi_control": (
        "hmi_control",
        "confirm_hmi_control_comm_hmi_control_failed",
        "eliminate_hmi_control_comm_hmi_control_ok",
    ),
}

KNOWLEDGE_EVIDENCE: dict[str, tuple[str, str, str]] = {
    "whirlpoolConnectedSmartGen3CtOhms": COMPONENT_DEFAULT_EVIDENCE["current_transformer"],
    "whirlpoolConnectedSmartGen3WifiModule5Vdc": COMPONENT_DEFAULT_EVIDENCE["wifi_module"],
    "whirlpoolConnectedSmartGen3Pmm5Vdc": (
        "power_management",
        "confirm_power_management_5v_power_management_failed",
        "eliminate_power_management_5v_power_management_ok",
    ),
}


def effects_for_branch(branch: dict, component: str, knowledge_id: str | None = None) -> list[dict] | None:
    when = branch.get("when") or {}
    kind = when.get("kind")
    if knowledge_id and knowledge_id in KNOWLEDGE_EVIDENCE:
        comp, fail_id, pass_id = KNOWLEDGE_EVIDENCE[knowledge_id]
    elif component in COMPONENT_DEFAULT_EVIDENCE:
        comp, fail_id, pass_id = COMPONENT_DEFAULT_EVIDENCE[component]
    else:
        return None

    if kind in FAIL_MEASUREMENT or branch.get("terminal"):
        return [{"componentId": comp, "evidenceId": fail_id, "polarity": "confirm"}]
    if kind in PASS_MEASUREMENT:
        return [{"componentId": comp, "evidenceId": pass_id, "polarity": "eliminate"}]
    if kind == "checkpoint_no" and branch.get("terminal"):
        return [{"componentId": comp, "evidenceId": fail_id, "polarity": "confirm"}]
    if kind == "checkpoint_yes":
        return [{"componentId": comp, "evidenceId": pass_id, "polarity": "eliminate"}]
    return None


def patch_seed(path: Path) -> str:
    data = json.loads(path.read_text(encoding="utf-8"))
    component = PROCEDURE_COMPONENT.get(path.stem.replace(".json", ""), "wifi_module")
    changed = 0

    for step in data.get("steps", []):
        knowledge_id = step.get("measurementKnowledgeId")
        for branch in step.get("branches") or []:
            if branch.get("diagnosticEffects"):
                continue
            fx = effects_for_branch(branch, component, knowledge_id)
            if fx:
                branch["diagnosticEffects"] = fx
                changed += 1

    if changed:
        path.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
        return f"{path.name}: attached {changed} branch effects"
    return f"{path.name}: no changes"


def main() -> None:
    for path in sorted(SEED_DIR.glob("w10785366a-*.json")):
        print(patch_seed(path))


if __name__ == "__main__":
    main()
