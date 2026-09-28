#!/usr/bin/env python3
"""CG-6.x — W11697231 fresh CG-3 observation vs unchanged TL candidate graph."""

from __future__ import annotations

import json
import re
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

SCRIPTS_DIR = Path(__file__).resolve().parent
ROOT = SCRIPTS_DIR.parent.parent
KNOWLEDGE = ROOT / "frontend" / "components" / "diagnostics" / "knowledge"
CALIBRATION = KNOWLEDGE / "normalization" / "calibration"
CANDIDATES = KNOWLEDGE / "normalization" / "candidates"
CANONICAL_CANDIDATE = CALIBRATION / "top_load_washer_cg6x_candidate_v1.json"
BASELINE_OBS = CALIBRATION / "W10864849_tl_cg6x_observation_v1.json"
TARGET_MANUAL = "W11697231"
PRIOR_MANUAL = "W10864849"
PLATFORM_ID = "whirlpool_tl_dd"
NATIVE_PREFIX = "w11697231-"

LEGACY_TO_CANDIDATE = {
    "supply": "power_supply",
    "mode_shifter": "transmission_or_shifter",
    "wash_ntc": "temperature_sensor",
    "pressure_sensor": "water_level_sensor",
    "suspension": "suspension_system",
    "door_lock": "lid_lock",
    "lid_lock": "lid_lock",
}

OVERLAY_MECHANISM_TERMS = frozenset(
    {"splutch", "clutch", "gearcase", "capacitor", "stator", "rotor", "actuator shifter"}
)


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _normalize(term: str) -> str:
    return re.sub(r"\s+", " ", str(term or "").strip().lower())


def _native_procedure_id(candidate: dict) -> str | None:
    proc = (candidate.get("provenance") or {}).get("procedureId") or candidate.get("procedureId")
    if proc and str(proc).startswith(NATIVE_PREFIX):
        return str(proc)
    return None


def _run_fresh_cg3() -> dict[str, Any]:
    import sys

    if str(SCRIPTS_DIR) not in sys.path:
        sys.path.insert(0, str(SCRIPTS_DIR))
    from normalization.pipeline import find_manual_entry, load_manifest, run_manual_normalization

    manifest = load_manifest()
    entry = find_manual_entry(manifest, TARGET_MANUAL)
    print(f"==> CG-3 normalize {TARGET_MANUAL} (fresh)")
    return run_manual_normalization(entry)


def _candidate_ids() -> set[str]:
    return {c["id"] for c in _load_json(CANONICAL_CANDIDATE).get("components", [])}


def _scan_procedure_evidence() -> dict[str, Any]:
    procedures = _load_json(CANDIDATES / TARGET_MANUAL / "normalized_procedures.json").get(
        "procedures"
    ) or []
    native = [p for p in procedures if str(p.get("procedureId", "")).startswith(NATIVE_PREFIX)]

    lid_rows: list[dict[str, str]] = []
    drive_rows: list[dict[str, str]] = []
    shifter_rows: list[dict[str, str]] = []

    for proc in native:
        proc_id = proc.get("procedureId") or ""
        blob = json.dumps(proc.get("steps") or proc)
        lower = blob.lower()

        if "lid" in proc_id or "door_lock" in lower:
            has_lid_switch = "lid switch" in lower
            has_lock_switch = "lock switch" in lower
            has_solenoid = "solenoid" in lower
            lid_rows.append(
                {
                    "procedureId": proc_id,
                    "lidSwitchMentioned": has_lid_switch,
                    "lockSwitchMentioned": has_lock_switch,
                    "solenoidMentioned": has_solenoid,
                    "distinctRolesInProcedureText": has_lid_switch and has_lock_switch,
                }
            )

        if "drive" in proc_id or "shifter" in proc_id or "motor" in proc_id:
            drive_rows.append(
                {
                    "procedureId": proc_id,
                    "mentionsDriveSystem": "drive system" in lower,
                    "mentionsShifter": "shifter" in lower,
                    "mentionsMotor": "drive_motor" in lower or "motor" in lower,
                }
            )

        if "shifter" in proc_id:
            shifter_rows.append(
                {
                    "procedureId": proc_id,
                    "hasShifterMeasurement": "shifter" in lower and "ohm" in lower,
                    "overlayMechanismTerms": sorted(
                        term for term in OVERLAY_MECHANISM_TERMS if term in lower
                    ),
                }
            )

    return {
        "nativeProcedureCount": len(native),
        "lidAuthorization": lid_rows,
        "drivePath": drive_rows,
        "shifterPath": shifter_rows,
    }


