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

test('CG_RANGE_NE58R9560WS_NORMALIZATION is normalized under range_oven with CG-12 lineage guard', () => {
  const ne58r = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_NORMALIZATION_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(ne58r.status, 'normalized');
  assert.equal(ne58r.canonicalOntologyId, 'range_oven');
  assert.equal(ne58r.implementationTemplateId, 'induction_range');
  assert.equal(ne58r.sourceMetadata.manualId, 'SAMSUNG-NE58R9560-INDUCTION');
  assert.equal(parent.targets[1].status, 'normalized');
  assert.equal(
    parent.targets[1].normalizationArtifact,
    'CG_RANGE_NE58R9560WS_NORMALIZATION_v1.json',
  );
  assert.ok(ne58r.evidenceLineageGuardrail.fitEvidencePath.notNormalizedAsProcedureEvidence);
  assert.equal(
    ne58r.evidenceLineageGuardrail.fitEvidenceReference.observationArtifact,
    'SAMSUNG_NE58R9560WS_IR_CG12X_OBSERVATION_v1.json',
  );
});

test('NE58R normalization captures induction surface_heating_system witness without canonical promotion', () => {
  const ne58r = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_NORMALIZATION_v1.json'), 'utf8'),
  );
  const ids = ne58r.canonicalFunctionalMappings.map((m: { canonicalId: string }) => m.canonicalId);

  for (const id of [
    'power_supply',
    'control_board',
    'user_interface',
    'temperature_sensor',
    'surface_heating_system',
    'bake_heating_element',
    'broil_heating_element',
    'convection_heating_element',
    'convection_fan',
    'thermal_protection',
    'oven_door_switch',
  ]) {
    assert.ok(ids.includes(id), `missing canonical mapping ${id}`);
  }

  const surface = ne58r.canonicalFunctionalMappings.find(
    (m: { canonicalId: string }) => m.canonicalId === 'surface_heating_system',
  );
  assert.equal(surface.criticalInductionWitness, true);
  assert.ok(surface.serviceManualEvidence.procedureIds.includes('ne58r-pan-detection'));
  assert.ok(surface.serviceManualEvidence.platformTerms.includes('inverter_pcb'));
});

test('NE58R measurements retain units, conditions, and induction-specific thresholds', () => {
  const ne58r = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_NORMALIZATION_v1.json'), 'utf8'),
  );

  const sensor = ne58r.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'ne58r-oven-sensor-ohms',
  );
  assert.ok(sensor);
  assert.equal(sensor.unit, 'ohms');
  assert.equal(sensor.nominalValue, 1080);
  assert.ok(sensor.condition.includes('Room temperature'));
  assert.equal(sensor.source.sourceType, 'service_manual');

  const igbtSensor = ne58r.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'ne58r-igbt-sensor-ohms-open-good',
  );
  assert.equal(igbtSensor.unit, 'ohms');
  assert.equal(igbtSensor.expectedValue, 10000);
  assert.equal(igbtSensor.implementationTerm, 'igbt_sensor');
  assert.equal(igbtSensor.rangeOvenBinding, 'surface_heating_system');

  const bake = ne58r.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'ne58r-bake-heater-ohms',
  );
  assert.equal(bake.expectedRange.normalMin, 17);
  assert.equal(bake.expectedRange.normalMax, 19);
});

test('NE58R excludes induction hardware from canonical promotion', () => {
  const ne58r = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_NORMALIZATION_v1.json'), 'utf8'),
  );
  const excluded = ne58r.excludedFromCanonicalPromotion.map((e: { term: string }) => e.term);

  for (const term of [
    'inverter',
    'igbt',
    'induction_coil',
    'igbt_sensor',
    'top_sensor',
    'pan_detection',
    'filter_pcb',
    'induction_range.json',
  ]) {
    assert.ok(excluded.includes(term));
  }

  const vocab = ne58r.implementationVocabulary.find(
    (v: { term: string }) => v.term === 'inverter',
  );
  assert.equal(vocab.classification, 'platform_implementation');
  assert.equal(vocab.bindsTo, 'surface_heating_system');
});

test('NE58R provenance audit passes with zero canonical mutation and CG-12 not reopened', () => {
  const ne58r = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(ne58r.provenanceAudit.status, 'passed');
  assert.equal(ne58r.provenanceAudit.checks.procedureCount, 24);
  assert.equal(ne58r.provenanceAudit.checks.inductionCooktopProcedures, 8);
  assert.equal(ne58r.provenanceAudit.checks.measurementCount, 25);
  assert.equal(ne58r.provenanceAudit.checks.canonicalGraphUnchanged, true);
  assert.equal(ne58r.provenanceAudit.checks.fitConclusionsNotNormalizedAsManualEvidence, true);
  assert.equal(ne58r.provenanceAudit.checks.cg12NotReopened, true);
  assert.equal(ne58r.definitionOfDone.met, true);

  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(ne58r.provenanceAudit.canonicalIntegrity.newCanonicalOntologyFiles, 0);
});

test('NE58R scope excludes electric Flex Duo NE58F corpus', () => {
  const ne58r = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.ok(
    ne58r.scope.excluded.some((s: string) => s.includes('NE58F9710WS') || s.includes('Flex Duo')),
  );
  assert.ok(ne58r.evidenceLineageGuardrail.excludedCorpus['samsung_range_ne58 procedure seeds']);
});
