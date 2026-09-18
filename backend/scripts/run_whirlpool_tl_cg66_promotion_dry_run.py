#!/usr/bin/env python3
"""Whirlpool TL CG-6.6 certification dry-run (fail-closed, no publish)."""

from __future__ import annotations

import json
import shutil
import subprocess
import sys
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
    apply_whirlpool_tl_cg66_gate_delta,
    build_publication_plan,
    file_sha256,
    verify_canonical_contract,
)

OVERLAY_FILE = "whirlpool_top_load_washer.json"
TABLE_PATH = CALIBRATION_DIR / GATE_TABLE_ARTIFACT
LEDGER_PATH = CALIBRATION_DIR / LEDGER_ARTIFACT
CANONICAL_PATH = CANONICAL_DIR / "top_load_washer.json"
FL_OVERLAY = "whirlpool_front_load_washer.json"
SAMSUNG_FL_OVERLAY = "samsung_front_load_washer.json"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _overlay_semantic_bytes(overlay: dict) -> str:
    families = overlay.get("platformFamilies") or []
    return json.dumps(families, sort_keys=True)


def _scan_fl_leakage(overlay: dict) -> list[str]:
    leaks: list[str] = []
    fl_patterns = (
        "front_load",
        "duet_sport",
        "wfw83",
        "wfw85",
        "door_lock_test",
        "pressure_switch",
    )
    blob = json.dumps(overlay).lower()
    for pattern in fl_patterns:
        if pattern in blob:
            leaks.append(pattern)
    return leaks


def _has_lid_switch_matcher_alias(overlay: dict) -> bool:
    for family in overlay.get("platformFamilies") or []:
        for target in (family.get("oemTermAliases") or {}).values():
            if target == "lid_switch":
                return True
    return False


def _scan_samsung_leakage(overlay: dict) -> list[str]:
    leaks: list[str] = []
    samsung_patterns = ("samsung", "samsungtl", "wa50", "dv50")
    blob = json.dumps(overlay).lower()
    for pattern in samsung_patterns:
        if pattern in blob:
            leaks.append(pattern)
    return leaks


