"""Inventory service tests."""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.core.exceptions import ValidationException
from app.schemas.inventory import InventoryStockAdjust
from app.services.inventory_service import InventoryService


def test_adjust_stock_zero_delta_raises():
    db = MagicMock()
    with pytest.raises(ValidationException):
        InventoryService.adjust_stock(
            db,
            uuid.uuid4(),
            InventoryStockAdjust(quantity_delta=0),
            uuid.uuid4(),
        )


@patch.object(InventoryService, "get_item")
def test_adjust_stock_prevents_negative(mock_get_item):
    db = MagicMock()
    item_id = uuid.uuid4()
    item = MagicMock()
    item.id = item_id
    item.quantity_in_stock = 2
    mock_get_item.return_value = item

    with pytest.raises(ValidationException):
        InventoryService.adjust_stock(
            db,
            item_id,
            InventoryStockAdjust(quantity_delta=-5, notes="test"),
            uuid.uuid4(),
        )

    db.commit.assert_not_called()
