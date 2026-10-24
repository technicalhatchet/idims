"""Customer-facing parts search URL templates."""

from __future__ import annotations

import json
from typing import Any, Dict, Optional
from urllib.parse import quote

from sqlalchemy import text
from sqlalchemy.orm import Session

SETTING_KEY = "parts_links"

DEFAULT_PARTS_LINKS = {
    "model_search_url_template": "https://www.searspartsdirect.com/search?q={model}",
    "water_filter_search_url_template": "https://www.searspartsdirect.com/search?q={model}%20water%20filter",
}

REFRIGERATOR_SUBTYPES = frozenset(
    {"refrigerator", "french_door_fridge", "side_by_side_fridge", "freezer", "chest_freezer", "upright_freezer"}
)


def get_parts_links_settings(db: Session) -> Dict[str, str]:
    row = db.execute(
        text("SELECT value FROM settings WHERE key = :key"),
        {"key": SETTING_KEY},
    ).fetchone()
    if not row or not row[0]:
        return dict(DEFAULT_PARTS_LINKS)
    value = row[0]
    if isinstance(value, str):
        try:
            value = json.loads(value)
        except json.JSONDecodeError:
            return dict(DEFAULT_PARTS_LINKS)
    if not isinstance(value, dict):
        return dict(DEFAULT_PARTS_LINKS)
    out = dict(DEFAULT_PARTS_LINKS)
    for key in DEFAULT_PARTS_LINKS:
        if key in value and isinstance(value[key], str):
            out[key] = value[key]
    return out


def validate_url_template(url: str, field_label: str) -> None:
    if not isinstance(url, str) or not url.strip():
        raise ValueError(f"{field_label} is required")
    if "{model}" not in url:
        raise ValueError(f"{field_label} must include {{model}} placeholder")
    if not url.strip().lower().startswith("https://"):
        raise ValueError(f"{field_label} must start with https://")


def validate_parts_links_value(value: Any) -> None:
    if not isinstance(value, dict):
        raise ValueError("parts_links must be an object")
    for key, label in (
        ("model_search_url_template", "Parts search link"),
        ("water_filter_search_url_template", "Water filter search link"),
    ):
        if key in value:
            if not isinstance(value[key], str):
                raise ValueError(f"parts_links.{key} must be a string")
            validate_url_template(value[key], label)


def build_parts_links_payload(
    db: Session,
    *,
    model: Optional[str],
    equipment_subtype: Optional[str],
) -> Optional[Dict[str, str]]:
    if not (model or "").strip():
        return None
    cfg = get_parts_links_settings(db)
    encoded = quote((model or "").strip())
    links = {
        "parts_search_url": cfg["model_search_url_template"].replace("{model}", encoded),
    }
    if (equipment_subtype or "") in REFRIGERATOR_SUBTYPES:
        links["water_filter_search_url"] = cfg["water_filter_search_url_template"].replace(
            "{model}", encoded
        )
    return links
