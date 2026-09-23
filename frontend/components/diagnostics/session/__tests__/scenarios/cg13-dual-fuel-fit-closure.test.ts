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

test('CG-13 closure locks Outcome A with R1 sufficient and R2/R3 deferred', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_CLOSURE_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );
  const analysis = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_ANALYSIS_v1.json'), 'utf8'),
  );

  assert.equal(closure.status, 'closed_successful');
  assert.equal(closure.verdict, 'CLOSED / DUAL_FUEL_FITS_ELECTRIC_CONTRACT');
  assert.equal(contract.status, 'closed');
  assert.equal(contract.closureArtifact, 'CG13_DUAL_FUEL_FIT_CLOSURE_v1.json');
  assert.equal(contract.r1SufficientForClosure, true);
  assert.equal(contract.r2RequiredForClosure, false);
  assert.equal(analysis.status, 'human_boundary_approved');
  assert.equal(analysis.humanBoundaryApprovedOutcome, 'A');
  assert.equal(analysis.r1SufficientForClosure, true);

  assert.equal(closure.approvedFitOutcome.r1SufficientForClosure, true);
  assert.equal(closure.closureDecisions.r2LgStatus, 'DEFERRED_OPTIONAL');
  assert.equal(closure.closureDecisions.r3WhirlpoolFamilyStatus, 'DEFERRED_OPTIONAL');
  assert.equal(closure.headlineMetrics.classificationDiverges, 0);
  assert.equal(closure.cumulativeFitExperiment.canonicalHashMutationsAcrossAllFitTests, 0);
});

test('CG-13 closure preserves cross-manufacturer matrix as PENDING and documents W11174814 corpus', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_CLOSURE_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const matrix = closure.closureDecisions.crossManufacturerMatrix;
  assert.equal(matrix.status, 'PENDING');
  assert.equal(matrix.notPassed, true);
  assert.ok(matrix.auditNote.includes('do not record as passed'));
  assert.equal(contract.successCriteria.crossManufacturerMatrixStatus, 'PENDING');
  assert.equal(contract.successCriteria.r2Status, 'DEFERRED_OPTIONAL');

  const whirlpool = closure.whirlpoolFamilyWitnessCorpus;
  assert.equal(whirlpool.manualId, 'W11174814');
  assert.ok(whirlpool.scope.includes('Dual Fuel'));
  assert.ok(whirlpool.relevanceToFitTests.cg13DualFuel.exampleWiringDiagrams.includes('JDS1450F'));
  assert.ok(whirlpool.relevanceToFitTests.cg12Induction.exampleWiringDiagrams.includes('JIS1450D'));
  assert.ok(whirlpool.relevanceToFitTests.cg12Induction.note.includes('WFI505'));
});

test('CG-13 closure preserves frozen hash and points to family boundary review', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG13_DUAL_FUEL_FIT_CLOSURE_v1.json'), 'utf8'),
  );

  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(closure.frozenContractUnderTest.hashAtCg13Close, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(closure.frozenContractUnderTest.hashMutatedDuringCg13, false);
  assert.equal(closure.governanceConclusion.normalizationCompoundingAuthorized, false);
  assert.equal(closure.hierarchy.nextDisciplinedStep, 'CG-RANGE-FAMILY-REVIEW — organizational gate before normalization/compounding');
  assert.equal(closure.conditionalConvectionCrossWitness.notAContradiction, true);
  assert.equal(closure.validationProof.evidenceRegression.testsPassing, 16);
});
