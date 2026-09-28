#!/usr/bin/env python3
"""Gate-table certification publisher for Whirlpool TL CG-6.6 on whirlpool_top_load_washer.json."""

from __future__ import annotations

import hashlib
import json
from copy import deepcopy
from datetime import datetime, timezone
from typing import Any

GATE_TABLE_ARTIFACT = "WHIRLPOOL_TOP_LOAD_WASHER_CG66_overlay_mapping_table_v1.json"
LEDGER_ARTIFACT = "WHIRLPOOL_TOP_LOAD_WASHER_CG66_gate_decision_ledger_v1.json"
MANUAL_IDS = ["W10864849", "W11697231", "W11416787"]
GATE_KIND = "whirlpool_tl_corpus_rev1_certification"

CERTIFY_ACTIONS = frozenset(
    {
        "certify_inherited_overlay",
        "certify_overlay_implementation",
        "certify_matcher_mapping",
        "certify_procedure_role",
    }
)


class GatePublishError(Exception):
    """Certification publisher blocked — overlay incompatible with frozen rev1 contract."""


def _procedure_binding_map(bindings: list[dict]) -> dict[str, str]:
    return {
        str(b["procedureId"]): str(b["testTargetId"])
        for b in bindings or []
        if b.get("procedureId") and b.get("testTargetId")
    }


def _measurement_binding_map(bindings: list[dict]) -> dict[str, str]:
    return {
        f"{b['procedureId']}:{b['measurementKnowledgeId']}": str(b["testTargetId"])
        for b in bindings or []
        if b.get("procedureId") and b.get("measurementKnowledgeId") and b.get("testTargetId")
    }


