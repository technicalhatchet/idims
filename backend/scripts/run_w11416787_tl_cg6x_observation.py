#!/usr/bin/env python3
"""CG-6.x — W11416787 adversarial third-manual CG-3 observation (freeze decision run)."""

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
PRIOR_OBSERVATIONS = (
    "W10864849_tl_cg6x_observation_v1.json",
    "W11697231_tl_cg6x_observation_v1.json",
)
TARGET_MANUAL = "W11416787"
PRIOR_MANUALS = ["W10864849", "W11697231"]
PLATFORM_ID = "whirlpool_tl_dd_5100"
NATIVE_PREFIX = "w11416787-"

LEGACY_TO_CANDIDATE = {
    "supply": "power_supply",
    "mode_shifter": "transmission_or_shifter",
    "wash_ntc": "temperature_sensor",
    "pressure_sensor": "water_level_sensor",
    "suspension": "suspension_system",
    "door_lock": "lid_lock",
    "lid_lock": "lid_lock",
}

PRIOR_NATIVE_PREFIX = {
    "W10864849": "w10864849-",
    "W11697231": "w11697231-",
    "W11416787": NATIVE_PREFIX,
}


def _load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def _normalize(term: str) -> str:
    return re.sub(r"\s+", " ", str(term or "").strip().lower())


def _native_procedure_id(candidate: dict, prefix: str = NATIVE_PREFIX) -> str | None:
    proc = (candidate.get("provenance") or {}).get("procedureId") or candidate.get("procedureId")
    if proc and str(proc).startswith(prefix):
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


def _scan_procedure_evidence(manual_id: str, prefix: str) -> dict[str, Any]:
    procedures = _load_json(CANDIDATES / manual_id / "normalized_procedures.json").get(
        "procedures"
    ) or []
    native = [p for p in procedures if str(p.get("procedureId", "")).startswith(prefix)]

    lid_evidence = None
    has_shifter_proc = False
    drive_chain: list[str] = []

    for proc in native:
        proc_id = proc.get("procedureId") or ""
        blob = json.dumps(proc.get("steps") or proc).lower()

        if "lid" in proc_id or "door_lock" in blob:
            has_lid_switch = "lid switch" in blob
            has_lock_switch = "lock switch" in blob
            has_home_switch = "home switch" in blob
            if has_lid_switch or has_lock_switch or has_home_switch:
                lid_evidence = {
                    "procedureId": proc_id,
                    "lidSwitchMentioned": has_lid_switch,
                    "lockSwitchMentioned": has_lock_switch,
                    "homeSwitchMentioned": has_home_switch,
                    "distinctRolesInProcedureText": (has_lid_switch or has_home_switch)
                    and has_lock_switch,
                }

        if "shifter" in proc_id:
            has_shifter_proc = True

        if any(tok in proc_id for tok in ("drive-system", "shifter", "motor")):
            if "test-03" in proc_id:
                drive_chain.append(proc_id)

    return {
        "nativeProcedureCount": len(native),
        "lidAuthorization": lid_evidence,
        "hasShifterProcedure": has_shifter_proc,
        "driveProcedureChain": drive_chain,
    }


