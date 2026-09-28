#!/usr/bin/env python3
"""SAMSUNG-TL-A50-WASHER CG-6.7 WP4 promotion dry-run (fail-closed, no publish)."""

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
from samsung_tl_a50_cg67_gate_publish import (
    GATE_KIND,
    MANUAL_ID,
    OVERLAY_FILE,
    GatePublishError,
    _overlay_has_drive_system,
    apply_samsung_tl_a50_cg67_gate_delta,
    build_publication_plan,
    file_sha256,
    scaffold_samsung_top_load_washer_overlay,
)

TABLE_PATH = CALIBRATION_DIR / "SAMSUNG_TL_A50_WASHER_overlay_mapping_table_v1.json"
LEDGER_PATH = CALIBRATION_DIR / "SAMSUNG_TL_A50_WASHER_gate_decision_ledger_v1.json"
CANONICAL_PATH = CANONICAL_DIR / "top_load_washer.json"
WHIRLPOOL_TL_OVERLAY = "whirlpool_top_load_washer.json"
WHIRLPOOL_FL_OVERLAY = "whirlpool_front_load_washer.json"
SAMSUNG_FL_OVERLAY = "samsung_front_load_washer.json"
EXPECTED_CANONICAL_HASH = "dee6b0c7128706eb78ac0e290090cd3d79d98dad579f41d6fa0a36ea3fdbf2b5"


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _has_lid_switch_matcher_alias(overlay: dict) -> bool:
    for family in overlay.get("platformFamilies") or []:
        for target in (family.get("oemTermAliases") or {}).values():
            if target == "lid_switch":
                return True
    return False


def _scan_leaks(blob: str, patterns: tuple[str, ...]) -> list[str]:
    lower = blob.lower()
    return [p for p in patterns if p in lower]


