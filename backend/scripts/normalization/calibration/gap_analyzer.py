from __future__ import annotations

import json
import re
from collections import defaultdict
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any

from ..paths import CANDIDATES_DIR, GLOBAL_CONFLICTS_PATH
from ..pipeline import load_manifest
from ..compound_term_parser import extract_functional_nouns, tokenize_oem_phrase

ONTOLOGY_MIN_MANUALS = 3
ONTOLOGY_MIN_MANUFACTURERS = 2
ALIAS_MIN_MANUALS = 2
PLATFORM_MIN_MANUALS = 2


def infer_manufacturer(platform_id: str, label: str | None = None) -> str:
    platform = str(platform_id or "").lower()
    text = f"{platform} {label or ''}".lower()
    if "samsung" in text:
        return "Samsung"
    if "whirlpool" in text or "maytag" in text or "mvw" in text or "wtw" in text:
        return "Whirlpool"
    if "lg" in text:
        return "LG"
    if "ge_" in platform or "ge " in text:
        return "GE"
    if "insignia" in text:
        return "Insignia"
    if "midea" in text:
        return "Midea"
    if "frigidaire" in text:
        return "Frigidaire"
    return "Other"


def _normalize_term(value: str) -> str:
    return re.sub(r"\s+", " ", str(value or "").strip().lower())


def _functional_signature(decomposition: dict[str, Any] | None) -> str | None:
    if not decomposition:
        return None
    parts = [
        decomposition.get("domain") or "",
        decomposition.get("component") or "",
        decomposition.get("actuator") or "",
    ]
    if not any(parts):
        return None
    return "|".join(str(part).lower() for part in parts if part)


def _concept_label(
    source_term: str,
    decomposition: dict[str, Any] | None,
    canonical_id: str | None,
) -> str:
    if canonical_id:
        return canonical_id.replace("_", " ")
    if decomposition:
        domain = decomposition.get("domain")
        component = decomposition.get("component")
        actuator = decomposition.get("actuator")
        bits = [bit for bit in (domain, component, actuator) if bit]
        if bits:
            return " ".join(bits)
    return source_term


@dataclass
class TermObservation:
    source_term: str
    manual_id: str
    platform_id: str
    manufacturer: str
    canonical_id: str | None
    status: str
    blocked_reason: str | None
    mapping_type: str | None
    decomposition: dict[str, Any] | None
    confidence: float | None
    seed_component_id: str | None = None


@dataclass
class GapCluster:
    cluster_key: str
    observations: list[TermObservation] = field(default_factory=list)
    canonical_ids: set[str] = field(default_factory=set)
    conflict: bool = False

    @property
    def manual_ids(self) -> set[str]:
        return {obs.manual_id for obs in self.observations}

    @property
    def manufacturers(self) -> set[str]:
        return {obs.manufacturer for obs in self.observations}

    @property
    def platform_ids(self) -> set[str]:
        return {obs.platform_id for obs in self.observations}

    @property
    def source_terms(self) -> set[str]:
        return {obs.source_term for obs in self.observations}

    @property
    def functional_signature(self) -> str | None:
        for obs in self.observations:
            signature = _functional_signature(obs.decomposition)
            if signature:
                return signature
        normalized = _normalize_term(next(iter(self.source_terms), ""))
        tokens = tokenize_oem_phrase(normalized)
        if len(tokens) >= 2:
            inferred = extract_functional_nouns(tokens)
            return _functional_signature(inferred)
        return None

    def primary_canonical_id(self) -> str | None:
        if len(self.canonical_ids) == 1:
            return next(iter(self.canonical_ids))
        return None


def _cluster_key_for_candidate(candidate: dict[str, Any]) -> str:
    canonical_id = candidate.get("canonicalId")
    source_term = str(candidate.get("sourceTerm") or "")
    seed_id = candidate.get("seedComponentId")
    decomposition = candidate.get("decomposition")

    if seed_id:
        return f"seed:{_normalize_term(seed_id)}"

    signature = _functional_signature(decomposition)
    if signature and not canonical_id:
        return f"func:{signature}"

    if canonical_id and candidate.get("mappingType") in {"alias", "compound_alias", "seed_component_id"}:
        return f"canonical:{canonical_id}"

    normalized = _normalize_term(source_term)
    tokens = tokenize_oem_phrase(source_term)
    if len(tokens) >= 2 and not canonical_id:
        inferred = extract_functional_nouns(tokens)
        inferred_sig = _functional_signature(inferred)
        if inferred_sig:
            return f"func:{inferred_sig}"

    return f"term:{normalized}"


