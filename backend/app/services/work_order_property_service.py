"""Find-or-create client properties for staff work-order service addresses."""

from __future__ import annotations

import logging
from typing import Any, Dict, Optional, Tuple
from uuid import UUID

from sqlalchemy.orm import Session

from app.models.property import Property
from app.services.portal_property_service import (
    _collapse_ws,
    find_duplicate_property,
)
from app.utils.address_format import parse_formatted_service_address

logger = logging.getLogger(__name__)


def extract_service_address_parts(
    service_location: Any,
) -> Tuple[str, Optional[str]]:
    """
    Return (street, unit) from a work-order service_location value.

    Prefers explicit unit/unit_number fields; otherwise parses a formatted
    single-line address (format_property_address / format_client_address).
    """
    if service_location is None:
        return "", None
    if isinstance(service_location, str):
        return parse_formatted_service_address(service_location)

    if not isinstance(service_location, dict):
        return "", None

    explicit_unit = service_location.get("unit_number")
    if explicit_unit is None:
        explicit_unit = service_location.get("unit")
    explicit_unit = (str(explicit_unit).strip() if explicit_unit else "") or None

    address = service_location.get("address")
    if address is None:
        address = service_location.get("formatted")
    address = (str(address).strip() if address else "")

    if not address:
        return "", None

    if explicit_unit:
        return _collapse_ws(address), _collapse_ws(explicit_unit)

    street, unit = parse_formatted_service_address(address)
    return _collapse_ws(street), (_collapse_ws(unit) if unit else None)


def ensure_client_property_for_service_address(
    db: Session,
    client_id: UUID,
    service_location: Any,
) -> Optional[Property]:
    """
    Find a matching client property or create one (staff path).

    Does not call assert_address_serviceable. Never creates a duplicate for the
    same normalized address+unit. Returns None when there is no usable address.
    """
    street, unit = extract_service_address_parts(service_location)
    if not street:
        return None

    existing = find_duplicate_property(db, client_id, street, unit)
    if existing:
        return existing

    prop = Property(
        client_id=client_id,
        address=street,
        unit_number=unit,
        property_type="residential",
        nickname=None,
    )
    db.add(prop)
    db.flush()
    logger.info(
        "Created property %s for client %s at %r unit=%r",
        prop.id,
        client_id,
        street,
        unit,
    )
    return prop