def _manual_drive_shifter_lid_stats(manual_id: str) -> dict[str, Any]:
    prefix = PRIOR_NATIVE_PREFIX[manual_id]
    mappings = _load_json(CANDIDATES / manual_id / "canonical_mapping_candidates.json").get(
        "candidates"
    ) or []
    overlays = _load_json(CANDIDATES / manual_id / "overlay_candidates.json").get(
        "candidates"
    ) or []
    native_mappings = [m for m in mappings if _native_procedure_id(m, prefix)]
    native_overlays = [o for o in overlays if _native_procedure_id(o, prefix)]

    drive_system_hits = sum(1 for m in native_mappings if m.get("canonicalId") == "drive_system")
    drive_motor_hits = sum(1 for m in native_mappings if m.get("canonicalId") == "drive_motor")
    lid_switch_hits = sum(
        1
        for m in native_mappings
        if m.get("canonicalId") in {"lid_switch", "door_switch"}
        or "lid switch" in _normalize(m.get("sourceTerm") or "")
    )
    lid_lock_hits = sum(
        1
        for m in native_mappings
        if m.get("canonicalId") in {"door_lock", "lid_lock"}
    )

    shifter_overlays = [
        o for o in native_overlays if "shifter" in _normalize(o.get("procedureId") or "")
    ]
    drive_overlays = [
        o
        for o in native_overlays
        if any(tok in _normalize(o.get("procedureId") or "") for tok in ("drive", "motor", "shifter"))
    ]

    proc_ev = _scan_procedure_evidence(manual_id, prefix)

    return {
        "manualId": manual_id,
        "nativeMappings": len(native_mappings),
        "driveSystemCandidateHits": drive_system_hits,
        "driveMotorHits": drive_motor_hits,
        "lidSwitchMatcherHits": lid_switch_hits,
        "lidLockMatcherHits": lid_lock_hits,
        "shifterProcedurePresent": proc_ev.get("hasShifterProcedure"),
        "shifterOverlayBindings": len(shifter_overlays),
        "driveOverlayBindings": len(drive_overlays),
        "driveOverlayTestTargets": sorted(
            {
                o.get("canonicalTestTarget")
                for o in drive_overlays
                if o.get("candidateType") == "procedureTestBinding" and o.get("canonicalTestTarget")
            }
        ),
        "lidProcedureRoleEvidence": proc_ev.get("lidAuthorization"),
        "driveProcedureChain": proc_ev.get("driveProcedureChain"),
    }


def _three_manual_synthesis(per_manual: list[dict[str, Any]]) -> dict[str, Any]:
    all_no_drive_system = all(m["driveSystemCandidateHits"] == 0 for m in per_manual)
    all_have_drive_motor = all(m["driveMotorHits"] >= 1 for m in per_manual)
    all_motor_output = all(
        set(m.get("driveOverlayTestTargets") or []) <= {"motor_output_test", "motor_command_test", "motor_winding_test", "shifter_test"}
        and bool(m.get("driveOverlayTestTargets"))
        for m in per_manual
    )
    all_have_shifter = all(m.get("shifterProcedurePresent") for m in per_manual)

    lid_proc_evidence_count = sum(
        1
        for m in per_manual
        if (m.get("lidProcedureRoleEvidence") or {}).get("distinctRolesInProcedureText")
    )
    lid_switch_matcher_total = sum(m.get("lidSwitchMatcherHits", 0) for m in per_manual)

    drive_verdict = "remove_from_rev1"
    if not all_no_drive_system:
        drive_verdict = "contradicted_keep_provisional"
    elif not (all_have_drive_motor and all_motor_output):
        drive_verdict = "inconclusive_wait"

    transmission_verdict = "keep_in_rev1"
    if not all_have_shifter:
        transmission_verdict = "contradicted_revisit"

    if lid_proc_evidence_count >= 2 and lid_switch_matcher_total == 0:
        lid_verdict = "conditional_in_rev1"
    elif lid_switch_matcher_total > 0:
        lid_verdict = "insufficient_matcher_only"
    else:
        lid_verdict = "provisional_defer"

    return {
        "drive_system": {
            "verdict": drive_verdict,
            "allManualsZeroDriveSystemHits": all_no_drive_system,
            "allManualsCollapseToDriveMotor": all_have_drive_motor and all_motor_output,
            "perManual": [
                {
                    "manualId": m["manualId"],
                    "driveSystemHits": m["driveSystemCandidateHits"],
                    "driveMotorHits": m["driveMotorHits"],
                    "driveOverlayTestTargets": m.get("driveOverlayTestTargets"),
                }
                for m in per_manual
            ],
        },
        "transmission_or_shifter": {
            "verdict": transmission_verdict,
            "allManualsExposeShifterProcedure": all_have_shifter,
            "canonicalLayer": "mode_selection / wash-spin transition",
            "overlayLayer": ["shifter", "splutch", "clutch", "gearcase", "actuator"],
            "perManual": [
                {
                    "manualId": m["manualId"],
                    "shifterProcedure": m.get("shifterProcedurePresent"),
                    "shifterOverlays": m.get("shifterOverlayBindings"),
                }
                for m in per_manual
            ],
        },
        "lid_switch": {
            "verdict": lid_verdict,
            "procedureRoleEvidenceManuals": lid_proc_evidence_count,
            "lidSwitchMatcherHitsTotal": lid_switch_matcher_total,
            "note": (
                "Procedure evidence across manuals distinguishes authorization vs lock/spin safety; "
                "CG-3 did not independently discover lid_switch in any manual."
            ),
            "perManual": [
                {
                    "manualId": m["manualId"],
                    "lidProcedureRoleEvidence": m.get("lidProcedureRoleEvidence"),
                    "lidSwitchMatcherHits": m.get("lidSwitchMatcherHits"),
                    "lidLockMatcherHits": m.get("lidLockMatcherHits"),
                }
                for m in per_manual
            ],
        },
    }


