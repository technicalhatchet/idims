#!/usr/bin/env python3
"""Validate canonical diagnostic ontology JSON and reference platform overlays."""

from __future__ import annotations

import hashlib
import json
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CANONICAL_DIR = ROOT / "frontend" / "components" / "diagnostics" / "knowledge" / "canonical"
FROZEN_HASH_REGISTRY = (
    ROOT
    / "frontend"
    / "components"
    / "diagnostics"
    / "knowledge"
    / "normalization"
    / "calibration"
    / "frozen_canonical_hashes_v1.json"
)
MANUFACTURER_OVERLAY_DIR = CANONICAL_DIR / "manufacturer_overlays"
EVIDENCE_DIR = ROOT / "frontend" / "components" / "diagnostics" / "knowledge" / "evidence"
EVIDENCE_WASHER = EVIDENCE_DIR / "washer.json"
EVIDENCE_DISHWASHER = EVIDENCE_DIR / "dishwasher.json"
EVIDENCE_MICROWAVE = EVIDENCE_DIR / "microwave.json"
EVIDENCE_ELECTRIC_DRYER = EVIDENCE_DIR / "electric_dryer.json"
PROCEDURE_SEED_DIR = ROOT / "frontend" / "components" / "diagnostics" / "procedures" / "seed"

REQUIRED_ONTOLOGY_KEYS = {
    "schemaVersion",
    "ontology",
    "systems",
    "components",
    "relationships",
    "functionalDependencies",
    "failureDomains",
    "diagnosticEntryPoints",
}

