from __future__ import annotations



import json

import re

from pathlib import Path

from typing import Any



from .paths import (
    CANONICAL_DISHWASHER_PATH,
    CANONICAL_DRYER_PATH,
    CANONICAL_WASHER_PATH,
    COMPONENT_ALIASES_PATH,
)
from .range_matcher_scope import (
    extend_range_alias_registry_for_platform,
    load_range_matchable_canonical_ids,
    resolve_range_canonical_path,
)
from .washer_matcher_scope import (
    extend_alias_registry_for_platform,
    remap_canonical_for_platform,
    remap_seed_canonical_id,
    resolve_washer_canonical_path,
)

from .compound_term_parser import (

    build_compound_candidate_payload,

    load_canonical_component_aliases,

    tokenize_oem_phrase,

    try_compound_match,

)

from .extraction_filter import build_extraction_filter_stats

from .provenance import build_provenance
from .seed_component_registry import resolve_seed_component_id
from .matcher_improvement_rules import (
    MatcherImprovementContext,
    matcher_improvement_provenance_extra,
    try_matcher_improvement,
)
from .semantic_inheritance import (
    build_semantic_match_context,
    semantic_inheritance_provenance_extra,
    try_semantic_inheritance,
)

from .term_preprocessor import (

    extract_terms_from_procedure,

    infer_blocked_reason,

    preprocess_extracted_term,

)



DISHWASHER_OEM_TERM_HINTS: dict[str, str] = {
    "wash motor": "circulation_pump",
    "circulation motor": "circulation_pump",
    "drain motor": "drain_pump",
    "heating element": "heat_source",
    "heater element": "heat_source",
    "owi": "water_level_sensor",
    "owi sensor": "water_level_sensor",
    "optical water indicator": "water_level_sensor",
    "overfill switch": "water_level_sensor",
    "float switch": "water_level_sensor",
    "dc fan": "drying_system",
    "dry fan": "drying_system",
    "vent fan": "drying_system",
    "diverter motor": "circulation_pump",
    "diverter sensor": "circulation_pump",
    "triac fuse": "thermal_protection",
    "dispenser": "detergent_dispenser",
    "dispenser solenoid": "detergent_dispenser",
}

GLOBAL_OEM_TERM_HINTS: dict[str, str] = {

    "ccu": "control_board",

    "central control unit": "control_board",

    "main control": "control_board",

    "main pcb": "control_board",

    "acu": "control_board",

    "machine control": "control_board",

    "mcu": "motor_controller",

    "machine control unit": "motor_controller",

    "inverter": "motor_controller",

    "inverter board": "motor_controller",

    "door lock assembly": "door_lock",

    "door latch": "door_lock",

    "door interlock": "door_lock",

    "pressure switch": "water_level_sensor",

    "drain pump": "drain_pump",

    "drive motor": "drive_motor",

    "wash motor": "drive_motor",

    "heating element": "wash_heater",

    "thermistor": "wash_ntc",

    "inlet valve": "inlet_valve",

    "fill valve": "inlet_valve",

}





def _normalize_term(value: str) -> str:

    return re.sub(r"\s+", " ", str(value or "").strip().lower())





def _canonical_ontology_path(template_id: str, platform_id: str | None = None) -> Path | None:
    washer_path = resolve_washer_canonical_path(template_id, platform_id)
    if washer_path is not None:
        return washer_path
    range_path = resolve_range_canonical_path(template_id, platform_id)
    if range_path is not None:
        return range_path
    if template_id in {"electric_dryer", "gas_dryer"} and CANONICAL_DRYER_PATH.is_file():
        return CANONICAL_DRYER_PATH
    if template_id == "dishwasher" and CANONICAL_DISHWASHER_PATH.is_file():
        return CANONICAL_DISHWASHER_PATH
    return None


def _template_oem_term_hints(template_id: str) -> dict[str, str]:
    if template_id == "dishwasher":
        return DISHWASHER_OEM_TERM_HINTS
    return {}


def load_canonical_component_ids(template_id: str, platform_id: str | None = None) -> set[str]:
    ontology_path = _canonical_ontology_path(template_id, platform_id)
    if ontology_path is None:
        return set()

    ontology = json.loads(ontology_path.read_text(encoding="utf-8"))

    if resolve_range_canonical_path(template_id, platform_id) is not None:
        return load_range_matchable_canonical_ids(ontology)

    return {comp["id"] for comp in ontology.get("components", []) if comp.get("id")}





