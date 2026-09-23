import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import electricRangeOntology from '../../../knowledge/canonical/electric_range.json';

const EXPECTED_FROZEN_ELECTRIC_HASH =
  '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

test('CG-11 fit-test contract is closed with Outcome A and does not create gas_range.json', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(contract.status, 'closed');
  assert.equal(contract.closureVerdict, 'CLOSED / GAS_FITS_ELECTRIC_CONTRACT');
  assert.equal(contract.closureArtifact, 'CG11_GAS_RANGE_FIT_CLOSURE_v1.json');
  assert.equal(contract.phase, 'CG-11');
  assert.equal(contract.fitTestMode, 'fit_falsification_against_frozen_contract');
  assert.equal(contract.priorPhaseClosed, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json');
  assert.ok(contract.notCreating.includes('gas_range.json'));
  assert.ok(contract.notCreating.includes('mutations to electric_range.json'));
  assert.ok(contract.notCreating.includes('automatic promotion of igniter'));
  assert.equal(contract.frozenContractUnderTest.immutable, true);
  assert.equal(contract.frozenContractUnderTest.canonicalHashMutationsAllowed, 0);
  assert.equal(contract.successCriteria.canonicalExpansion, 0);
  assert.equal(contract.successCriteria.closureStatus, 'closed_successful');
});

test('CG-11 centerpiece question targets electric vs range/oven contract — not hardware matching', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const centerpiece = contract.centerpieceQuestion;
  assert.equal(centerpiece.id, 'electric_vs_range_oven_contract');
  assert.ok(centerpiece.question.includes('broader range/oven'));
  assert.ok(centerpiece.disallowedShortcut.includes('gas_range.json'));

  const hypothesis = JSON.parse(
    readFileSync(join(CALIBRATION, 'electric_range_gas_fit_hypothesis_v1.json'), 'utf8'),
  );
  assert.equal(hypothesis.contract, 'CG11_GAS_RANGE_FIT_TEST_CONTRACT_v1.json');
  assert.equal(hypothesis.status, 'r1_observation_complete');
  assert.ok(hypothesis.centerpieceHypothesis.nullHypothesis.includes('electric-only'));
});

test('CG-11 R1 is Samsung NX60 gas — not CG-10 electric corpus manufacturers', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const r1 = contract.discoveryCorpus.R1;
  assert.equal(r1.manualId, 'SAMSUNG-NX60-RANGE');
  assert.equal(r1.platformId, 'samsung_range_nx60');
  assert.equal(r1.fuelFilter, 'gas_range');
  assert.equal(r1.observationStatus, 'complete');
  assert.equal(contract.successCriteria.fitAnalysisStatus, 'human_boundary_approved');
  assert.equal(contract.successCriteria.approvedFitOutcome, 'A');
  assert.equal(contract.successCriteria.humanBoundaryApprovalRequired, true);
  assert.equal(contract.successCriteria.r2Required, false);
  assert.ok(r1.excludeProcedureIds.includes('samsungnx60-bake-element'));
  assert.ok(r1.rationale.includes('not in electric discovery corpus'));

  assert.equal(contract.cg10CorpusExclusion.gasR1Manufacturer, 'Samsung NX60 — distinct fuel family on partially shared Samsung range platform');
  assert.equal(contract.discoveryCorpus.R2.status, 'deferred');
});

test('CG-11 boundary questions map to frozen electric_range layers with vocabulary guardrails', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );

  const byId = Object.fromEntries(
    (contract.boundaryQuestions as Array<{ id: string; frozenContractNode: string; layer: string }>).map(
      (q) => [q.id, q],
    ),
  );

  assert.equal(byId.power_supply_gas.frozenContractNode, 'power_supply');
  assert.equal(byId.power_supply_gas.layer, 'components[]');
  assert.equal(byId.bake_instance_scope_gas.frozenContractNode, 'bake_heating_element');
  assert.equal(byId.bake_instance_scope_gas.layer, 'instanceScopes[]');
  assert.equal(byId.convection_fan_gas.layer, 'conditionalConcepts[]');

  const guard = contract.vocabularyGuardrails;
  assert.ok(guard.doNotAutoCreateCanonical.includes('gas_valve'));
  assert.ok(guard.doNotAutoCreateCanonical.includes('igniter'));
  assert.ok(guard.requiredClassification.includes('platform_implementation_only'));
  assert.ok(guard.requiredClassification.includes('contract_boundary'));
});

test('frozen electric_range.json is immutable contract truth during CG-11', () => {
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG11_GAS_RANGE_FIT_TEST_CONTRACT_v1.json'), 'utf8'),
  );
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json'), 'utf8'),
  );

  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(contract.frozenContractUnderTest.hash, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(lock.canonicalOntology.hash, EXPECTED_FROZEN_ELECTRIC_HASH);
  assert.equal(electricRangeOntology.ontology.frozen, true);
  assert.equal(electricRangeOntology.ontology.id, 'electric_range');
});