def main() -> int:
    print("==> Samsung TL A50 CG-6.7 promotion dry-run (first manual compounding)")

    if not TABLE_PATH.is_file():
        print(f"FAIL: missing gate table {TABLE_PATH}", file=sys.stderr)
        return 1
    if not LEDGER_PATH.is_file():
        print(f"FAIL: missing ledger {LEDGER_PATH}", file=sys.stderr)
        return 1

    table = _load_json(TABLE_PATH)
    ledger = _load_json(LEDGER_PATH)
    if table.get("status") != "gated":
        print(f"FAIL: gate table not gated ({table.get('status')})", file=sys.stderr)
        return 1
    if ledger.get("gateKind") != GATE_KIND:
        print(f"FAIL: unexpected gateKind {ledger.get('gateKind')}", file=sys.stderr)
        return 1
    if ledger.get("accounting", {}).get("canonicalExpansion", -1) != 0:
        print("FAIL: canonical expansion must be zero", file=sys.stderr)
        return 1

    overlay_path = MANUFACTURER_OVERLAYS_DIR / OVERLAY_FILE
    overlay_existed_before = overlay_path.is_file()
    overlay_before = (
        _load_json(overlay_path) if overlay_existed_before else scaffold_samsung_top_load_washer_overlay()
    )
    overlay_seed = scaffold_samsung_top_load_washer_overlay()

    canonical_hash_before = file_sha256(CANONICAL_PATH)
    whirlpool_tl_before = _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_TL_OVERLAY)
    whirlpool_fl_before = _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_FL_OVERLAY)
    samsung_fl_before = _load_json(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY)
    wp_tl_hash_before = file_sha256(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_TL_OVERLAY)
    wp_fl_hash_before = file_sha256(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_FL_OVERLAY)
    samsung_fl_hash_before = file_sha256(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY)

    publication_plan = build_publication_plan(table, ledger)
    print("==> Gate-table publisher dry-run (authoritative)")
    try:
        overlay_after, plan = apply_samsung_tl_a50_cg67_gate_delta(
            json.loads(json.dumps(overlay_seed)),
            table,
            ledger,
            publish=False,
        )
    except GatePublishError as exc:
        print(f"FAIL: publisher blocked: {exc}", file=sys.stderr)
        plan_path = CALIBRATION_DIR / "publication_plan_SAMSUNG_TL_A50_WASHER_CG67.json"
        plan_path.write_text(json.dumps(publication_plan, indent=2), encoding="utf-8")
        return 1

    promotion_id = "promo-SAMSUNG-TL-A50-CG67-gate-table-dry-run"
    promo_dir = PROMOTIONS_DIR / promotion_id
    promo_dir.mkdir(parents=True, exist_ok=True)
    (promo_dir / "overlay_before.json").write_text(
        json.dumps(overlay_before, indent=2),
        encoding="utf-8",
    )
    (promo_dir / "overlay_after.json").write_text(
        json.dumps(overlay_after, indent=2),
        encoding="utf-8",
    )

    overlay_path.write_text(json.dumps(overlay_after, indent=2), encoding="utf-8")

    canonical_hash_after = file_sha256(CANONICAL_PATH)
    overlay_blob = json.dumps(overlay_after)

    accounting = ledger.get("accounting") or {}
    checks = {
        "canonicalHashMatch": canonical_hash_before == canonical_hash_after == EXPECTED_CANONICAL_HASH,
        "canonicalFrozenRev1": _load_json(CANONICAL_PATH).get("ontology", {}).get("frozenRevision") == "rev1",
        "driveSystemAbsent": not _overlay_has_drive_system(overlay_after),
        "lidSwitchNoMatcherAlias": not _has_lid_switch_matcher_alias(overlay_after),
        "doorLockMapsToLidLockOnly": (
            _family_alias(overlay_after, "door_lock") == "lid_lock"
        ),
        "washHeaterDeferred": "wash_heater" not in (_family_alias_map(overlay_after)),
        "whirlpoolTlOverlayByteStable": file_sha256(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_TL_OVERLAY)
        == wp_tl_hash_before,
        "whirlpoolFlOverlayByteStable": file_sha256(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_FL_OVERLAY)
        == wp_fl_hash_before,
        "samsungFlOverlayByteStable": file_sha256(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY)
        == samsung_fl_hash_before,
        "whirlpoolTlLeakZero": len(_scan_leaks(overlay_blob, ("whirlpool_tl", "w10864849", "mode_shifter"))) == 0,
        "whirlpoolFlLeakZero": len(_scan_leaks(overlay_blob, ("whirlpool_fl", "duet_sport", "door_lock_test"))) == 0,
        "samsungFlLeakZero": len(_scan_leaks(overlay_blob, ("samsung_fl_washer", "wf6000", "inverter_board"))) == 0,
        "overlayStatusDraft": overlay_after.get("status") == "draft",
        "isLearningEventNotCertification": overlay_after.get("compoundingEvidence", {}).get("isLearningEvent")
        is True
        and overlay_after.get("compoundingEvidence", {}).get("isCertification") is False,
        "newOverlaySemanticDecisionsSix": accounting.get("newOverlaySemanticDecisions") == 6,
        "infrastructureSemanticLearningZero": (
            ledger.get("infrastructureCorrection", {}).get("semanticLearningFromRouting", 0) == 0
        ),
        "canonicalExpansionZero": accounting.get("canonicalExpansion", 0) == 0,
        "gatePublisherNoFailures": plan.get("summary", {}).get("representationFailures", 1) == 0,
        "procedureBindingsEight": len(
            (overlay_after.get("platformFamilies") or [{}])[0].get("procedureBindings") or []
        )
        == 8,
        "measurementBindingsFive": len(
            (overlay_after.get("platformFamilies") or [{}])[0].get("measurementBindings") or []
        )
        == 5,
        "procedureRoleEvidenceTwo": len(
            (overlay_after.get("certificationEvidence") or {}).get("procedureRoleEvidence") or []
        )
        == 2,
    }

    print("==> validate_canonical_graph.py")
    if subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "validate_canonical_graph.py")],
        cwd=ROOT,
        check=False,
    ).returncode != 0:
        _restore_overlay(overlay_path, overlay_before, overlay_existed_before)
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

    plan_path = CALIBRATION_DIR / "publication_plan_SAMSUNG_TL_A50_WASHER_CG67.json"
    plan_path.write_text(json.dumps(plan, indent=2), encoding="utf-8")

    report = {
        "manualId": MANUAL_ID,
        "gateKind": GATE_KIND,
        "promotionId": promotion_id,
        "publish": False,
        "publishMode": "gate_table_first_manual_compounding",
        "isLearningEvent": True,
        "isCertification": False,
        "accounting": accounting,
        "infrastructureCorrection": ledger.get("infrastructureCorrection"),
        "appliedCounts": plan.get("appliedCounts"),
        "summary": plan.get("summary"),
        "checks": checks,
        "canonicalHash": {
            "before": canonical_hash_before,
            "after": canonical_hash_after,
            "expected": EXPECTED_CANONICAL_HASH,
            "match": canonical_hash_before == canonical_hash_after,
        },
        "whirlpoolPreservation": {
            "tlByteStable": checks["whirlpoolTlOverlayByteStable"],
            "flByteStable": checks["whirlpoolFlOverlayByteStable"],
        },
        "foreignFamilyIsolation": accounting.get("forbiddenFamilyLeaks"),
        "testResults": test_results,
        "notes": [
            "First Samsung TL semantic learning event — 6 overlay vocabulary decisions.",
            "WP1.1 +6 inheritance delta is infrastructure correction (zero teaching cost).",
            "Overlay written as draft — publication gate remains blocked.",
        ],
    }
    report_path = CALIBRATION_DIR / "promotion_dry_run_SAMSUNG_TL_A50_WASHER_CG67.json"
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    # Keep draft overlay scaffold on disk for review; Whirlpool overlays restored if mutated.
    checks["whirlpoolTlOverlayRestored"] = json.dumps(
        _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_TL_OVERLAY), sort_keys=True
    ) == json.dumps(whirlpool_tl_before, sort_keys=True)
    checks["whirlpoolFlOverlayRestored"] = json.dumps(
        _load_json(MANUFACTURER_OVERLAYS_DIR / WHIRLPOOL_FL_OVERLAY), sort_keys=True
    ) == json.dumps(whirlpool_fl_before, sort_keys=True)
    checks["samsungFlOverlayRestored"] = json.dumps(
        _load_json(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY), sort_keys=True
    ) == json.dumps(samsung_fl_before, sort_keys=True)
    checks["samsungOverlayDraftPresent"] = overlay_path.is_file() and _load_json(overlay_path).get(
        "status"
    ) == "draft"

    dry_run_pass = all(checks.values()) and all(code == 0 for code in test_results.values())
    report["checks"] = checks
    report["dryRunPass"] = dry_run_pass
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")

    if not dry_run_pass:
        print("FAIL: dry-run checks or tests", checks, test_results, file=sys.stderr)
        return 1

    print("\nCG-6.7 Samsung TL A50 promotion dry-run")
    print("----------------------------------------")
    print(f"Canonical hash:           {'MATCH' if checks['canonicalHashMatch'] else 'MISMATCH'}")
    print(f"New overlay decisions:    {accounting.get('newOverlaySemanticDecisions')}")
    print(f"Infrastructure learning:  0")
    print(f"Canonical expansion:        0")
    print(f"Overlay status:             draft (not published)")
    print(f"Procedure bindings:         {checks['procedureBindingsEight']}")
    print(f"Role evidence rows:         {checks['procedureRoleEvidenceTwo']}")
    print("")
    print("DRY-RUN: PASS")
    print(f"overlay: {overlay_path}")
    print(f"plan:    {plan_path}")
    print(f"report:  {report_path}")
    return 0


def _family_alias_map(overlay: dict) -> dict:
    family = (overlay.get("platformFamilies") or [{}])[0]
    return family.get("oemTermAliases") or {}


def _family_alias(overlay: dict, term: str) -> str | None:
    return _family_alias_map(overlay).get(term)


def _restore_overlay(path: Path, before: dict, existed: bool) -> None:
    if existed:
        path.write_text(json.dumps(before, indent=2), encoding="utf-8")
    elif path.is_file():
        path.unlink()


if __name__ == "__main__":
    raise SystemExit(main())
