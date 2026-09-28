import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-RANGE-NORMALIZATION is active with core constraint on frozen fit evidence', () => {
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );
  const implClosure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_ORGANIZATIONAL_IMPLEMENTATION_GATE_CLOSURE_v1.json'), 'utf8'),
  );

  assert.equal(normalization.status, 'closed');
  assert.equal(normalization.workstream, 'CG-RANGE-NORMALIZATION');
  assert.equal(normalization.priorPhaseClosed, 'CG_RANGE_ORGANIZATIONAL_IMPLEMENTATION_GATE_CLOSURE_v1.json');
  assert.equal(implClosure.status, 'closed');
  assert.ok(
    normalization.coreConstraint.includes('does not reopen or reinterpret CG-11/12/13'),
  );
  assert.equal(normalization.targetCanonicalIdentity.primaryId, 'range_oven');
});

test('CG-RANGE-NORMALIZATION locks range_oven identity and forbids fuel-specific canonical graphs', () => {
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );
  const identityRule = normalization.normalizationRules.find(
    (rule: { id: string }) => rule.id === 'range_oven_target_identity',
  );

  assert.ok(identityRule);
  assert.ok(identityRule.doesNotCreate.includes('gas_range.json'));
  assert.ok(identityRule.doesNotCreate.includes('induction_range.json'));
  assert.ok(identityRule.doesNotCreate.includes('dual_fuel_range.json'));
});

test('CG-RANGE-NORMALIZATION preserves implementation vocabulary as platform knowledge', () => {
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );
  const vocabRule = normalization.normalizationRules.find(
    (rule: { id: string }) => rule.id === 'preserve_implementation_vocabulary',
  );

  assert.ok(vocabRule.vocabularyByImplementation.gas.includes('gas_valve'));
  assert.ok(vocabRule.vocabularyByImplementation.gas.includes('igniter'));
  assert.ok(vocabRule.vocabularyByImplementation.induction.includes('inverter'));
  assert.ok(vocabRule.vocabularyByImplementation.induction.includes('igbt'));
  assert.ok(vocabRule.vocabularyByImplementation.induction.includes('induction_coil'));
});

test('CG-RANGE-NORMALIZATION defines four targets in NX60 → NE58R → NY63 → W11174814 order', () => {
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );

  const order = normalization.normalizationOrder.map((entry: { targetId: string }) => entry.targetId);
  assert.deepEqual(order, [
    'samsung_nx60_gas',
    'samsung_ne58r9560ws_induction',
    'samsung_ny63t8751ss_dual_fuel',
    'whirlpool_w11174814_corpus',
  ]);

  assert.equal(normalization.targets.length, 4);
  assert.equal(normalization.targets[0].manualId, 'SAMSUNG-NX60-RANGE');
  assert.equal(normalization.targets[0].status, 'normalized');
  assert.equal(normalization.targets[0].normalizationArtifact, 'CG_RANGE_NX60_NORMALIZATION_v1.json');
  assert.equal(normalization.targets[1].smokeModel, 'NE58R9560WS/AA');
  assert.equal(normalization.targets[1].status, 'normalized');
  assert.equal(
    normalization.targets[1].normalizationArtifact,
    'CG_RANGE_NE58R9560WS_NORMALIZATION_v1.json',
  );
  assert.equal(normalization.targets[2].smokeModel, 'NY63T8751SS/AA');
  assert.equal(normalization.targets[2].status, 'normalized');
  assert.equal(
    normalization.targets[2].normalizationArtifact,
    'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json',
  );
  assert.equal(normalization.targets[3].manualId, 'W11174814');
  assert.equal(normalization.targets[3].role, 'corroboration');
  assert.equal(normalization.targets[3].status, 'normalized');
  assert.equal(
    normalization.targets[3].normalizationArtifact,
    'CG_RANGE_W11174814_NORMALIZATION_v1.json',
  );
  assert.equal(normalization.targets[3].notRetroactiveFitEvidence, true);
});

test('fit witnesses are frozen inputs — normalization does not rewrite CG-11/12/13 artifacts', () => {
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(normalization.frozenFitEvidence.immutable, true);
  assert.ok(
    normalization.frozenFitEvidence.doNotRewrite.includes('CG11_GAS_RANGE_FIT_CLOSURE_v1.json'),
  );
  assert.ok(
    normalization.frozenFitEvidence.doNotRewrite.includes('CG12_INDUCTION_FIT_CLOSURE_v1.json'),
  );
  assert.ok(
    normalization.frozenFitEvidence.doNotRewrite.includes('CG13_DUAL_FUEL_FIT_CLOSURE_v1.json'),
  );
  assert.ok(
    normalization.frozenFitEvidence.doNotRewrite.includes('electric_range.json'),
  );

  assert.equal(normalization.targets[0].fitWitness.workstream, 'CG-11');
  assert.equal(normalization.targets[1].fitWitness.diverges, 0);
  assert.equal(normalization.targets[2].fitWitness.verdict, 'CLOSED / DUAL_FUEL_FITS_ELECTRIC_CONTRACT');
  assert.equal(normalization.targets[3].fitWitness, null);
  assert.equal(normalization.targets[3].notRetroactiveFitEvidence, true);
});

test('provenance contract requires manufacturer, platform, manual, and range_oven binding', () => {
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(normalization.provenanceContract.canonicalOntologyId, 'range_oven');
  const fields = normalization.provenanceContract.minimumFields;
  assert.ok(fields.manufacturer);
  assert.ok(fields.platformId);
  assert.ok(fields.sourceManual);
  assert.ok(fields.pageOrSection);
  assert.equal(fields.canonicalOntologyId, 'range_oven');
});

test('CG-RANGE-NORMALIZATION audit green unlocks CG-RANGE-COMPOUNDING', () => {
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );

  assert.equal(normalization.exitCriteria.provenanceAuditGreen, true);
  assert.equal(normalization.exitCriteria.normalizationRegressionGreen, true);
  assert.equal(normalization.exitCriteria.closureArtifact, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json');
  assert.equal(normalization.compoundingBlockedUntil, null);
  assert.equal(normalization.unlockOnSuccess.compounding, 'CG-RANGE-COMPOUNDING');
  assert.equal(audit.verdict, 'GREEN / NORMALIZATION_AUDIT_PASSED');
  assert.equal(sequence.disciplinedSequence[5].status, 'closed');
  assert.equal(sequence.disciplinedSequence[6].status, 'active');
  assert.ok(normalization.pipelineFlow.stages.includes('normalization regression / provenance audit'));
});

test('CG-RANGE-NORMALIZATION defers remaining-family inventory until range compounding closure', () => {
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.ok(
    normalization.explicitNonGoals.some((goal: string) =>
      goal.includes('Remaining-appliance-family inventory'),
    ),
  );
  assert.ok(
    normalization.unlockOnSuccess.remainingFamilyInventory.includes('deferred'),
  );
});
