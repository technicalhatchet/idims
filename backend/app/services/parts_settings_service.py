"""Load and validate parts tab settings (vendors + lookup providers)."""
from __future__ import annotations

import copy
import logging
from typing import Any, Dict, List, Optional
from urllib.parse import quote

from sqlalchemy.orm import Session

from app.data.parts_settings_defaults import DEFAULT_PARTS_SETTINGS
from app.schemas.settings import PartsSettings

logger = logging.getLogger(__name__)

SETTING_KEY = "parts_settings"


def _deep_merge(base: dict, override: dict) -> dict:
    result = copy.deepcopy(base)
    for key, value in (override or {}).items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


class PartsSettingsService:
    def __init__(self, db: Session):
        self.db = db

    def _load_raw(self) -> Optional[dict]:
        try:
            from sqlalchemy import text

            row = self.db.execute(
                text("SELECT value FROM settings WHERE key = :key LIMIT 1"),
                {"key": SETTING_KEY},
            ).fetchone()
            if row and row[0]:
                return row[0] if isinstance(row[0], dict) else None
        except Exception as exc:
            logger.warning("Could not load %s: %s", SETTING_KEY, exc)
        return None

    def _load_legacy_markup_percent(self) -> Optional[float]:
        """Legacy `parts_markup_percentage` setting — used only if parts_settings not saved yet."""
        try:
            from sqlalchemy import text

            row = self.db.execute(
                text("SELECT value FROM settings WHERE key = 'parts_markup_percentage' LIMIT 1"),
            ).fetchone()
            if row and row[0] is not None:
                return float(row[0])
        except Exception as exc:
            logger.debug("Could not load legacy parts_markup_percentage: %s", exc)
        return None

    def get_settings(self) -> dict:
        raw = self._load_raw()
        merged = _deep_merge(DEFAULT_PARTS_SETTINGS, raw or {})
        if raw is None:
            legacy_markup = self._load_legacy_markup_percent()
            if legacy_markup is not None:
                merged["markupPercent"] = legacy_markup
        try:
            validated = PartsSettings(**merged)
            return validated.model_dump()
        except Exception as exc:
            logger.warning("Invalid %s in DB, using defaults: %s", SETTING_KEY, exc)
            return copy.deepcopy(DEFAULT_PARTS_SETTINGS)

    def get_allowed_vendor_ids(self) -> List[str]:
        settings = self.get_settings()
        return [
            v["id"]
            for v in settings.get("partVendors", [])
            if v.get("enabled", True) and v.get("id")
        ]

    def validate_vendor(self, vendor: Optional[str]) -> None:
        if vendor is None:
            return
        allowed = self.get_allowed_vendor_ids()
        if vendor not in allowed:
            raise ValueError(f"Vendor must be one of: {', '.join(allowed)}")


def build_lookup_url(
    url_template: str,
    *,
    manufacturer: str = "",
    model_number: str = "",
) -> str:
    search_term = f"{manufacturer} {model_number} parts".strip()
    replacements = {
        "{model}": quote(model_number or "", safe=""),
        "{manufacturer}": quote(manufacturer or "", safe=""),
        "{search}": quote(search_term, safe=""),
    }
    url = url_template or ""
    for token, value in replacements.items():
        url = url.replace(token, value)
    return url


def lookup_providers_for_equipment(settings: dict, equipment_type: str) -> List[dict]:
    if not settings.get("lookupEnabled", True):
        return []
    providers = []
    for provider in settings.get("lookupProviders", []):
        if not provider.get("enabled", True):
            continue
        types = provider.get("equipmentTypes") or []
        if equipment_type and equipment_type not in types:
            continue
        providers.append(provider)
    return providers
