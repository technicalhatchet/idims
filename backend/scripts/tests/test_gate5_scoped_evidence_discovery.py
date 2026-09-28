from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
GATE5_JSON = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration"
    / "CG_SCOPED_EVIDENCE_GATE5_DISCOVERY_v1.json"
)
GATE5_AUDIT = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration"
    / "CG_SCOPED_EVIDENCE_GATE5_DISCOVERY_AUDIT_v1.json"
)
SCRIPT = REPO_ROOT / "backend/scripts/discover_gate5_scoped_evidence.py"

EXPECTED_IDS = [
    "w8178558-door-lock",
    "w11169652-test-01-acu-power",
    "w8178558-inlet-valves",
    "w10864849-test-07-drain-recirc-pump",
    "w11416787-test-07-drain-recirc-pump",
    "w11633848-overfill-switch",
    "lgotrmw-door-interlock",
    "samsungotrmw-door-interlock",
]

CLASSIFICATIONS = frozenset(
    {
        "CURRENT_MODEL_SUFFICIENT",
        "NEEDS_NEW_SEMANTIC_DESIGN",
        "TRUE_COMPONENT_FAILURE",
        "INSUFFICIENT_EVIDENCE",
        "AMBIGUOUS_CONFIGURATION",
    }
)


def test_gate5_artifact_schema():
    assert GATE5_JSON.is_file(), "Run discover_gate5_scoped_evidence.py"
    data = json.loads(GATE5_JSON.read_text(encoding="utf-8"))
    assert data.get("noProposedProductionMutations") is True
    assert len(data.get("procedures", [])) == 8
    ids = {p["procedureId"] for p in data["procedures"]}
    assert ids == set(EXPECTED_IDS)
    for proc in data["procedures"]:
        assert proc["classification"] in CLASSIFICATIONS
    assert set(data["classificationCounts"]) == CLASSIFICATIONS
    assert sum(data["classificationCounts"].values()) == 8
    assert data["classificationCounts"]["CURRENT_MODEL_SUFFICIENT"] == 0
    assert data["gate5Summary"]["safeForFutureSingleSeedMigration"] == []


def test_gate5_audit_matches():
    assert GATE5_AUDIT.is_file()
    audit = json.loads(GATE5_AUDIT.read_text(encoding="utf-8"))
    data = json.loads(GATE5_JSON.read_text(encoding="utf-8"))
    assert audit["executiveSummary"]["proceduresReviewed"] == 8
    assert audit["executiveSummary"]["classificationCounts"] == data["classificationCounts"]


def test_gate5_script_regenerates():
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr or result.stdout