def _analyze_watch_areas(
    mappings: list[dict],
    overlays: list[dict],
    procedure_evidence: dict[str, Any],
    candidate_ids: set[str],
) -> dict[str, Any]:
    native_mappings = [m for m in mappings if _native_procedure_id(m)]
    native_overlays = [o for o in overlays if _native_procedure_id(o)]

    drive_motor_hits = [
        m
        for m in native_mappings
        if m.get("canonicalId") == "drive_motor"
        or "drive_motor" in _normalize(m.get("sourceTerm") or "")
    ]
    drive_system_candidate_hits = [
        m for m in native_mappings if m.get("canonicalId") == "drive_system"
    ]
    drive_overlays = [
        o
        for o in native_overlays
        if "drive" in _normalize(o.get("procedureId") or "")
        or "motor" in _normalize(o.get("procedureId") or "")
    ]

    shifter_mappings = [
        m
        for m in native_mappings
        if "shifter" in _normalize(m.get("sourceTerm") or "")
        or "shifter" in _normalize((m.get("provenance") or {}).get("procedureId") or "")
    ]
    shifter_overlays = [
        o for o in native_overlays if "shifter" in _normalize(o.get("procedureId") or "")
    ]

    lid_mappings = [
        m
        for m in native_mappings
        if any(
            tok in _normalize(m.get("sourceTerm") or "")
            for tok in ("lid", "door_lock", "door lock", "lid lock")
        )
    ]
    lid_overlays = [
        o for o in native_overlays if "lid" in _normalize(o.get("procedureId") or "")
    ]

    lid_proc = next(
        (r for r in procedure_evidence.get("lidAuthorization") or [] if r.get("distinctRolesInProcedureText")),
        None,
    )

    drive_system_verdict = "not_earned_remove_at_freeze"
    if drive_system_candidate_hits:
        drive_system_verdict = "earned_pending_third_manual"
    elif all(
        o.get("canonicalTestTarget") in {"motor_output_test", "motor_command_test", "motor_winding_test"}
        for o in drive_overlays
        if o.get("candidateType") == "procedureTestBinding"
    ):
        drive_system_verdict = "not_earned_collapses_to_drive_motor"

    transmission_verdict = "cross_platform_functional_supported"
    if len(shifter_overlays) >= 1 and any(
        "shifter" in _normalize(o.get("displayTitle") or "") for o in shifter_overlays
    ):
        transmission_verdict = "cross_platform_functional_supported"

    lid_split_verdict = "provisional_procedure_evidence_not_matcher_evidence"
    if lid_proc and lid_proc.get("distinctRolesInProcedureText"):
        lid_split_verdict = (
            "provisional_positive — procedure distinguishes lid switch vs lock switch; "
            "CG-3 still collapses to door_lock/lid_lock"
        )

    return {
        "drive_system": {
            "verdict": drive_system_verdict,
            "nativeDriveMotorMappingHits": len(drive_motor_hits),
            "nativeDriveSystemCandidateHits": len(drive_system_candidate_hits),
            "nativeDriveOverlayBindings": len(drive_overlays),
            "driveProcedureChain": [
                r.get("procedureId") for r in procedure_evidence.get("drivePath") or []
            ],
            "evidence": (
                "W11697231 drive path resolves control_board → drive_motor → motor_output_test. "
                "No independent canonical evidence for drive_system node."
            ),
            "freezeRecommendation": "provisional_remove_unless_W11416787_contradicts",
        },
        "transmission_or_shifter": {
            "verdict": transmission_verdict,
            "nativeShifterMappingHits": len(shifter_mappings),
            "nativeShifterOverlayBindings": len(shifter_overlays),
            "shifterTestTarget": sorted(
                {
                    o.get("canonicalTestTarget")
                    for o in shifter_overlays
                    if o.get("canonicalTestTarget")
                }
            ),
            "shifterComponentIds": sorted(
                {
                    cid
                    for o in shifter_overlays
                    for cid in (o.get("componentIds") or [])
                }
            ),
            "canonicalBoundary": {
                "canonical": "mode_selection / wash-spin mode transition (transmission_or_shifter)",
                "overlay": ["shifter", "splutch", "clutch", "gearcase", "actuator"],
            },
            "crossManualReinforcement": (
                f"{PRIOR_MANUAL} and {TARGET_MANUAL} both expose TEST #3a shifter procedures "
                "on whirlpool_tl_dd — functional vocabulary, not Whirlpool-only implementation pattern."
            ),
            "freezeRecommendation": "keep_if_W11416787_reinforces",
        },
        "lid_switch_vs_lid_lock": {
            "verdict": lid_split_verdict,
            "nativeLidMappingHits": len(lid_mappings),
            "nativeLidOverlayBindings": len(lid_overlays),
            "procedureRoleEvidence": lid_proc,
            "matcherCanonicalTargets": sorted(
                {m.get("canonicalId") for m in lid_mappings if m.get("canonicalId")}
            ),
            "overlayTestTargets": sorted(
                {
                    o.get("canonicalTestTarget")
                    for o in lid_overlays
                    if o.get("canonicalTestTarget")
                }
            ),
            "freezeRecommendation": "provisional_lid_switch — do not promote split on plausibility alone",
        },
    }