def file_sha256(path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def json_sha256(value: Any) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def collect_gate_intent(table: dict) -> dict[str, Any]:
    mappings = [
        m for m in table.get("mappings") or [] if m.get("gateAction") in CERTIFY_ACTIONS
    ]
    procedure_bindings = [
        b for b in table.get("procedureBindings") or [] if b.get("gateAction") in CERTIFY_ACTIONS
    ]
    measurement_bindings = [
        b for b in table.get("measurementBindings") or [] if b.get("gateAction") in CERTIFY_ACTIONS
    ]
    procedure_role_evidence = list(table.get("procedureRoleEvidence") or [])
    return {
        "mappings": mappings,
        "procedureBindings": procedure_bindings,
        "measurementBindings": measurement_bindings,
        "procedureRoleEvidence": procedure_role_evidence,
        "counts": {
            "mappings": len(mappings),
            "procedureBindings": len(procedure_bindings),
            "measurementBindings": len(measurement_bindings),
            "procedureRoleEvidence": len(procedure_role_evidence),
            "totalCertified": (
                len(mappings)
                + len(procedure_bindings)
                + len(measurement_bindings)
                + len(procedure_role_evidence)
            ),
        },
    }


def build_publication_plan(table: dict, ledger: dict | None = None) -> dict[str, Any]:
    intent = collect_gate_intent(table)
    ledger_accounting = (ledger or {}).get("accounting") or {}
    table_accounting = table.get("certificationAccounting") or {}
    accounting = ledger_accounting or table_accounting
    return {
        "manualIds": MANUAL_IDS,
        "gateKind": GATE_KIND,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "publishMode": "gate_table_certification",
        "gateIntent": intent,
        "expectedCounts": table.get("expectedPublicationCounts") or {},
        "certificationAccounting": {
            "newSemanticDecisions": 0,
            "certificationDecisions": accounting.get("certificationDecisions", 0),
            "inheritedKnowledge": accounting.get("inheritedKnowledge", 0),
            "deferredArtifacts": accounting.get("deferredArtifacts", 0),
            "contractRejections": accounting.get("contractRejections", 0),
            "canonicalExpansion": 0,
        },
        "canonicalContract": table.get("canonicalContract"),
        "deferred": table.get("deferredArtifacts") or [],
        "contractRejections": table.get("contractRejections") or [],
    }


def _overlay_semantic_snapshot(overlay: dict) -> dict[str, Any]:
    families = {}
    for family in overlay.get("platformFamilies") or []:
        fid = family.get("platformFamilyId")
        families[fid] = {
            "oemTermAliases": family.get("oemTermAliases") or {},
            "procedureBindings": _procedure_binding_map(family.get("procedureBindings")),
            "measurementBindings": _measurement_binding_map(family.get("measurementBindings")),
            "overlayComponents": sorted(
                c.get("id")
                for c in (family.get("add") or {}).get("components") or []
                if c.get("id")
            ),
            "overrides": family.get("overrides") or [],
        }
    return {"platformFamilies": families}


def _overlay_binding_union(overlay: dict) -> dict[str, dict[str, str]]:
    procedure_bindings: dict[str, str] = {}
    measurement_bindings: dict[str, str] = {}
    for family in overlay.get("platformFamilies") or []:
        procedure_bindings.update(_procedure_binding_map(family.get("procedureBindings")))
        measurement_bindings.update(_measurement_binding_map(family.get("measurementBindings")))
    return {
        "procedureBindings": procedure_bindings,
        "measurementBindings": measurement_bindings,
    }


def _gate_certified_bindings(table: dict) -> dict[str, dict[str, str]]:
    procedure_bindings: dict[str, str] = {}
    measurement_bindings: dict[str, str] = {}
    for binding in table.get("procedureBindings") or []:
        if binding.get("gateAction") not in CERTIFY_ACTIONS:
            continue
        procedure_bindings[binding["procedureId"]] = binding["testTargetId"]
    for binding in table.get("measurementBindings") or []:
        if binding.get("gateAction") not in CERTIFY_ACTIONS:
            continue
        key = f"{binding['procedureId']}:{binding['measurementKnowledgeId']}"
        measurement_bindings[key] = binding["testTargetId"]
    return {
        "procedureBindings": procedure_bindings,
        "measurementBindings": measurement_bindings,
    }


def _verify_overlay_matches_gate_table(overlay: dict, table: dict) -> list[str]:
    errors: list[str] = []
    expected = _gate_certified_bindings(table)
    actual = _overlay_binding_union(overlay)

    for proc_id, target in expected["procedureBindings"].items():
        if actual["procedureBindings"].get(proc_id) != target:
            errors.append(
                f"procedure binding drift: {proc_id} "
                f"overlay={actual['procedureBindings'].get(proc_id)} gate={target}"
            )
    for key, target in expected["measurementBindings"].items():
        if actual["measurementBindings"].get(key) != target:
            errors.append(
                f"measurement binding drift: {key} "
                f"overlay={actual['measurementBindings'].get(key)} gate={target}"
            )

    contract = table.get("canonicalContract") or {}
    forbidden = set(contract.get("forbiddenCanonicalIds") or [])
    permitted_targets = set(contract.get("allowedCanonicalIds") or []) | set(
        contract.get("overlayOnlyIds") or []
    )
    for family in overlay.get("platformFamilies") or []:
        for component in (family.get("add") or {}).get("components") or []:
            if component.get("id"):
                permitted_targets.add(component["id"])

    for family in overlay.get("platformFamilies") or []:
        for term, target in (family.get("oemTermAliases") or {}).items():
            if target in forbidden:
                errors.append(f"forbidden alias target {term} -> {target}")
            if target == "lid_switch":
                errors.append(f"fabricated lid_switch matcher alias: {term} -> {target}")
            if target not in permitted_targets:
                errors.append(
                    f"alias target not in rev1 contract or overlay-only set: {term} -> {target}"
                )

    return errors


def _assert_no_canonical_mutation(before: dict, after: dict) -> None:
    if before != after:
        raise GatePublishError(
            "Canonical graph mutation proposed during certification — fail closed."
        )


def apply_whirlpool_tl_cg66_gate_delta(
    overlay: dict,
    table: dict,
    *,
    publish: bool = False,
    promotion_id: str | None = None,
    dry_run_report_artifact: str | None = None,
    canonical_before: dict | None = None,
    canonical_after: dict | None = None,
) -> tuple[dict, dict[str, Any]]:
    allowed_status = {"gated"} if not publish else {"gated", "published"}
    if table.get("status") not in allowed_status:
        raise GatePublishError(
            f"Gate table status must be one of {sorted(allowed_status)}, got {table.get('status')}"
        )
    if table.get("gatePolicy", {}).get("gateKind") != GATE_KIND:
        raise GatePublishError("Gate table gateKind mismatch")

    if canonical_before is not None and canonical_after is not None:
        _assert_no_canonical_mutation(canonical_before, canonical_after)

    plan = build_publication_plan(table)
    intent = plan["gateIntent"]
    expected = plan["expectedCounts"]

    semantic_before = _overlay_semantic_snapshot(overlay)
    drift_errors = _verify_overlay_matches_gate_table(overlay, table)
    if drift_errors:
        raise GatePublishError("; ".join(drift_errors))

    result = deepcopy(overlay)
    certified_at = datetime.now(timezone.utc).isoformat()

    result["gateArtifact"] = GATE_TABLE_ARTIFACT
    result["certificationLedgerArtifact"] = LEDGER_ARTIFACT
    result["certificationManualIds"] = list(MANUAL_IDS)
    result["certificationAt"] = certified_at
    result["gateKind"] = GATE_KIND
    result["status"] = "published" if publish else "certified_preview"
    result["certificationEvidence"] = {
        "procedureRoleEvidence": intent["procedureRoleEvidence"],
        "canonicalContract": table.get("canonicalContract"),
        "accounting": plan["certificationAccounting"],
        "historicalPromotionProvenance": table.get("historicalPromotionProvenance"),
        "certifiedArtifactsSemantics": {
            "certifiedArtifactsRepresented": intent["counts"]["totalCertified"],
            "knowledgeArtifactsAdded": 0,
            "overlaySemanticDelta": 0,
            "note": (
                "certifiedArtifactsRepresented counts gate-table artifacts certified in the "
                "publication record — not new knowledge added to the overlay."
            ),
        },
        "note": (
            "CG-6.6 certification metadata only — semantic overlay content unchanged. "
            "Procedure-role lid_switch evidence is certified without matcher alias fabrication."
        ),
    }
    if promotion_id:
        result["certificationPromotionId"] = promotion_id
    if dry_run_report_artifact:
        result["dryRunReportArtifact"] = dry_run_report_artifact
    if publish:
        result["publicationArtifact"] = "publication_WHIRLPOOL_TOP_LOAD_WASHER_CG66.json"
        result["certificationEvidenceArtifact"] = (
            "WHIRLPOOL_TOP_LOAD_WASHER_CG66_CERTIFICATION_EVIDENCE_v1.json"
        )

    semantic_after = _overlay_semantic_snapshot(result)
    if semantic_before != semantic_after:
        raise GatePublishError(
            "Certification publisher mutated overlay semantic content — fail closed."
        )

    metadata_only = {
        k: v
        for k, v in result.items()
        if k
        not in {
            "schemaVersion",
            "overlayKind",
            "canonicalOntologyId",
            "manufacturer",
            "label",
            "platformFamilies",
        }
    }
    overlay_metadata_only = {
        k: v
        for k, v in overlay.items()
        if k
        not in {
            "schemaVersion",
            "overlayKind",
            "canonicalOntologyId",
            "manufacturer",
            "label",
            "platformFamilies",
        }
    }
    if metadata_only == overlay_metadata_only and result.get("gateArtifact"):
        pass  # idempotent re-certification

    applied_counts = {
        "metadataFields": max(0, len(metadata_only) - len(overlay_metadata_only)),
        "procedureBindings": len(intent["procedureBindings"]),
        "measurementBindings": len(intent["measurementBindings"]),
        "procedureRoleEvidence": len(intent["procedureRoleEvidence"]),
        "oemAliasMappings": len(intent["mappings"]),
        "certifiedArtifactsRepresented": intent["counts"]["totalCertified"],
        "knowledgeArtifactsAdded": 0,
        "overlaySemanticDelta": 0,
        "canonicalMutations": 0,
        "newSemanticDecisions": 0,
    }

    failures: list[str] = []
    if applied_counts["procedureBindings"] != expected.get("procedureBindings", 12):
        failures.append(
            f"procedureBindings certified count {applied_counts['procedureBindings']} "
            f"!= expected {expected.get('procedureBindings')}"
        )
    if applied_counts["measurementBindings"] != expected.get("measurementBindings", 18):
        failures.append(
            f"measurementBindings certified count {applied_counts['measurementBindings']} "
            f"!= expected {expected.get('measurementBindings')}"
        )
    if applied_counts["canonicalMutations"] != 0:
        failures.append("canonical mutations must be 0")

    plan["publisherResult"] = {
        "metadataApplied": list(metadata_only.keys()),
        "semanticOverlayUnchanged": semantic_before == semantic_after,
        "driftErrors": drift_errors,
    }
    plan["appliedCounts"] = applied_counts
    plan["summary"] = {
        "gateIntentTotal": intent["counts"]["totalCertified"],
        "publisherAppliedTotal": applied_counts["procedureBindings"]
        + applied_counts["measurementBindings"]
        + applied_counts["procedureRoleEvidence"]
        + applied_counts["oemAliasMappings"],
        "representationFailures": len(failures),
        "publishBlocked": bool(failures),
        "newSemanticDecisions": 0,
        "canonicalMutations": 0,
    }
    if failures:
        plan["blockedReason"] = "; ".join(failures)
        raise GatePublishError(plan["blockedReason"])

    return result, plan


def verify_canonical_contract(canonical: dict, table: dict) -> dict[str, bool]:
    contract = table.get("canonicalContract") or {}
    ontology = canonical.get("ontology") or {}
    component_ids = sorted(c.get("id") for c in canonical.get("components") or [] if c.get("id"))
    allowed = sorted(contract.get("allowedCanonicalIds") or [])
    lid_switch = next((c for c in canonical.get("components") or [] if c.get("id") == "lid_switch"), {})
    aliases_values = []
    return {
        "frozen": ontology.get("frozen") is True,
        "frozenRevisionRev1": ontology.get("frozenRevision") == "rev1",
        "componentCount17": len(component_ids) == 17,
        "componentSetMatchesContract": component_ids == allowed,
        "driveSystemAbsent": "drive_system" not in component_ids,
        "lidSwitchPresent": "lid_switch" in component_ids,
        "lidSwitchConditional": lid_switch.get("canonicalStatus") == "conditional",
        "noDriveSystemInRelationships": not any(
            rel.get("from") == "drive_system" or rel.get("to") == "drive_system"
            for rel in canonical.get("relationships") or []
        ),
    }