def classify_cluster(cluster: GapCluster) -> str:
    if cluster.conflict:
        return "human_review"

    canonical_id = cluster.primary_canonical_id()
    resolved = canonical_id is not None and all(
        obs.canonical_id == canonical_id or obs.canonical_id is None
        for obs in cluster.observations
        if obs.status not in {"UNRESOLVED_TERM", "FILTERED_NOISE"}
    )

    if canonical_id and len(cluster.source_terms) >= 2 and len(cluster.manual_ids) >= ALIAS_MIN_MANUALS:
        return "canonical_alias"

    if resolved and canonical_id:
        return "mapped"

    manual_count = len(cluster.manual_ids)
    manufacturer_count = len(cluster.manufacturers)
    platform_count = len(cluster.platform_ids)

    blocked = {obs.blocked_reason for obs in cluster.observations if obs.blocked_reason}
    if "AMBIGUOUS_COMPONENT" in blocked:
        return "human_review"

    if manual_count == 1:
        return "platform_overlay" if any(obs.seed_component_id for obs in cluster.observations) else "unresolved"

    if (
        manual_count >= ONTOLOGY_MIN_MANUALS
        and manufacturer_count >= ONTOLOGY_MIN_MANUFACTURERS
        and cluster.functional_signature
    ):
        return "canonical_ontology_candidate"

    if manual_count >= PLATFORM_MIN_MANUALS and (platform_count == 1 or manufacturer_count == 1):
        return "platform_overlay"

    if manual_count >= 2:
        return "human_review"

    return "unresolved"


def _load_manual_metadata() -> dict[str, dict[str, Any]]:
    manifest = load_manifest()
    metadata: dict[str, dict[str, Any]] = {}
    for entry in manifest.get("manuals", []):
        manual_id = entry.get("manualId")
        platform_id = str(entry.get("platformId") or "")
        metadata[manual_id] = {
            "manualId": manual_id,
            "platformId": platform_id,
            "templateId": entry.get("templateId"),
            "label": entry.get("label"),
            "manufacturer": infer_manufacturer(platform_id, entry.get("label")),
        }
    return metadata


def collect_observations(
    manual_ids: list[str] | None = None,
    template_id: str | None = None,
) -> list[TermObservation]:
    metadata = _load_manual_metadata()
    observations: list[TermObservation] = []

    for manual_dir in sorted(CANDIDATES_DIR.iterdir()):
        if not manual_dir.is_dir() or manual_dir.name.startswith("_"):
            continue
        manual_id = manual_dir.name
        if manual_ids and manual_id not in manual_ids:
            continue
        meta = metadata.get(manual_id)
        if not meta:
            continue
        if template_id and meta.get("templateId") != template_id:
            continue

        mapping_path = manual_dir / "canonical_mapping_candidates.json"
        if not mapping_path.is_file():
            continue

        for candidate in json.loads(mapping_path.read_text(encoding="utf-8")).get("candidates", []):
            if candidate.get("status") == "FILTERED_NOISE":
                continue
            observations.append(
                TermObservation(
                    source_term=str(candidate.get("sourceTerm") or ""),
                    manual_id=manual_id,
                    platform_id=str(meta.get("platformId") or ""),
                    manufacturer=str(meta.get("manufacturer") or "Other"),
                    canonical_id=candidate.get("canonicalId"),
                    status=str(candidate.get("status") or "candidate"),
                    blocked_reason=candidate.get("blockedReason"),
                    mapping_type=candidate.get("mappingType"),
                    decomposition=candidate.get("decomposition"),
                    confidence=candidate.get("confidence"),
                    seed_component_id=candidate.get("seedComponentId"),
                ),
            )

    return observations


def build_gap_clusters(observations: list[TermObservation]) -> list[GapCluster]:
    clusters: dict[str, GapCluster] = {}
    for obs in observations:
        pseudo_candidate = {
            "sourceTerm": obs.source_term,
            "canonicalId": obs.canonical_id,
            "seedComponentId": obs.seed_component_id,
            "decomposition": obs.decomposition,
            "mappingType": obs.mapping_type,
        }
        key = _cluster_key_for_candidate(pseudo_candidate)
        cluster = clusters.setdefault(key, GapCluster(cluster_key=key))
        cluster.observations.append(obs)
        if obs.canonical_id:
            cluster.canonical_ids.add(obs.canonical_id)

    for cluster in clusters.values():
        if len(cluster.canonical_ids) > 1:
            cluster.conflict = True

    return list(clusters.values())


def _cluster_to_row(cluster: GapCluster, classification: str) -> dict[str, Any]:
    sample_terms = sorted(cluster.source_terms)[:8]
    decomposition = None
    for obs in cluster.observations:
        if obs.decomposition:
            decomposition = obs.decomposition
            break

    return {
        "concept": _concept_label(
            sample_terms[0] if sample_terms else cluster.cluster_key,
            decomposition,
            cluster.primary_canonical_id(),
        ),
        "classification": classification,
        "clusterKey": cluster.cluster_key,
        "manualCount": len(cluster.manual_ids),
        "manufacturerCount": len(cluster.manufacturers),
        "platformCount": len(cluster.platform_ids),
        "manufacturers": sorted(cluster.manufacturers),
        "manualIds": sorted(cluster.manual_ids),
        "platformIds": sorted(cluster.platform_ids),
        "canonicalId": cluster.primary_canonical_id(),
        "functionalSignature": cluster.functional_signature,
        "sampleTerms": sample_terms,
        "conflict": cluster.conflict,
        "recommendedAction": _recommended_action(classification),
    }


