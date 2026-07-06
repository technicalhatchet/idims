"""Push notification rules — toggles and recipient roles."""

from __future__ import annotations

from pydantic import BaseModel, Field, validator


class PushRecipients(BaseModel):
    admin: bool = True
    manager: bool = True
    technician: bool = True


class PushNotificationRule(BaseModel):
    enabled: bool = True
    recipients: PushRecipients = Field(default_factory=PushRecipients)
    include_assigned_technician: bool = False


class MorningBriefingSettings(BaseModel):
    enabled: bool = True
    hour: int = Field(7, ge=5, le=11)
    minute: int = Field(0, ge=0, le=59)
    recipients: PushRecipients = Field(default_factory=PushRecipients)
    technicians_see_own_jobs_only: bool = True

    @validator("minute")
    def minute_step(cls, v: int) -> int:
        if v not in (0, 15, 30, 45):
            raise ValueError("minute must be 0, 15, 30, or 45")
        return v


class PushNotificationSettings(BaseModel):
    morning_briefing: MorningBriefingSettings = Field(default_factory=MorningBriefingSettings)
    pending_work_order: PushNotificationRule = Field(
        default_factory=lambda: PushNotificationRule(
            recipients=PushRecipients(admin=True, manager=True, technician=False),
        )
    )
    portal_self_schedule: PushNotificationRule = Field(
        default_factory=lambda: PushNotificationRule(
            include_assigned_technician=True,
        )
    )
    portal_update_request: PushNotificationRule = Field(default_factory=PushNotificationRule)
    deploy_reminder: PushNotificationRule = Field(
        default_factory=lambda: PushNotificationRule(
            recipients=PushRecipients(admin=False, manager=False, technician=True),
        )
    )
