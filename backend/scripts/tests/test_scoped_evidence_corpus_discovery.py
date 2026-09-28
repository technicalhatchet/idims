from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
DISCOVERY_JSON = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration"
    / "CG_SCOPED_EVIDENCE_CORPUS_DISCOVERY_v1.json"
)
AUDIT_JSON = (
    REPO_ROOT
    / "frontend/components/diagnostics/knowledge/normalization/calibration"
    / "CG_SCOPED_EVIDENCE_CORPUS_DISCOVERY_AUDIT_v1.json"
)
SCRIPT = REPO_ROOT / "backend/scripts/discover_scoped_evidence_corpus.py"

CLASSIFICATIONS = (
    "CLEAR_PATH_SEMANTICS",
    "AMBIGUOUS_CONFIGURATION",
    "TRUE_COMPONENT_FAILURE",
    "MULTI_POINT_COMPOUND",
    "INSUFFICIENT_EVIDENCE",
)


def test_discovery_artifact_exists_and_schema():
    assert DISCOVERY_JSON.is_file(), "Run discover_scoped_evidence_corpus.py to generate artifact"
    discovery = json.loads(DISCOVERY_JSON.read_text(encoding="utf-8"))
    assert discovery.get("schemaVersion") == "1.0.0"
    assert discovery.get("noProposedProductionMutations") is True
    assert discovery.get("referenceWitness", {}).get("procedureId") == "w8178558-drain-pump"

    totals = discovery["totals"]
    assert totals["procedureSeedFilesScanned"] >= 800
    assert totals["candidateProcedures"] > 0
    assert set(totals["classificationCountsPairRecords"]) == set(CLASSIFICATIONS)
    assert set(totals["classificationCountsByProcedurePrimary"]) == set(CLASSIFICATIONS)

    for key in CLASSIFICATIONS:
        assert key in discovery["classifications"]
        assert isinstance(discovery["classifications"][key], list)

    witness = discovery["classifications"]["CLEAR_PATH_SEMANTICS"]
    assert any(
        r.get("procedureId") == "w8178558-drain-pump"
        and r.get("migrationStatus") == "migrated_gate2_control"
        for r in witness
    )


def test_audit_artifact_matches_discovery():
    assert AUDIT_JSON.is_file()
    audit = json.loads(AUDIT_JSON.read_text(encoding="utf-8"))
    discovery = json.loads(DISCOVERY_JSON.read_text(encoding="utf-8"))
    assert audit.get("readOnly") is True
    assert audit["executiveSummary"]["scanned"] == discovery["totals"]["procedureSeedFilesScanned"]


def test_discovery_script_regenerates_cleanly():
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
        check=False,
    )
    assert result.returncode == 0, result.stderr or result.stdout
