from __future__ import annotations

import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).resolve().parents[1]
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from normalization.calibration.gap_analyzer import (
    GapCluster,
    TermObservation,
    build_gap_clusters,
    classify_cluster,
)


def _obs(
    term: str,
    manual: str,
    manufacturer: str,
    canonical: str | None = None,
    platform: str = "test_platform",
    blocked: str | None = None,
    decomposition: dict | None = None,
    seed: str | None = None,
) -> TermObservation:
    return TermObservation(
        source_term=term,
        manual_id=manual,
        platform_id=platform,
        manufacturer=manufacturer,
        canonical_id=canonical,
        status="UNRESOLVED_TERM" if not canonical else "candidate",
        blocked_reason=blocked,
        mapping_type="alias",
        decomposition=decomposition,
        confidence=0.0 if not canonical else 0.9,
        seed_component_id=seed,
    )


def test_canonical_ontology_candidate_requires_cross_manufacturer_evidence():
    observations = [
        _obs(
            "Dispenser Motor",
            "M1",
            "Whirlpool",
            decomposition={"domain": "detergent", "component": "dispenser", "actuator": "motor"},
            platform="whirlpool_a",
        ),
        _obs(
            "Detergent Dispenser Motor",
            "M2",
            "Samsung",
            decomposition={"domain": "detergent", "component": "dispenser", "actuator": "motor"},
            platform="samsung_a",
        ),
        _obs(
            "Auto Dispenser Pump",
            "M3",
            "LG",
            decomposition={"domain": "detergent", "component": "dispenser", "actuator": "motor"},
            platform="lg_a",
        ),
    ]
    cluster = build_gap_clusters(observations)[0]
    assert classify_cluster(cluster) == "canonical_ontology_candidate"


def test_single_manual_unknown_is_not_ontology_candidate():
    observations = [
        _obs("Shifter", "M1", "Whirlpool", blocked="UNRESOLVED_COMPONENT"),
    ]
    cluster = build_gap_clusters(observations)[0]
    assert classify_cluster(cluster) in {"unresolved", "platform_overlay", "human_review"}
    assert classify_cluster(cluster) != "canonical_ontology_candidate"


def test_alias_opportunity_same_canonical_different_terms():
    cluster = GapCluster(cluster_key="canonical:door_lock", canonical_ids={"door_lock"})
    cluster.observations = [
        _obs("Door Lock Assembly", "M1", "Whirlpool", canonical="door_lock"),
        _obs("Door Latch", "M2", "Samsung", canonical="door_lock", platform="samsung_fl"),
    ]
    assert classify_cluster(cluster) == "canonical_alias"


def test_conflict_maps_to_human_review():
    cluster = GapCluster(cluster_key="term:mcu", canonical_ids={"motor_controller", "control_board"})
    cluster.conflict = True
    cluster.observations = [
        _obs("MCU", "M1", "Whirlpool", canonical="motor_controller"),
        _obs("MCU", "M2", "Other", canonical="control_board"),
    ]
    assert classify_cluster(cluster) == "human_review"
