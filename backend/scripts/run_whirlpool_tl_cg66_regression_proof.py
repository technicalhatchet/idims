#!/usr/bin/env python3
"""WP5 — read-only regression/isolation proof for CG-6.6 Whirlpool TL certification."""

from __future__ import annotations

import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.paths import CALIBRATION_DIR, CANONICAL_DIR, MANUFACTURER_OVERLAYS_DIR
from whirlpool_tl_cg66_gate_publish import (
    GATE_TABLE_ARTIFACT,
    LEDGER_ARTIFACT,
    _overlay_semantic_snapshot,
    file_sha256,
    json_sha256,
)

EXPECTED_CANONICAL_HASH = "dee6b0c7128706eb78ac0e290090cd3d79d98dad579f41d6fa0a36ea3fdbf2b5"
EVIDENCE_PATH = CALIBRATION_DIR / "WHIRLPOOL_TOP_LOAD_WASHER_CG66_CERTIFICATION_EVIDENCE_v1.json"
CLOSURE_PATH = CALIBRATION_DIR / "CG66_WHIRLPOOL_TOP_LOAD_WASHER_FAMILY_LOCK_v1.json"
PROOF_PATH = CALIBRATION_DIR / "WHIRLPOOL_TOP_LOAD_WASHER_CG66_REGRESSION_PROOF_v1.json"
OVERLAY_FILE = "whirlpool_top_load_washer.json"
FL_OVERLAY = "whirlpool_front_load_washer.json"
SAMSUNG_FL_OVERLAY = "samsung_front_load_washer.json"
PUBLICATION_PATH = CALIBRATION_DIR / "publication_WHIRLPOOL_TOP_LOAD_WASHER_CG66.json"
PLAN_PATH = CALIBRATION_DIR / "publication_plan_WHIRLPOOL_TOP_LOAD_WASHER_CG66.json"
DRY_RUN_PATH = CALIBRATION_DIR / "promotion_dry_run_WHIRLPOOL_TOP_LOAD_WASHER_CG66.json"
TABLE_PATH = CALIBRATION_DIR / GATE_TABLE_ARTIFACT
LEDGER_PATH = CALIBRATION_DIR / LEDGER_ARTIFACT
CANONICAL_PATH = CANONICAL_DIR / "top_load_washer.json"

CERTIFICATION_STATEMENT = (
    "Previously published Whirlpool TL overlay knowledge was retroactively certified "
    "against the frozen top_load_washer rev1 canonical contract."
)

WHIRLPOOL_TL_SMOKE = {
    "W10864849": {"model": "WTW9500", "platformId": "whirlpool_tl_dd", "familyId": "whirlpool_tl_dd_direct_drive"},
    "W11697231": {"model": "WTW4950", "platformId": "whirlpool_tl_dd", "familyId": "whirlpool_tl_dd_direct_drive"},
    "W11416787": {"model": "WTW5100", "platformId": "whirlpool_tl_dd_5100", "familyId": "whirlpool_tl_dd_5100_direct_drive"},
}

OVERLAY_ONLY_IDS = {
    "mode_shifter",
    "splutch",
    "clutch",
    "gearcase",
    "recirc_pump",
    "bulk_level_switch",
    "pressure_sensor",
    "wash_ntc",
    "supply",
    "wash_heater",
}

FL_LEAK_PATTERNS = (
    "w8178558",
    "w11169652",
    "door_lock_test",
    "whirlpool_duet_sport",
    "front_load",
    "pressure_switch",
)

SAMSUNG_LEAK_PATTERNS = (
    "samsungtla50",
    "samsungtlcg71",
    "samsung_fl_washer",
    "wf45t6000",
    "wa50r",
)

SAMSUNG_TL_LEAK_PATTERNS = (
    "samsungtla50",
    "samsungtlcg71",
    "wa50r",
    "wa55cg",
)


def _load_json(path: Path) -> dict:
    return json.loads(path.read_text(encoding="utf-8"))


def _scan_leakage(blob: str, patterns: tuple[str, ...]) -> list[str]:
    lower = blob.lower()
    return [p for p in patterns if p in lower]


def _overlay_semantic_hash(overlay: dict) -> str:
    return json_sha256(_overlay_semantic_snapshot(overlay))


def _collect_overlay_component_ids(overlay: dict) -> set[str]:
    ids: set[str] = set()
    for family in overlay.get("platformFamilies") or []:
        for component in (family.get("add") or {}).get("components") or []:
            if component.get("id"):
                ids.add(component["id"])
    return ids