def load_full_registry(template_id: str, platform_id: str | None = None) -> dict[str, tuple[str, float, str]]:

    """Alias registry merged with canonical ontology component names/aliases."""

    registry = dict(load_alias_registry(template_id, platform_id))

    for term, canonical_id in _template_oem_term_hints(template_id).items():
        remapped = remap_canonical_for_platform(canonical_id, template_id, platform_id)
        registry[_normalize_term(term)] = (remapped, 0.9, "template_hint")

    ontology_path = _canonical_ontology_path(template_id, platform_id)
    canonical_aliases = (
        load_canonical_component_aliases(template_id, ontology_path)
        if ontology_path is not None
        else {}
    )

    for term, (canonical_id, confidence) in canonical_aliases.items():

        existing = registry.get(term)

        if existing is None or confidence > existing[1]:

            registry[term] = (canonical_id, confidence, "canonical_ontology_alias")

    return registry





def load_alias_registry(
    template_id: str = "washer",
    platform_id: str | None = None,
) -> dict[str, tuple[str, float, str]]:

    """normalized_term → (canonical_id, confidence, source_layer)"""

    registry: dict[str, tuple[str, float, str]] = {}

    for term, canonical_id in GLOBAL_OEM_TERM_HINTS.items():
        remapped = remap_canonical_for_platform(canonical_id, template_id, platform_id)
        registry[_normalize_term(term)] = (remapped, 0.85, "global_hint")

    if COMPONENT_ALIASES_PATH.is_file():
        aliases = json.loads(COMPONENT_ALIASES_PATH.read_text(encoding="utf-8"))
        for template_aliases in (aliases.get("templateAliases") or {}).values():
            for seed_id, canonical_id in template_aliases.items():
                remapped = remap_canonical_for_platform(
                    str(canonical_id),
                    template_id,
                    platform_id,
                )
                registry[_normalize_term(seed_id)] = (remapped, 0.95, "component_aliases")

    extend_alias_registry_for_platform(registry, template_id, platform_id)
    extend_range_alias_registry_for_platform(registry, template_id, platform_id)

    return registry





def resolve_component_id(

    component_id: str,

    registry: dict[str, tuple[str, float, str]],

    canonical_ids: set[str],

) -> tuple[str, float, str]:

    if component_id in canonical_ids:

        return component_id, 1.0, "canonical_component_id"

    normalized = _normalize_term(component_id)

    if normalized in registry:

        canonical_id, confidence, source = registry[normalized]

        # Registry merges washer + overlay hints; only accept targets in this template's ontology.
        if canonical_id in canonical_ids:

            return canonical_id, confidence, source

    return component_id, 0.0, "unresolved"





def _match_term_core(

    term: str,

    registry: dict[str, tuple[str, float, str]],

    canonical_ids: set[str],

    canonical_aliases: dict[str, tuple[str, float]],

    *,
    improvement_context: MatcherImprovementContext | None = None,
    enable_matcher_improvement: bool = True,

) -> dict[str, Any]:

    canonical_id, confidence, source_layer = resolve_component_id(term, registry, canonical_ids)

    if confidence > 0:

        return {

            "sourceTerm": term,

            "canonicalId": canonical_id,

            "confidence": round(confidence, 2),

            "status": "candidate",

            "mappingType": "alias",

            "matcherLayer": source_layer,

        }



    compound = try_compound_match(term, registry, canonical_aliases, canonical_ids)

    if compound and len(tokenize_oem_phrase(term)) >= 2:

        if compound.canonical_id:

            return {

                "sourceTerm": term,

                "canonicalId": compound.canonical_id,

                "confidence": compound.confidence,

                "status": "COMPOUND_TERM_CANDIDATE",

                "mappingType": "compound_alias",

                "matcherLayer": compound.matcher_layer,

                "matchedPhrase": compound.matched_phrase,

                "decomposition": compound.decomposition,

            }

        improvement = None
        if improvement_context is not None:
            improvement = try_matcher_improvement(
                term,
                term,
                context=improvement_context,
                canonical_ids=canonical_ids,
                enabled=enable_matcher_improvement,
            )
        if improvement is not None:
            return {
                "sourceTerm": term,
                "canonicalId": improvement.canonical_id,
                "confidence": improvement.confidence,
                "status": "candidate",
                "mappingType": "matcher_improvement",
                "matcherLayer": improvement.matcher_layer,
                "decomposition": compound.decomposition,
                "matcherImprovement": {"backlogId": improvement.backlog_id},
            }

        return {

            "sourceTerm": term,

            "canonicalId": None,

            "confidence": 0.0,

            "status": "UNRESOLVED_TERM",

            "mappingType": "compound_alias",

            "matcherLayer": compound.matcher_layer,

            "decomposition": compound.decomposition,

        }

    improvement = None
    if improvement_context is not None:
        improvement = try_matcher_improvement(
            term,
            term,
            context=improvement_context,
            canonical_ids=canonical_ids,
            enabled=enable_matcher_improvement,
        )
    if improvement is not None:
        return {
            "sourceTerm": term,
            "canonicalId": improvement.canonical_id,
            "confidence": improvement.confidence,
            "status": "candidate",
            "mappingType": "matcher_improvement",
            "matcherLayer": improvement.matcher_layer,
            "matcherImprovement": {"backlogId": improvement.backlog_id},
        }

    return {

        "sourceTerm": term,

        "canonicalId": None,

        "confidence": 0.0,

        "status": "UNRESOLVED_TERM",

        "mappingType": "alias",

        "matcherLayer": "unresolved",

    }





