"""
County-based sales tax resolution for work orders (parts tax).

Zip → county → rate. Unknown zips default to Lucas County.
"""

import logging
from decimal import Decimal
from typing import Any, Dict, Optional, Tuple

from sqlalchemy import text
from sqlalchemy.orm import Session

from app.data.ohio_county_zip_seed import (
    ERIE_ZIPS,
    FULTON_ZIPS,
    HANCOCK_ZIPS,
    HENRY_ZIPS,
    LUCAS_ZIPS,
    OTTAWA_ZIPS,
    PUTNAM_ZIPS,
    SANDUSKY_ZIPS,
    SENECA_ZIPS,
    WOOD_ZIPS,
)
from app.utils.address_utils import extract_zip_code

logger = logging.getLogger(__name__)

DEFAULT_COUNTY_KEY = "lucas"

DEFAULT_TAX_JURISDICTIONS: Dict[str, Any] = {
    "defaultCounty": DEFAULT_COUNTY_KEY,
    "counties": {
        "lucas": {
            "name": "Lucas County",
            "rate": 0.0775,
            "zipCodes": LUCAS_ZIPS,
        },
        "wood": {
            "name": "Wood County",
            "rate": 0.0675,
            "zipCodes": WOOD_ZIPS,
        },
        "fulton": {
            "name": "Fulton County",
            "rate": 0.0725,
            "zipCodes": FULTON_ZIPS,
        },
        "henry": {
            "name": "Henry County",
            "rate": 0.0725,
            "zipCodes": HENRY_ZIPS,
        },
        "ottawa": {
            "name": "Ottawa County",
            "rate": 0.07,
            "zipCodes": OTTAWA_ZIPS,
        },
        "sandusky": {
            "name": "Sandusky County",
            "rate": 0.0725,
            "zipCodes": SANDUSKY_ZIPS,
        },
        "erie": {
            "name": "Erie County",
            "rate": 0.0675,
            "zipCodes": ERIE_ZIPS,
        },
        "hancock": {
            "name": "Hancock County",
            "rate": 0.0675,
            "zipCodes": HANCOCK_ZIPS,
        },
        "putnam": {
            "name": "Putnam County",
            "rate": 0.07,
            "zipCodes": PUTNAM_ZIPS,
        },
        "seneca": {
            "name": "Seneca County",
            "rate": 0.0725,
            "zipCodes": SENECA_ZIPS,
        },
    },
}


def _build_zip_index(counties: Dict[str, Any]) -> Dict[str, str]:
    """Map zip → county key. Later counties override earlier on duplicate zips."""
    index: Dict[str, str] = {}
    for county_key, county in counties.items():
        for zip_code in county.get("zipCodes") or []:
            clean = str(zip_code).strip()[:5]
            if len(clean) == 5 and clean.isdigit():
                index[clean] = county_key
    return index