def _has_lid_switch_matcher_alias(overlay: dict) -> bool:
    for family in overlay.get("platformFamilies") or []:
        for target in (family.get("oemTermAliases") or {}).values():
            if target == "lid_switch":
                return True
    return False


def _question_canonical_integrity(canonical: dict) -> dict:
    component_ids = sorted(c.get("id") for c in canonical.get("components") or [] if c.get("id"))
    ontology = canonical.get("ontology") or {}
    canonical_hash = file_sha256(CANONICAL_PATH)
    checks = {
        "hashEqualsExpected": canonical_hash == EXPECTED_CANONICAL_HASH,
        "frozenTrue": ontology.get("frozen") is True,
        "frozenRevisionRev1": ontology.get("frozenRevision") == "rev1",
        "componentCount17": len(component_ids) == 17,
        "driveSystemAbsent": "drive_system" not in component_ids,
        "transmissionOrShifterPresent": "transmission_or_shifter" in component_ids,
        "lidSwitchConditional": any(
            c.get("id") == "lid_switch" and c.get("canonicalStatus") == "conditional"
            for c in canonical.get("components") or []
        ),
        "noDriveSystemRelationships": not any(
            rel.get("from") == "drive_system" or rel.get("to") == "drive_system"
            for rel in canonical.get("relationships") or []
        ),
    }
    return {
        "question": "Canonical integrity",
        "pass": all(checks.values()),
        "checks": checks,
        "canonicalHash": canonical_hash,
    }


def _question_whirlpool_tl_integrity(overlay: dict, canonical: dict) -> dict:
    canonical_ids = {c["id"] for c in canonical.get("components") or [] if c.get("id")}
    overlay_components = _collect_overlay_component_ids(overlay)
    overlay_only_present = OVERLAY_ONLY_IDS.intersection(overlay_components)
    families = {f["platformFamilyId"]: f for f in overlay.get("platformFamilies") or []}

    manual_bindings: dict[str, list[str]] = {}
    for manual_id, smoke in WHIRLPOOL_TL_SMOKE.items():
        family = families.get(smoke["familyId"])
        proc_prefix = f"w{manual_id[1:].lower()}"
        bindings = [
            b["procedureId"]
            for b in (family or {}).get("procedureBindings") or []
            if str(b.get("procedureId", "")).startswith(proc_prefix)
        ]
        manual_bindings[manual_id] = bindings

    checks = {
        "overlayPublished": overlay.get("status") == "published",
        "gateArtifactAttached": overlay.get("gateArtifact") == GATE_TABLE_ARTIFACT,
        "ledgerArtifactAttached": overlay.get("certificationLedgerArtifact") == LEDGER_ARTIFACT,
        "twoPlatformFamilies": len(families) == 2,
        "w10864849FamilyResolvable": "whirlpool_tl_dd_direct_drive" in families,
        "w11697231SharesDdFamily": manual_bindings.get("W11697231", []) != [],
        "w11416787FamilyResolvable": "whirlpool_tl_dd_5100_direct_drive" in families,
        "w10864849BindingsPresent": len(manual_bindings.get("W10864849", [])) >= 6,
        "w11697231BindingsPresent": len(manual_bindings.get("W11697231", [])) >= 6,
        "w11416787BindingsPresent": len(manual_bindings.get("W11416787", [])) >= 6,
        "transmissionOrShifterCanonical": "transmission_or_shifter" in canonical_ids,
        "modeShifterOverlayOnly": "mode_shifter" in overlay_components
        and "mode_shifter" not in canonical_ids,
        "overlayOnlyComponentsRemainOverlayLevel": overlay_only_present.issuperset(
            {"mode_shifter", "bulk_level_switch"}
        ),
        "shifterAliasMapsToModeShifter": any(
            target == "mode_shifter"
            for term, target in (families.get("whirlpool_tl_dd_direct_drive", {}) or {})
            .get("oemTermAliases", {})
            .items()
            if "3a" in term and "shifter" in term.lower()
        ),
    }
    return {
        "question": "Whirlpool TL integrity",
        "pass": all(checks.values()),
        "checks": checks,
        "manualProcedureBindings": {k: len(v) for k, v in manual_bindings.items()},
        "overlayOnlyComponentsPresent": sorted(overlay_only_present),
    }