def match_source_term(

    term: str,

    template_id: str,

    registry: dict[str, tuple[str, float, str]] | None = None,

    canonical_ids: set[str] | None = None,

    canonical_aliases: dict[str, tuple[str, float]] | None = None,

    platform_id: str | None = None,

) -> dict[str, Any]:

    """Single-term matcher for golden-set regression and diagnostics."""

    registry = registry or load_full_registry(template_id, platform_id)

    canonical_ids = canonical_ids or load_canonical_component_ids(template_id, platform_id)

    ontology_path = _canonical_ontology_path(template_id, platform_id)
    canonical_aliases = canonical_aliases or (
        load_canonical_component_aliases(template_id, ontology_path)
        if ontology_path is not None
        else {}
    )



    preprocessed = preprocess_extracted_term(term)

    if preprocessed.action == "filter":

        return {

            "sourceTerm": term,

            "canonicalId": None,

            "confidence": 0.0,

            "status": "FILTERED_NOISE",

            "mappingType": "filtered",

            "matcherLayer": "preprocessor",

            "blockedReason": preprocessed.blocked_reason,

            "extractedTerm": None,

        }



    match_term = preprocessed.match_term or term

    result = _match_term_core(match_term, registry, canonical_ids, canonical_aliases)

    result["sourceTerm"] = term

    if match_term != term:

        result["extractedTerm"] = match_term



    if result.get("status") == "UNRESOLVED_TERM":

        normalized = _normalize_term(match_term)

        result["blockedReason"] = infer_blocked_reason(

            match_term,

            template_id,

            in_registry=normalized in registry,

            in_canonical_ids=match_term in canonical_ids,

        )



    return result