REQUIRED_ONTOLOGY_FIELDS = {"id", "name", "templateId", "variant"}


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def sha256_file(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def validate_frozen_hashes() -> list[str]:
    """Enforce byte-stable frozen canonical ontologies (CG-PRODUCTION-INGESTION-GOVERNANCE)."""
    errors: list[str] = []
    if not FROZEN_HASH_REGISTRY.is_file():
        errors.append(f"missing frozen hash registry: {FROZEN_HASH_REGISTRY}")
        return errors

    registry = load_json(FROZEN_HASH_REGISTRY)
    for ontology_id, entry in (registry.get("frozenOntologies") or {}).items():
        rel_path = entry.get("file")
        expected_hash = entry.get("hash")
        if not rel_path or not expected_hash:
            errors.append(f"frozen hash registry: incomplete entry for '{ontology_id}'")
            continue
        path = ROOT / rel_path
        if not path.is_file():
            errors.append(f"frozen ontology missing on disk: {rel_path}")
            continue
        actual_hash = sha256_file(path)
        if actual_hash != expected_hash:
            errors.append(
                f"frozen hash mismatch for '{ontology_id}': expected {expected_hash}, got {actual_hash}"
            )
    return errors


def validate_ontology(ontology: dict, evidence: dict) -> list[str]:
    errors: list[str] = []

    for key in REQUIRED_ONTOLOGY_KEYS:
        if key not in ontology:
            errors.append(f"canonical: missing top-level key '{key}'")

    ont = ontology.get("ontology", {})
    for field in REQUIRED_ONTOLOGY_FIELDS:
        if field not in ont:
            errors.append(f"canonical.ontology: missing '{field}'")

    evidence_components = {c["id"] for c in evidence.get("components", [])}
    evidence_categories = {c["id"] for c in evidence.get("categories", [])}

    component_ids: set[str] = set()
    for comp in ontology.get("components", []):
        cid = comp.get("id")
        if not cid:
            errors.append("canonical.components: entry missing id")
            continue
        if cid in component_ids:
            errors.append(f"canonical.components: duplicate id '{cid}'")
        component_ids.add(cid)

        if comp.get("pendingEvidenceGraph"):
            continue
        if cid not in evidence_components:
            errors.append(
                f"canonical.components: '{cid}' not in evidence/washer.json "
                f"(mark pendingEvidenceGraph: true if intentional)"
            )

        cat = comp.get("categoryId")
        if cat and cat not in evidence_categories:
            errors.append(f"canonical.components: '{cid}' categoryId '{cat}' not in evidence categories")

    system_ids = {s["id"] for s in ontology.get("systems", []) if "id" in s}
    for comp in ontology.get("components", []):
        sid = comp.get("systemId")
        if sid and sid not in system_ids:
            errors.append(f"canonical.components: '{comp.get('id')}' unknown systemId '{sid}'")

    rel_types = set(ontology.get("relationshipTypes", []))
    for rel in ontology.get("relationships", []):
        for end in ("from", "to"):
            node = rel.get(end)
            if node not in component_ids:
                errors.append(f"canonical.relationships: {end} '{node}' not a canonical component")
        rtype = rel.get("type")
        if rel_types and rtype not in rel_types:
            errors.append(f"canonical.relationships: unknown type '{rtype}'")

    dependency_ids = {d["id"] for d in ontology.get("functionalDependencies", []) if "id" in d}
    for dep in ontology.get("functionalDependencies", []):
        for key in ("requires", "feedback", "conditional"):
            for node in dep.get(key, []):
                if node not in component_ids:
                    errors.append(
                        f"canonical.functionalDependencies '{dep.get('id')}': "
                        f"unknown component '{node}' in {key}"
                    )
        for node in dep.get("enables", []):
            if node not in component_ids and node not in dependency_ids:
                errors.append(
                    f"canonical.functionalDependencies '{dep.get('id')}': "
                    f"unknown reference '{node}' in enables"
                )

    domain_ids = set()
    for domain in ontology.get("failureDomains", []):
        did = domain.get("id")
        if not did:
            errors.append("canonical.failureDomains: entry missing id")
            continue
        if did in domain_ids:
            errors.append(f"canonical.failureDomains: duplicate id '{did}'")
        domain_ids.add(did)
        for node in domain.get("components", []):
            if node not in component_ids:
                errors.append(f"canonical.failureDomains '{did}': unknown component '{node}'")

    for entry in ontology.get("diagnosticEntryPoints", []):
        for domain_id in entry.get("initialDomains", []):
            if domain_id not in domain_ids and domain_id not in system_ids:
                errors.append(
                    f"canonical.diagnosticEntryPoints '{entry.get('id')}': "
                    f"unknown initialDomain '{domain_id}'"
                )
        for goal_id in entry.get("activeGoals", []):
            if goal_id not in dependency_ids:
                errors.append(
                    f"canonical.diagnosticEntryPoints '{entry.get('id')}': "
                    f"unknown activeGoal '{goal_id}'"
                )

    fact_ids = {f["factId"] for f in ontology.get("establishedFactSources", []) if "factId" in f}
    for source in ontology.get("establishedFactSources", []):
        for component_id in source.get("fromComponents", []):
            if component_id not in component_ids:
                errors.append(
                    f"canonical.establishedFactSources '{source.get('factId')}': "
                    f"unknown fromComponents '{component_id}'"
                )

    for target in ontology.get("testTargets", []):
        tid = target.get("id", "?")
        alias_id = target.get("testAliasId")
        if not alias_id:
            errors.append(f"canonical.testTargets '{tid}': missing testAliasId")
        for fact_id in target.get("establishesFacts", []):
            if fact_id not in fact_ids:
                errors.append(
                    f"canonical.testTargets '{tid}': establishesFacts '{fact_id}' not declared"
                )
        requires = target.get("requires", {})
        for fact_id in requires.get("facts", []):
            if fact_id not in fact_ids:
                errors.append(
                    f"canonical.testTargets '{tid}': requires.facts '{fact_id}' not declared"
                )
        for dep_id in requires.get("dependencies", []):
            if dep_id not in dependency_ids:
                errors.append(
                    f"canonical.testTargets '{tid}': requires.dependencies '{dep_id}' unknown"
                )
        for goal_id in target.get("forGoals", []):
            if goal_id not in dependency_ids:
                errors.append(
                    f"canonical.testTargets '{tid}': forGoals '{goal_id}' unknown"
                )

    return errors


def resolve_component(seed_id: str, aliases: dict[str, str]) -> str:
    return aliases.get(seed_id, seed_id)


def validate_overlay(overlay: dict, ontology: dict) -> list[str]:
    errors: list[str] = []
    canonical_ids = {c["id"] for c in ontology.get("components", [])}

    if overlay.get("canonicalOntologyId") != ontology.get("ontology", {}).get("id"):
        errors.append("overlay: canonicalOntologyId mismatch")

    for platform in overlay.get("platforms", []):
        platform_id = platform.get("platformId", "?")
        aliases = platform.get("componentAliases", {})
        seed_dir = PROCEDURE_SEED_DIR / platform_id
        if not seed_dir.is_dir():
            errors.append(f"overlay [{platform_id}]: seed directory missing")
            continue

        for proc in platform.get("procedures", []):
            proc_id = proc.get("procedureId")
            if not proc_id:
                errors.append(f"overlay [{platform_id}]: procedure missing procedureId")
                continue

            proc_path = seed_dir / f"{proc_id}.json"
            if not proc_path.is_file():
                errors.append(f"overlay [{platform_id}]: procedure file missing '{proc_id}.json'")
                continue

            seed = load_json(proc_path)
            seed_components = seed.get("componentIds", [])
            for sid in seed_components:
                resolved = resolve_component(sid, aliases)
                if resolved not in canonical_ids:
                    errors.append(
                        f"overlay [{platform_id}] {proc_id}: seed componentId '{sid}' "
                        f"→ '{resolved}' not in canonical graph"
                    )

            for cid in proc.get("canonicalComponents", []):
                if cid not in canonical_ids:
                    errors.append(
                        f"overlay [{platform_id}] {proc_id}: canonicalComponent '{cid}' not in graph"
                    )

    return errors


def validate_manufacturer_overlay(overlay: dict, ontology: dict) -> list[str]:
    errors: list[str] = []
    if overlay.get("overlayKind") != "manufacturer":
        errors.append("manufacturer overlay: overlayKind must be 'manufacturer'")
    if overlay.get("canonicalOntologyId") != ontology.get("ontology", {}).get("id"):
        errors.append("manufacturer overlay: canonicalOntologyId mismatch")

    canonical_ids = {c["id"] for c in ontology.get("components", [])}
    dependency_ids = {d["id"] for d in ontology.get("functionalDependencies", []) if "id" in d}
    fact_ids = {f["factId"] for f in ontology.get("establishedFactSources", []) if "factId" in f}
    test_target_ids = {t["id"] for t in ontology.get("testTargets", []) if "id" in t}

    for family in overlay.get("platformFamilies", []):
        family_id = family.get("platformFamilyId", "?")
        for target in family.get("add", {}).get("testTargets", []):
            if target.get("id") not in test_target_ids and target.get("id"):
                errors.append(
                    f"manufacturer [{family_id}]: additive testTarget '{target.get('id')}' "
                    f"should extend canonical ids only in v1"
                )
        for binding in family.get("procedureBindings", []):
            if binding.get("testTargetId") not in test_target_ids:
                errors.append(
                    f"manufacturer [{family_id}]: procedureBinding testTargetId "
                    f"'{binding.get('testTargetId')}' not in canonical testTargets"
                )
        for binding in family.get("measurementBindings", []):
            if binding.get("testTargetId") and binding["testTargetId"] not in test_target_ids:
                errors.append(
                    f"manufacturer [{family_id}]: measurementBinding testTargetId "
                    f"'{binding.get('testTargetId')}' not in canonical testTargets"
                )
        for source in family.get("add", {}).get("establishedFactSources", []):
            fact_id = source.get("factId")
            if fact_id and fact_id not in fact_ids:
                errors.append(
                    f"manufacturer [{family_id}]: fact '{fact_id}' must exist in canonical establishedFactSources"
                )
        for override in family.get("overrides", []):
            if override.get("layer") == "functionalDependency":
                dep_id = override.get("match", {}).get("id")
                if dep_id and dep_id not in dependency_ids:
                    errors.append(
                        f"manufacturer [{family_id}]: override dependency '{dep_id}' unknown"
                    )

        family_component_ids = {
            component["id"]
            for component in (family.get("add") or {}).get("components", [])
            if component.get("id")
        }
        allowed_alias_targets = canonical_ids | family_component_ids

        aliases = family.get("oemTermAliases", {})
        for _oem, canonical_id in aliases.items():
            if canonical_id not in allowed_alias_targets:
                errors.append(
                    f"manufacturer [{family_id}]: alias target '{canonical_id}' not in canonical "
                    f"or platform additive components"
                )

    return errors


def validate_ontology_bundle(
    ontology_filename: str,
    overlay_filename: str,
    manufacturer_overlay_filenames: list[str],
    evidence: dict,
    *,
    require_overlay: bool = True,
) -> list[str]:
    ontology_path = CANONICAL_DIR / ontology_filename
    overlay_path = CANONICAL_DIR / "platform_overlays" / overlay_filename
    errors: list[str] = []

    if not ontology_path.is_file():
        errors.append(f"missing ontology: {ontology_path}")
        return errors

    ontology = load_json(ontology_path)
    errors.extend(validate_ontology(ontology, evidence))

    if overlay_path.is_file():
        overlay = load_json(overlay_path)
        errors.extend(validate_overlay(overlay, ontology))
    elif require_overlay:
        errors.append(f"missing overlay file: {overlay_path}")

    for filename in manufacturer_overlay_filenames:
        manufacturer_path = MANUFACTURER_OVERLAY_DIR / filename
        if manufacturer_path.is_file():
            manufacturer_overlay = load_json(manufacturer_path)
            errors.extend(validate_manufacturer_overlay(manufacturer_overlay, ontology))
        else:
            errors.append(f"missing manufacturer overlay: {manufacturer_path}")

    return errors


def main() -> int:
    bundles = [
        (
            "front_load_washer.json",
            "front_load_washer.reference.json",
            ["whirlpool_front_load_washer.json"],
            EVIDENCE_WASHER,
            True,
        ),
        (
            "top_load_washer.json",
            "top_load_washer.reference.json",
            ["whirlpool_top_load_washer.json"],
            EVIDENCE_WASHER,
            True,
        ),
        (
            "dishwasher.json",
            "dishwasher.reference.json",
            ["whirlpool_dishwasher.json", "samsung_dishwasher.json"],
            EVIDENCE_DISHWASHER,
            True,
        ),
        (
            "electric_range.json",
            "electric_range.reference.json",
            [],
            EVIDENCE_WASHER,
            True,
        ),
        (
            "range_oven.json",
            "range_oven.reference.json",
            [],
            EVIDENCE_WASHER,
            True,
        ),
        (
            "microwave.json",
            "microwave.reference.json",
            [],
            EVIDENCE_MICROWAVE,
            True,
        ),
        (
            "heat_pump_dryer.json",
            "heat_pump_dryer.reference.json",
            [],
            EVIDENCE_ELECTRIC_DRYER,
            True,
        ),
        (
            "aio_laundry_combo.json",
            "aio_laundry_combo.reference.json",
            [],
            EVIDENCE_WASHER,
            True,
        ),
    ]

    errors: list[str] = []
    summaries: list[str] = []
    for ontology_filename, overlay_filename, manufacturer_files, evidence_path, require_overlay in bundles:
        evidence = load_json(evidence_path)
        bundle_errors = validate_ontology_bundle(
            ontology_filename,
            overlay_filename,
            manufacturer_files,
            evidence,
            require_overlay=require_overlay,
        )
        errors.extend(bundle_errors)
        if not bundle_errors:
            ontology = load_json(CANONICAL_DIR / ontology_filename)
            overlay = load_json(CANONICAL_DIR / "platform_overlays" / overlay_filename)
            summaries.append(
                f"{ontology.get('ontology', {}).get('id')}: "
                f"{len(ontology.get('components', []))} components, "
                f"{len(ontology.get('relationships', []))} relationships, "
                f"{len(overlay.get('platforms', []))} reference platforms"
            )

    hash_errors = validate_frozen_hashes()
    errors.extend(hash_errors)

    if errors:
        print(f"validate_canonical_graph: FAILED ({len(errors)} issues)")
        for err in errors:
            print(f"  - {err}")
        return 1

    hash_count = len((load_json(FROZEN_HASH_REGISTRY).get("frozenOntologies") or {}))
    print(
        "validate_canonical_graph: OK — "
        + "; ".join(summaries)
        + f"; frozen_hashes={hash_count} verified"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
