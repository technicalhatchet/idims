"""Human-approved matcher improvements (matcher-improvement-wave1 only)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from functools import lru_cache
from typing import Any

from .paths import CALIBRATION_DIR, REVIEW_DIR
from .review.frozen_canonical_vocabulary import load_frozen_canonical_ids
from .review.matcher_improvement_decisions import load_matcher_improvement_decisions

REVIEW_FILENAME = "CG_MATCHER_IMPROVEMENT_REVIEW_v1.json"
GATE_ID = "matcher-improvement-wave1"
MATCHER_LAYER = "matcher_improvement:approved_backlog"
CONFIDENCE = 0.91


@dataclass(frozen=True)
class MatcherImprovementContext:
    manual_id: str
    procedure_id: str | None
    template_id: str
    platform_id: str | None = None


@dataclass(frozen=True)
class MatcherImprovementMatch:
    backlog_id: str
    canonical_id: str
    confidence: float
    matcher_layer: str
    matched_surface: str
    source_term: str


def _normalize_match_surface(term: str) -> str:
    value = str(term or "").strip().lower()
    value = value.replace("—", "-").replace("–", "-")
    value = re.sub(r"^§\s*", "", value)
    value = re.sub(r"^§?[\d\-.]+\s*:\s*", "", value)
    value = re.sub(r"^test\s*#\d+\s*[:\-—]\s*", "", value, flags=re.IGNORECASE)
    value = re.sub(r"\s+", " ", value)
    return value.strip()


def _manual_ids_from_provenance(provenance_ids: list[str]) -> frozenset[str]:
    manuals: set[str] = set()
    for record_id in provenance_ids:
        manual = str(record_id).split("::", 1)[0]
        if manual:
            manuals.add(manual)
    return frozenset(manuals)


def _procedure_family(procedure_id: str | None) -> str:
    if not procedure_id:
        return ""
    parts = str(procedure_id).split("-")
    if len(parts) >= 2:
        return "-".join(parts[:2])
    return str(procedure_id)


def _procedure_family_allowed(procedure_id: str | None, families: list[str]) -> bool:
    if not families:
        return True
    pid = str(procedure_id or "")
    if not pid:
        return True
    family = _procedure_family(procedure_id)
    for expected in families:
        if family == expected or pid.startswith(f"{expected}-") or pid == expected:
            return True
    return False


def _term_matches_spec(term: str, raw_term: str, spec: dict[str, Any]) -> str | None:
    match_type = spec.get("type")
    surfaces = {_normalize_match_surface(term), _normalize_match_surface(raw_term)}
    if match_type == "exact_terms":
        allowed = {_normalize_match_surface(value) for value in (spec.get("values") or [])}
        for surface in surfaces:
            if surface in allowed:
                return surface
        return None
    if match_type == "normalized_regex":
        pattern = str(spec.get("pattern") or "")
        if not pattern:
            return None
        regex = re.compile(pattern, re.IGNORECASE)
        for surface in surfaces:
            if surface and regex.fullmatch(surface):
                return surface
        return None
    return None


# Narrow matcher specs per backlogId (approved human gate only).
BACKLOG_MATCH_SPECS: dict[str, dict[str, Any]] = {
    "efmm-cda9def45dce": {
        "canonicalId": "hmi_control",
        "match": {"type": "exact_terms", "values": ["user_interface"]},
    },
    "efmm-247b16052823": {
        "canonicalId": "user_interface",
        "match": {"type": "exact_terms", "values": ["display_panel"]},
    },
    "efmm-ccfd232a7378": {
        "canonicalId": "control_board",
        "match": {"type": "exact_terms", "values": ["main_control"]},
    },
    "efmm-615da9433924": {
        "canonicalId": "temperature_sensor",
        "match": {"type": "normalized_regex", "pattern": r"^temperature thermistor$"},
    },
    "efmm-ce66fe78ffd3": {
        "canonicalId": "heat_source",
        "match": {"type": "normalized_regex", "pattern": r"^electric heater$"},
    },
    "efmm-5edc6b1da575": {
        "canonicalId": "inlet_valve",
        "match": {"type": "normalized_regex", "pattern": r"^water supply \(4c\)$"},
    },
    "efmm-62ec837ed0fc": {
        "canonicalId": "lid_lock",
        "match": {"type": "normalized_regex", "pattern": r"^door lock \(dc, dc1, dc2\)$"},
    },
    "efmm-c01495a054b4": {
        "canonicalId": "temperature_sensor",
        "match": {"type": "normalized_regex", "pattern": r"^water thermistor \(tc\)$"},
    },
    "efmm-e859af7c0c65": {
        "canonicalId": "heat_source",
        "match": {"type": "normalized_regex", "pattern": r"^e3\s*-\s*tub heater\b.*$"},
    },
}


@lru_cache(maxsize=1)
def load_matcher_improvement_review() -> dict[str, Any]:
    path = CALIBRATION_DIR / REVIEW_FILENAME
    return json.loads(path.read_text(encoding="utf-8"))


def approved_backlog_ids() -> list[str]:
    store = load_matcher_improvement_decisions()
    if store.get("gateId") != GATE_ID:
        return []
    decisions = store.get("decisions") or {}
    approved = [
        backlog_id
        for backlog_id, entry in decisions.items()
        if str(entry.get("reviewStatus") or "") == "approve"
    ]
    return sorted(approved)


def review_item_by_backlog_id() -> dict[str, dict[str, Any]]:
    review = load_matcher_improvement_review()
    return {str(item["backlogId"]): item for item in (review.get("reviewItems") or [])}


def active_approved_rules() -> list[dict[str, Any]]:
    items = review_item_by_backlog_id()
    rules: list[dict[str, Any]] = []
    for backlog_id in approved_backlog_ids():
        spec = BACKLOG_MATCH_SPECS.get(backlog_id)
        item = items.get(backlog_id)
        if not spec or not item:
            continue
        rules.append(
            {
                "backlogId": backlog_id,
                "canonicalId": spec["canonicalId"],
                "match": spec["match"],
                "allowedManualIds": sorted(_manual_ids_from_provenance(item.get("provenanceRecordIds") or [])),
                "procedureFamilies": list(item.get("procedureFamilies") or []),
                "category": item.get("category"),
            },
        )
    return rules


def try_matcher_improvement(
    term: str,
    raw_term: str,
    *,
    context: MatcherImprovementContext,
    canonical_ids: set[str],
    enabled: bool = True,
) -> MatcherImprovementMatch | None:
    if not enabled:
        return None

    for rule in active_approved_rules():
        if context.manual_id not in rule["allowedManualIds"]:
            continue
        if not _procedure_family_allowed(context.procedure_id, rule["procedureFamilies"]):
            continue
        matched_surface = _term_matches_spec(term, raw_term, rule["match"])
        if not matched_surface:
            continue
        canonical_id = str(rule["canonicalId"])
        if canonical_id not in load_frozen_canonical_ids():
            continue
        return MatcherImprovementMatch(
            backlog_id=str(rule["backlogId"]),
            canonical_id=canonical_id,
            confidence=CONFIDENCE,
            matcher_layer=MATCHER_LAYER,
            matched_surface=matched_surface,
            source_term=raw_term,
        )
    return None


def matcher_improvement_provenance_extra(match: MatcherImprovementMatch) -> list[dict[str, Any]]:
    return [
        {
            "type": "matcher_improvement",
            "gateId": GATE_ID,
            "backlogId": match.backlog_id,
            "matchedSurface": match.matched_surface,
            "notes": "Human-approved backlog item only; not a category-wide rule.",
        },
    ]
