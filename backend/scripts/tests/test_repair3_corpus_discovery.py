from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
CAL = REPO_ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
DISCOVERY_JSON = CAL / "CG_REPAIR3_CORPUS_DISCOVERY_v1.json"
AUDIT_JSON = CAL / "CG_REPAIR3_CORPUS_DISCOVERY_AUDIT_v1.json"
SCRIPT = REPO_ROOT / "backend/scripts/discover_repair_corpus.py"
REPAIR_REGISTRY = REPO_ROOT / "frontend/components/diagnostics/repairs/repairRegistry.ts"
REPAIR_RESOLVER = (
    REPO_ROOT / "frontend/components/diagnostics/repairs/resolveRepairProcedureForDiagnostic.ts"
)
EXPECTED_SEEDS = 825
W8178558_MANUAL = "jobaid-8178558-l-78 whirlpool fl washer 2013 era-extracted.txt"

CLASSIFICATIONS = (
    "REPAIR_READY",
    "PARTIAL_REPAIR",
    "DIAGNOSTIC_ONLY",
    "REFERENCE_ONLY",
    "UNSUPPORTED",
)


def test_repair3_artifacts_exist_and_summary():
    assert DISCOVERY_JSON.is_file(), "Run discover_repair_corpus.py"
    assert AUDIT_JSON.is_file()
    discovery = json.loads(DISCOVERY_JSON.read_text(encoding="utf-8"))
    audit = json.loads(AUDIT_JSON.read_text(encoding="utf-8"))

    assert discovery.get("gate") == "REPAIR-3"
    assert discovery.get("readOnlyDiscovery") is True
    assert discovery.get("noRepairProcedureSeedsGenerated") is True
    assert audit.get("readOnly") is True
    assert audit["executiveSummary"]["verdict"] == "GREEN"

    summary = discovery["summary"]
    assert summary["manualsScanned"] >= 90
    assert summary["totalCandidates"] > 0
    assert set(summary["classificationCounts"].keys()) == set(CLASSIFICATIONS)
    assert summary["candidatesRequiringHumanReview"] > 0


def test_implemented_witnesses_discoverable_with_expected_class():
    discovery = json.loads(DISCOVERY_JSON.read_text(encoding="utf-8"))
    witnesses = {
        c["implementedRepairWitness"]: c
        for c in discovery["candidates"]
        if c.get("implementedRepairWitness")
    }
    assert witnesses["REPAIR-1"]["manualFile"] == W8178558_MANUAL
    assert witnesses["REPAIR-1"]["sourceSection"] == "REMOVING THE DRAIN PUMP"
    assert witnesses["REPAIR-1"]["classification"] == "REPAIR_READY"
    assert witnesses["REPAIR-2"]["classification"] == "PARTIAL_REPAIR"
    assert witnesses["REPAIR-2"]["crossReferenceEvidence"]


def test_provenance_and_deterministic_regeneration():
    before = json.loads(DISCOVERY_JSON.read_text(encoding="utf-8"))
    result = subprocess.run(
        [sys.executable, str(SCRIPT)],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert result.returncode == 0, result.stderr or result.stdout
    after = json.loads(DISCOVERY_JSON.read_text(encoding="utf-8"))
    assert after["summary"]["totalCandidates"] == before["summary"]["totalCandidates"]
    assert after["summary"]["classificationCounts"] == before["summary"]["classificationCounts"]

    sample = after["candidates"][0]
    for key in (
        "candidateId",
        "manualFile",
        "sourceSection",
        "classification",
        "sourceExcerpt",
        "extractedTextFile",
    ):
        assert sample.get(key)

    assert all(c["classification"] in CLASSIFICATIONS for c in after["candidates"])


def test_diagnostic_only_not_repair_ready():
    discovery = json.loads(DISCOVERY_JSON.read_text(encoding="utf-8"))
    diagnostic_only = [
        c for c in discovery["candidates"] if c["classification"] == "DIAGNOSTIC_ONLY"
    ]
    assert diagnostic_only, "Expected at least one DIAGNOSTIC_ONLY candidate"
    for cand in diagnostic_only:
        assert cand["physicalStepEvidence"]["numberedPhysicalSteps"] == 0
        assert cand["physicalStepEvidence"]["removalPhaseSteps"] == 0


def test_read_only_repair_layer_unchanged():
    registry = REPAIR_REGISTRY.read_text(encoding="utf-8")
    assert "w8178558-repair-drain-pump" in registry
    assert "w8178558-repair-wash-heater" in registry
    assert REPAIR_RESOLVER.is_file()
    assert "w8178558-repair-drain-pump" in REPAIR_RESOLVER.read_text(encoding="utf-8")


def test_repair3_regression_bundle_green():
    frontend = REPO_ROOT / "frontend"
    ts_tests = [
        "components/diagnostics/repairs/__tests__/repair1-w8178558-drain-pump.test.ts",
        "components/diagnostics/repairs/__tests__/repair2-w8178558-wash-heater.test.ts",
        "components/diagnostics/procedures/__tests__/gate8DiagnosticConclusionIntegration.test.ts",
    ]
    for rel in ts_tests:
        result = subprocess.run(
            ["npx", "tsx", rel],
            cwd=str(frontend),
            capture_output=True,
            text=True,
            shell=True,
        )
        assert result.returncode == 0, f"{rel} failed:\n{result.stderr or result.stdout}"

    for pytest_rel in [
        "backend/scripts/tests/test_repair2_closure.py",
        "backend/scripts/tests/test_gate8_diagnostic_conclusion_integration.py",
    ]:
        pytest_result = subprocess.run(
            [sys.executable, "-m", "pytest", pytest_rel, "-q"],
            cwd=str(REPO_ROOT),
            capture_output=True,
            text=True,
        )
        assert pytest_result.returncode == 0, pytest_result.stderr or pytest_result.stdout

    validator = subprocess.run(
        [sys.executable, "backend/scripts/validate_procedure_seed.py"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert validator.returncode == 0, validator.stderr or validator.stdout
    assert f"Validated {EXPECTED_SEEDS} procedure seed" in validator.stdout
