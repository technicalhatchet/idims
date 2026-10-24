"""Normalize and match appliance models to CPSC recall model strings."""

from __future__ import annotations

import re
from typing import List, Optional, Tuple

MIN_PREFIX_LEN = 6


def normalize_model(value: Optional[str]) -> str:
    if not value:
        return ""
    text = value.upper()
    return re.sub(r"[^A-Z0-9]", "", text)


def _shared_prefix_len(a: str, b: str) -> int:
    n = 0
    for x, y in zip(a, b):
        if x != y:
            break
        n += 1
    return n


def match_model_to_recall(
    appliance_model: str,
    recall_models: List[str],
) -> Optional[Tuple[str, str]]:
    """
    Return (matched_token, rule) or None.
    rule: exact | prefix_recall | prefix_appliance
    """
    app_norm = normalize_model(appliance_model)
    if not app_norm:
        return None

    for raw in recall_models:
        if not raw:
            continue
        token = normalize_model(raw)
        if not token:
            continue

        if token.endswith("*"):
            prefix = token[:-1]
            if prefix and app_norm.startswith(prefix) and len(prefix) >= MIN_PREFIX_LEN:
                return prefix, "prefix_recall"
            continue

        if app_norm == token:
            return token, "exact"

        shared = _shared_prefix_len(app_norm, token)
        if shared >= MIN_PREFIX_LEN:
            if app_norm.startswith(token):
                return token, "prefix_recall"
            if token.startswith(app_norm):
                return app_norm, "prefix_appliance"

    return None
