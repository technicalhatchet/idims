from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

BLOCKED_REASONS = (
    "PROCEDURAL_NOISE",
    "STRUCTURAL_TOKEN",
    "CROSS_APPLIANCE_TERM",
    "UNRESOLVED_COMPONENT",
    "AMBIGUOUS_COMPONENT",
    "CONFLICT",
    "INVALID_EXTRACTION",
)

PROCEDURAL_NOISE_EXACT = frozenset(
    {
        "test",
        "pretest",
        "pre-test",
        "check",
        "mode",
        "diagnostic",
        "service",
        "manual",
        "ohms",
        "ohm",
        "circuit",
        "voltage",
        "resistance",
        "component",
        "connector",
        "harness",
        "terminal",
        "pin",
        "procedure",
        "step",
        "section",
        "page",
        "figure",
        "table",
        "note",
        "warning",
        "caution",
    },
)

AMBIGUOUS_SINGLE_TOKENS = frozenset(
    {
        "motor",
        "valve",
        "pump",
        "board",
        "heater",
        "electric",
        "supply",
        "switch",
        "sensor",
        "control",
        "load",
        "relay",
    },
)

CROSS_TEMPLATE_COMPONENT_HINTS = frozenset(
    {
        "compressor",
        "gas_valve",
        "igniter",
        "gas_ignitor",
        "flame_sensor",
        "burner",
        "defrost",
        "evaporator",
        "condenser",
        "ice_maker",
        "dispenser",
        "turntable",
        "magnetron",
        "convection",
        "broil",
        "bake",
    },
)

STRUCTURAL_PREFIX_PATTERNS = (
    re.compile(r"^§\s*[\d]+[-.][\d]+[a-z]?\s*:?\s*", re.IGNORECASE),
    re.compile(r"^test\s*#?\s*\d+[a-z]?\s*[-–—:]\s*", re.IGNORECASE),
    re.compile(r"^test\s*#?\s*\d+[a-z]?\s*$", re.IGNORECASE),
    re.compile(r"^[\d]+[-.][\d]+[a-z]?\s*:\s*", re.IGNORECASE),
    re.compile(r"^§\s*[\d]+[-.][\d]+[a-z]?\s*$", re.IGNORECASE),
)

PROCEDURAL_SUFFIX_PATTERNS = (
    re.compile(r"\s+test\s*#?\s*\d*[a-z]?\s*$", re.IGNORECASE),
    re.compile(r"\s+test\s*$", re.IGNORECASE),
)

STRUCTURAL_TOKEN_PATTERN = re.compile(r"^[a-z]{0,3}\d+[a-z]?$", re.IGNORECASE)
CONNECTOR_DESIGNATOR_PATTERN = re.compile(r"^[a-z]{1,3}\d+[a-z]?$", re.IGNORECASE)

KNOWN_OEM_DESIGNATORS = frozenset(
    {
        "th2",
        "ms2",
        "dp2",
        "pr6",
        "dl3",
        "aps",
        "ntc",
        "ccu",
        "mcu",
        "acu",
    },
)


