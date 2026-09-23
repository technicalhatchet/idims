#!/usr/bin/env python3
"""Apply CG-6.6 Whirlpool TL human gate — certification ledger only (no new semantic knowledge).

WP2 records gate decisions against the frozen rev1 contract. It does NOT treat
certification work as compounding approvals or mutate normalization candidates as
new knowledge acquisitions.
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
CALIBRATION = ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
TABLE_PATH = CALIBRATION / "WHIRLPOOL_TOP_LOAD_WASHER_CG66_overlay_mapping_table_v1.json"
LEDGER_PATH = CALIBRATION / "WHIRLPOOL_TOP_LOAD_WASHER_CG66_gate_decision_ledger_v1.json"

GATE_KIND = "whirlpool_tl_corpus_rev1_certification"
REVIEWER = "human_gate_cg66"

CERTIFY_ACTIONS = frozenset(
    {
        "certify_inherited_overlay",
        "certify_overlay_implementation",
        "certify_matcher_mapping",
        "certify_procedure_role",
    }
)
DEFER_ACTIONS = frozenset({"defer_unbound_procedure", "defer_ambiguous_lid_language"})
REJECT_ACTIONS = frozenset({"reject_contract_violation"})


def load_json(path: Path) -> dict:
    with path.open(encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, payload: dict) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(payload, handle, indent=2)
        handle.write("\n")


def gate_action_to_decision_kind(gate_action: str) -> str:
    if gate_action == "certify_inherited_overlay":
        return "inherited"
    if gate_action in CERTIFY_ACTIONS:
        return "certification"
    if gate_action in DEFER_ACTIONS:
        return "deferred"
    if gate_action in REJECT_ACTIONS:
        return "contract_rejection"
    raise ValueError(f"Unknown gateAction: {gate_action}")


def artifact_id(section: str, index: int, item: dict) -> str:
    if section == "mappings":
        return f"mapping:{item.get('manualId')}:{item.get('oemTerm')}:{item.get('aliasTarget')}"
    if section == "procedureBindings":
        return f"procedure:{item.get('procedureId')}:{item.get('testTargetId')}"
    if section == "measurementBindings":
        return (
            f"measurement:{item.get('procedureId')}:"
            f"{item.get('measurementKnowledgeId')}:{item.get('testTargetId')}"
        )
    if section == "procedureRoleEvidence":
        return (
            f"procedure_role:{item.get('procedureId')}:"
            f"{item.get('stepId')}:{item.get('roleId')}"
        )
    if section == "deferredArtifacts":
        return f"deferred:{item.get('procedureId')}"
    if section == "contractRejections":
        return f"contract_rejection:{item.get('concept')}"
    return f"{section}:{index}"


def build_ledger_entry(section: str, index: int, item: dict) -> dict:
    gate_action = item.get("gateAction")
    if not gate_action:
        raise ValueError(f"Missing gateAction on {section}[{index}]")
    decision_kind = gate_action_to_decision_kind(gate_action)
    entry = {
        "artifactId": artifact_id(section, index, item),
        "section": section,
        "gateAction": gate_action,
        "decisionKind": decision_kind,
        "newSemanticDecision": False,
        "reviewer": REVIEWER,
        "rationale": item.get("rationale") or item.get("note"),
    }
    for key in (
        "manualId",
        "oemTerm",
        "aliasTarget",
        "procedureId",
        "testTargetId",
        "measurementKnowledgeId",
        "stepId",
        "roleId",
        "concept",
        "canonicalComponents",
        "implementationComponent",
        "layer",
        "displayTitle",
    ):
        if key in item and item[key] is not None:
            entry[key] = item[key]
    if decision_kind == "contract_rejection":
        entry["countsAsTeachingCost"] = False
        entry["countsAsCertificationFailure"] = True
    else:
        entry["countsAsTeachingCost"] = False
        entry["countsAsCertificationFailure"] = False
    return entry


def validate_contract(table: dict) -> list[str]:
    errors: list[str] = []
    contract = table["canonicalContract"]
    allowed = set(contract["allowedCanonicalIds"])
    forbidden = set(contract["forbiddenCanonicalIds"])

    def check_components(components: list[str], context: str) -> None:
        for component_id in components or []:
            if component_id in forbidden:
                errors.append(f"{context}: forbidden canonical id '{component_id}'")
            elif component_id and component_id not in allowed:
                errors.append(f"{context}: canonical id '{component_id}' not in rev1 contract")

    for section in (
        "mappings",
        "procedureBindings",
        "measurementBindings",
        "procedureRoleEvidence",
    ):
        for index, item in enumerate(table.get(section) or []):
            check_components(item.get("canonicalComponents") or [], f"{section}[{index}]")

    for item in table.get("contractRejections") or []:
        if item.get("gateAction") != "reject_contract_violation":
            errors.append(f"contractRejections must use reject_contract_violation: {item}")

    return errors


def collect_entries(table: dict) -> list[dict]:
    entries: list[dict] = []
    for section in (
        "mappings",
        "procedureBindings",
        "measurementBindings",
        "procedureRoleEvidence",
        "deferredArtifacts",
        "contractRejections",
    ):
        for index, item in enumerate(table.get(section) or []):
            entries.append(build_ledger_entry(section, index, item))
    return entries


def summarize(entries: list[dict]) -> dict:
    by_kind: dict[str, int] = {}
    for entry in entries:
        kind = entry["decisionKind"]
        by_kind[kind] = by_kind.get(kind, 0) + 1
    semantic_true = sum(1 for entry in entries if entry.get("newSemanticDecision"))
    return {
        "totalArtifacts": len(entries),
        "byDecisionKind": by_kind,
        "newSemanticDecisions": semantic_true,
        "certificationDecisions": by_kind.get("certification", 0),
        "inheritedKnowledge": by_kind.get("inherited", 0),
        "deferredArtifacts": by_kind.get("deferred", 0),
        "contractRejections": by_kind.get("contract_rejection", 0),
        "canonicalExpansion": 0,
    }


def main() -> int:
    table = load_json(TABLE_PATH)
    if table.get("status") == "gated":
        print("Gate table already gated — re-run is idempotent only if status reset to draft.")
    if table.get("gatePolicy", {}).get("gateKind") != GATE_KIND:
        print(f"FAIL: expected gateKind {GATE_KIND}", file=sys.stderr)
        return 1

    contract_errors = validate_contract(table)
    if contract_errors:
        print(f"FAIL: contract validation ({len(contract_errors)} issues)", file=sys.stderr)
        for err in contract_errors:
            print(f"  - {err}", file=sys.stderr)
        return 1

    entries = collect_entries(table)
    summary = summarize(entries)
    if summary["newSemanticDecisions"] != 0:
        print("FAIL: ledger contains newSemanticDecision=true entries", file=sys.stderr)
        return 1

    gated_at = datetime.now(timezone.utc).isoformat()
    ledger = {
        "schemaVersion": "1.0.0",
        "reportType": "whirlpool_tl_cg66_certification_gate_ledger",
        "gateKind": GATE_KIND,
        "manualIds": table.get("manualIds"),
        "canonicalOntologyId": table.get("canonicalOntologyId"),
        "canonicalContract": table.get("canonicalContract"),
        "gateTableArtifact": TABLE_PATH.name,
        "gatedAt": gated_at,
        "reviewer": REVIEWER,
        "purpose": (
            "CG-6.6 certification ledger — validates already-published Whirlpool TL overlay "
            "against frozen top_load_washer rev1. Not new compounding."
        ),
        "accounting": {
            "newSemanticDecisions": 0,
            "certificationDecisions": summary["certificationDecisions"],
            "inheritedKnowledge": summary["inheritedKnowledge"],
            "deferredArtifacts": summary["deferredArtifacts"],
            "contractRejections": summary["contractRejections"],
            "canonicalExpansion": 0,
            "note": (
                "Every entry has newSemanticDecision=false. Contract rejections are policy "
                "guardrails, not negative teaching cost. Historical promotion decisions "
                "(14/0/2) remain in gate table provenance only."
            ),
        },
        "historicalPromotionProvenance": table.get("historicalPromotionProvenance"),
        "summary": summary,
        "entries": entries,
        "publishBlocked": True,
        "publishPrerequisites": [
            "WP3 gate publisher dry-run",
            "canonical top_load_washer.json hash unchanged",
            "gate table equivalent to publication plan",
        ],
    }

    gate_summary = table.get("gateSummary") or {}
    gate_summary.update(
        {
            "status": "gated",
            "gatedAt": gated_at,
            "ledgerArtifact": LEDGER_PATH.name,
            "totalLedgerEntries": len(entries),
            **summary,
        }
    )
    table["gateSummary"] = gate_summary
    table["status"] = "gated"
    table["gatedAt"] = gated_at
    table["ledgerArtifact"] = LEDGER_PATH.name

    write_json(TABLE_PATH, table)
    write_json(LEDGER_PATH, ledger)

    print(f"Gated: {TABLE_PATH.name}")
    print(f"Ledger: {LEDGER_PATH.name}")
    print(f"totalArtifacts={summary['totalArtifacts']}")
    print(f"byDecisionKind={summary['byDecisionKind']}")
    print(f"newSemanticDecisions={summary['newSemanticDecisions']}")
    print("Normalization candidates NOT mutated — certification ledger only.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
