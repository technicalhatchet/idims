import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { FROZEN_ELECTRIC_RANGE_REV1_HASH } from '../../../knowledge/canonical/canonicalRegistry';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG_RANGE_NX60_NORMALIZATION is normalized under range_oven with service-manual lineage guard', () => {
  const nx60 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_NORMALIZATION_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(nx60.status, 'normalized');
  assert.equal(nx60.canonicalOntologyId, 'range_oven');
  assert.equal(nx60.sourceMetadata.manualId, 'SAMSUNG-NX60-RANGE');
  assert.equal(parent.targets[0].status, 'normalized');
  assert.equal(parent.targets[0].normalizationArtifact, 'CG_RANGE_NX60_NORMALIZATION_v1.json');
  assert.ok(nx60.evidenceLineageGuardrail.fitEvidencePath.notNormalizedAsProcedureEvidence);
  assert.equal(
    nx60.evidenceLineageGuardrail.fitEvidenceReference.observationArtifact,
    'SAMSUNG_NX60_RANGE_gr_cg11x_observation_v1.json',
  );
});

test('NX60 normalization captures canonical functional mappings from service manual evidence', () => {
  const nx60 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_NORMALIZATION_v1.json'), 'utf8'),
  );
  const ids = nx60.canonicalFunctionalMappings.map((m: { canonicalId: string }) => m.canonicalId);

  for (const id of [
    'power_supply',
    'control_board',
    'user_interface',
    'temperature_sensor',
    'surface_heating_system',
    'bake_heating_element',
    'broil_heating_element',
    'convection_fan',
    'thermal_protection',
    'oven_door_switch',
  ]) {
    assert.ok(ids.includes(id), `missing canonical mapping ${id}`);
  }

  const bake = nx60.canonicalFunctionalMappings.find(
    (m: { canonicalId: string }) => m.canonicalId === 'bake_heating_element',
  );
  assert.equal(bake.rangeOvenLayer, 'instanceScopes[]');
  assert.ok(bake.serviceManualEvidence.procedureIds.includes('samsungnx60-bake-ignitor'));
});

test('NX60 measurements retain units, conditions, and manual page provenance', () => {
  const nx60 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_NORMALIZATION_v1.json'), 'utf8'),
  );

  const sensor = nx60.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'nx60-oven-sensor-ohms',
  );
  assert.ok(sensor);
  assert.equal(sensor.unit, 'ohms');
  assert.equal(sensor.nominalValue, 1080);
  assert.ok(sensor.condition.includes('Room temperature'));
  assert.ok(sensor.source.pages.length > 0);
  assert.equal(sensor.source.sourceType, 'service_manual');

  const valve = nx60.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'nx60-safety-valve-amps',
  );
  assert.equal(valve.unit, 'amps');
  assert.equal(valve.expectedRange.normalMin, 3.3);
  assert.equal(valve.expectedRange.normalMax, 3.6);
  assert.equal(valve.implementationTerm, 'safety_valve');
});

test('NX60 excludes gas hardware from canonical promotion', () => {
  const nx60 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_NORMALIZATION_v1.json'), 'utf8'),
  );
  const excluded = nx60.excludedFromCanonicalPromotion.map((e: { term: string }) => e.term);

  for (const term of ['igniter', 'gas_valve', 'safety_valve', 'spark_module', 'bake_element']) {
    assert.ok(excluded.includes(term));
  }

  const vocab = nx60.implementationVocabulary.find(
    (v: { term: string }) => v.term === 'spark_module',
  );
  assert.equal(vocab.classification, 'platform_implementation');
});

test('NX60 provenance audit passes with zero canonical mutation', () => {
  const nx60 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(nx60.provenanceAudit.status, 'passed');
  assert.equal(nx60.provenanceAudit.checks.procedureCount, 14);
  assert.equal(nx60.provenanceAudit.checks.measurementCount, 16);
  assert.equal(nx60.provenanceAudit.checks.canonicalGraphUnchanged, true);
  assert.equal(nx60.provenanceAudit.checks.fitConclusionsNotNormalizedAsManualEvidence, true);
  assert.equal(nx60.definitionOfDone.met, true);

  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(nx60.provenanceAudit.canonicalIntegrity.newCanonicalOntologyFiles, 0);
});

test('NX60 scope excludes NE63 electric element procedures', () => {
  const nx60 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_NORMALIZATION_v1.json'), 'utf8'),
  );
  const procedureIds = nx60.normalizedProcedures.map((p: { procedureId: string }) => p.procedureId);

  assert.ok(!procedureIds.includes('samsungnx60-bake-element'));
  assert.ok(!procedureIds.includes('samsungnx60-broil-element'));
  assert.ok(nx60.scope.excluded.some((s: string) => s.includes('bake-element')));
});
