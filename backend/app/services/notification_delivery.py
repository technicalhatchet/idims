"""Non-blocking delivery helpers for outbound notification email and web push."""

from __future__ import annotations

import asyncio
import logging
from typing import Callable, TypeVar

from fastapi.concurrency import run_in_threadpool

logger = logging.getLogger(__name__)

DELIVERY_TIMEOUT_SECONDS = 10

T = TypeVar("T")


async def run_with_delivery_timeout(awaitable) -> T | None:
    try:
        return await asyncio.wait_for(awaitable, timeout=DELIVERY_TIMEOUT_SECONDS)
    except asyncio.TimeoutError:
        logger.error(
            "Notification delivery timed out after %ss",
            DELIVERY_TIMEOUT_SECONDS,
        )
        return None


async def deliver_resend_email(to_email: str, subject: str, html: str) -> bool:
    if not to_email:
        return False
    from app.services.email_service import EmailService

    result = await run_with_delivery_timeout(
        EmailService.send_resend_email(to_email, subject, html),
    )
    return bool(result)


async def deliver_sync_in_threadpool(fn: Callable[..., T], *args, **kwargs) -> T | None:
    async def _run():
        return await run_in_threadpool(lambda: fn(*args, **kwargs))

    return await run_with_delivery_timeout(_run())
