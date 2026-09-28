import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const PROCEDURES = join(
  process.cwd(),
  'components/diagnostics/procedures/seed/samsung_microwave_otr',
);

test('R1 gate approved — Samsung R2 observation authorized and complete', () => {
  const r1Gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_R1_GATE_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );
  const lg = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'LG_LMHM2237_MICROWAVE_cg_microwave_fit_observation_v1.json'),
      'utf8',
    ),
  );

  assert.equal(r1Gate.verdict, 'GREEN / R1_APPROVED_AUTHORIZE_R2');
  assert.equal(lg.r1GateApproved, 'CG_MICROWAVE_FIT_R1_GATE_v1.json');
  assert.equal(contract.r2Authorized, true);
  assert.equal(contract.r2ObservationComplete, true);
  assert.equal(contract.discoveryCorpus.R2.observationStatus, 'complete');
});

test('Samsung R2 records 14 procedures — independent evidentiary artifact', () => {
  const observation = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'SAMSUNG_ME11_MICROWAVE_cg_microwave_fit_observation_v1.json'),
      'utf8',
    ),
  );
  const catalog = JSON.parse(readFileSync(join(PROCEDURES, 'procedureCatalog.json'), 'utf8'));

  assert.equal(observation.status, 'complete');
  assert.equal(observation.stage, 'R2_microwave_fit_observation');
  assert.equal(observation.canonicalPromotionBlocked, true);
  assert.equal(observation.crossManufacturerProof, false);
  assert.equal(observation.pipelineCounts.proceduresEvaluated, 14);
  assert.equal(observation.procedureObservations.length, 14);
  assert.equal(catalog.plannedProcedures.length, 14);
});

test('R2 triangulation tests functional recurrence not component universality', () => {
  const triangulation = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TRIANGULATION_v1.json'), 'utf8'),
  );
  const r2 = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'SAMSUNG_ME11_MICROWAVE_cg_microwave_fit_observation_v1.json'),
      'utf8',
    ),
  );

  assert.equal(triangulation.fitClosureBlocked, true);
  assert.equal(triangulation.preliminaryRemainsLocked, true);
  assert.equal(triangulation.crossManufacturerSummary.fitsAnyFrozenContract, false);
  assert.equal(triangulation.humanBoundaryDecision.status, 'approved');

  const hv = triangulation.domainTriangulation.find(
    (d: { domainId: string }) => d.domainId === 'hv_generation',
  );
  assert.equal(hv.functionalRecurrence, true);
  assert.equal(hv.triangulationVerdict.includes('CROSS_MANUFACTURER'), true);

  assert.equal(r2.functionalLayerEvaluations.hv_generation.comparisons.range_oven.classification, 'NO_HOST');
  assert.equal(
    r2.rangeOvenContaminationAssessment.rangeArchitectureReopened,
    false,
  );
});
