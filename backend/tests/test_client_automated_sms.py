"""SMS opt-in gating for automated client texts (reminders, portal batch, etc.)."""

from types import SimpleNamespace

from app.services.client_contact import client_automated_sms_allowed


def _client(**kwargs):
    defaults = {"sms_consent": False, "mobile": None}
    defaults.update(kwargs)
    return SimpleNamespace(**defaults)


def test_automated_sms_requires_consent_and_mobile():
    assert not client_automated_sms_allowed(_client(mobile="+14195551234", sms_consent=False))
    assert not client_automated_sms_allowed(_client(mobile=None, sms_consent=True))
    assert client_automated_sms_allowed(_client(mobile="(419) 555-1234", sms_consent=True))
