"""Load diagnostic template metadata for PDF checklist rendering."""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Any, Dict, List, Optional

_CATALOG_PATH = Path(__file__).resolve().parent.parent / "data" / "diagnostic_template_catalog.json"


@lru_cache(maxsize=1)
def load_diagnostic_template_catalog() -> List[Dict[str, Any]]:
    if not _CATALOG_PATH.is_file():
        return []
    with _CATALOG_PATH.open(encoding="utf-8") as fh:
        data = json.load(fh)
    return data if isinstance(data, list) else []


def get_diagnostic_template(template_id: Optional[str]) -> Optional[Dict[str, Any]]:
    if not template_id:
        return None
    for template in load_diagnostic_template_catalog():
        if template.get("id") == template_id:
            return template
    return None
