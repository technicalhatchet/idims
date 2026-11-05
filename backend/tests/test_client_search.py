"""Client list search: phone digits and A–Z sort."""
import asyncio
import importlib
import pkgutil
from unittest.mock import MagicMock

import app.models

from sqlalchemy.dialects import postgresql

from app.services.client_service import ClientService, client_search_digits

# Load the models so relationships like Client.appliances resolve, as they do in the app.
# A few legacy model files don't import on their own; Client doesn't use them.
for _mod in pkgutil.iter_modules(app.models.__path__):
    try:
        importlib.import_module(f"app.models.{_mod.name}")
    except Exception:  # noqa: BLE001
        pass


def test_phone_like_searches_give_digits():
    assert client_search_digits("419 515") == "419515"
    assert client_search_digits("(419) 515-3394") == "4195153394"
    assert client_search_digits("+1 419") == "1419"


def test_non_phone_searches_skip_phone_matching():
    assert client_search_digits("Dana") is None
    assert client_search_digits("Unit 4B") is None
    assert client_search_digits("41") is None
    assert client_search_digits("") is None
    assert client_search_digits(None) is None


def _run(**kwargs):
    """Run get_clients against a mock session and return the compiled Postgres SQL."""
    db = MagicMock()
    query = MagicMock()
    db.query.return_value = query
    for name in ("options", "filter", "order_by", "offset", "limit"):
        getattr(query, name).return_value = query
    query.count.return_value = 0
    query.all.return_value = []
    asyncio.run(ClientService.get_clients(db, **kwargs))
    sql = []
    for call in query.filter.call_args_list + query.order_by.call_args_list:
        for arg in call.args:
            sql.append(str(arg.compile(dialect=postgresql.dialect(), compile_kwargs={"literal_binds": True})))
    return "\n".join(sql)


def test_phone_search_compares_digits_only():
    sql = _run(search="419-515")
    assert "regexp_replace(coalesce(clients.phone, '')" in sql
    assert "regexp_replace(coalesce(clients.mobile, '')" in sql
    assert "419515%" in sql and "'%%419-515%%'" in sql


def test_name_search_does_not_touch_phones():
    sql = _run(search="Dana Whit")
    assert "regexp_replace" not in sql
    assert "concat(clients.first_name, ' ', clients.last_name)" in sql


def test_sort_name_orders_by_shown_name():
    sql = _run(sort="name")
    assert "lower(coalesce(nullif(trim(clients.company_name), '')" in sql
    assert "ASC" in sql


def test_default_sort_is_newest_first():
    sql = _run()
    assert "clients.created_at DESC" in sql
    assert "lower(" not in sql