def _question_authorization_semantics(overlay: dict, canonical: dict) -> dict:
    evidence = overlay.get("certificationEvidence") or {}
    role_evidence = evidence.get("procedureRoleEvidence") or []
    lid_switch_roles = [
        e for e in role_evidence if "lid_switch" in (e.get("canonicalComponents") or [])
    ]
    families = overlay.get("platformFamilies") or []
    lid_lock_bindings = []
    for family in families:
        for binding in family.get("procedureBindings") or []:
            if binding.get("testTargetId") == "lid_lock_test":
                lid_lock_bindings.append(binding["procedureId"])

    checks = {
        "lidSwitchConditionalInCanonical": any(
            c.get("id") == "lid_switch" and c.get("canonicalStatus") == "conditional"
            for c in canonical.get("components") or []
        ),
        "procedureRoleEvidenceResolvesLidSwitch": len(lid_switch_roles) >= 1,
        "noLidSwitchMatcherAlias": not _has_lid_switch_matcher_alias(overlay),
        "doorLockAliasMapsToLidLock": all(
            (family.get("oemTermAliases") or {}).get("door_lock") == "lid_lock"
            for family in families
            if "door_lock" in (family.get("oemTermAliases") or {})
        ),
        "lidLockTestTargetOnLidProcedures": len(lid_lock_bindings) >= 3,
        "lidLockNotLidSwitchTest": all(
            binding.get("testTargetId") != "lid_switch_test"
            for family in families
            for binding in family.get("procedureBindings") or []
            if "lid" in str(binding.get("procedureId", "")).lower()
        ),
    }
    return {
        "question": "Authorization semantics",
        "pass": all(checks.values()),
        "checks": checks,
        "lidSwitchProcedureRoleCount": len(lid_switch_roles),
        "lidLockProcedureBindings": lid_lock_bindings,
    }


def _question_cross_family_isolation(overlay: dict) -> dict:
    overlay_blob = json.dumps(overlay)
    fl_overlay = _load_json(MANUFACTURER_OVERLAYS_DIR / FL_OVERLAY)
    samsung_fl_overlay = _load_json(MANUFACTURER_OVERLAYS_DIR / SAMSUNG_FL_OVERLAY)
    fl_blob = json.dumps(fl_overlay)
    samsung_fl_blob = json.dumps(samsung_fl_overlay)

    whirlpool_tl_leaks_in_fl = _scan_leakage(fl_blob, ("w10864849", "w11697231", "w11416787", "mode_shifter"))
    whirlpool_tl_leaks_in_samsung_fl = _scan_leakage(
        samsung_fl_blob, ("w10864849", "w11697231", "w11416787", "mode_shifter")
    )
    fl_leaks_in_tl = _scan_leakage(overlay_blob, FL_LEAK_PATTERNS)
    samsung_fl_leaks_in_tl = _scan_leakage(overlay_blob, SAMSUNG_LEAK_PATTERNS)
    samsung_tl_leaks_in_tl = _scan_leakage(overlay_blob, SAMSUNG_TL_LEAK_PATTERNS)

    checks = {
        "flLeakageInWhirlpoolTlZero": len(fl_leaks_in_tl) == 0,
        "samsungFlLeakageInWhirlpoolTlZero": len(samsung_fl_leaks_in_tl) == 0,
        "samsungTlLeakageInWhirlpoolTlZero": len(samsung_tl_leaks_in_tl) == 0,
        "whirlpoolTlNotLeakedIntoFl": len(whirlpool_tl_leaks_in_fl) == 0,
        "whirlpoolTlNotLeakedIntoSamsungFl": len(whirlpool_tl_leaks_in_samsung_fl) == 0,
        "flOverlayIndependentOntology": fl_overlay.get("canonicalOntologyId") == "front_load_washer",
        "whirlpoolTlOverlayOntology": overlay.get("canonicalOntologyId") == "top_load_washer",
    }
    return {
        "question": "Cross-family isolation",
        "pass": all(checks.values()),
        "checks": checks,
        "leakage": {
            "flInWhirlpoolTl": fl_leaks_in_tl,
            "samsungFlInWhirlpoolTl": samsung_fl_leaks_in_tl,
            "samsungTlInWhirlpoolTl": samsung_tl_leaks_in_tl,
            "whirlpoolTlInFl": whirlpool_tl_leaks_in_fl,
            "whirlpoolTlInSamsungFl": whirlpool_tl_leaks_in_samsung_fl,
        },
    }


