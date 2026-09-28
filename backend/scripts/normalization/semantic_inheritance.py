"""CG-6.3 — Deterministic semantic platform inheritance (human-proven rules only)."""

from __future__ import annotations

import json
import re
from dataclasses import dataclass
from typing import Any

from .compound_term_parser import tokenize_oem_phrase
from .paths import CALIBRATION_DIR, MANUFACTURER_OVERLAYS_DIR

RULES_FILE = CALIBRATION_DIR / "semantic_inheritance_rules_v1.json"

GUARDRAILS = (
    "semantic matching may improve inheritance",
    "semantic matching may NOT promote ontology",
    "semantic matching may NOT bypass human gates where confidence is insufficient",
    "semantic matching may NOT cross manufacturer boundaries",
    "semantic matching may NOT infer topology",
)


def _normalize_term(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


@dataclass(frozen=True)
class SemanticInheritanceMatch:
    rule_id: str
    source_term: str
    canonical_id: str
    classification: str
    confidence: float
    matcher_layer: str
    prior_manual_id: str
    rationale: str
    human_provenance: dict[str, Any]


@dataclass(frozen=True)
class SemanticAbstention:
    """Matcher saw partial semantic evidence but refused auto-resolve (human gate)."""

    rule_id: str
    source_term: str
    signal_type: str
    reason: str
    manual_id: str


@dataclass(frozen=True)
class SemanticMatchContext:
    manual_id: str
    platform_id: str
    manufacturer: str
    template_id: str
    platform_family_prior_manual_ids: list[str]


def load_semantic_inheritance_rules() -> dict[str, Any]:
    if not RULES_FILE.is_file():
        return {"rules": []}
    return json.loads(RULES_FILE.read_text(encoding="utf-8"))


def _load_platform_concepts_for_manuals(manual_ids: list[str]) -> dict[str, set[str]]:
    """Platform-scoped concept ids from published manufacturer overlays (not canonical ontology)."""
    concepts_by_manual: dict[str, set[str]] = {manual_id: set() for manual_id in manual_ids}
    for path in sorted(MANUFACTURER_OVERLAYS_DIR.glob("*.json")):
        overlay = json.loads(path.read_text(encoding="utf-8"))
        for family in overlay.get("platformFamilies") or []:
            manual_id = str(family.get("manualId") or "")
            if manual_id not in manual_ids:
                continue
            bucket = concepts_by_manual.setdefault(manual_id, set())
            for canonical_id in (family.get("oemTermAliases") or {}).values():
                if canonical_id:
                    bucket.add(str(canonical_id))
            for component in (family.get("add") or {}).get("components") or []:
                component_id = component.get("id")
                if component_id:
                    bucket.add(str(component_id))
    return concepts_by_manual


def _manufacturer_for_manual(manual_id: str) -> str | None:
    if manual_id.startswith("SAMSUNG"):
        return "Samsung"
    if manual_id.startswith("W") or manual_id.startswith("w"):
        return "Whirlpool"
    return None


def build_semantic_match_context(manual_entry: dict[str, Any], prior_manual_ids: list[str]) -> SemanticMatchContext:
    manual_id = str(manual_entry.get("manualId"))
    return SemanticMatchContext(
        manual_id=manual_id,
        platform_id=str(manual_entry.get("platformId") or ""),
        manufacturer=str(manual_entry.get("manufacturer") or _manufacturer_for_manual(manual_id) or ""),
        template_id=str(manual_entry.get("templateId") or "washer"),
        platform_family_prior_manual_ids=[
            mid for mid in prior_manual_ids if mid != manual_id
        ],
    )


def _term_tokens(term: str) -> set[str]:
    return set(tokenize_oem_phrase(term))


def _term_matches_rule(term: str, rule: dict[str, Any]) -> bool:
    normalized = _normalize_term(term)
    tokens = _term_tokens(term)
    for matcher in rule.get("termMatchers") or []:
        matcher_type = matcher.get("type")
        if matcher_type == "normalized_regex":
            pattern = str(matcher.get("pattern") or "")
            if pattern and re.match(pattern, normalized):
                return True
        elif matcher_type == "diagnostic_codes":
            codes = {str(code).upper() for code in (matcher.get("codes") or [])}
            required = {str(token).lower() for token in (matcher.get("requireTokens") or [])}
            upper_tokens = {token.upper() for token in tokens}
            if codes.issubset(upper_tokens) and required.issubset(tokens):
                return True
        elif matcher_type == "compound_tokens":
            require_all = {str(token).lower() for token in (matcher.get("requireAll") or [])}
            exclude_any = {str(token).lower() for token in (matcher.get("excludeAny") or [])}
            if exclude_any & tokens:
                continue
            if require_all and require_all.issubset(tokens):
                return True
    return False


def _validate_rule_guardrails(rule: dict[str, Any], context: SemanticMatchContext, prior_concepts: set[str]) -> bool:
    if not rule.get("enabled", True):
        return False
    if str(rule.get("manufacturer") or "") != context.manufacturer:
        return False
    if str(rule.get("templateId") or "washer") != context.template_id:
        return False
    target_manual_ids = rule.get("targetManualIds")
    if target_manual_ids and context.manual_id not in target_manual_ids:
        return False
    required_prior = list(rule.get("platformFamilyPriorManualIds") or [])
    if not all(mid in context.platform_family_prior_manual_ids for mid in required_prior):
        return False
    required_concept = str(rule.get("requiredPlatformConcept") or rule.get("canonicalId") or "")
    if required_concept not in prior_concepts:
        return False
    if rule.get("mayNotCreateConcept") and str(rule.get("canonicalId") or "") != required_concept:
        return False
    classification = str(rule.get("classification") or "")
    if classification == "new_canonical_knowledge":
        return False
    return True


def _prior_platform_concepts(
    context: SemanticMatchContext,
    rules_doc: dict[str, Any],
) -> set[str]:
    prior_manual_ids = list(context.platform_family_prior_manual_ids)
    required_prior = {
        str(mid)
        for rule in rules_doc.get("rules") or []
        for mid in (rule.get("platformFamilyPriorManualIds") or [])
    }
    concepts_by_manual = _load_platform_concepts_for_manuals(
        sorted(set(prior_manual_ids) | required_prior),
    )
    prior_concepts: set[str] = set()
    for manual_id in prior_manual_ids:
        prior_concepts.update(concepts_by_manual.get(manual_id, set()))
    return prior_concepts


def _abstention_signal_partial_match(term: str, signal: dict[str, Any]) -> bool:
    signal_type = str(signal.get("type") or "")
    tokens = _term_tokens(term)
    upper_tokens = {token.upper() for token in tokens}
    if signal_type == "diagnostic_codes_partial":
        codes = {str(code).upper() for code in (signal.get("codes") or [])}
        return bool(codes & upper_tokens)
    if signal_type == "token_cluster":
        any_of = {str(token).lower() for token in (signal.get("anyOf") or [])}
        exclude_if_any = {str(token).lower() for token in (signal.get("excludeIfAny") or [])}
        if not (any_of & tokens):
            return False
        if exclude_if_any & tokens:
            return False
        return True
    return False


def try_semantic_abstention(
    term: str,
    context: SemanticMatchContext,
    *,
    rules: dict[str, Any] | None = None,
) -> SemanticAbstention | None:
    """Partial semantic signal without sufficient evidence for deterministic inherit."""
    if context is None:
        return None
    rules_doc = rules or load_semantic_inheritance_rules()
    if try_semantic_inheritance(term, context, rules=rules_doc):
        return None
    prior_concepts = _prior_platform_concepts(context, rules_doc)
    for rule in rules_doc.get("rules") or []:
        if not rule.get("enabled", True):
            continue
        if not _validate_rule_guardrails(rule, context, prior_concepts):
            continue
        if _term_matches_rule(term, rule):
            continue
        for signal in rule.get("abstentionSignals") or []:
            if not _abstention_signal_partial_match(term, signal):
                continue
            return SemanticAbstention(
                rule_id=str(rule.get("id")),
                source_term=term,
                signal_type=str(signal.get("type") or "unknown"),
                reason=str(signal.get("reason") or ""),
                manual_id=context.manual_id,
            )
    return None


def collect_semantic_abstentions(
    terms: list[str],
    context: SemanticMatchContext,
    *,
    rules: dict[str, Any] | None = None,
) -> list[SemanticAbstention]:
    seen: set[tuple[str, str, str]] = set()
    abstentions: list[SemanticAbstention] = []
    for term in terms:
        if not str(term or "").strip():
            continue
        abstention = try_semantic_abstention(term, context, rules=rules)
        if abstention is None:
            continue
        key = (abstention.rule_id, abstention.source_term, abstention.signal_type)
        if key in seen:
            continue
        seen.add(key)
        abstentions.append(abstention)
    return abstentions


def try_semantic_inheritance(
    term: str,
    context: SemanticMatchContext,
    *,
    rules: dict[str, Any] | None = None,
) -> SemanticInheritanceMatch | None:
    """Apply frozen semantic rules after exact/compound match fails."""
    if context is None:
        return None
    rules_doc = rules or load_semantic_inheritance_rules()
    prior_concepts = _prior_platform_concepts(context, rules_doc)

    for rule in rules_doc.get("rules") or []:
        if not _term_matches_rule(term, rule):
            continue
        if not _validate_rule_guardrails(rule, context, prior_concepts):
            continue
        prior_manual_id = str((rule.get("platformFamilyPriorManualIds") or ["unknown"])[0])
        return SemanticInheritanceMatch(
            rule_id=str(rule.get("id")),
            source_term=term,
            canonical_id=str(rule.get("canonicalId")),
            classification=str(rule.get("classification") or "inherited_platform_family"),
            confidence=float(rule.get("confidence") or 0.95),
            matcher_layer=str(rule.get("matcherLayer") or "semantic:inherit_platform_family"),
            prior_manual_id=prior_manual_id,
            rationale=str(rule.get("rationale") or ""),
            human_provenance=dict(rule.get("humanProvenance") or {}),
        )
    return None


def semantic_inheritance_provenance_extra(match: SemanticInheritanceMatch) -> list[dict[str, Any]]:
    return [
        {
            "type": "matcher",
            "layer": match.matcher_layer,
            "ruleId": match.rule_id,
        },
        {
            "type": "semantic_inheritance",
            "ruleId": match.rule_id,
            "classification": match.classification,
            "priorManualId": match.prior_manual_id,
            "humanProvenance": match.human_provenance,
            "rationale": match.rationale,
        },
    ]


SEMANTIC_INHERITANCE_CLASSIFICATIONS = frozenset(
    {
        "inherited_platform_family",
        "inherited_corpus_knowledge",
    },
)


def record_has_semantic_inheritance(
    record: dict[str, Any],
    prior_manual_ids: list[str] | None,
) -> bool:
    provenance = record.get("provenance") or {}
    for source in provenance.get("sources") or []:
        if source.get("type") != "semantic_inheritance":
            continue
        if source.get("classification") not in SEMANTIC_INHERITANCE_CLASSIFICATIONS:
            continue
        prior_manual_id = str(source.get("priorManualId") or "")
        if prior_manual_ids and prior_manual_id not in prior_manual_ids:
            continue
        return True
    return False


def record_has_semantic_platform_inheritance(
    record: dict[str, Any],
    platform_prior_manual_ids: list[str] | None,
) -> bool:
    """Backward-compatible alias — counts platform-family and corpus semantic inherits."""
    return record_has_semantic_inheritance(record, platform_prior_manual_ids)
