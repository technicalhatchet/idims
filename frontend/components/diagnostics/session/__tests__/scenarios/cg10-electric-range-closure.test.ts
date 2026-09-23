import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import electricRangeOntology from '../../../knowledge/canonical/electric_range.json';

const EXPECTED_CANONICAL_HASH =
  '0edfd0988fa4f782d946bc7e65089ad018bbb769851be0c6f30a701851e72d54';

const EXPECTED_CANONICAL_HASH_BEFORE_FREEZE =
  '480802761b32a5d0e23611417f02220d4c9b4384fec5dec04e2c737907689749';

const EXPECTED_RECOMMENDATION_HASH =
  '65a576ba6d3cff7836b61305d23ec9402f56dbe9f098f8a544cfb7ff939265ee';

const EXPECTED_REFERENCE_OVERLAY_HASH =
  'd4ba3be53830955f36edf9f2d0bbb2bb1bfd866bb954afce0b03ddb2c704ffe7';

const CALIBRATION = resolve(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

test('CG-10 freeze lock closes electric range architecture with explicit ontology layers', () => {
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_ONTOLOGY_DISCOVERY_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(lock.status, 'closed_successful');
  assert.equal(lock.verdict, 'CLOSED / ELECTRIC_RANGE_ARCHITECTURE_COMPLETE');
  assert.equal(contract.status, 'closed');
  assert.equal(contract.closureArtifact, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json');
  assert.equal(contract.closureVerdict, 'CLOSED / ELECTRIC_RANGE_ARCHITECTURE_COMPLETE');

  const layers = lock.ontologyLayers;
  assert.deepEqual(layers.canonicalComponents.ids, [
    'power_supply',
    'control_board',
    'user_interface',
    'temperature_sensor',
    'surface_heating_system',
  ]);
  assert.equal(layers.canonicalComponents.count, 5);
  assert.equal(layers.canonicalComponents.layer, 'components[]');

  assert.deepEqual(layers.instanceScopes.ids, ['bake_heating_element', 'broil_heating_element']);
  assert.equal(layers.instanceScopes.layer, 'instanceScopes[]');
  assert.equal(layers.instanceScopes.domainId, 'oven_heat_generation');

  assert.deepEqual(layers.conditionalInstanceScopes.ids, ['convection_heating_element']);
  assert.equal(layers.conditionalInstanceScopes.layer, 'conditionalInstanceScopes[]');

  assert.deepEqual(layers.conditionalConcepts.ids, [
    'convection_fan',
    'thermal_protection',
    'oven_door_switch',
  ]);
  assert.equal(layers.conditionalConcepts.layer, 'conditionalConcepts[]');

  assert.deepEqual(layers.removedFromRev1.ids, ['oven_heating_system']);
  assert.equal(lock.headlineMetrics.canonicalExpansion, 0);
  assert.equal(lock.headlineMetrics.canonicalHashMutationsDuringDiscoveryAuthoring, 0);
  assert.equal(lock.headlineMetrics.cg10RegressionTestsPassing, 18);
});

test('CG-10 frozen canonical hash and recommendation artifact are byte-stable', () => {
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json'), 'utf8'),
  );

  const canonicalHash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(canonicalHash, EXPECTED_CANONICAL_HASH);
  assert.equal(lock.canonicalOntology.hash, EXPECTED_CANONICAL_HASH);
  assert.equal(lock.canonicalOntology.hashBeforeFreeze, EXPECTED_CANONICAL_HASH_BEFORE_FREEZE);
  assert.equal(lock.byteStabilityProof.canonicalHashAfterFreeze, EXPECTED_CANONICAL_HASH);

  const recommendationHash = sha256File(
    join(CALIBRATION, 'CG10_ELECTRIC_RANGE_FREEZE_RECOMMENDATION_v1.json'),
  );
  assert.equal(recommendationHash, EXPECTED_RECOMMENDATION_HASH);
  assert.equal(lock.humanApproval.freezeRecommendationHash, EXPECTED_RECOMMENDATION_HASH);

  const overlayHash = sha256File(
    join(CANONICAL, 'platform_overlays/electric_range.reference.json'),
  );
  assert.equal(overlayHash, EXPECTED_REFERENCE_OVERLAY_HASH);
  assert.equal(
    lock.byteStabilityProof.referenceOverlayHashAtClosure['electric_range.reference.json'],
    EXPECTED_REFERENCE_OVERLAY_HASH,
  );
});

test('CG-10 frozen ontology preserves components vs instanceScopes and validation proof', () => {
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json'), 'utf8'),
  );

  assert.equal(electricRangeOntology.ontology.frozen, true);
  assert.equal(electricRangeOntology.ontology.frozenRevision, 'rev1');
  assert.equal(electricRangeOntology.ontology.frozenAt, '2026-09-16T15:26:00+00:00');

  const componentIds = new Set(electricRangeOntology.components.map((c) => c.id));
  for (const id of lock.ontologyLayers.canonicalComponents.ids) {
    assert.ok(componentIds.has(id));
  }
  for (const id of lock.ontologyLayers.instanceScopes.ids) {
    assert.ok(!componentIds.has(id), `instance scope ${id} must not be in components[]`);
  }

  assert.equal(lock.validationProof.canonicalGraphValidation.result, 'pass');
  assert.equal(lock.validationProof.topologyDependencyValidation.result, 'pass');
  assert.equal(lock.validationProof.evidenceRegression.result, 'pass');
  assert.equal(lock.validationProof.evidenceRegression.testsPassing, 18);

  assert.ok(
    lock.postFreezeInvariants.some((inv: string) => inv.includes('components[] contains exactly five')),
  );
  assert.ok(
    lock.postFreezeInvariants.some((inv: string) => inv.includes('instanceScopes[]')),
  );
  assert.equal(lock.hierarchy.nextPhase, 'CG-11_gas_range_fit_test');
});