def _question_evidence_lock_integrity(overlay: dict, evidence: dict) -> dict:
    recomputed = {
        "canonical": file_sha256(CANONICAL_PATH),
        "gateTable": file_sha256(TABLE_PATH),
        "ledger": file_sha256(LEDGER_PATH),
        "publicationPlan": file_sha256(PLAN_PATH),
        "dryRunReport": file_sha256(DRY_RUN_PATH),
        "publicationReport": file_sha256(PUBLICATION_PATH),
        "overlaySemantic": _overlay_semantic_hash(overlay),
    }
    locked = evidence.get("hashes") or {}
    publication = evidence.get("publication") or {}
    overlay_promotion = overlay.get("certificationPromotionId")
    publication_report = _load_json(PUBLICATION_PATH)

    hash_match = {
        artifact_key: recomputed[artifact_key] == locked.get(locked_key)
        for artifact_key, locked_key in (
            ("canonical", "canonical"),
            ("gateTable", "gateTable"),
            ("ledger", "ledger"),
            ("publicationPlan", "publicationPlan"),
            ("dryRunReport", "dryRunReport"),
            ("publicationReport", "publicationReport"),
        )
    }
    hash_match["overlaySemantic"] = (
        recomputed["overlaySemantic"] == locked.get("overlaySemanticBefore")
        and recomputed["overlaySemantic"] == locked.get("overlaySemanticAfter")
    )

    checks = {
        "evidenceStatusLocked": evidence.get("status") == "locked",
        "evidenceVerdictCertified": evidence.get("verdict") == "CERTIFIED",
        "allHashesMatch": all(hash_match.values()),
        "promotionIdMatchesOverlay": overlay_promotion == publication.get("promotionId"),
        "promotionIdMatchesPublicationReport": overlay_promotion
        == publication_report.get("promotionId"),
        "overlayGateArtifactMatchesEvidence": overlay.get("gateArtifact")
        == publication.get("gateArtifact"),
        "certifiedArtifactsRepresented85": evidence.get("counts", {}).get(
            "certifiedArtifactsRepresented"
        )
        == 85,
        "cg66TeachingCostZero": evidence.get("cg66TeachingCost") == 0,
    }
    return {
        "question": "Evidence-lock integrity",
        "pass": all(checks.values()),
        "checks": checks,
        "recomputedHashes": recomputed,
        "lockedHashes": locked,
        "hashMatch": hash_match,
        "attachedPromotionId": overlay_promotion,
        "lockedPromotionId": publication.get("promotionId"),
    }


def _write_closure_lock(
    *,
    proof: dict,
    evidence: dict,
    published_at: str,
) -> None:
    closure = {
        "schemaVersion": "1.0.0",
        "reportType": "cg66_whirlpool_top_load_washer_family_lock",
        "status": "closed_certified",
        "lockedAt": published_at,
        "phase": "CG-6.6",
        "verdict": "CLOSED / CERTIFIED",
        "certificationStatement": CERTIFICATION_STATEMENT,
        "notACompoundingClaim": (
            "This closure certifies existing published overlay knowledge against rev1. "
            "It is not a claim that three Whirlpool manuals compounded into rev1."
        ),
        "canonicalOntology": {
            "id": "top_load_washer",
            "frozenRevision": "rev1",
            "hash": EXPECTED_CANONICAL_HASH,
            "file": "frontend/components/diagnostics/knowledge/canonical/top_load_washer.json",
        },
        "manufacturer": {
            "name": "Whirlpool",
            "overlayFile": OVERLAY_FILE,
            "platformFamilies": [
                "whirlpool_tl_dd_direct_drive",
                "whirlpool_tl_dd_5100_direct_drive",
            ],
            "certifiedManuals": [
                {"manualId": "W10864849", "historicalNewDecisions": 14},
                {"manualId": "W11697231", "historicalNewDecisions": 0},
                {"manualId": "W11416787", "historicalNewDecisions": 2},
            ],
            "cg66TeachingCost": 0,
        },
        "demonstratedProperties": [
            "canonical_stability — top_load_washer rev1 frozen; zero expansion through certification",
            "retroactive_certification — existing overlay certified without reopening historical compounding",
            "metadata_only_publish — overlay semantic content unchanged; certification provenance attached",
            "authorization_semantics — lid_switch conditional via procedure-role evidence; lid_lock spin-safety path",
            "cross_family_isolation — zero FL/Samsung TL leakage into Whirlpool TL overlay",
        ],
        "evidenceArtifacts": [
            EVIDENCE_PATH.name,
            PROOF_PATH.name,
            PUBLICATION_PATH.name,
            PLAN_PATH.name,
            DRY_RUN_PATH.name,
            GATE_TABLE_ARTIFACT,
            LEDGER_ARTIFACT,
        ],
        "regressionProof": {
            "artifact": PROOF_PATH.name,
            "allQuestionsPass": proof.get("verdict") == "PASS",
        },
        "nextWork": {
            "family": "Samsung top-load washer",
            "approach": "independent_manufacturer_boundary_test",
            "note": (
                "Samsung TL must not inherit Whirlpool TL merely because appliance category matches. "
                "Begin as independent manufacturer-boundary test."
            ),
        },
    }
    CLOSURE_PATH.write_text(json.dumps(closure, indent=2), encoding="utf-8")


