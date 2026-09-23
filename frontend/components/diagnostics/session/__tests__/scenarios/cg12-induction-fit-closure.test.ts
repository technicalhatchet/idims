import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const EXPECTED_FROZEN_ELECTRIC_HASH =
  '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

const CALIBRATION = resolve(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

test('CG-12 closure locks Outcome A with R1 sufficient and R2 deferred', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_CLOSURE_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  assert.equal(closure.status, 'closed_successful');
  assert.equal(closure.verdict, 'CLOSED / INDUCTION_FITS_ELECTRIC_CONTRACT');
  assert.equal(contract.status, 'closed');
  assert.equal(contract.closureArtifact, 'CG12_INDUCTION_FIT_CLOSURE_v1.json');
  assert.equal(contract.r1SufficientForClosure, true);
  assert.equal(contract.r2RequiredForClosure, false);
  assert.equal(analysis.status, 'human_boundary_approved');
  assert.equal(analysis.humanBoundaryApprovedOutcome, 'A');
  assert.equal(analysis.r1SufficientForClosure, true);
  assert.equal(analysis.r2RequiredForClosure, false);

  assert.equal(closure.approvedFitOutcome.r1SufficientForClosure, true);
  assert.equal(closure.approvedFitOutcome.r2RequiredForClosure, false);
  assert.equal(closure.closureDecisions.r2WhirlpoolStatus, 'DEFERRED_OPTIONAL');
  assert.equal(closure.headlineMetrics.classificationDiverges, 0);
});

test('CG-12 closure preserves cross-manufacturer matrix as PENDING not passed', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_CLOSURE_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const matrix = closure.closureDecisions.crossManufacturerMatrix;
  assert.equal(matrix.status, 'PENDING');
  assert.equal(matrix.notPassed, true);
  assert.equal(matrix.notFailed, true);
  assert.ok(matrix.auditNote.includes('do not record as passed'));
  assert.equal(closure.headlineMetrics.crossManufacturerMatrixStatus, 'PENDING');
  assert.equal(contract.successCriteria.crossManufacturerMatrixStatus, 'PENDING');
  assert.equal(contract.successCriteria.crossManufacturerMatrixComplete, false);
  assert.equal(contract.successCriteria.r2Status, 'DEFERRED_OPTIONAL');
  assert.equal(closure.evidenceChain.r2.notRequiredForClosure, true);
});

test('CG-12 closure preserves frozen hash and points to CG-13', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG12_INDUCTION_FIT_CLOSURE_v1.json'), 'utf8'),
  );

  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(closure.frozenContractUnderTest.hashAtCg12Close, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(closure.frozenContractUnderTest.hashMutatedDuringCg12, false);
  assert.equal(closure.governanceConclusion.normalizationCompoundingAuthorized, false);
  assert.equal(closure.hierarchy.nextDisciplinedStep, 'CG-13 dual_fuel fit test');
  assert.equal(closure.conditionalConvectionCrossWitness.notAContradiction, true);
  assert.equal(closure.validationProof.evidenceRegression.testsPassing, 18);
});
