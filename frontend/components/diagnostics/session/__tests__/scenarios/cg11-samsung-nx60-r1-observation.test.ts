import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const FROZEN_HASH = '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

test('CG-11 R1 Samsung NX60 observation classifies against frozen electric layers only', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NX60_RANGE_gr_cg11x_observation_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(obs.stage, 'R1_gas_fit_observation');
  assert.equal(obs.manualId, 'SAMSUNG-NX60-RANGE');
  assert.equal(obs.fuelFilter, 'gas_range');
  assert.equal(obs.canonicalPromotionBlocked, true);
  assert.equal(obs.canonicalMutationBlocked, true);
  assert.equal(obs.ontologyUnderTest.hash, FROZEN_HASH);
  assert.equal(contract.discoveryCorpus.R1.observationStatus, 'complete');

  const vocab = new Set(obs.classificationVocabulary);
  for (const c of ['INHERITS', 'CONDITIONAL', 'DIVERGES', 'PLATFORM_ONLY', 'NO_EVIDENCE']) {
    assert.ok(vocab.has(c));
  }
});

test('CG-11 R1 all five frozen components INHERIT — bake/broil instance scopes scrutinized', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NX60_RANGE_gr_cg11x_observation_v1.json'), 'utf8'),
  );
  const evals = obs.frozenLayerEvaluations as Record<
    string,
    { classification: string; frozenLayer: string }
  >;

  for (const id of [
    'power_supply',
    'control_board',
    'user_interface',
    'temperature_sensor',
    'surface_heating_system',
  ]) {
    assert.equal(evals[id].classification, 'INHERITS');
    assert.equal(evals[id].frozenLayer, 'components[]');
  }

  assert.equal(evals.bake_heating_element.classification, 'INHERITS');
  assert.equal(evals.bake_heating_element.frozenLayer, 'instanceScopes[]');
  assert.equal(evals.bake_heating_element.instanceScopeFunctionalEquivalence, true);
  assert.equal(evals.broil_heating_element.classification, 'INHERITS');

  assert.equal(obs.bakeBroilScrutiny.bakeFinding.functionalDiagnosticIndependence, true);
  assert.equal(obs.bakeBroilScrutiny.broilFinding.functionalDiagnosticIndependence, true);
  assert.equal(obs.fitTestSummary.divergenceCount, 0);
  assert.equal(obs.fitTestSummary.bothInstanceScopesInherit, true);
});

test('CG-11 R1 gas hardware stays platform-only — not promoted to canonical', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NX60_RANGE_gr_cg11x_observation_v1.json'), 'utf8'),
  );

  const platform = obs.platformHardwareClassifications.observed as Array<{
    oemConcept: string;
    classification: string;
  }>;
  const byOem = Object.fromEntries(platform.map((p) => [p.oemConcept, p]));

  assert.equal(byOem.igniter.classification, 'PLATFORM_ONLY');
  assert.equal(byOem.gas_valve.classification, 'PLATFORM_ONLY');
  assert.equal(byOem.safety_valve.classification, 'PLATFORM_ONLY');
  assert.equal(byOem.spark_module.classification, 'PLATFORM_ONLY');

  assert.equal(obs.fitTestSummary.gasHardwarePromotedToCanonical, false);
  assert.equal(obs.recommendation.canonicalMutation, false);
  assert.equal(obs.recommendation.provisionalFitOutcome, 'A');
  assert.equal(obs.recommendation.r2Required, false);
});

test('CG-11 R1 provisional centerpiece answer — range/oven contract not electric-only', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NX60_RANGE_gr_cg11x_observation_v1.json'), 'utf8'),
  );

  const answer = obs.centerpieceQuestionAnswer;
  assert.equal(answer.questionId, 'electric_vs_range_oven_contract');
  assert.ok(answer.provisionalAnswer.includes('range/oven functional contract'));
  assert.ok(answer.doesNotAuthorize.includes('mutating electric_range.json'));
  assert.ok(answer.doesNotAuthorize.includes('creating gas_range.json'));
  assert.equal(obs.recommendation.fitAnalysisNext, true);
});