def _recommended_action(classification: str) -> str:
    return {
        "canonical_alias": "Add OEM alias candidates; review and promote to overlay",
        "canonical_ontology_candidate": "Propose new canonical concept — requires human ontology review",
        "platform_overlay": "Keep in manufacturer/platform overlay, not canonical ontology",
        "human_review": "Mandatory human resolution before promotion",
        "unresolved": "Insufficient cross-manual evidence — do not add to ontology",
        "mapped": "Already mapped — no gap",
    }.get(classification, "Review")


def analyze_corpus_gaps(
    template_id: str | None = "washer",
    manual_ids: list[str] | None = None,
) -> dict[str, Any]:
    observations = collect_observations(manual_ids=manual_ids, template_id=template_id)
    clusters = build_gap_clusters(observations)

    classified: dict[str, list[dict[str, Any]]] = defaultdict(list)
    for cluster in clusters:
        classification = classify_cluster(cluster)
        if classification == "mapped":
            continue
        classified[classification].append(_cluster_to_row(cluster, classification))

    for bucket in classified.values():
        bucket.sort(key=lambda row: (-row["manualCount"], row["concept"]))

    global_conflicts = []
    if GLOBAL_CONFLICTS_PATH.is_file():
        global_conflicts = json.loads(
            GLOBAL_CONFLICTS_PATH.read_text(encoding="utf-8"),
        ).get("conflicts", [])

    summary = {
        "canonicalAliasOpportunities": len(classified["canonical_alias"]),
        "canonicalOntologyCandidates": len(classified["canonical_ontology_candidate"]),
        "platformSpecificConcepts": len(classified["platform_overlay"]),
        "unresolved": len(classified["unresolved"]),
        "humanReview": len(classified["human_review"]),
        "conflicts": len(global_conflicts),
        "observationCount": len(observations),
        "clusterCount": len(clusters),
    }

    return {
        "schemaVersion": "1.0.0",
        "reportType": "canonical_gap_report",
        "templateFilter": template_id,
        "manualCount": len({obs.manual_id for obs in observations}),
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "thresholds": {
            "ontologyMinManuals": ONTOLOGY_MIN_MANUALS,
            "ontologyMinManufacturers": ONTOLOGY_MIN_MANUFACTURERS,
            "aliasMinManuals": ALIAS_MIN_MANUALS,
        },
        "rules": [
            "Never add a canonical concept from a single unknown term.",
            "Canonical ontology candidates require multi-manual + multi-manufacturer evidence.",
            "Platform-specific concepts belong in OEM overlays, not canonical ontology.",
        ],
        "summary": summary,
        "conceptTable": sorted(
            classified["canonical_ontology_candidate"]
            + classified["canonical_alias"]
            + classified["platform_overlay"]
            + classified["human_review"]
            + classified["unresolved"],
            key=lambda row: (-row["manualCount"], row["concept"]),
        ),
        "buckets": dict(classified),
        "globalConflicts": global_conflicts,
    }


def format_gap_report_text(report: dict[str, Any]) -> str:
    lines = [
        "CANONICAL GAP REPORT",
        f"Template: {report.get('templateFilter') or 'all'}",
        f"Manuals:  {report.get('manualCount')}",
        "",
        "Summary",
        "-------",
    ]
    summary = report.get("summary") or {}
    lines.extend(
        [
            f"Canonical alias opportunities:     {summary.get('canonicalAliasOpportunities', 0)}",
            f"Potential new canonical concepts:    {summary.get('canonicalOntologyCandidates', 0)}",
            f"Platform-specific concepts:          {summary.get('platformSpecificConcepts', 0)}",
            f"Unresolved (insufficient evidence):  {summary.get('unresolved', 0)}",
            f"Human review required:               {summary.get('humanReview', 0)}",
            f"Global conflicts:                    {summary.get('conflicts', 0)}",
            "",
            "Top concepts (by manual reach)",
            "------------------------------",
            f"{'Concept':<32} {'Manuals':>8} {'Mfrs':>8} {'Class':<28}",
        ],
    )
    for row in (report.get("conceptTable") or [])[:25]:
        lines.append(
            f"{row['concept'][:31]:<32} {row['manualCount']:>8} "
            f"{row['manufacturerCount']:>8} {row['classification']:<28}",
        )
    return "\n".join(lines)
