"""Tests for work-order part inventory sync."""

import uuid
from unittest.mock import MagicMock, patch

import pytest

from app.services.work_order_part_inventory_service import (
    sync_inventory_for_part_status_change,
    restore_inventory_before_part_delete,
)


@patch("app.services.work_order_part_inventory_service.InventoryService.apply_stock_delta")
def test_consume_on_install(mock_apply):
    db = MagicMock()
    part = MagicMock()
    part.id = uuid.uuid4()
    part.inventory_item_id = uuid.uuid4()
    part.inventory_consumed_qty = 0
    part.number = "W101"

    sync_inventory_for_part_status_change(db, part, "received", "installed", uuid.uuid4())

    mock_apply.assert_called_once()
    assert part.inventory_consumed_qty == 1


@patch("app.services.work_order_part_inventory_service.InventoryService.apply_stock_delta")
def test_restore_on_uninstall(mock_apply):
    db = MagicMock()
    part = MagicMock()
    part.id = uuid.uuid4()
    part.inventory_item_id = uuid.uuid4()
    part.inventory_consumed_qty = 1
    part.number = "W101"

    sync_inventory_for_part_status_change(db, part, "installed", "received", uuid.uuid4())

    mock_apply.assert_called_once()
    assert part.inventory_consumed_qty == 0


@patch("app.services.work_order_part_inventory_service.InventoryService.apply_stock_delta")
def test_skips_without_inventory_link(mock_apply):
    db = MagicMock()
    part = MagicMock()
    part.inventory_item_id = None

    sync_inventory_for_part_status_change(db, part, "received", "installed", uuid.uuid4())
    mock_apply.assert_not_called()


@patch("app.services.work_order_part_inventory_service.InventoryService.apply_stock_delta")
def test_restore_before_delete(mock_apply):
    db = MagicMock()
    part = MagicMock()
    part.id = uuid.uuid4()
    part.inventory_item_id = uuid.uuid4()
    part.inventory_consumed_qty = 1
    part.number = "X"

    restore_inventory_before_part_delete(db, part, uuid.uuid4())

    mock_apply.assert_called_once()
    assert part.inventory_consumed_qty == 0
