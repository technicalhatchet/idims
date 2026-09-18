import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import rangeOvenOntology from '../../../knowledge/canonical/range_oven.json';
const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

test('CG-MICROWAVE-FIT contract is closed Outcome B and does not create microwave.json', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );
  const inventory = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_CANONICAL_FAMILY_INVENTORY_v1.json'), 'utf8'),
  );

  assert.equal(contract.status, 'closed');
  assert.equal(contract.closureVerdict, 'CLOSED / MICROWAVE_GENUINE_FUNCTIONAL_DIVERGENCE');
  assert.equal(contract.approvedFitOutcome, 'B');
  assert.equal(contract.phase, 'CG-MICROWAVE-FIT');
  assert.equal(contract.priorPhaseClosed, 'CG_CANONICAL_FAMILY_INVENTORY_v1.json');
  assert.equal(inventory.status, 'closed');
  assert.equal(inventory.microwaveWorkstream.fitClosed, 'CG_MICROWAVE_FIT_CLOSURE_v1.json');
  assert.equal(inventory.microwaveWorkstream.fitOutcome, 'B_genuine_divergence_documented');
  assert.equal(
    inventory.microwaveWorkstream.discoveryClosed,
    'CG_MICROWAVE_DISCOVERY_CLOSURE_v1.json',
  );
  assert.equal(
    inventory.microwaveWorkstream.freezeLock,
    'CG_MICROWAVE_FREEZE_LOCK_v1.json',
  );
  assert.ok(contract.notCreating.includes('microwave.json'));
  assert.ok(contract.notCreating.includes('mutations to range_oven.json'));
  assert.equal(contract.successCriteria.canonicalExpansion, 0);
  assert.equal(contract.successCriteria.closureStatus, 'closed_successful');
  assert.equal(contract.successCriteria.fitAnalysisStatus, 'human_boundary_approved');
  assert.equal(contract.successCriteria.approvedFitOutcome, 'B');
});

test('CG-MICROWAVE-FIT hard gate: diverges before new graph; no first-manual shortcut', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const gate = contract.hardGateRule;
  assert.ok(gate.tree.some((step: string) => step.includes('FITS EXISTING CONTRACT')));
  assert.ok(gate.tree.some((step: string) => step.includes('DIVERGES')));
  assert.ok(gate.disallowedShortcut.includes('microwave.json'));

  assert.ok(
    contract.immutableRules.some((r: string) => r.includes('CG_RANGE_FAMILY_LOCK')),
  );
});

test('CG-MICROWAVE-FIT centerpiece questions cover contamination and functional contract', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );
  const hypothesis = JSON.parse(
    readFileSync(join(CALIBRATION, 'microwave_existing_family_fit_hypothesis_v1.json'), 'utf8'),
  );

  const ids = contract.centerpieceQuestions.map((q: { id: string }) => q.id);
  assert.ok(ids.includes('microwave_vs_any_existing_contract'));
  assert.ok(ids.includes('range_oven_contamination'));
  assert.ok(ids.includes('implementation_vs_functional_contract'));

  const contamination = contract.centerpieceQuestions.find(
    (q: { id: string }) => q.id === 'range_oven_contamination',
  );
  assert.equal(contamination.lockedFamily, 'range_oven');
  assert.equal(contamination.familyLock, 'CG_RANGE_FAMILY_LOCK_v1.json');

  assert.equal(hypothesis.contract, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json');
  assert.equal(hypothesis.status, 'r1_observation_complete');
  assert.equal(hypothesis.r1PreliminaryLean, 'genuine_divergence_preliminary');
  assert.ok(hypothesis.centerpieceHypothesis.nullHypothesis.includes('divergence'));
});

test('range_oven remains locked and immutable under microwave fit test', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const rangeProbe = contract.frozenContractsUnderTest.find(
    (c: { id: string }) => c.id === 'range_oven',
  );
  assert.equal(rangeProbe.immutable, true);
  assert.equal(rangeProbe.primaryContaminationProbe, true);
  assert.equal(rangeProbe.hash, RANGE_OVEN_HASH);
  assert.equal(rangeProbe.familyLock, 'CG_RANGE_FAMILY_LOCK_v1.json');

  const rangeHash = sha256File(join(CANONICAL, 'range_oven.json'));
  assert.equal(rangeHash, RANGE_OVEN_HASH);
  assert.equal(rangeOvenOntology.ontology.frozen, true);
  assert.ok(contract.notCreating.includes('microwave.json'));
  assert.equal(contract.successCriteria.canonicalExpansion, 0);
});

test('CG-MICROWAVE-FIT R1 is LG LMHM2237; R2 is Samsung ME11 for triangulation', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const r1 = contract.discoveryCorpus.R1;
  assert.equal(r1.manualId, 'LG-LMHM2237-MICROWAVE');
  assert.equal(r1.platformId, 'lg_microwave_otr');
  assert.equal(r1.observationStatus, 'complete');
  assert.equal(
    r1.observationArtifact,
    'LG_LMHM2237_MICROWAVE_cg_microwave_fit_observation_v1.json',
  );

  const r2 = contract.discoveryCorpus.R2;
  assert.equal(r2.manualId, 'SAMSUNG-ME11-MICROWAVE');
  assert.equal(r2.platformId, 'samsung_microwave_otr');
  assert.equal(r2.observationStatus, 'complete');
  assert.equal(
    r2.observationArtifact,
    'SAMSUNG_ME11_MICROWAVE_cg_microwave_fit_observation_v1.json',
  );
  assert.equal(contract.r2Authorized, true);
  assert.equal(contract.triangulationArtifact, 'CG_MICROWAVE_FIT_TRIANGULATION_v1.json');
  assert.equal(contract.successCriteria.r2RequiredForClosure, true);
});

test('functional layers include HV, interlock, cavity, and OTR ventilation probes', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const layerIds = contract.functionalLayersUnderTest.layers.map(
    (l: { id: string }) => l.id,
  );
  assert.ok(layerIds.includes('hv_generation'));
  assert.ok(layerIds.includes('door_interlock_chain'));
  assert.ok(layerIds.includes('rf_cavity'));
  assert.ok(layerIds.includes('thermal_protection'));
  assert.ok(layerIds.includes('ventilation_otr'));

  const vent = contract.functionalLayersUnderTest.layers.find(
    (l: { id: string }) => l.id === 'ventilation_otr',
  );
  assert.ok(vent.rangeOvenContaminationRisk.includes('surface_heating_system'));
});