def build_mapping_candidates(

    procedures: list[dict[str, Any]],

    manual_entry: dict[str, Any],

    template_id: str,

    *,
    enable_semantic_inheritance: bool = True,

) -> tuple[list[dict[str, Any]], dict[str, Any]]:

    platform_id = str(manual_entry.get("platformId") or "")

    canonical_ids = load_canonical_component_ids(template_id, platform_id)

    registry = load_full_registry(template_id, platform_id)

    ontology_path = _canonical_ontology_path(template_id, platform_id)
    canonical_aliases = (
        load_canonical_component_aliases(template_id, ontology_path)
        if ontology_path is not None
        else {}
    )

    manual_id = str(manual_entry.get("manualId"))

    semantic_context = None
    if enable_semantic_inheritance:
        from human_decision_metrics import resolve_promotion_prior_manual_ids

        prior_manual_ids = resolve_promotion_prior_manual_ids(manual_id)
        semantic_context = build_semantic_match_context(manual_entry, prior_manual_ids or [])

    candidates: list[dict[str, Any]] = []

    seen: set[str] = set()

    filter_stats = build_extraction_filter_stats(procedures)

    for procedure in procedures:

        procedure_id = procedure.get("procedureId")

        pages = (procedure.get("source") or {}).get("pages") or []



        for extracted in extract_terms_from_procedure(procedure):

            term = extracted.match_term

            raw_term = extracted.raw

            canonical_id, confidence, source_layer = resolve_component_id(

                term,

                registry,

                canonical_ids,

            )



            extra_provenance = [{"type": "matcher", "layer": source_layer}]

            if raw_term != term:

                extra_provenance.append(

                    {

                        "type": "preprocessor",

                        "rawTerm": raw_term,

                        "extractedTerm": term,

                        "notes": list(extracted.preprocess.preprocess_notes)

                        if extracted.preprocess

                        else [],

                    },

                )

            def append_matcher_improvement_if_matched() -> bool:
                improvement = try_matcher_improvement(
                    term,
                    raw_term,
                    context=MatcherImprovementContext(
                        manual_id=manual_id,
                        procedure_id=procedure_id,
                        template_id=template_id,
                        platform_id=platform_id,
                    ),
                    canonical_ids=canonical_ids,
                )
                if improvement is None:
                    return False
                slug = _normalize_term(raw_term).replace(" ", "-")
                payload = {
                    "id": f"map-{manual_id}-mig-{improvement.backlog_id}-{slug}"[:120],
                    "status": "candidate",
                    "candidateType": "canonicalMapping",
                    "sourceTerm": raw_term,
                    "extractedTerm": term if raw_term != term else None,
                    "canonicalId": improvement.canonical_id,
                    "confidence": improvement.confidence,
                    "mappingType": "matcher_improvement",
                    "matcherLayer": improvement.matcher_layer,
                    "matcherImprovement": {"backlogId": improvement.backlog_id},
                    "provenance": build_provenance(
                        manual_id=manual_id,
                        platform_id=platform_id,
                        procedure_id=procedure_id,
                        pages=pages,
                        extraction_doc=manual_entry.get("extractionDoc"),
                        extra=extra_provenance + matcher_improvement_provenance_extra(improvement),
                    ),
                }
                key = f"{_normalize_term(term)}::{improvement.canonical_id}"
                if key in seen:
                    return True
                seen.add(key)
                candidates.append(payload)
                return True

            if confidence <= 0 and extracted.source == "componentId":
                seed_match = resolve_seed_component_id(raw_term, template_id, platform_id)
                if seed_match and seed_match.get("canonicalId"):
                    seed_canonical_id = remap_seed_canonical_id(
                        raw_term,
                        str(seed_match["canonicalId"]),
                        template_id,
                        platform_id,
                    )
                    if seed_canonical_id not in canonical_ids:
                        continue
                    key = f"seed:{_normalize_term(raw_term)}::{seed_canonical_id}"
                    if key not in seen:
                        seen.add(key)
                        candidates.append(
                            {
                                "id": (
                                    f"map-{manual_id}-seed-{_normalize_term(raw_term).replace(' ', '-')}-"
                                    f"{seed_canonical_id}"
                                ),
                                "status": "candidate",
                                "candidateType": "canonicalMapping",
                                "sourceTerm": raw_term,
                                "seedComponentId": raw_term,
                                "canonicalId": seed_canonical_id,
                                "confidence": round(seed_match["confidence"], 2),
                                "mappingType": "seed_component_id",
                                "reviewLevel": seed_match.get("reviewLevel"),
                                "registryScope": seed_match.get("scope"),
                                "provenance": build_provenance(
                                    manual_id=manual_id,
                                    platform_id=platform_id,
                                    procedure_id=procedure_id,
                                    pages=pages,
                                    extraction_doc=manual_entry.get("extractionDoc"),
                                    extra=[
                                        {
                                            "type": "matcher",
                                            "layer": seed_match.get("registryLayer"),
                                            "seedComponentId": raw_term,
                                            "notes": seed_match.get("notes"),
                                        },
                                    ],
                                ),
                            },
                        )
                    continue

            if confidence <= 0:

                if len(tokenize_oem_phrase(term)) >= 2:

                    compound = try_compound_match(term, registry, canonical_aliases, canonical_ids)

                    if compound and compound.canonical_id:

                        payload = build_compound_candidate_payload(

                            compound,

                            manual_id,

                            platform_id,

                            procedure_id,

                            pages,

                            manual_entry.get("extractionDoc"),

                            build_provenance,

                        )

                        if raw_term != term:

                            payload["sourceTerm"] = raw_term

                            payload["extractedTerm"] = term

                        key = f"{_normalize_term(term)}::{payload.get('canonicalId')}"

                        if key not in seen:

                            seen.add(key)

                            candidates.append(payload)

                        continue

                    semantic_match = None
                    if semantic_context is not None:
                        semantic_match = try_semantic_inheritance(term, semantic_context)
                        if semantic_match is None and raw_term != term:
                            semantic_match = try_semantic_inheritance(raw_term, semantic_context)

                    if semantic_match is not None:
                        slug = _normalize_term(semantic_match.source_term).replace(" ", "-")
                        payload = {
                            "id": f"map-{manual_id}-semantic-{slug}"[:120],
                            "status": "COMPOUND_TERM_CANDIDATE",
                            "candidateType": "canonicalMapping",
                            "sourceTerm": raw_term,
                            "extractedTerm": term if raw_term != term else None,
                            "canonicalId": semantic_match.canonical_id,
                            "confidence": semantic_match.confidence,
                            "mappingType": "compound_alias",
                            "matcherLayer": semantic_match.matcher_layer,
                            "semanticInheritance": {
                                "ruleId": semantic_match.rule_id,
                                "classification": semantic_match.classification,
                                "priorManualId": semantic_match.prior_manual_id,
                            },
                            "provenance": build_provenance(
                                manual_id=manual_id,
                                platform_id=platform_id,
                                procedure_id=procedure_id,
                                pages=pages,
                                extraction_doc=manual_entry.get("extractionDoc"),
                                extra=semantic_inheritance_provenance_extra(semantic_match),
                            ),
                        }
                        key = f"{_normalize_term(term)}::{semantic_match.canonical_id}"
                        if key not in seen:
                            seen.add(key)
                            candidates.append(payload)
                        continue

                    if append_matcher_improvement_if_matched():
                        continue

                    if compound:

                        payload = build_compound_candidate_payload(

                            compound,

                            manual_id,

                            platform_id,

                            procedure_id,

                            pages,

                            manual_entry.get("extractionDoc"),

                            build_provenance,

                        )

                        if raw_term != term:

                            payload["sourceTerm"] = raw_term

                            payload["extractedTerm"] = term

                        key = f"{_normalize_term(term)}::{payload.get('canonicalId')}"

                        if key not in seen:

                            seen.add(key)

                            candidates.append(payload)

                        continue

                if append_matcher_improvement_if_matched():
                    continue

                blocked_reason = infer_blocked_reason(

                    term,

                    template_id,

                    in_registry=_normalize_term(term) in registry,

                    in_canonical_ids=term in canonical_ids,

                )

                candidates.append(

                    {

                        "id": (

                            f"map-{manual_id}-unresolved-{procedure_id}-"

                            f"{raw_term}".lower().replace(" ", "-")

                        )[:120],

                        "status": "UNRESOLVED_TERM",

                        "candidateType": "canonicalMapping",

                        "sourceTerm": raw_term,

                        "extractedTerm": term if raw_term != term else None,

                        "canonicalId": None,

                        "confidence": 0.0,

                        "mappingType": "alias",

                        "blockedReason": blocked_reason,

                        "provenance": build_provenance(

                            manual_id=manual_id,

                            platform_id=platform_id,

                            procedure_id=procedure_id,

                            pages=pages,

                            extraction_doc=manual_entry.get("extractionDoc"),

                            extra=[{"type": "matcher", "layer": "unresolved"}] + extra_provenance,

                        ),

                    },

                )

                continue



            key = f"{_normalize_term(term)}::{canonical_id}"

            if key in seen:

                continue

            seen.add(key)



            candidates.append(

                {

                    "id": f"map-{manual_id}-{_normalize_term(term).replace(' ', '-')}-{canonical_id}",

                    "status": "candidate",

                    "candidateType": "canonicalMapping",

                    "sourceTerm": raw_term,

                    "extractedTerm": term if raw_term != term else None,

                    "canonicalId": canonical_id,

                    "confidence": round(confidence, 2),

                    "mappingType": "alias",

                    "provenance": build_provenance(

                        manual_id=manual_id,

                        platform_id=platform_id,

                        procedure_id=procedure_id,

                        pages=pages,

                        extraction_doc=manual_entry.get("extractionDoc"),

                        extra=extra_provenance,

                    ),

                },

            )



    return candidates, filter_stats.to_dict()


