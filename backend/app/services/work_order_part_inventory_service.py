"""Decrement / restore shop stock when WO parts are installed."""

from __future__ import annotations

import logging
import uuid
from typing import Optional

from sqlalchemy.orm import Session

from app.core.exceptions import ValidationException
from app.models.work_order import WorkOrderPart
from app.services.inventory_service import InventoryService

logger = logging.getLogger(__name__)

INSTALLED_STATUS = "installed"


def sync_inventory_for_part_status_change(
    db: Session,
    part: WorkOrderPart,
    previous_status: Optional[str],
    new_status: str,
    user_id: Optional[uuid.UUID],
) -> None:
    """Pull from shop stock when a linked part is installed; restore on revert."""
    if not part.inventory_item_id:
        return

    prev_installed = previous_status == INSTALLED_STATUS
    new_installed = new_status == INSTALLED_STATUS
    consumed = int(part.inventory_consumed_qty or 0)

    if new_installed and not prev_installed:
        if consumed > 0:
            return
        try:
            InventoryService.apply_stock_delta(
                db,
                part.inventory_item_id,
                -1,
                user_id,
                reference_id=part.id,
                reference_type="work_order_part",
                notes=f"Installed on job — {part.number}",
            )
            part.inventory_consumed_qty = 1
        except ValidationException:
            raise
        except Exception as exc:
            logger.error("Inventory consume failed for part %s: %s", part.id, exc)
            raise ValidationException("Could not decrement shop stock for this part")

    elif prev_installed and not new_installed and consumed > 0:
        try:
            InventoryService.apply_stock_delta(
                db,
                part.inventory_item_id,
                consumed,
                user_id,
                reference_id=part.id,
                reference_type="work_order_part",
                notes=f"Install reverted — {part.number}",
            )
            part.inventory_consumed_qty = 0
        except Exception as exc:
            logger.error("Inventory restore failed for part %s: %s", part.id, exc)
            raise ValidationException("Could not restore shop stock for this part")


def restore_inventory_before_part_delete(
    db: Session,
    part: WorkOrderPart,
    user_id: Optional[uuid.UUID],
) -> None:
    consumed = int(part.inventory_consumed_qty or 0)
    if not part.inventory_item_id or consumed <= 0:
        return
    InventoryService.apply_stock_delta(
        db,
        part.inventory_item_id,
        consumed,
        user_id,
        reference_id=part.id,
        reference_type="work_order_part",
        notes=f"Part removed from job — {part.number}",
    )
    part.inventory_consumed_qty = 0
