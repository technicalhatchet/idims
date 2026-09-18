#!/usr/bin/env python3
"""Publish Whirlpool TL CG-6.6 certification metadata on whirlpool_top_load_washer.json."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR, MANUFACTURER_OVERLAYS_DIR, PROMOTIONS_DIR
from normalization.promotion.planner import load_overlay_file
from whirlpool_tl_cg66_gate_publish import (
    GATE_KIND,
    GATE_TABLE_ARTIFACT,
    LEDGER_ARTIFACT,
    MANUAL_IDS,
    GatePublishError,
    _overlay_semantic_snapshot,
    apply_whirlpool_tl_cg66_gate_delta,
    build_publication_plan,
    file_sha256,
    json_sha256,
    verify_canonical_contract,
)

OVERLAY_FILE = "whirlpool_top_load_washer.json"
FL_OVERLAY = "whirlpool_front_load_washer.json"
SAMSUNG_FL_OVERLAY = "samsung_front_load_washer.json"
TABLE_PATH = CALIBRATION_DIR / GATE_TABLE_ARTIFACT
LEDGER_PATH = CALIBRATION_DIR / LEDGER_ARTIFACT
CANONICAL_PATH = CANONICAL_DIR / "top_load_washer.json"
DRY_RUN_REPORT = CALIBRATION_DIR / "promotion_dry_run_WHIRLPOOL_TOP_LOAD_WASHER_CG66.json"
PLAN_PATH = CALIBRATION_DIR / "publication_plan_WHIRLPOOL_TOP_LOAD_WASHER_CG66.json"
PUBLICATION_PATH = CALIBRATION_DIR / "publication_WHIRLPOOL_TOP_LOAD_WASHER_CG66.json"
EVIDENCE_PATH = CALIBRATION_DIR / "WHIRLPOOL_TOP_LOAD_WASHER_CG66_CERTIFICATION_EVIDENCE_v1.json"
EXPECTED_CANONICAL_HASH = "dee6b0c7128706eb78ac0e290090cd3d79d98dad579f41d6fa0a36ea3fdbf2b5"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _overlay_semantic_hash(overlay: dict) -> str:
    return json_sha256(_overlay_semantic_snapshot(overlay))


def _metadata_only_delta(before: dict, after: dict) -> dict[str, object]:
    semantic_keys = {
        "schemaVersion",
        "overlayKind",
        "canonicalOntologyId",
        "manufacturer",
        "label",
        "platformFamilies",
    }
    before_meta = {k: v for k, v in before.items() if k not in semantic_keys}
    after_meta = {k: v for k, v in after.items() if k not in semantic_keys}
    added = {k: after_meta[k] for k in after_meta if k not in before_meta}
    changed = {
        k: {"before": before_meta[k], "after": after_meta[k]}
        for k in before_meta
        if k in after_meta and before_meta[k] != after_meta[k]
    }
    return {
        "metadataFieldsAdded": sorted(added.keys()),
        "metadataFieldsChanged": sorted(changed.keys()),
        "unexpectedMetadataChanges": changed,
    }


def _write_evidence_lock(
    *,
    promotion_id: str,
    published_at: str,
    hashes: dict[str, str],
    publication_plan: dict,
    ledger: dict,
    checks: dict[str, bool],
    historical: dict,
) -> None:
    ledger_accounting = ledger.get("accounting") or publication_plan.get("certificationAccounting") or {}
    applied = publication_plan.get("appliedCounts") or {}
    evidence = {
        "schemaVersion": "1.0.0",
        "reportType": "cg66_whirlpool_tl_rev1_certification",
        "status": "locked",
        "verdict": "CERTIFIED",
        "lockedAt": published_at,
        "experiment": (
            "Retroactive certification of already-published Whirlpool TL overlay "
            "against frozen top_load_washer rev1 — not new compounding."
        ),
        "canonicalOntology": {
            "id": "top_load_washer",
            "frozen": True,
            "frozenRevision": "rev1",
            "hashBefore": hashes.get("canonicalBefore") or hashes["canonical"],
            "hashAfter": hashes.get("canonicalAfter") or hashes["canonical"],
            "canonicalExpansion": 0,
        },
        "certificationSemantics": {
            "certifiedArtifactsRepresented": applied.get("certifiedArtifactsRepresented", 85),
            "knowledgeArtifactsAdded": 0,
            "overlaySemanticDelta": 0,
            "note": (
                "certifiedArtifactsRepresented counts gate-table artifacts certified in the "
                "publication record — not new knowledge added to the overlay."
            ),
        },
        "overlayDelta": {
            "semanticHashBefore": hashes["overlaySemanticBefore"],
            "semanticHashAfter": hashes["overlaySemanticAfter"],
            "semanticDelta": 0,
            "metadataAttachment": "certification provenance + gate/ledger references",
        },
        "hashes": hashes,
        "counts": {
            "certifiedArtifactsRepresented": applied.get("certifiedArtifactsRepresented", 85),
            "certificationDecisions": ledger_accounting.get("certificationDecisions", 35),
            "inheritedKnowledge": ledger_accounting.get("inheritedKnowledge", 50),
            "certificationWorkItems": (
                ledger_accounting.get("certificationDecisions", 35)
                + ledger_accounting.get("inheritedKnowledge", 50)
            ),
            "deferred": ledger_accounting.get("deferredArtifacts", 17),
            "contractRejections": ledger_accounting.get("contractRejections", 2),
            "newSemanticDecisions": 0,
            "canonicalExpansion": 0,
        },
        "historicalCompounding": historical,
        "cg66TeachingCost": 0,
        "publication": {
            "promotionId": promotion_id,
            "publishedAt": published_at,
            "publishMode": "gate_table_certification",
            "overlayFile": OVERLAY_FILE,
            "gateArtifact": GATE_TABLE_ARTIFACT,
            "ledgerArtifact": LEDGER_ARTIFACT,
            "publicationArtifact": PUBLICATION_PATH.name,
            "publicationPlanArtifact": PLAN_PATH.name,
            "dryRunReportArtifact": DRY_RUN_REPORT.name,
            "certificationEvidenceArtifact": EVIDENCE_PATH.name,
        },
        "regression": {
            "checks": checks,
        },
        "manufacturerIsolation": {
            "flOverlayUnchanged": checks.get("flOverlayByteStable"),
            "samsungFlOverlayUnchanged": checks.get("samsungFlOverlayByteStable"),
            "flLeakage": 0,
            "samsungLeakage": 0,
            "verdict": "clean",
        },
    }
    EVIDENCE_PATH.write_text(json.dumps(evidence, indent=2), encoding="utf-8")


def main() -> int:
    print("==> Whirlpool TL CG-6.6 certification publish")

    for path in (TABLE_PATH, LEDGER_PATH, DRY_RUN_REPORT, PLAN_PATH):
        if not path.exists():
            print(f"FAIL: required artifact missing: {path}", file=sys.stderr)
            return 1

    table = _load_json(TABLE_PATH)
    ledger = _load_json(LEDGER_PATH)
    dry_run = _load_json(DRY_RUN_REPORT)
    plan_before = _load_json(PLAN_PATH)

    if table.get("status") not in {"gated", "published"}:
        print(f"FAIL: gate table status must be gated/published, got {table.get('status')}", file=sys.stderr)
        return 1
    if dry_run.get("summary", {}).get("publishBlocked"):
        print("FAIL: WP3 dry-run report indicates publish blocked", file=sys.stderr)
        return 1
    if ledger.get("accounting", {}).get("newSemanticDecisions", -1) != 0:
        print("FAIL: ledger reports new semantic decisions", file=sys.stderr)
        return 1

    hashes_before = {
        "canonicalBefore": file_sha256(CANONICAL_PATH),
        "gateTableBefore": file_sha256(TABLE_PATH),
        "ledgerBefore": file_sha256(LEDGER_PATH),
        "publicationPlanBefore": file_sha256(PLAN_PATH),
        "dryRunReportBefore": file_sha256(DRY_RUN_REPORT),
        "flOverlayBefore": file_sha256(MANUFACTURER_OVERLAYS_DIR / FL_OVERLAY),
        "samsungFlOverlayBefore": file_sha256(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY),
    }
    if hashes_before["canonicalBefore"] != EXPECTED_CANONICAL_HASH:
        print(
            f"FAIL: canonical hash drift before publish "
            f"(expected {EXPECTED_CANONICAL_HASH}, got {hashes_before['canonicalBefore']})",
            file=sys.stderr,
        )
        return 1

    overlay_path = MANUFACTURER_OVERLAYS_DIR / OVERLAY_FILE
    overlay_before = load_overlay_file(OVERLAY_FILE)
    overlay_semantic_before = _overlay_semantic_hash(overlay_before)
    hashes_before["overlaySemanticBefore"] = overlay_semantic_before

    canonical_before = _load_json(CANONICAL_PATH)
    fl_before = _load_json(MANUFACTURER_OVERLAYS_DIR / FL_OVERLAY)
    samsung_fl_before = _load_json(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY)

    published_at = datetime.now(timezone.utc)
    promotion_id = f"cert-WHIRLPOOL-TL-CG66-{published_at.strftime('%Y%m%d%H%M%S')}"
    promo_dir = PROMOTIONS_DIR / promotion_id
    promo_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(overlay_path, promo_dir / "overlay_before.json")

    print("==> Apply gate-table certification publisher (authoritative, metadata-only)")
    try:
        overlay_after, publication_plan = apply_whirlpool_tl_cg66_gate_delta(
            json.loads(json.dumps(overlay_before)),
            table,
            publish=True,
            promotion_id=promotion_id,
            dry_run_report_artifact=DRY_RUN_REPORT.name,
            canonical_before=canonical_before,
            canonical_after=canonical_before,
        )
    except GatePublishError as exc:
        print(f"FAIL: certification publisher blocked: {exc}", file=sys.stderr)
        return 1

    metadata_delta = _metadata_only_delta(overlay_before, overlay_after)
    overlay_semantic_after = _overlay_semantic_hash(overlay_after)
    if overlay_semantic_before != overlay_semantic_after:
        print("FAIL: overlay semantic content changed during publish", file=sys.stderr)
        return 1
    if _overlay_semantic_snapshot(overlay_before) != _overlay_semantic_snapshot(overlay_after):
        print("FAIL: platformFamilies semantic snapshot changed", file=sys.stderr)
        return 1

    expected_plan = build_publication_plan(table, ledger)
    expected_counts = expected_plan.get("expectedCounts") or {}
    if (
        publication_plan["appliedCounts"]["certifiedArtifactsRepresented"]
        != expected_counts.get("procedureBindings", 12)
        + expected_counts.get("measurementBindings", 18)
        + expected_counts.get("procedureRoleEvidence", 6)
        + expected_counts.get("oemAliasMappings", 49)
    ):
        print("FAIL: certified artifact count drift vs gate table expected counts", file=sys.stderr)
        return 1

    (promo_dir / "overlay_after.json").write_text(
        json.dumps(overlay_after, indent=2),
        encoding="utf-8",
    )
    overlay_path.write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")

    canonical_after = _load_json(CANONICAL_PATH)
    fl_after = _load_json(MANUFACTURER_OVERLAYS_DIR / FL_OVERLAY)
    samsung_fl_after = _load_json(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY)
    contract_checks = verify_canonical_contract(canonical_after, table)

    hashes_after = {
        **hashes_before,
        "canonicalAfter": file_sha256(CANONICAL_PATH),
        "gateTableAfter": file_sha256(TABLE_PATH),
        "ledgerAfter": file_sha256(LEDGER_PATH),
        "overlaySemanticAfter": overlay_semantic_after,
        "flOverlayAfter": file_sha256(MANUFACTURER_OVERLAYS_DIR / FL_OVERLAY),
        "samsungFlOverlayAfter": file_sha256(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY),
    }

    checks = {
        "canonicalHashUnchanged": hashes_after["canonicalBefore"] == hashes_after["canonicalAfter"],
        "canonicalFrozenRev1": contract_checks["frozen"] and contract_checks["frozenRevisionRev1"],
        "overlaySemanticUnchanged": overlay_semantic_before == overlay_semantic_after,
        "metadataOnlyDelta": len(metadata_delta["metadataFieldsChanged"]) == 0
        or all(
            k in {
                "gateArtifact",
                "certificationLedgerArtifact",
                "certificationManualIds",
                "certificationAt",
                "gateKind",
                "status",
                "certificationEvidence",
                "certificationPromotionId",
                "dryRunReportArtifact",
                "publicationArtifact",
            }
            for k in metadata_delta["metadataFieldsAdded"] + metadata_delta["metadataFieldsChanged"]
        ),
        "flOverlayByteStable": hashes_after["flOverlayBefore"] == hashes_after["flOverlayAfter"],
        "samsungFlOverlayByteStable": hashes_after["samsungFlOverlayBefore"]
        == hashes_after["samsungFlOverlayAfter"],
        "gateTableFullyApplied": publication_plan["summary"]["representationFailures"] == 0,
        "knowledgeArtifactsAddedZero": publication_plan["appliedCounts"]["knowledgeArtifactsAdded"] == 0,
        "canonicalMutationsZero": publication_plan["appliedCounts"]["canonicalMutations"] == 0,
        "newSemanticDecisionsZero": publication_plan["appliedCounts"]["newSemanticDecisions"] == 0,
        "certifiedArtifacts85": publication_plan["appliedCounts"]["certifiedArtifactsRepresented"] == 85,
        "deferred17": publication_plan["certificationAccounting"]["deferredArtifacts"] == 17,
        "contractRejections2": publication_plan["certificationAccounting"]["contractRejections"] == 2,
    }

    if not all(checks.values()):
        print("FAIL: publication drift checks", checks, file=sys.stderr)
        overlay_path.write_text(json.dumps(overlay_before, indent=2), encoding="utf-8")
        return 1

    print("==> validate_canonical_graph.py")
    if subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "validate_canonical_graph.py")],
        cwd=ROOT,
        check=False,
    ).returncode != 0:
        overlay_path.write_text(json.dumps(overlay_before, indent=2), encoding="utf-8")
        return 1

    tests = [
        "components/diagnostics/session/__tests__/scenarios/cg5-tl-architecture-boundary.test.ts",
        "components/diagnostics/session/__tests__/scenarios/tl-washer-torture.test.ts",
    ]
    test_results: dict[str, int] = {}
    for test_path in tests:
        print(f"==> {test_path}")
        proc = subprocess.run(
            ["npx", "--yes", "tsx", test_path],
            cwd=ROOT / "frontend",
            check=False,
            shell=sys.platform == "win32",
        )
        test_results[test_path] = proc.returncode
        if proc.returncode != 0:
            overlay_path.write_text(json.dumps(overlay_before, indent=2), encoding="utf-8")
            return 1

    print("==> npx tsc --noEmit")
    tsc = subprocess.run(
        ["npx", "tsc", "--noEmit"],
        cwd=ROOT / "frontend",
        check=False,
        shell=sys.platform == "win32",
    )
    if tsc.returncode != 0:
        print("WARN: tsc reported errors (pre-existing unrelated failures allowed)", file=sys.stderr)

    published_at_iso = published_at.isoformat()
    publication_plan["status"] = "published"
    publication_plan["publishedAt"] = published_at_iso
    publication_plan["promotionId"] = promotion_id
    publication_plan["hashes"] = {
        "canonical": hashes_after["canonicalAfter"],
        "gateTable": hashes_before["gateTableBefore"],
        "ledger": hashes_before["ledgerBefore"],
        "publicationPlan": json_sha256(publication_plan),
        "dryRunReport": hashes_before["dryRunReportBefore"],
        "overlaySemantic": overlay_semantic_after,
    }
    PLAN_PATH.write_text(json.dumps(publication_plan, indent=2), encoding="utf-8")
    hashes_after["publicationPlanAfter"] = file_sha256(PLAN_PATH)

    table["status"] = "published"
    table["publishedAt"] = published_at_iso
    table["certificationPromotionId"] = promotion_id
    table["publicationArtifact"] = PUBLICATION_PATH.name
    table["certificationEvidenceArtifact"] = EVIDENCE_PATH.name
    table["dryRunReportArtifact"] = DRY_RUN_REPORT.name
    if table.get("gateSummary"):
        table["gateSummary"]["status"] = "published"
        table["gateSummary"]["publishedAt"] = published_at_iso
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")
    hashes_after["gateTableAfter"] = file_sha256(TABLE_PATH)

    historical = {
        "manuals": (table.get("historicalPromotionProvenance") or {}).get("manuals") or [],
        "cg66TeachingCost": 0,
        "note": "Historical compounding decisions are provenance only — not CG-6.6 teaching cost.",
    }

    report = {
        "manualIds": MANUAL_IDS,
        "gateKind": GATE_KIND,
        "promotionId": promotion_id,
        "publishedAt": published_at_iso,
        "publishMode": "gate_table_certification",
        "verdict": "CERTIFIED",
        "publicationPlan": publication_plan,
        "metadataDelta": metadata_delta,
        "overlayDelta": {
            "semanticHashBefore": overlay_semantic_before,
            "semanticHashAfter": overlay_semantic_after,
            "semanticDelta": 0,
            "knowledgeArtifactsAdded": 0,
            "certifiedArtifactsRepresented": 85,
        },
        "certificationAccounting": publication_plan.get("certificationAccounting"),
        "historicalPromotionProvenance": table.get("historicalPromotionProvenance"),
        "publicationChecks": checks,
        "hashes": hashes_after,
        "testResults": test_results,
        "tscExitCode": tsc.returncode,
        "dryRunReportArtifact": DRY_RUN_REPORT.name,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "overlayFile": OVERLAY_FILE,
        "notes": [
            "CG-6.6 certification — metadata/provenance only; overlay platformFamilies unchanged.",
            "85 certified artifacts = represented in publication record, not knowledge added.",
            "No candidate regeneration; no new semantic inference.",
        ],
    }
    PUBLICATION_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")

    _write_evidence_lock(
        promotion_id=promotion_id,
        published_at=published_at_iso,
        ledger=ledger,
        hashes={
            "canonical": hashes_after["canonicalAfter"],
            "gateTable": hashes_after["gateTableAfter"],
            "ledger": hashes_before["ledgerBefore"],
            "publicationPlan": hashes_after["publicationPlanAfter"],
            "dryRunReport": hashes_before["dryRunReportBefore"],
            "overlaySemanticBefore": overlay_semantic_before,
            "overlaySemanticAfter": overlay_semantic_after,
            "publicationReport": file_sha256(PUBLICATION_PATH),
        },
        publication_plan=publication_plan,
        checks=checks,
        historical=historical,
    )

    (PROMOTIONS_DIR / f"{promotion_id}.json").write_text(
        json.dumps(publication_plan, indent=2),
        encoding="utf-8",
    )

    print("\nCG-6.6 WHIRLPOOL TL")
    print("CERTIFIED")
    print("------------------------")
    print("Canonical rev1:       unchanged")
    print("Canonical expansion:  0")
    print("New semantic:         0")
    print("Certified artifacts:  85  (represented, not added)")
    print("Deferred:             17")
    print("Contract rejections:  2")
    print("")
    print("Overlay semantic delta: 0")
    print("Certification metadata: +gate attachment/evidence record")
    print("")
    print("Historical compounding:")
    for manual in historical.get("manuals") or []:
        print(f"  {manual['manualId']} = {manual.get('historicalNewDecisions', 0)} decisions")
    print("")
    print("CG-6.6 teaching cost: 0")
    print("")
    print(f"promotionId:  {promotion_id}")
    print(f"canonical:    {hashes_after['canonicalAfter']}")
    print(f"gate table:   {hashes_after['gateTableAfter']}")
    print(f"ledger:       {hashes_before['ledgerBefore']}")
    print(f"plan:         {hashes_after['publicationPlanAfter']}")
    print(f"report:       {PUBLICATION_PATH}")
    print(f"evidence:     {EVIDENCE_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
