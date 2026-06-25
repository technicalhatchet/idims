"""Shared address parsing helpers."""

import re
from typing import Optional


def extract_zip_code(address: Optional[str]) -> Optional[str]:
    """Extract the first 5-digit US zip from an address string."""
    if not address:
        return None
    match = re.search(r"\b(\d{5})(?:-\d{4})?\b", str(address))
    return match.group(1) if match else None
