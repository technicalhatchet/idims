#!/usr/bin/env python3
"""SAMSUNG-TL-A50-WASHER CG-6.7 WP5 controlled publication transaction."""

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
from samsung_tl_a50_cg67_gate_publish import (
    EXPECTED_CANONICAL_HASH,
    EXPECTED_LEARNING_DECISION_IDS,
    GATE_KIND,
    GATE_TABLE_ARTIFACT,
    LEDGER_ARTIFACT,
    MANUAL_ID,
    OVERLAY_FILE,
    GatePublishError,
    apply_samsung_tl_a50_cg67_gate_delta,
    build_publication_plan,
    file_sha256,
    json_sha256,
    scaffold_samsung_top_load_washer_overlay,
)

TABLE_PATH = CALIBRATION_DIR / GATE_TABLE_ARTIFACT
LEDGER_PATH = CALIBRATION_DIR / LEDGER_ARTIFACT
CANONICAL_PATH = CANONICAL_DIR / "top_load_washer.json"
DRY_RUN_REPORT = CALIBRATION_DIR / "promotion_dry_run_SAMSUNG_TL_A50_WASHER_CG67.json"
PLAN_PATH = CALIBRATION_DIR / "publication_plan_SAMSUNG_TL_A50_WASHER_CG67.json"
PUBLICATION_PATH = CALIBRATION_DIR / "publication_SAMSUNG_TL_A50_WASHER_CG67.json"
WHIRLPOOL_TL_OVERLAY = "whirlpool_top_load_washer.json"
WHIRLPOOL_FL_OVERLAY = "whirlpool_front_load_washer.json"
SAMSUNG_FL_OVERLAY = "samsung_front_load_washer.json"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def main() -> int:
    print("==> Samsung TL A50 CG-6.7 WP5 controlled publication")

    required = (TABLE_PATH, LEDGER_PATH, DRY_RUN_REPORT, PLAN_PATH)
    for path in required:
        if not path.is_file():
            print(f"FAIL: required artifact missing: {path}", file=sys.stderr)
            return 1

    table = _load_json(TABLE_PATH)
    ledger = _load_json(LEDGER_PATH)
    dry_run = _load_json(DRY_RUN_REPORT)

    if table.get("status") != "gated":
        print(f"FAIL: gate table must be gated (got {table.get('status')})", file=sys.stderr)
        return 1
    if not dry_run.get("dryRunPass"):
        print("FAIL: WP4 dry-run report did not pass", file=sys.stderr)
        return 1
    if ledger.get("gateKind") != GATE_KIND:
        print(f"FAIL: unexpected gateKind {ledger.get('gateKind')}", file=sys.stderr)
        return 1

    hashes_before = {
        "canonicalBefore": file_sha256(CANONICAL_PATH),
        "gateTableBefore": file_sha256(TABLE_PATH),
        "ledgerBefore": file_sha256(LEDGER_PATH),
        "dryRunReportBefore": file_sha256(DRY_RUN_REPORT),
        "publicationPlanBefore": file_sha256(PLAN_PATH),
        "whirlpoolTlOverlayBefore": file_sha256(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_TL_OVERLAY),
        "whirlpoolFlOverlayBefore": file_sha256(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_FL_OVERLAY),
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
    overlay_existed = overlay_path.is_file()
    overlay_on_disk_before = _load_json(overlay_path) if overlay_existed else None

    published_at = datetime.now(timezone.utc)
    promotion_id = f"promo-SAMSUNG-TL-A50-CG67-{published_at.strftime('%Y%m%d%H%M%S')}"
    promo_dir = PROMOTIONS_DIR / promotion_id
    promo_dir.mkdir(parents=True, exist_ok=True)
    if overlay_on_disk_before:
        (promo_dir / "overlay_on_disk_before.json").write_text(
            json.dumps(overlay_on_disk_before, indent=2),
            encoding="utf-8",
        )

    print("==> Apply gate-table publisher (fresh scaffold, publish=True)")
    try:
        overlay_after, publication_plan = apply_samsung_tl_a50_cg67_gate_delta(
            scaffold_samsung_top_load_washer_overlay(),
            table,
            ledger,
            publish=True,
            canonical_hash=hashes_before["canonicalBefore"],
        )
    except GatePublishError as exc:
        print(f"FAIL: publisher blocked: {exc}", file=sys.stderr)
        return 1

    published_at_iso = published_at.isoformat()
    overlay_hash = file_sha256_from_dict(overlay_after)
    publication_plan["status"] = "published"
    publication_plan["publishedAt"] = published_at_iso
    publication_plan["promotionId"] = promotion_id
    publication_plan["publishBlocked"] = False
    publication_plan["hashes"] = {
        "canonical": hashes_before["canonicalBefore"],
        "gateTable": hashes_before["gateTableBefore"],
        "ledger": hashes_before["ledgerBefore"],
        "dryRunReport": hashes_before["dryRunReportBefore"],
        "overlay": overlay_hash,
        "publicationPlan": json_sha256(publication_plan),
    }
    publication_plan["learningDecisionIds"] = sorted(EXPECTED_LEARNING_DECISION_IDS)

    (promo_dir / "overlay_after.json").write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")
    overlay_path.write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")
    hashes_after = {
        **hashes_before,
        "canonicalAfter": file_sha256(CANONICAL_PATH),
        "overlayAfter": file_sha256(overlay_path),
        "whirlpoolTlOverlayAfter": file_sha256(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_TL_OVERLAY),
        "whirlpoolFlOverlayAfter": file_sha256(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_FL_OVERLAY),
        "samsungFlOverlayAfter": file_sha256(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY),
    }

    checks = {
        "canonicalHashUnchanged": hashes_after["canonicalBefore"] == hashes_after["canonicalAfter"],
        "overlayPublished": overlay_after.get("status") == "published",
        "isLearningEvent": overlay_after.get("compoundingEvidence", {}).get("isLearningEvent") is True,
        "isCertificationFalse": overlay_after.get("compoundingEvidence", {}).get("isCertification") is False,
        "learningDecisionsSix": len(
            overlay_after.get("compoundingEvidence", {}).get("learningDecisions") or []
        )
        == 6,
        "learningDecisionIdsExact": {
            r.get("artifactId")
            for r in overlay_after.get("compoundingEvidence", {}).get("learningDecisions") or []
        }
        == set(EXPECTED_LEARNING_DECISION_IDS),
        "whirlpoolTlOverlayByteStable": hashes_after["whirlpoolTlOverlayBefore"]
        == hashes_after["whirlpoolTlOverlayAfter"],
        "whirlpoolFlOverlayByteStable": hashes_after["whirlpoolFlOverlayBefore"]
        == hashes_after["whirlpoolFlOverlayAfter"],
        "samsungFlOverlayByteStable": hashes_after["samsungFlOverlayBefore"]
        == hashes_after["samsungFlOverlayAfter"],
        "gatePublisherNoFailures": publication_plan.get("summary", {}).get("representationFailures", 1) == 0,
        "procedureBindingsEight": publication_plan["appliedCounts"]["procedureBindings"] == 8,
        "measurementBindingsFive": publication_plan["appliedCounts"]["measurementBindings"] == 5,
        "deferredArtifactsTwelve": publication_plan["appliedCounts"]["deferredArtifacts"] == 12,
    }

    if not all(v is True for v in checks.values()):
        print("FAIL: publication invariant checks", checks, file=sys.stderr)
        if overlay_on_disk_before:
            overlay_path.write_text(json.dumps(overlay_on_disk_before, indent=2), encoding="utf-8")
        elif overlay_path.is_file():
            overlay_path.unlink()
        return 1

    print("==> validate_canonical_graph.py")
    if subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "validate_canonical_graph.py")],
        cwd=ROOT,
        check=False,
    ).returncode != 0:
        _rollback_overlay(overlay_path, overlay_on_disk_before, overlay_existed)
        return 1

    tests = [
        "components/diagnostics/session/__tests__/scenarios/cg5-tl-architecture-boundary.test.ts",
        "components/diagnostics/session/__tests__/scenarios/cg66-whirlpool-tl-certification-closure.test.ts",
        "components/diagnostics/session/__tests__/scenarios/cg67-samsung-tl-a50-promotion-dry-run.test.ts",
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
            _rollback_overlay(overlay_path, overlay_on_disk_before, overlay_existed)
            return 1

    PLAN_PATH.write_text(json.dumps(publication_plan, indent=2), encoding="utf-8")
    hashes_after["publicationPlanAfter"] = file_sha256(PLAN_PATH)

    table["status"] = "published"
    table["publishedAt"] = published_at_iso
    table["promotionId"] = promotion_id
    table["publicationArtifact"] = PUBLICATION_PATH.name
    table["dryRunReportArtifact"] = DRY_RUN_REPORT.name
    TABLE_PATH.write_text(json.dumps(table, indent=2), encoding="utf-8")
    hashes_after["gateTableAfter"] = file_sha256(TABLE_PATH)

    report = {
        "manualId": MANUAL_ID,
        "gateKind": GATE_KIND,
        "promotionId": promotion_id,
        "publishedAt": published_at_iso,
        "publishMode": "gate_table_first_manual_compounding",
        "isLearningEvent": True,
        "isCertification": False,
        "verdict": "PUBLISHED",
        "accounting": ledger.get("accounting"),
        "infrastructureCorrection": ledger.get("infrastructureCorrection"),
        "learningDecisionIds": sorted(EXPECTED_LEARNING_DECISION_IDS),
        "appliedCounts": publication_plan.get("appliedCounts"),
        "publicationChecks": checks,
        "hashes": hashes_after,
        "testResults": test_results,
        "overlayFile": OVERLAY_FILE,
        "gateArtifact": GATE_TABLE_ARTIFACT,
        "ledgerArtifact": LEDGER_ARTIFACT,
        "dryRunReportArtifact": DRY_RUN_REPORT.name,
        "publicationPlanArtifact": PLAN_PATH.name,
        "notes": [
            "First Samsung TL semantic learning event — 6 gated teaching decisions promoted exactly.",
            "WP1.1 +6 inheritance delta is infrastructure correction (zero teaching cost).",
            "Fresh scaffold application — no working-tree overlay edits carried into publication.",
        ],
    }
    PUBLICATION_PATH.write_text(json.dumps(report, indent=2), encoding="utf-8")
    hashes_after["publicationReport"] = file_sha256(PUBLICATION_PATH)

    (PROMOTIONS_DIR / f"{promotion_id}.json").write_text(
        json.dumps(publication_plan, indent=2),
        encoding="utf-8",
    )

    print("\nCG-6.7 Samsung TL A50 publication")
    print("-----------------------------------")
    print("Verdict:                  PUBLISHED")
    print("Canonical rev1:           unchanged")
    print("New overlay decisions:    6")
    print("Canonical expansion:      0")
    print("Infrastructure learning:  0")
    print(f"Learning decision IDs:    {', '.join(sorted(EXPECTED_LEARNING_DECISION_IDS))}")
    print("")
    print(f"promotionId:  {promotion_id}")
    print(f"canonical:    {hashes_after['canonicalAfter']}")
    print(f"overlay:      {hashes_after['overlayAfter']}")
    print(f"gate table:   {hashes_after['gateTableAfter']}")
    print(f"ledger:       {hashes_before['ledgerBefore']}")
    print(f"report:       {PUBLICATION_PATH}")
    return 0


def file_sha256_from_dict(value: dict) -> str:
    payload = json.dumps(value, sort_keys=True, separators=(",", ":"))
    import hashlib

    return hashlib.sha256(payload.encode("utf-8")).hexdigest()


def _rollback_overlay(path: Path, before: dict | None, existed: bool) -> None:
    if before is not None:
        path.write_text(json.dumps(before, indent=2), encoding="utf-8")
    elif path.is_file():
        path.unlink()


if __name__ == "__main__":
    raise SystemExit(main())
