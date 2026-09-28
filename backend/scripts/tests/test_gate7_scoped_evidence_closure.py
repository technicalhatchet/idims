from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
CAL = REPO_ROOT / "frontend/components/diagnostics/knowledge/normalization/calibration"
CLOSURE_JSON = CAL / "CG_SCOPED_EVIDENCE_GATE7_CLOSURE_v1.json"
AUDIT_JSON = CAL / "CG_SCOPED_EVIDENCE_GATE7_CLOSURE_AUDIT_v1.json"
LOCK_JSON = CAL / "CG_SCOPED_EVIDENCE_GATE7_LOCK_v1.json"

EXPECTED_PILOTS = frozenset({"7A", "7B", "7C", "7D", "7E"})
EXPECTED_INVARIANTS = 10
EXPECTED_REGRESSION_PASSED = 8
EXPECTED_SEEDS = 825


def test_gate7_closure_artifacts_exist_and_align():
    assert CLOSURE_JSON.is_file(), "Missing CG_SCOPED_EVIDENCE_GATE7_CLOSURE_v1.json"
    assert AUDIT_JSON.is_file(), "Missing CG_SCOPED_EVIDENCE_GATE7_CLOSURE_AUDIT_v1.json"
    assert LOCK_JSON.is_file(), "Missing CG_SCOPED_EVIDENCE_GATE7_LOCK_v1.json"

    closure = json.loads(CLOSURE_JSON.read_text(encoding="utf-8"))
    audit = json.loads(AUDIT_JSON.read_text(encoding="utf-8"))
    lock = json.loads(LOCK_JSON.read_text(encoding="utf-8"))

    assert closure.get("gate") == 7
    assert closure.get("verdict") == "GREEN"
    assert closure.get("verdictLabel") == "GATE 7 SCOPED EVIDENCE SEMANTICS COMPLETE"
    assert closure.get("readOnlyAuditRecord") is True

    pilots = closure.get("gate7Pilots", {})
    assert EXPECTED_PILOTS <= set(pilots.keys())

    invariants = closure.get("closureInvariants", [])
    assert len(invariants) == EXPECTED_INVARIANTS
    assert {item["id"] for item in invariants} == {
        f"G7-INV-{i:02d}" for i in range(1, 11)
    }

    inv05 = next(item for item in invariants if item["id"] == "G7-INV-05")
    assert "external_path_fault" in inv05["statement"]
    assert "voltage segmentation" in inv05["statement"]

    unscoped = closure.get("intentionallyUnscopedOutsideGate7", [])
    assert any("hot coil" in item["item"] for item in unscoped)
    assert any("recirc" in item["item"].lower() for item in unscoped)
    assert any("w11416787" in item["item"] for item in unscoped)

    reg = closure["regressionEvidence"]
    assert reg["gate4"]["status"] == "green"
    assert reg["procedureSeedValidator"]["expectedProcedureSeeds"] == EXPECTED_SEEDS

    assert audit["executiveSummary"]["verdict"] == "GREEN"
    assert audit["artifact"] == CLOSURE_JSON.name
    assert lock["closureArtifact"] == CLOSURE_JSON.name
    assert len(lock["frozenPilotSeeds"]) == 5
    assert len(lock["frozenGate4WitnessSeeds"]) == 3

    for pilot_id in EXPECTED_PILOTS:
        rel_test = pilots[pilot_id]["regressionTest"]
        assert (REPO_ROOT / rel_test).is_file(), f"Missing regression test for {pilot_id}"


def test_gate7_closure_invariant_policy_snippets():
    closure = json.loads(CLOSURE_JSON.read_text(encoding="utf-8"))
    text = json.dumps(closure["closureInvariants"]).lower()
    assert "path_open" in text
    assert "physicaltestsetup" in text or "physicaltestsetup" in text.replace(" ", "")
    assert "evidencesubjectkey" in text.replace(" ", "")
    assert "loadinstancekey" in text.replace(" ", "")

    pilots = closure["gate7Pilots"]
    assert "loadInstanceKey" in json.dumps(pilots["7A"]["capabilitiesProven"])
    assert "evidence-set" in json.dumps(pilots["7B"]["capabilitiesProven"]).lower()
    assert "evidenceSubjectKey" in json.dumps(pilots["7C"]["capabilitiesProven"])
    assert "isolated harness" in json.dumps(pilots["7D"]["capabilitiesProven"]).lower()
    assert "supply_voltage_segment" in json.dumps(pilots["7E"]["capabilitiesProven"])


def test_gate7_regression_suite_green():
    frontend = REPO_ROOT / "frontend"
    ts_tests = [
        "components/diagnostics/procedures/__tests__/w8178558-drain-pump-scopedSemantics.test.ts",
        "components/diagnostics/procedures/__tests__/w8178558-wash-heater-ntc-scopedSemantics.test.ts",
        "components/diagnostics/procedures/__tests__/w8178558-inlet-valves-cold-coil-scopedSemantics.test.ts",
        "components/diagnostics/procedures/__tests__/w10864849-test-07-drain-recirc-pump-scopedSemantics.test.ts",
        "components/diagnostics/procedures/__tests__/w11633848-overfill-switch-evidenceSubject.test.ts",
        "components/diagnostics/procedures/__tests__/w8178558-door-lock-evidenceSubject.test.ts",
        "components/diagnostics/procedures/__tests__/w11169652-test-01-acu-power-evidenceSubject.test.ts",
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

    pytest_result = subprocess.run(
        [
            sys.executable,
            "-m",
            "pytest",
            "backend/scripts/tests/test_scoped_evidence_corpus_discovery.py",
            "backend/scripts/tests/test_gate5_scoped_evidence_discovery.py",
            "backend/scripts/tests/test_gate6_scoped_evidence_design.py",
            "-q",
        ],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert pytest_result.returncode == 0, pytest_result.stderr or pytest_result.stdout
    assert f"{EXPECTED_REGRESSION_PASSED} passed" in pytest_result.stdout

    validator = subprocess.run(
        [sys.executable, "backend/scripts/validate_procedure_seed.py"],
        cwd=str(REPO_ROOT),
        capture_output=True,
        text=True,
    )
    assert validator.returncode == 0, validator.stderr or validator.stdout
    assert f"Validated {EXPECTED_SEEDS} procedure seed" in validator.stdout
