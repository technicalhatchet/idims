import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import electricRangeOntology from '../../../knowledge/canonical/electric_range.json';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-10 rev1 is frozen and locked by CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json', () => {
  assert.equal(electricRangeOntology.ontology.frozen, true);
  assert.equal(electricRangeOntology.ontology.frozenRevision, 'rev1');
  assert.equal(electricRangeOntology.ontology.frozenAt, '2026-09-16T15:26:00+00:00');
  assert.ok(String(electricRangeOntology.ontology.frozenNote).includes('CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json'));

  const freeze = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_FREEZE_RECOMMENDATION_v1.json'), 'utf8'),
  );
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json'), 'utf8'),
  );
  assert.equal(freeze.status, 'recommendation_approved');
  assert.equal(freeze.canonicalOntologyFile, 'electric_range.json');
  assert.equal(freeze.canonicalOntologyFrozen, true);
  assert.equal(freeze.freezeLockArtifact, 'CG10_ELECTRIC_RANGE_FREEZE_LOCK_v1.json');
  assert.equal(lock.verdict, 'CLOSED / ELECTRIC_RANGE_ARCHITECTURE_COMPLETE');
  assert.ok(freeze.humanFreezeApprovedAt);
});

test('rev1 components[] contains only KEEP nodes from freeze recommendation', () => {
  const componentIds = new Set(electricRangeOntology.components.map((c) => c.id));

  for (const id of [
    'power_supply',
    'control_board',
    'user_interface',
    'temperature_sensor',
    'surface_heating_system',
  ]) {
    assert.ok(componentIds.has(id), `missing KEEP component ${id}`);
  }

  assert.equal(componentIds.size, 5);
});

test('instance-scoped oven heat functions live in instanceScopes[] not components[]', () => {
  const componentIds = new Set(electricRangeOntology.components.map((c) => c.id));
  const instanceScopeIds = (electricRangeOntology as { instanceScopes?: Array<{ id: string }> }).instanceScopes?.map(
    (s) => s.id,
  ) ?? [];

  assert.ok(instanceScopeIds.includes('bake_heating_element'));
  assert.ok(instanceScopeIds.includes('broil_heating_element'));

  for (const id of ['bake_heating_element', 'broil_heating_element', 'oven_heating_system']) {
    assert.ok(!componentIds.has(id), `${id} must not be in components[]`);
  }

  const conditionalInstanceScopes = (
    electricRangeOntology as { conditionalInstanceScopes?: Array<{ id: string }> }
  ).conditionalInstanceScopes?.map((s) => s.id) ?? [];
  assert.ok(conditionalInstanceScopes.includes('convection_heating_element'));
  assert.ok(!componentIds.has('convection_heating_element'));
});

test('conditional and platform-only concepts are excluded from components[]', () => {
  const componentIds = new Set(electricRangeOntology.components.map((c) => c.id));

  for (const id of ['convection_fan', 'thermal_protection', 'oven_door_switch']) {
    assert.ok(!componentIds.has(id), `conditional concept incorrectly in components[]: ${id}`);
  }

  for (const id of ['surface_control', 'surface_heating_element', 'door_latch_motor', 'oven_lamp']) {
    assert.ok(!componentIds.has(id), `platform-only concept incorrectly in components[]: ${id}`);
  }
});

test('rev1 freeze provenance links to recommendation and preserves components vs instanceScopes', () => {
  const provenance = (electricRangeOntology as {
    freezeProvenance?: {
      freezeRecommendation?: string;
      componentsVsInstanceScopesPreserved?: boolean;
      humanFreezeReview?: { approvalIsNotCanonicalFreeze?: boolean; instanceScopesNotInComponents?: boolean };
    };
  }).freezeProvenance;

  assert.ok(provenance);
  assert.equal(provenance?.freezeRecommendation, 'CG10_ELECTRIC_RANGE_FREEZE_RECOMMENDATION_v1.json');
  assert.equal(provenance?.componentsVsInstanceScopesPreserved, true);
  assert.equal(provenance?.humanFreezeReview?.approvalIsNotCanonicalFreeze, true);
  assert.equal(provenance?.humanFreezeReview?.instanceScopesNotInComponents, true);
});

test('rev1 dispositions match freeze recommendation buckets', () => {
  const freeze = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG10_ELECTRIC_RANGE_FREEZE_RECOMMENDATION_v1.json'), 'utf8'),
  );
  const provenance = (electricRangeOntology as { freezeProvenance?: Record<string, unknown> }).freezeProvenance;

  assert.deepEqual(provenance?.keep, freeze.summary.keep);
  assert.deepEqual(provenance?.instanceScope, freeze.summary.instanceScope);
  assert.deepEqual(provenance?.remove, freeze.summary.remove);
  assert.deepEqual(provenance?.defer, freeze.summary.defer);
});

test('control_board → surface_heating_system invariant is encoded in relationships', () => {
  const rel = electricRangeOntology.relationships.find(
    (r) => r.from === 'control_board' && r.to === 'surface_heating_system' && r.type === 'controls',
  );
  assert.ok(rel);
});
