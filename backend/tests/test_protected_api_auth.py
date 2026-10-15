"""Unit-level checks that protected dependencies reject missing Bearer tokens."""

from unittest.mock import MagicMock

import pytest
from fastapi import HTTPException

from app.core.dependencies import get_current_user


@pytest.mark.asyncio
async def test_get_current_user_raises_401_without_token():
    request = MagicMock()
    request.headers = {}
    db = MagicMock()

    with pytest.raises(HTTPException) as exc_info:
        await get_current_user(request, authorization=None, db=db)

    assert exc_info.value.status_code == 401
    assert "token" in str(exc_info.value.detail).lower()


@pytest.mark.asyncio
async def test_get_current_user_raises_401_with_empty_bearer():
    request = MagicMock()
    request.headers = {"Authorization": "Bearer "}
    db = MagicMock()

    with pytest.raises(HTTPException):
        await get_current_user(request, authorization="Bearer ", db=db)