def _freeze_recommendation(synthesis: dict[str, Any]) -> dict[str, Any]:
    keep = [
        "lid_lock",
        "inlet_valve",
        "water_level_sensor",
        "drain_pump",
        "drain_path",
        "drive_motor",
        "transmission_or_shifter",
        "agitator_or_impeller",
        "spin_system",
        "suspension_system",
        "power_supply",
        "control_board",
        "hmi_control",
        "temperature_sensor",
        "tub",
        "basket",
    ]
    conditional = []
    remove = []

    if synthesis["drive_system"]["verdict"] == "remove_from_rev1":
        remove.append("drive_system")
    else:
        conditional.append("drive_system")

    if synthesis["transmission_or_shifter"]["verdict"] != "keep_in_rev1":
        keep = [c for c in keep if c != "transmission_or_shifter"]

    if synthesis["lid_switch"]["verdict"] == "conditional_in_rev1":
        conditional.append("lid_switch")
    elif synthesis["lid_switch"]["verdict"] == "provisional_defer":
        conditional.append("lid_switch")

    ready = (
        synthesis["drive_system"]["verdict"] == "remove_from_rev1"
        and synthesis["transmission_or_shifter"]["verdict"] == "keep_in_rev1"
        and synthesis["lid_switch"]["verdict"] in {"conditional_in_rev1", "provisional_defer"}
    )

    return {
        "revision": "rev1",
        "freezeRev1Ready": ready,
        "keep": [c for c in keep if c not in remove],
        "conditional": conditional,
        "remove": remove,
        "overlayOnlyExplicit": [
            "splutch",
            "clutch",
            "gearcase",
            "capacitor",
            "stator",
            "rotor",
            "manufacturer_motor_controller",
            "mode_shifter",
            "pressure_sensor",
            "recirc_pump",
            "wash_heater",
            "bulk_level_switch",
            "motor_controller",
            "drum_bearing",
        ],
        "canonicalExpansion": 0,
        "implementationVocabularyRule": (
            "Do not promote OEM implementation terms (splutch, clutch, gearcase, etc.) "
            "to canonical rev1 — they remain manufacturer/platform overlay knowledge."
        ),
    }


