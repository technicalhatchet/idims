"""Fetch recalls from CPSC SaferProducts REST API."""

from __future__ import annotations

import logging
from datetime import date, datetime
from typing import Any, Dict, List, Optional

import httpx

from app.services.cpsc_recall_brand_families import CPSC_FETCH_MANUFACTURERS

logger = logging.getLogger(__name__)

CPSC_RECALL_URL = "https://www.saferproducts.gov/RestWebServices/Recall"
BOOTSTRAP_RECALL_DATE_START = date(2005, 1, 1)


def _parse_date(value: Any) -> Optional[date]:
    if not value:
        return None
    if isinstance(value, date):
        return value
    text = str(value).strip()
    for fmt in ("%m/%d/%Y", "%Y-%m-%d", "%m-%d-%Y"):
        try:
            return datetime.strptime(text[:10], fmt).date()
        except ValueError:
            continue
    return None


def _extract_models(products: Any) -> List[str]:
    models: List[str] = []
    if not isinstance(products, list):
        return models
    for item in products:
        if not isinstance(item, dict):
            continue
        model = item.get("Model") or item.get("model")
        if model and str(model).strip():
            models.append(str(model).strip())
    return models


def _normalize_recall_row(row: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    recall_id = row.get("RecallID") or row.get("RecallId") or row.get("ID")
    if recall_id is None:
        return None
    try:
        recall_id_int = int(recall_id)
    except (TypeError, ValueError):
        return None

    products = row.get("Products") or row.get("products") or []
    manufacturer = None
    product_name = None
    if isinstance(products, list) and products:
        first = products[0] if isinstance(products[0], dict) else {}
        manufacturer = first.get("Manufacturer") or first.get("manufacturer")
        product_name = first.get("Name") or first.get("name")

    return {
        "cpsc_recall_id": recall_id_int,
        "title": (row.get("Title") or row.get("title") or "Recall").strip(),
        "recall_date": _parse_date(row.get("RecallDate") or row.get("recallDate")),
        "last_publish_date": _parse_date(
            row.get("LastPublishDate") or row.get("lastPublishDate")
        ),
        "url": row.get("URL") or row.get("Url") or row.get("url"),
        "hazard": row.get("Hazard") or row.get("hazard"),
        "remedy": row.get("Remedy") or row.get("remedy"),
        "manufacturer": manufacturer,
        "product_name": product_name,
        "model_numbers": _extract_models(products),
        "raw_payload": row,
    }


def fetch_recalls_for_manufacturer(
    manufacturer: str,
    *,
    recall_date_start: Optional[date] = None,
    last_publish_date_start: Optional[date] = None,
    timeout: float = 60.0,
) -> List[Dict[str, Any]]:
    params: Dict[str, str] = {"format": "json", "Manufacturer": manufacturer}
    if last_publish_date_start:
        params["LastPublishDateStart"] = last_publish_date_start.strftime("%m/%d/%Y")
    elif recall_date_start:
        params["RecallDateStart"] = recall_date_start.strftime("%m/%d/%Y")

    try:
        response = httpx.get(CPSC_RECALL_URL, params=params, timeout=timeout)
        response.raise_for_status()
        data = response.json()
    except Exception as exc:
        logger.error("CPSC fetch failed manufacturer=%s: %s", manufacturer, exc)
        return []

    if not isinstance(data, list):
        logger.warning("CPSC unexpected payload for %s: %s", manufacturer, type(data))
        return []

    out: List[Dict[str, Any]] = []
    for row in data:
        if not isinstance(row, dict):
            continue
        parsed = _normalize_recall_row(row)
        if parsed:
            out.append(parsed)
    return out


def fetch_all_configured_manufacturers(
    *,
    bootstrap: bool,
    last_publish_date_start: Optional[date],
) -> List[Dict[str, Any]]:
    combined: Dict[int, Dict[str, Any]] = {}
    for name in CPSC_FETCH_MANUFACTURERS:
        if bootstrap:
            rows = fetch_recalls_for_manufacturer(
                name, recall_date_start=BOOTSTRAP_RECALL_DATE_START
            )
        else:
            rows = fetch_recalls_for_manufacturer(
                name, last_publish_date_start=last_publish_date_start
            )
        for row in rows:
            combined[row["cpsc_recall_id"]] = row
    return list(combined.values())
