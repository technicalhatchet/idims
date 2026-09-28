import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('range family sequence separates fit tests from normalization/compounding', () => {
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_CLOSURE_v1.json'), 'utf8'),
  );

  assert.equal(sequence.status, 'closed');
  assert.equal(sequence.verdict, 'CLOSED / RANGE_FAMILY_ARCHITECTURE_COMPLETE');
  assert.ok(sequence.coreDistinction.fitTests.includes('architecture boundary'));
  assert.ok(sequence.coreDistinction.normalizationCompounding.includes('CG-3 normalization'));
  assert.equal(sequence.cg11FitResultSummary.diverges, 0);
  assert.ok(sequence.cg11FitResultSummary.notYetDelivered.includes('not yet in Solomon'));

  const phases = sequence.disciplinedSequence.map((p: { phase: string }) => p.phase);
  assert.deepEqual(phases, [
    'CG-11',
    'CG-12',
    'CG-13',
    'CG-RANGE-FAMILY-REVIEW',
    'CG-RANGE-IMPLEMENTATION-GATE',
    'CG-RANGE-NORMALIZATION',
    'CG-RANGE-COMPOUNDING',
    'CG-RANGE-FAMILY-CLOSURE',
  ]);
  assert.equal(sequence.disciplinedSequence[0].status, 'closed');
  assert.equal(sequence.disciplinedSequence[1].status, 'closed');
  assert.equal(sequence.disciplinedSequence[1].crossManufacturerMatrix, 'PENDING');
  assert.equal(sequence.disciplinedSequence[2].status, 'closed');
  assert.equal(sequence.disciplinedSequence[2].closureArtifact, 'CG13_DUAL_FUEL_FIT_CLOSURE_v1.json');
  assert.equal(sequence.disciplinedSequence[3].status, 'closed');
  assert.equal(sequence.disciplinedSequence[4].status, 'closed');
  assert.equal(sequence.disciplinedSequence[4].gateArtifact, 'CG_RANGE_ORGANIZATIONAL_IMPLEMENTATION_GATE_v1.json');
  assert.equal(sequence.disciplinedSequence[5].status, 'closed');
  assert.equal(sequence.disciplinedSequence[5].closureArtifact, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json');
  assert.equal(sequence.disciplinedSequence[6].status, 'closed');
  assert.equal(sequence.disciplinedSequence[6].gateArtifact, 'CG_RANGE_COMPOUNDING_v1.json');
  assert.equal(sequence.disciplinedSequence[7].status, 'closed');
  assert.equal(sequence.disciplinedSequence[7].familyLock, 'CG_RANGE_FAMILY_LOCK_v1.json');
  assert.ok(sequence.nextDisciplinedStep.includes('STOP'));
  assert.equal(sequence.frozenContract.implementationStatus, 'complete');
  assert.equal(sequence.frozenContract.organizationalPrimaryId, 'range_oven');
  assert.equal(sequence.familyReviewSummary.organizationalPrimaryId, 'range_oven');
  assert.equal(sequence.familyReviewSummary.templateRouting, 'all range implementation templates → shared range_oven contract');
  assert.equal(sequence.cg12FitResultSummary.diverges, 0);
  assert.equal(sequence.cg13FitResultSummary.diverges, 0);
  assert.equal(sequence.whirlpoolFamilyWitnessCorpus.manualId, 'W11174814');
  assert.equal(sequence.cumulativeFitExperiment.canonicalHashMutations, 0);

  assert.equal(closure.hierarchy.workstreamSequence, 'CG_RANGE_FAMILY_WORKSTREAM_SEQUENCE_v1.json');
  assert.equal(closure.hierarchy.nextDisciplinedStep, 'CG-12 induction_range fit test');
  assert.ok(closure.futureWorkPolicy.fitVsCompounding.includes('proved compatibility only'));
  assert.ok(sequence.nx60CompoundingTarget.singleManualRule.includes('CG-5.3'));
});