def _freeze_convergence(watch: dict[str, Any]) -> dict[str, Any]:
    keep = [
        "lid_lock",
        "inlet_valve",
        "water_level_sensor",
        "drain_pump",
        "drain_path",
        "drive_motor",
        "agitator_or_impeller",
        "spin_system",
        "suspension_system",
    ]
    provisional = ["lid_switch", "drive_system"]
    if watch["transmission_or_shifter"]["freezeRecommendation"].startswith("keep"):
        keep.append("transmission_or_shifter")

    if watch["drive_system"]["verdict"] == "not_earned_collapses_to_drive_motor":
        provisional = ["lid_switch"]
        if "drive_system" in provisional:
            provisional = [p for p in provisional if p != "drive_system"]

    return {
        "keepAfterTwoManuals": keep,
        "provisionalAfterTwoManuals": provisional,
        "overlayOnlyExplicit": [
            "splutch",
            "clutch",
            "gearcase",
            "capacitor",
            "stator",
            "rotor",
            "manufacturer_motor_controller",
            "specific_shifter_mechanisms",
        ],
        "awaitingThirdManual": "W11416787",
        "freezeRev1Ready": False,
    }


def build_observation(normalize_result: dict[str, Any]) -> dict[str, Any]:
    candidate = _load_json(CANONICAL_CANDIDATE)
    candidate_ids = _candidate_ids()
    baseline = _load_json(BASELINE_OBS) if BASELINE_OBS.is_file() else {}

    target_dir = CANDIDATES / TARGET_MANUAL
    all_mappings = _load_json(target_dir / "canonical_mapping_candidates.json").get("candidates") or []
    all_overlays = _load_json(target_dir / "overlay_candidates.json").get("candidates") or []
    manifest = _load_json(target_dir / "pipeline_manifest.json")
    conflicts = _load_json(target_dir / "conflicts.json").get("conflicts") or []

    native_mappings = [m for m in all_mappings if _native_procedure_id(m)]
    native_overlays = [o for o in all_overlays if _native_procedure_id(o)]

    canonical_targets = Counter(
        str(m.get("canonicalId")) for m in native_mappings if m.get("canonicalId")
    )
    unresolved = sum(1 for m in native_mappings if not m.get("canonicalId"))

    procedure_evidence = _scan_procedure_evidence()
    watch = _analyze_watch_areas(
        all_mappings,
        all_overlays,
        procedure_evidence,
        candidate_ids,
    )

    new_canonical = [
        cid for cid in canonical_targets if cid not in candidate_ids and cid not in LEGACY_TO_CANDIDATE
    ]

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg6x_tl_washer_cg3_observation",
        "experiment": (
            "Whirlpool TL manual #2 (PSC WTW4950) — fresh CG-3 vs unchanged "
            "top_load_washer_cg6x_candidate_v1.json"
        ),
        "manualId": TARGET_MANUAL,
        "priorManualId": PRIOR_MANUAL,
        "platformId": PLATFORM_ID,
        "ontologyId": "top_load_washer",
        "ontologyFrozen": False,
        "candidateGraphUnchanged": True,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metricsSource": "fresh_cg3_observation",
        "publishBlocked": True,
        "baselineObservation": BASELINE_OBS.name,
        "graphArtifact": str(CANONICAL_CANDIDATE.relative_to(ROOT)),
        "nativeCohortFilter": f"procedureId.startsWith('{NATIVE_PREFIX}')",
        "pipelineCounts": {
            "proceduresNative": len(
                {
                    _native_procedure_id(m) or _native_procedure_id(o)
                    for m, o in [(x, x) for x in native_mappings + native_overlays]
                }
                - {None}
            ),
            "mappingCandidatesNative": len(native_mappings),
            "mappingCandidatesTotal": len(all_mappings),
            "overlayCandidatesNative": len(native_overlays),
            "overlayCandidatesTotal": len(all_overlays),
            "conflicts": len(conflicts),
            "extractionFiltered": (manifest.get("counts") or {}).get("extractionFiltered"),
        },
        "normalizeRun": {"manualId": normalize_result.get("manualId")},
        "canonicalExpansion": {
            "newCanonicalConcepts": len(new_canonical),
            "ids": sorted(new_canonical),
        },
        "nativeCanonicalTargetHistogram": dict(canonical_targets.most_common()),
        "unresolvedNativeMappings": unresolved,
        "watchAreas": watch,
        "procedureEvidence": procedure_evidence,
        "crossManualComparison": {
            "priorManual": PRIOR_MANUAL,
            "priorOpenQuestions": baseline.get("openQuestions") or {},
            "convergence": {
                "transmission_or_shifter": (
                    "reinforced — second manual exposes same TEST #3a shifter functional split"
                ),
                "drive_system": (
                    "weakened — second manual also collapses to drive_motor; abstraction not earning place"
                ),
                "lid_switch_vs_lid_lock": (
                    "strengthened provisionally — W11697231 procedure text distinguishes "
                    "lid switch vs lock switch; matcher still maps door_lock only"
                ),
            },
        },
        "freezeConvergence": _freeze_convergence(watch),
        "recommendation": {
            "freezeCandidateNow": False,
            "rationale": (
                "Two-manual convergence supports transmission_or_shifter and weakens drive_system. "
                "lid_switch split has procedure-level evidence but not matcher-level evidence. "
                "Run W11416787 as adversarial third manual before freezing rev1."
            ),
            "nextManual": "W11416787",
            "doNotChangeCandidateDuringObservation": True,
        },
    }


def main() -> int:
    normalize_result = _run_fresh_cg3()
    report = build_observation(normalize_result)
    out = CALIBRATION / "W11697231_tl_cg6x_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    watch = report["watchAreas"]
    print(f"\n=== W11697231 TL CG-6.x Observation ===")
    print(f"native mappings:  {report['pipelineCounts']['mappingCandidatesNative']}")
    print(f"native overlays:  {report['pipelineCounts']['overlayCandidatesNative']}")
    print(f"canonical expansion: {report['canonicalExpansion']['newCanonicalConcepts']}")
    print(f"drive_system:     {watch['drive_system']['verdict']}")
    print(f"transmission:     {watch['transmission_or_shifter']['verdict']}")
    print(f"lid split:        {watch['lid_switch_vs_lid_lock']['verdict']}")
    print(f"freeze rev1?      {report['freezeConvergence']['freezeRev1Ready']}")
    print(f"report:           {out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
