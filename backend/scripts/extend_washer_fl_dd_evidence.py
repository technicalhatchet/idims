#!/usr/bin/env python3
"""Add Whirlpool FL DD procedure evidence categories, components, and rules to washer.json."""

from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
WASHER_JSON = ROOT / "frontend/components/diagnostics/knowledge/evidence/washer.json"

NEW_CATEGORIES = [
    {
        "id": "control_hmi",
        "label": "HMI / User Interface",
        "dmaTags": ["hmi_check", "error_code", "F3E1"],
    },
    {
        "id": "water_level",
        "label": "Water Level / Pressure Switch",
        "dmaTags": ["fill_issue", "water_valve_check", "F8E1"],
    },
    {
        "id": "dispenser",
        "label": "Dispenser System",
        "dmaTags": ["dispenser_check", "fill_issue"],
    },
    {
        "id": "vent_dry",
        "label": "Vent / Dry Airflow",
        "dmaTags": ["vent_fan_check", "noisy", "dry_heat"],
    },
    {
        "id": "dry_heating",
        "label": "Dry Heating",
        "dmaTags": ["heating_element_check", "dry_heat", "no_heat"],
    },
]

NEW_COMPONENTS = [
    {
        "id": "hmi_control",
        "label": "HMI / UI control",
        "categoryId": "control_hmi",
        "dmaTags": ["hmi_check", "error_code"],
    },
    {
        "id": "water_level_sensor",
        "label": "Water level sensor (APS)",
        "categoryId": "water_level",
        "dmaTags": ["fill_issue", "water_valve_check"],
    },
    {
        "id": "wash_ntc",
        "label": "Wash temperature sensor",
        "categoryId": "wash_heating",
        "dmaTags": ["heating_element_check", "no_heat"],
    },
    {
        "id": "dosing_pump",
        "label": "Dosing pump",
        "categoryId": "dispenser",
        "dmaTags": ["dispenser_check"],
    },
    {
        "id": "bulk_level_switch",
        "label": "Bulk dispenser level switch",
        "categoryId": "dispenser",
        "dmaTags": ["dispenser_check"],
    },
    {
        "id": "vent_fan",
        "label": "Vent fan motor",
        "categoryId": "vent_dry",
        "dmaTags": ["vent_fan_check", "noisy"],
    },
    {
        "id": "vent_baffle",
        "label": "Vent baffle solenoid",
        "categoryId": "vent_dry",
        "dmaTags": ["vent_fan_check"],
    },
    {
        "id": "dry_heater",
        "label": "Dry heating element",
        "categoryId": "dry_heating",
        "dmaTags": ["heating_element_check", "dry_heat", "no_heat"],
    },
    {
        "id": "dry_ntc",
        "label": "Dry temperature sensor",
        "categoryId": "dry_heating",
        "dmaTags": ["heating_element_check", "dry_heat", "no_heat"],
    },
    {
        "id": "dry_blower",
        "label": "Dry blower motor",
        "categoryId": "vent_dry",
        "dmaTags": ["vent_fan_check", "noisy"],
    },
]

# (component_id, category_id, knowledge_id, dma_tags, trigger_label)
MEASUREMENT_RULE_SPECS = [
    ("hmi_control", "control_hmi", "whirlpoolFlWasherHmi5Vdc", ["hmi_check"], "5v"),
    ("hmi_control", "control_hmi", "whirlpoolFlWasherHmi12Vdc", ["hmi_check"], "12v"),
    ("water_level_sensor", "water_level", "whirlpoolFlWasherAps5Vdc", ["fill_issue"], "5v"),
    ("wash_ntc", "wash_heating", "whirlpoolFlWasherWashNtcOhms", ["heating_element_check"], "ol"),
    ("dosing_pump", "dispenser", "whirlpoolFlWasherDosingPumpOhms", ["dispenser_check"], "ol"),
    ("bulk_level_switch", "dispenser", "whirlpoolFlWasherBulkLevelSwitchClosedOhms", ["dispenser_check"], "ol"),
    ("vent_fan", "vent_dry", "whirlpoolFlWasherVentFanOhms", ["vent_fan_check"], "ol"),
    ("vent_baffle", "vent_dry", "whirlpoolFlWasherVentBaffleSolenoidOhms", ["vent_fan_check"], "ol"),
    ("dry_heater", "dry_heating", "whirlpoolFlWasherDryHeater1100WOms", ["heating_element_check"], "ol"),
    ("dry_heater", "dry_heating", "whirlpoolFlWasherDryHeater450WOms", ["heating_element_check"], "ol"),
    ("dry_ntc", "dry_heating", "whirlpoolFlWasherDryNtcOhms", ["heating_element_check"], "ol"),
    ("dry_blower", "vent_dry", "whirlpoolFlWasherDryBlowerOhms", ["vent_fan_check"], "ol"),
]


def rule_triplet(
    component: str,
    category: str,
    knowledge_id: str,
    dma_tags: list[str],
    trigger: str,
) -> list[dict]:
    confirm_id = f"confirm_{component}_{trigger}_{component}_failed"
    cat_id = f"cat_up_{component}_{trigger}_{component}_failed"
    eliminate_id = f"eliminate_{component}_{trigger}_{component}_ok"
    label = component.replace("_", " ")
    return [
        {
            "id": confirm_id,
            "when": [
                {
                    "type": "measurement",
                    "knowledgeId": knowledge_id,
                    "statusIn": ["critical", "warning", "open"],
                }
            ],
            "target": component,
            "targetLayer": "component",
            "effect": {"effect": "confirm"},
            "explanation": f"{label} failed — supported by OEM procedure measurement.",
            "dmaTags": dma_tags,
        },
        {
            "id": cat_id,
            "when": [
                {
                    "type": "measurement",
                    "knowledgeId": knowledge_id,
                    "statusIn": ["critical", "warning", "open"],
                }
            ],
            "target": category,
            "targetLayer": "category",
            "effect": {"effect": "increase", "value": 38},
            "explanation": f"{label} failed — category evidence increased.",
        },
        {
            "id": eliminate_id,
            "when": [
                {
                    "type": "measurement",
                    "knowledgeId": knowledge_id,
                    "statusIn": ["normal"],
                }
            ],
            "target": component,
            "targetLayer": "component",
            "effect": {"effect": "eliminate"},
            "explanation": f"{label} OK ruled out by OEM procedure measurement.",
        },
    ]


def merge_unique(items: list[dict], new_items: list[dict], key: str = "id") -> list[dict]:
    seen = {item[key] for item in items if key in item}
    for item in new_items:
        if item[key] not in seen:
            items.append(item)
            seen.add(item[key])
    return items


def main() -> None:
    data = json.loads(WASHER_JSON.read_text(encoding="utf-8"))
    data["categories"] = merge_unique(data.get("categories", []), NEW_CATEGORIES)
    data["components"] = merge_unique(data.get("components", []), NEW_COMPONENTS)

    new_rules: list[dict] = []
    for spec in MEASUREMENT_RULE_SPECS:
        new_rules.extend(rule_triplet(*spec))

    data["rules"] = merge_unique(data.get("rules", []), new_rules)

    WASHER_JSON.write_text(json.dumps(data, indent=2) + "\n", encoding="utf-8")
    print(f"Extended {WASHER_JSON.name}: +{len(NEW_CATEGORIES)} categories, +{len(NEW_COMPONENTS)} components, +{len(new_rules)} rules.")


if __name__ == "__main__":
    main()
