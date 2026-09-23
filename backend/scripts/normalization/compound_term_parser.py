from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any

ACTUATOR_TOKENS = frozenset(
    {
        "motor",
        "pump",
        "valve",
        "switch",
        "sensor",
        "thermistor",
        "solenoid",
        "heater",
        "relay",
        "fuse",
        "board",
        "assembly",
        "lock",
        "latch",
        "igniter",
        "coil",
        "actuator",
        "module",
    },
)

DOMAIN_TOKENS = frozenset(
    {
        "detergent",
        "bulk",
        "hot",
        "cold",
        "wash",
        "drain",
        "door",
        "lid",
        "inlet",
        "outlet",
        "water",
        "steam",
        "gas",
        "electric",
        "main",
        "auxiliary",
        "dispenser",
        "fill",
        "level",
        "pressure",
    },
)

COMPOUND_CONFIDENCE_CAP = 0.88


def _normalize_term(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def tokenize_oem_phrase(phrase: str) -> list[str]:
    return re.findall(r"[a-z0-9]+", _normalize_term(phrase))


def extract_functional_nouns(tokens: list[str]) -> dict[str, str | None]:
    if not tokens:
        return {"domain": None, "component": None, "actuator": None}

    actuator_idx: int | None = None
    for index in range(len(tokens) - 1, -1, -1):
        if tokens[index] in ACTUATOR_TOKENS:
            actuator_idx = index
            break

    actuator = tokens[actuator_idx] if actuator_idx is not None else None
    domain: str | None = None
    component: str | None = None

    if actuator_idx is not None and actuator_idx > 0:
        prefix = tokens[:actuator_idx]
        if len(prefix) >= 2 and prefix[0] in DOMAIN_TOKENS:
            domain = prefix[0]
            component = " ".join(prefix[1:])
        elif prefix:
            if len(prefix) == 1 and prefix[0] in DOMAIN_TOKENS:
                domain = prefix[0]
            else:
                component = " ".join(prefix)
    elif len(tokens) >= 2 and tokens[0] in DOMAIN_TOKENS:
        domain = tokens[0]
        component = " ".join(tokens[1:])

    return {
        "domain": domain,
        "component": component,
        "actuator": actuator,
    }


def generate_phrase_variants(tokens: list[str]) -> list[str]:
    variants: list[str] = []
    for start in range(len(tokens)):
        for end in range(start + 2, len(tokens) + 1):
            variants.append(" ".join(tokens[start:end]))
    variants.sort(key=len, reverse=True)
    return variants


@dataclass(frozen=True)
class CompoundMatchResult:
    source_term: str
    matched_phrase: str
    canonical_id: str | None
    confidence: float
    decomposition: dict[str, str | None]
    matcher_layer: str


def load_canonical_component_aliases(template_id: str, ontology_path: Any) -> dict[str, tuple[str, float]]:
    if ontology_path is None or not ontology_path.is_file():
        return {}

    import json

    ontology = json.loads(ontology_path.read_text(encoding="utf-8"))
    registry: dict[str, tuple[str, float]] = {}
    for component in ontology.get("components", []):
        component_id = component.get("id")
        if not component_id:
            continue
        name = component.get("name")
        if name:
            registry[_normalize_term(name)] = (component_id, 0.92)
        for alias in component.get("aliases") or []:
            registry[_normalize_term(alias)] = (component_id, 0.94)
    return registry


def try_compound_match(
    source_term: str,
    alias_registry: dict[str, tuple[str, float, str]],
    canonical_aliases: dict[str, tuple[str, float]],
    canonical_ids: frozenset[str] | set[str] | None = None,
) -> CompoundMatchResult | None:
    normalized = _normalize_term(source_term)
    tokens = tokenize_oem_phrase(source_term)
    if len(tokens) < 2:
        return None

    decomposition = extract_functional_nouns(tokens)

    for phrase in generate_phrase_variants(tokens):
        if phrase == normalized:
            continue

        if phrase in canonical_aliases:
            canonical_id, base_confidence = canonical_aliases[phrase]
            return CompoundMatchResult(
                source_term=source_term,
                matched_phrase=phrase,
                canonical_id=canonical_id,
                confidence=round(min(base_confidence * 0.92, COMPOUND_CONFIDENCE_CAP), 2),
                decomposition=decomposition,
                matcher_layer="compound:canonical_alias_suffix",
            )

        if phrase in alias_registry:
            canonical_id, base_confidence, source_layer = alias_registry[phrase]
            if canonical_ids is not None and canonical_id not in canonical_ids:
                continue
            return CompoundMatchResult(
                source_term=source_term,
                matched_phrase=phrase,
                canonical_id=canonical_id,
                confidence=round(min(base_confidence * 0.90, COMPOUND_CONFIDENCE_CAP), 2),
                decomposition=decomposition,
                matcher_layer=f"compound:{source_layer}",
            )

    return CompoundMatchResult(
        source_term=source_term,
        matched_phrase="",
        canonical_id=None,
        confidence=0.0,
        decomposition=decomposition,
        matcher_layer="compound:unresolved",
    )


def build_compound_candidate_payload(
    match: CompoundMatchResult,
    manual_id: str,
    platform_id: str,
    procedure_id: str | None,
    pages: list[Any],
    extraction_doc: str | None,
    provenance_builder: Any,
) -> dict[str, Any]:
    has_proposal = bool(match.canonical_id)
    status = "COMPOUND_TERM_CANDIDATE" if has_proposal else "UNRESOLVED_TERM"
    slug = _normalize_term(match.source_term).replace(" ", "-")

    return {
        "id": f"map-{manual_id}-compound-{slug}"[:120],
        "status": status,
        "candidateType": "canonicalMapping",
        "sourceTerm": match.source_term,
        "canonicalId": match.canonical_id,
        "confidence": match.confidence,
        "mappingType": "compound_alias",
        "decomposition": match.decomposition,
        "matchedPhrase": match.matched_phrase or None,
        "provenance": provenance_builder(
            manual_id=manual_id,
            platform_id=platform_id,
            procedure_id=procedure_id,
            pages=pages,
            extraction_doc=extraction_doc,
            extra=[
                {
                    "type": "matcher",
                    "layer": match.matcher_layer,
                    "matchedPhrase": match.matched_phrase,
                    "decomposition": match.decomposition,
                },
            ],
        ),
    }