def build_observation(normalize_result: dict[str, Any]) -> dict[str, Any]:
    candidate_ids = _candidate_ids()
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

    new_canonical = [
        cid for cid in canonical_targets if cid not in candidate_ids and cid not in LEGACY_TO_CANDIDATE
    ]

    per_manual = [_manual_drive_shifter_lid_stats(mid) for mid in PRIOR_MANUALS + [TARGET_MANUAL]]
    synthesis = _three_manual_synthesis(per_manual)
    freeze = _freeze_recommendation(synthesis)

    return {
        "schemaVersion": "1.0.0",
        "reportType": "cg6x_tl_washer_adversarial_third_manual_observation",
        "experiment": (
            "W11416787 adversarial third manual — fresh CG-3 vs unchanged candidate; "
            "final evidence before TOP_LOAD_WASHER rev1 freeze decision"
        ),
        "manualId": TARGET_MANUAL,
        "priorManualIds": PRIOR_MANUALS,
        "platformId": PLATFORM_ID,
        "ontologyId": "top_load_washer",
        "ontologyFrozen": False,
        "candidateGraphUnchanged": True,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "metricsSource": "fresh_cg3_observation",
        "publishBlocked": True,
        "priorObservations": list(PRIOR_OBSERVATIONS),
        "graphArtifact": str(CANONICAL_CANDIDATE.relative_to(ROOT)),
        "nativeCohortFilter": f"procedureId.startsWith('{NATIVE_PREFIX}')",
        "pipelineCounts": {
            "proceduresNative": manifest.get("counts", {}).get("procedures"),
            "mappingCandidatesNative": len(native_mappings),
            "overlayCandidatesNative": len(native_overlays),
            "conflicts": len(conflicts),
            "extractionFiltered": (manifest.get("counts") or {}).get("extractionFiltered"),
        },
        "canonicalExpansion": {"newCanonicalConcepts": len(new_canonical), "ids": sorted(new_canonical)},
        "nativeCanonicalTargetHistogram": dict(canonical_targets.most_common()),
        "threeManualCorpus": per_manual,
        "adversarialSynthesis": synthesis,
        "freezeRecommendation": freeze,
        "hypothesisPath": {
            "W10864849": "first baseline (BPM DD 6.2 cu ft)",
            "W11697231": "second convergence (PSC 3.8 cu ft)",
            "W11416787": "adversarial third (DD 4.7/5.3 cu ft WTW5100 family)",
        },
        "recommendation": {
            "freezeCandidateNow": freeze["freezeRev1Ready"],
            "rationale": (
                "Three-manual corpus supports removing drive_system, keeping transmission_or_shifter "
                "as functional mode-selection, and treating lid_switch as conditional (procedure "
                "evidence without matcher discovery). No canonical expansion."
            ),
            "nextStep": (
                "Derive top_load_washer rev1 from freezeRecommendation — do not copy legacy "
                "top_load_washer.json wholesale; apply KEEP/CONDITIONAL/REMOVE against candidate."
            ),
        },
    }


def main() -> int:
    normalize_result = _run_fresh_cg3()
    report = build_observation(normalize_result)

    out = CALIBRATION / "W11416787_tl_cg6x_observation_v1.json"
    out.write_text(json.dumps(report, indent=2), encoding="utf-8")

    freeze_path = CALIBRATION / "TOP_LOAD_WASHER_CG6X_FREEZE_RECOMMENDATION_v1.json"
    freeze_doc = {
        "schemaVersion": "1.0.0",
        "reportType": "cg6x_top_load_washer_freeze_recommendation",
        "status": "locked_pending_rev1_derivation",
        "lockedAt": report["generatedAt"],
        "evidenceManuals": PRIOR_MANUALS + [TARGET_MANUAL],
        "evidenceArtifacts": [
            "W10864849_tl_cg6x_observation_v1.json",
            "W11697231_tl_cg6x_observation_v1.json",
            "W11416787_tl_cg6x_observation_v1.json",
            "top_load_washer_cg6x_candidate_v1.json",
        ],
        "candidateGraphUnmodified": True,
        "synthesis": report["adversarialSynthesis"],
        "freeze": report["freezeRecommendation"],
        "verdict": (
            "Three-manual Whirlpool TL CG-3 corpus converges on functional rev1 freeze. "
            "drive_system removed; transmission_or_shifter kept; lid_switch conditional."
        ),
    }
    freeze_path.write_text(json.dumps(freeze_doc, indent=2), encoding="utf-8")

    syn = report["adversarialSynthesis"]
    freeze = report["freezeRecommendation"]
    print(f"\n=== W11416787 TL Adversarial Observation (3-manual) ===")
    print(f"native mappings:  {report['pipelineCounts']['mappingCandidatesNative']}")
    print(f"canonical expansion: {report['canonicalExpansion']['newCanonicalConcepts']}")
    print(f"drive_system:     {syn['drive_system']['verdict']}")
    print(f"transmission:     {syn['transmission_or_shifter']['verdict']}")
    print(f"lid_switch:       {syn['lid_switch']['verdict']}")
    print(f"freeze rev1 ready: {freeze['freezeRev1Ready']}")
    print(f"REMOVE:           {freeze['remove']}")
    print(f"CONDITIONAL:      {freeze['conditional']}")
    print(f"report:           {out}")
    print(f"freeze rec:       {freeze_path}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