class TaxService:
    def __init__(self, db: Session):
        self.db = db
        self._config: Optional[Dict[str, Any]] = None
        self._zip_index: Optional[Dict[str, str]] = None

    def _get_config(self) -> Dict[str, Any]:
        if self._config is not None:
            return self._config
        try:
            query = text("SELECT value FROM settings WHERE key = :key")
            result = self.db.execute(query, {"key": "tax_jurisdictions"}).fetchone()
            if result and result[0]:
                self._config = result[0]
            else:
                self._config = DEFAULT_TAX_JURISDICTIONS
        except Exception as exc:
            logger.warning("Could not load tax_jurisdictions setting: %s", exc)
            self._config = DEFAULT_TAX_JURISDICTIONS
        return self._config

    def _get_zip_index(self) -> Dict[str, str]:
        if self._zip_index is None:
            config = self._get_config()
            counties = config.get("counties") or {}
            self._zip_index = _build_zip_index(counties)
        return self._zip_index

    def get_all_jurisdictions(self) -> Dict[str, Any]:
        return self._get_config()

    def get_county_by_zip(self, zip_code: Optional[str]) -> Optional[Tuple[str, Dict[str, Any]]]:
        if not zip_code:
            return None
        clean = str(zip_code).strip()[:5]
        if len(clean) != 5:
            return None
        county_key = self._get_zip_index().get(clean)
        if not county_key:
            return None
        counties = self._get_config().get("counties") or {}
        county = counties.get(county_key)
        if not county:
            return None
        return county_key, county

    def resolve_tax_rate(
        self,
        address: Optional[str] = None,
        zip_code: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Resolve sales tax rate from zip (parsed from address if needed).

        Returns rate as decimal (e.g. 0.0775), county info, and lookup method.
        """
        config = self._get_config()
        counties = config.get("counties") or {}
        default_key = config.get("defaultCounty") or DEFAULT_COUNTY_KEY
        default_county = counties.get(default_key) or counties.get("lucas") or {
            "name": "Lucas County",
            "rate": 0.0775,
        }

        resolved_zip = zip_code or extract_zip_code(address or "")
        result = self.get_county_by_zip(resolved_zip)

        if result:
            county_key, county = result
            rate = float(county.get("rate", default_county.get("rate", 0.0775)))
            return {
                "rate": rate,
                "countyKey": county_key,
                "countyName": county.get("name", county_key.title()),
                "zipCode": resolved_zip,
                "method": "zip_code",
            }

        rate = float(default_county.get("rate", 0.0775))
        return {
            "rate": rate,
            "countyKey": default_key,
            "countyName": default_county.get("name", "Lucas County"),
            "zipCode": resolved_zip,
            "method": "default",
        }

    def resolve_work_order_address(self, work_order, address: Optional[str] = None) -> Optional[str]:
        """Best-effort service address for tax zip lookup."""
        if address:
            return address

        if work_order.service_location:
            loc = work_order.service_location
            if isinstance(loc, dict):
                address = loc.get("address") or loc.get("formatted_address")
            elif isinstance(loc, str):
                address = loc

        if not address and getattr(work_order, "property_ref", None):
            prop = work_order.property_ref
            address = getattr(prop, "address", None)

        if not address and getattr(work_order, "property_id", None):
            from app.models.property import Property

            prop = (
                self.db.query(Property)
                .filter(Property.id == work_order.property_id)
                .first()
            )
            if prop:
                address = prop.address

        return address

    def apply_tax_rate_to_work_order(self, work_order, address: Optional[str] = None) -> Dict[str, Any]:
        """Set work_order.tax_rate from service address. Returns resolve result."""
        address = self.resolve_work_order_address(work_order, address=address)
        tax_result = self.resolve_tax_rate(address=address)
        work_order.tax_rate = Decimal(str(tax_result["rate"]))
        logger.info(
            "Tax rate %.4f (%s, method=%s, zip=%s) for work order %s",
            tax_result["rate"],
            tax_result["countyName"],
            tax_result["method"],
            tax_result.get("zipCode"),
            getattr(work_order, "id", "new"),
        )
        return tax_result

    def ensure_work_order_tax_rate(self, work_order, *, apply_when_missing: bool = True) -> Dict[str, Any]:
        """
        Resolve county tax for a work order.

        When ``apply_when_missing`` is True and the stored rate is zero, persist the
        county rate from the service address / property zip.
        """
        address = self.resolve_work_order_address(work_order)
        tax_result = self.resolve_tax_rate(address=address)
        stored = float(work_order.tax_rate or 0)
        if apply_when_missing and stored == 0:
            work_order.tax_rate = Decimal(str(tax_result["rate"]))
            tax_result["applied"] = True
        else:
            tax_result["applied"] = False
            tax_result["rate"] = stored if stored > 0 else tax_result["rate"]
        return tax_result


def get_tax_service(db: Session) -> TaxService:
    return TaxService(db)
