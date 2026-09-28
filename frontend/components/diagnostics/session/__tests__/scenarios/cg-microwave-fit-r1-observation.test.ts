import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');
const PROCEDURES = join(
  process.cwd(),
  'components/diagnostics/procedures/seed/lg_microwave_otr',
);

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

test('LG R1 observation is complete evidentiary artifact — no canonical promotion', () => {
  const observation = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'LG_LMHM2237_MICROWAVE_cg_microwave_fit_observation_v1.json'),
      'utf8',
    ),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(observation.status, 'complete');
  assert.equal(observation.manualId, 'LG-LMHM2237-MICROWAVE');
  assert.equal(observation.contract, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json');
  assert.equal(observation.canonicalPromotionBlocked, true);
  assert.equal(observation.canonicalMutationBlocked, true);
  assert.equal(observation.crossManufacturerProof, false);
  assert.equal(observation.r1GateApproved, 'CG_MICROWAVE_FIT_R1_GATE_v1.json');
  assert.equal(contract.discoveryCorpus.R1.observationStatus, 'complete');
  assert.equal(contract.r2Authorized, true);
  assert.equal(contract.r2ObservationComplete, true);
});

test('R1 records all 12 LMHM2237 procedures with manual provenance', () => {
  const observation = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'LG_LMHM2237_MICROWAVE_cg_microwave_fit_observation_v1.json'),
      'utf8',
    ),
  );
  const catalog = JSON.parse(readFileSync(join(PROCEDURES, 'procedureCatalog.json'), 'utf8'));

  assert.equal(observation.pipelineCounts.proceduresEvaluated, 12);
  assert.equal(observation.procedureObservations.length, 12);
  assert.equal(catalog.plannedProcedures.length, 12);

  const catalogIds = catalog.plannedProcedures.map((p: { id: string }) => p.id).sort();
  const observedIds = observation.procedureObservations
    .map((p: { procedureId: string }) => p.procedureId)
    .sort();
  assert.deepEqual(observedIds, catalogIds);

  for (const proc of observation.procedureObservations) {
    assert.ok(proc.oemSection, proc.procedureId);
    assert.ok(proc.pages?.length, proc.procedureId);
    assert.ok(proc.functionalBehavior, proc.procedureId);
  }
});

test('R1 separates superficial overlap from divergence — range_oven contamination flagged', () => {
  const observation = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'LG_LMHM2237_MICROWAVE_cg_microwave_fit_observation_v1.json'),
      'utf8',
    ),
  );

  const layers = observation.functionalLayerEvaluations;
  assert.equal(layers.door_interlock_chain.comparisons.range_oven.classification, 'CONTAMINATES_IF_MERGED');
  assert.equal(layers.hv_generation.comparisons.range_oven.classification, 'NO_HOST');
  assert.equal(observation.rangeOvenContaminationAssessment.rangeArchitectureReopened, false);
  assert.equal(observation.r1PreliminarySummary.rangeOvenVariantHypothesis, 'rejected_preliminary');
  assert.equal(observation.divergenceEvidence.notArchitecturalConclusion, true);
  assert.equal(observation.divergenceEvidence.requiresR2Triangulation, true);

  const rangeHash = sha256File(join(CANONICAL, 'range_oven.json'));
  assert.equal(rangeHash, RANGE_OVEN_HASH);
  assert.equal(observation.rangeOvenContaminationAssessment.rangeOvenHashUnchanged, true);
});

test('R1 captures HV/interlock measurements and does not create microwave.json', () => {
  const observation = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'LG_LMHM2237_MICROWAVE_cg_microwave_fit_observation_v1.json'),
      'utf8',
    ),
  );

  const hvProc = observation.procedureObservations.find(
    (p: { procedureId: string }) => p.procedureId === 'lgotrmw-hv-transformer',
  );
  assert.ok(hvProc.measurements.some((m: { knowledgeId: string }) => m.knowledgeId.includes('Transformer')));

  const interlock = observation.procedureObservations.find(
    (p: { procedureId: string }) => p.procedureId === 'lgotrmw-door-interlock',
  );
  assert.equal(interlock.microwaveSpecificMechanism, 'hv_safety_interlock_monitor_chain');

  assert.ok(
    observation.explicitNonActions.some((a: string) => a.includes('No microwave.json')),
  );
  assert.ok(observation.explicitNonActions.some((a: string) => a.includes('No microwave.json')));
});