def _normalize_term(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


@dataclass(frozen=True)
class PreprocessResult:
    action: str
    raw_term: str
    match_term: str | None = None
    blocked_reason: str | None = None
    preprocess_notes: tuple[str, ...] = ()


def is_procedural_noise(term: str) -> bool:
    return _normalize_term(term) in PROCEDURAL_NOISE_EXACT


def is_structural_token(term: str) -> bool:
    normalized = _normalize_term(term)
    if not normalized:
        return True
    if normalized in KNOWN_OEM_DESIGNATORS:
        return False
    if is_procedural_noise(term):
        return False
    if CONNECTOR_DESIGNATOR_PATTERN.match(normalized):
        return True
    if STRUCTURAL_TOKEN_PATTERN.match(normalized) and len(normalized) <= 4:
        return True
    if re.fullmatch(r"§\s*[\d]+[-.][\d]+[a-z]?", normalized):
        return True
    if re.fullmatch(r"test\s*#?\s*\d+[a-z]?", normalized):
        return True
    return False


def strip_structural_and_procedural_markers(text: str) -> tuple[str, tuple[str, ...]]:
    notes: list[str] = []
    cleaned = str(text or "").strip()
    if not cleaned:
        return "", tuple(notes)

    for pattern in STRUCTURAL_PREFIX_PATTERNS:
        updated = pattern.sub("", cleaned).strip()
        if updated != cleaned:
            notes.append("stripped_structural_prefix")
            cleaned = updated

    for pattern in PROCEDURAL_SUFFIX_PATTERNS:
        updated = pattern.sub("", cleaned).strip()
        if updated != cleaned:
            notes.append("stripped_procedural_suffix")
            cleaned = updated

    return cleaned, tuple(notes)


def preprocess_extracted_term(raw_term: str) -> PreprocessResult:
    raw = str(raw_term or "").strip()
    if not raw:
        return PreprocessResult(
            action="filter",
            raw_term=raw,
            blocked_reason="INVALID_EXTRACTION",
        )

    if is_procedural_noise(raw):
        return PreprocessResult(
            action="filter",
            raw_term=raw,
            blocked_reason="PROCEDURAL_NOISE",
        )

    if is_structural_token(raw):
        return PreprocessResult(
            action="filter",
            raw_term=raw,
            blocked_reason="STRUCTURAL_TOKEN",
        )

    cleaned, notes = strip_structural_and_procedural_markers(raw)
    if not cleaned:
        return PreprocessResult(
            action="filter",
            raw_term=raw,
            blocked_reason="STRUCTURAL_TOKEN",
            preprocess_notes=notes,
        )

    if is_procedural_noise(cleaned):
        return PreprocessResult(
            action="filter",
            raw_term=raw,
            blocked_reason="PROCEDURAL_NOISE",
            preprocess_notes=notes,
        )

    if cleaned != raw:
        return PreprocessResult(
            action="match",
            raw_term=raw,
            match_term=cleaned,
            preprocess_notes=notes,
        )

    return PreprocessResult(action="match", raw_term=raw, match_term=raw)


def preprocess_title(title: str) -> PreprocessResult:
    return preprocess_extracted_term(title)


@dataclass(frozen=True)
class ExtractedTerm:
    raw: str
    match_term: str
    source: str
    preprocess: PreprocessResult | None = None


def extract_terms_from_procedure(procedure: dict[str, Any]) -> list[ExtractedTerm]:
    terms: list[ExtractedTerm] = []

    for component_id in procedure.get("componentIds") or []:
        raw = str(component_id)
        preprocessed = preprocess_extracted_term(raw)
        if preprocessed.action == "filter":
            continue
        terms.append(
            ExtractedTerm(
                raw=raw,
                match_term=preprocessed.match_term or raw,
                source="componentId",
                preprocess=preprocessed,
            ),
        )

    title = str(procedure.get("title") or "").strip()
    if title:
        preprocessed = preprocess_title(title)
        if preprocessed.action == "match" and preprocessed.match_term:
            terms.append(
                ExtractedTerm(
                    raw=title,
                    match_term=preprocessed.match_term,
                    source="title",
                    preprocess=preprocessed,
                ),
            )

    for step in procedure.get("steps") or []:
        for token in re.findall(
            r"\b(CCU|MCU|ACU|MS2|DP2|PR6|DL3)\b",
            str(step.get("body") or ""),
        ):
            preprocessed = preprocess_extracted_term(token)
            if preprocessed.action == "filter":
                continue
            terms.append(
                ExtractedTerm(
                    raw=token,
                    match_term=preprocessed.match_term or token,
                    source="step_signal",
                    preprocess=preprocessed,
                ),
            )

    return terms


def infer_blocked_reason(
    term: str,
    template_id: str,
    *,
    in_registry: bool,
    in_canonical_ids: bool,
    has_conflict: bool = False,
) -> str:
    if has_conflict:
        return "CONFLICT"

    normalized = _normalize_term(term)
    if not normalized:
        return "INVALID_EXTRACTION"

    if is_procedural_noise(term):
        return "PROCEDURAL_NOISE"

    if is_structural_token(term):
        return "STRUCTURAL_TOKEN"

    if template_id == "washer" and normalized in CROSS_TEMPLATE_COMPONENT_HINTS:
        return "CROSS_APPLIANCE_TERM"

    if template_id == "washer" and "_" in normalized and not in_canonical_ids and not in_registry:
        if normalized in CROSS_TEMPLATE_COMPONENT_HINTS:
            return "CROSS_APPLIANCE_TERM"
        return "UNRESOLVED_COMPONENT"

    tokens = normalized.split()
    if len(tokens) == 1 and normalized in AMBIGUOUS_SINGLE_TOKENS:
        return "AMBIGUOUS_COMPONENT"

    return "UNRESOLVED_COMPONENT"