def main() -> int:
    print("==> Whirlpool TL CG-6.6 certification dry-run")

    if not TABLE_PATH.exists():
        print(f"FAIL: missing gate table {TABLE_PATH}", file=sys.stderr)
        return 1
    if not LEDGER_PATH.exists():
        print(f"FAIL: missing ledger {LEDGER_PATH}", file=sys.stderr)
        return 1

    table = _load_json(TABLE_PATH)
    ledger = _load_json(LEDGER_PATH)
    if table.get("status") != "gated":
        print(f"FAIL: gate table not gated ({table.get('status')})", file=sys.stderr)
        return 1
    if ledger.get("accounting", {}).get("newSemanticDecisions", -1) != 0:
        print("FAIL: ledger reports new semantic decisions", file=sys.stderr)
        return 1

    canonical_before = _load_json(CANONICAL_PATH)
    canonical_hash_before = file_sha256(CANONICAL_PATH)
    overlay_before = load_overlay_file(OVERLAY_FILE)
    overlay_semantic_before = _overlay_semantic_bytes(overlay_before)

    fl_before = _load_json(MANUFACTURER_OVERLAYS_DIR / FL_OVERLAY)
    samsung_fl_before = _load_json(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY)
    fl_hash_before = file_sha256(MANUFACTURER_OVERLAYS_DIR / FL_OVERLAY)
    samsung_fl_hash_before = file_sha256(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY)

    publication_plan = build_publication_plan(table, ledger)
    expected = table.get("expectedPublicationCounts") or {}

    print("==> Gate-table certification publisher dry-run (authoritative)")
    try:
        overlay_after, plan = apply_whirlpool_tl_cg66_gate_delta(
            json.loads(json.dumps(overlay_before)),
            table,
            publish=False,
            canonical_before=canonical_before,
            canonical_after=canonical_before,
        )
    except GatePublishError as exc:
        print(f"FAIL: certification publisher blocked: {exc}", file=sys.stderr)
        plan_path = CALIBRATION_DIR / "publication_plan_WHIRLPOOL_TOP_LOAD_WASHER_CG66.json"
        plan_path.write_text(json.dumps(publication_plan, indent=2), encoding="utf-8")
        return 1

    overlay_path = MANUFACTURER_OVERLAYS_DIR / OVERLAY_FILE
    promotion_id = "promo-WHIRLPOOL-TL-CG66-gate-table-dry-run"
    promo_dir = PROMOTIONS_DIR / promotion_id
    promo_dir.mkdir(parents=True, exist_ok=True)
    shutil.copy2(overlay_path, promo_dir / "overlay_before.json")
    (promo_dir / "overlay_after.json").write_text(
        json.dumps(overlay_after, indent=2),
        encoding="utf-8",
    )

    overlay_path.write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")

    canonical_after = _load_json(CANONICAL_PATH)
    canonical_hash_after = file_sha256(CANONICAL_PATH)
    fl_after = _load_json(MANUFACTURER_OVERLAYS_DIR / FL_OVERLAY)
    samsung_fl_after = _load_json(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY)

    contract_checks = verify_canonical_contract(canonical_after, table)
    overlay_semantic_after = _overlay_semantic_bytes(overlay_after)

    gate_intent = plan["gateIntent"]
    gate_intent_total = gate_intent["counts"]["totalCertified"]
    ledger_accounting = ledger.get("accounting") or {}

    gate_artifacts_applied = gate_intent_total
    gate_artifacts_dropped = max(0, gate_intent_total - plan["summary"]["publisherAppliedTotal"])

    checks = {
        "canonicalHashMatch": canonical_hash_before == canonical_hash_after,
        "canonicalFrozenRev1": contract_checks["frozen"] and contract_checks["frozenRevisionRev1"],
        "canonicalComponentSet17": contract_checks["componentCount17"]
        and contract_checks["componentSetMatchesContract"],
        "driveSystemAbsent": contract_checks["driveSystemAbsent"]
        and contract_checks["noDriveSystemInRelationships"],
        "lidSwitchConditionalNoMatcherAlias": contract_checks["lidSwitchConditional"]
        and not _has_lid_switch_matcher_alias(overlay_after),
        "overlaySemanticUnchanged": overlay_semantic_before == overlay_semantic_after,
        "whirlpoolTlKnowledgePreserved": overlay_semantic_before == overlay_semantic_after,
        "flOverlayByteStable": file_sha256(MANUFACTURER_OVERLAYS_DIR / FL_OVERLAY) == fl_hash_before,
        "samsungFlOverlayByteStable": file_sha256(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY)
        == samsung_fl_hash_before,
        "flLeakageZero": len(_scan_fl_leakage(overlay_after)) == 0,
        "samsungLeakageZero": len(_scan_samsung_leakage(overlay_after)) == 0,
        "gateTableFullyApplied": plan["summary"]["representationFailures"] == 0
        and not plan.get("publishBlocked"),
        "gatePublicationDriftZero": gate_artifacts_dropped == 0,
        "newSemanticDecisionsZero": ledger_accounting.get("newSemanticDecisions", 0) == 0,
        "canonicalExpansionZero": ledger_accounting.get("canonicalExpansion", 0) == 0,
        "canonicalMutationsZero": plan["appliedCounts"]["canonicalMutations"] == 0,
        "procedureBindingsMatchExpected": plan["appliedCounts"]["procedureBindings"]
        == expected.get("procedureBindings", 12),
        "measurementBindingsMatchExpected": plan["appliedCounts"]["measurementBindings"]
        == expected.get("measurementBindings", 18),
        "procedureRoleEvidenceMatchExpected": plan["appliedCounts"]["procedureRoleEvidence"]
        == expected.get("procedureRoleEvidence", 6),
        "oemAliasMappingsMatchExpected": plan["appliedCounts"]["oemAliasMappings"]
        == expected.get("oemAliasMappings", 49),
        "ledgerCertificationAccounting": (
            ledger_accounting.get("certificationDecisions", 0) == 35
            and ledger_accounting.get("inheritedKnowledge", 0) == 50
            and ledger_accounting.get("deferredArtifacts", 0) == 17
            and ledger_accounting.get("contractRejections", 0) == 2
        ),
    }

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

    plan_path = CALIBRATION_DIR / "publication_plan_WHIRLPOOL_TOP_LOAD_WASHER_CG66.json"
    plan_path.write_text(json.dumps(plan, indent=2), encoding="utf-8")

    report = {
        "manualIds": MANUAL_IDS,
        "gateKind": GATE_KIND,
        "promotionId": promotion_id,
        "publish": False,
        "publishMode": "gate_table_certification",
        "certificationAccounting": ledger_accounting,
        "expectedPublicationCounts": expected,
        "appliedCounts": plan["appliedCounts"],
        "summary": plan["summary"],
        "checks": checks,
        "contractChecks": contract_checks,
        "canonicalHash": {
            "before": canonical_hash_before,
            "after": canonical_hash_after,
            "match": canonical_hash_before == canonical_hash_after,
        },
        "flPreservation": {
            "byteStable": checks["flOverlayByteStable"],
            "leakage": _scan_fl_leakage(overlay_after),
        },
        "samsungPreservation": {
            "byteStable": checks["samsungFlOverlayByteStable"],
            "leakage": _scan_samsung_leakage(overlay_after),
        },
        "testResults": test_results,
        "notes": [
            "CG-6.6 certification — metadata-only publisher; semantic overlay unchanged.",
            "Gate table authoritative; ledger audit-only.",
            "Any canonical mutation would fail closed — not auto-fixed.",
        ],
    }
    report_path = CALIBRATION_DIR / "promotion_dry_run_WHIRLPOOL_TOP_LOAD_WASHER_CG66.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    overlay_path.write_text(json.dumps(overlay_before, indent=2), encoding="utf-8")
    checks["overlayRestoredAfterDryRun"] = (
        json.dumps(_load_json(overlay_path), sort_keys=True)
        == json.dumps(overlay_before, sort_keys=True)
    )
    checks["flOverlayRestored"] = json.dumps(fl_before, sort_keys=True) == json.dumps(
        _load_json(MANUFACTURER_OVERLAYS_DIR / FL_OVERLAY), sort_keys=True
    )
    checks["samsungFlOverlayRestored"] = json.dumps(samsung_fl_before, sort_keys=True) == json.dumps(
        _load_json(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY), sort_keys=True
    )

    certification_pass = all(checks.values()) and all(code == 0 for code in test_results.values())

    if not certification_pass:
        print("FAIL: certification checks or tests", checks, test_results, file=sys.stderr)
        return 1

    print("\nCG-6.6 certification")
    print("------------------------")
    print(f"Canonical mutation:       {plan['appliedCounts']['canonicalMutations']}")
    print(f"New semantic knowledge:   {ledger_accounting.get('newSemanticDecisions', 0)}")
    print(f"Existing knowledge lost:  0")
    print(f"Contract violations:      0")
    print(f"Gate artifacts applied:   {gate_artifacts_applied}")
    print(f"Gate artifacts dropped:   {gate_artifacts_dropped}")
    print(f"Gate/publication drift:   {gate_artifacts_dropped}")
    print(
        f"Canonical hash:          {'MATCH' if checks['canonicalHashMatch'] else 'MISMATCH'}"
    )
    print(
        f"Frozen revision:         {canonical_after.get('ontology', {}).get('frozenRevision', '?')}"
    )
    print(f"FL leakage:              {len(_scan_fl_leakage(overlay_after))}")
    print(f"Samsung leakage:         {len(_scan_samsung_leakage(overlay_after))}")
    print("")
    print("CERTIFICATION: PASS")
    print(f"plan:   {plan_path}")
    print(f"report: {report_path}")
    print(f"ledger: {LEDGER_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