def main() -> int:
    print("==> CG-6.6 WP5 regression/isolation proof (read-only)")

    for path in (
        EVIDENCE_PATH,
        TABLE_PATH,
        LEDGER_PATH,
        PLAN_PATH,
        PUBLICATION_PATH,
        DRY_RUN_PATH,
        CANONICAL_PATH,
        MANUFACTURER_OVERLAYS_DIR / OVERLAY_FILE,
    ):
        if not path.exists():
            print(f"FAIL: missing required artifact {path}", file=sys.stderr)
            return 1

    canonical = _load_json(CANONICAL_PATH)
    overlay = _load_json(MANUFACTURER_OVERLAYS_DIR / OVERLAY_FILE)
    evidence = _load_json(EVIDENCE_PATH)

    q1 = _question_canonical_integrity(canonical)
    q2 = _question_whirlpool_tl_integrity(overlay, canonical)
    q3 = _question_authorization_semantics(overlay, canonical)
    q4 = _question_cross_family_isolation(overlay)
    q5 = _question_evidence_lock_integrity(overlay, evidence)

    print("==> validate_canonical_graph.py")
    validate_rc = subprocess.run(
        [sys.executable, str(SCRIPTS_DIR / "validate_canonical_graph.py")],
        cwd=ROOT,
        check=False,
    ).returncode

    tests = [
        "components/diagnostics/session/__tests__/scenarios/cg5-tl-architecture-boundary.test.ts",
        "components/diagnostics/session/__tests__/scenarios/tl-washer-torture.test.ts",
        "components/diagnostics/session/__tests__/scenarios/cg66-whirlpool-tl-certification-closure.test.ts",
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

    questions = {
        "canonicalIntegrity": q1,
        "whirlpoolTlIntegrity": q2,
        "authorizationSemantics": q3,
        "crossFamilyIsolation": q4,
        "evidenceLockIntegrity": q5,
    }
    all_questions_pass = all(q["pass"] for q in questions.values())
    all_tests_pass = all(code == 0 for code in test_results.values()) and validate_rc == 0
    verdict = "PASS" if all_questions_pass and all_tests_pass else "FAIL"

    proved_at = datetime.now(timezone.utc).isoformat()
    proof = {
        "schemaVersion": "1.0.0",
        "reportType": "cg66_whirlpool_tl_regression_proof",
        "status": "closed_certified" if verdict == "PASS" else "failed",
        "verdict": verdict,
        "provedAt": proved_at,
        "certificationStatement": CERTIFICATION_STATEMENT,
        "notACompoundingClaim": (
            "Three Whirlpool manuals did not compound into rev1 during CG-6.6. "
            "Existing published overlay knowledge was retroactively certified."
        ),
        "questions": questions,
        "testResults": test_results,
        "validateCanonicalGraphExitCode": validate_rc,
        "counts": evidence.get("counts"),
        "cg66TeachingCost": 0,
    }
    PROOF_PATH.write_text(json.dumps(proof, indent=2), encoding="utf-8")

    if verdict == "PASS":
        _write_closure_lock(proof=proof, evidence=evidence, published_at=proved_at)

    if verdict != "PASS":
        print("FAIL: WP5 regression proof", file=sys.stderr)
        for name, q in questions.items():
            if not q["pass"]:
                print(f"  {name}: {q['checks']}", file=sys.stderr)
        print(f"  tests: {test_results}", file=sys.stderr)
        return 1

    print("\nCG-6.6 — WHIRLPOOL TOP-LOAD WASHER: CLOSED / CERTIFIED")
    print("--------------------------------------------------------")
    print(CERTIFICATION_STATEMENT)
    print("")
    print(f"Canonical hash:     {q1['canonicalHash'][:8]}... (unchanged)")
    print(f"Overlay semantic:   {q5['recomputedHashes']['overlaySemantic'][:8]}... (unchanged)")
    print(f"Promotion ID:       {q5['attachedPromotionId']}")
    print(f"Certified artifacts: 85 (represented, not added)")
    print(f"CG-6.6 teaching cost: 0")
    print("")
    print("WP5 questions:      5/5 PASS")
    print(f"proof:              {PROOF_PATH}")
    print(f"closure:            {CLOSURE_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
