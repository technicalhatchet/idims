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

test('CG_RANGE_NY63T8751SS_NORMALIZATION is normalized under range_oven with CG-13 lineage guard', () => {
  const ny63 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(ny63.status, 'normalized');
  assert.equal(ny63.canonicalOntologyId, 'range_oven');
  assert.equal(ny63.implementationTemplateId, 'dual_fuel_range');
  assert.equal(ny63.sourceMetadata.manualId, 'SAMSUNG-NY63-DUAL-FUEL');
  assert.equal(parent.targets[2].status, 'normalized');
  assert.equal(
    parent.targets[2].normalizationArtifact,
    'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json',
  );
  assert.ok(ny63.evidenceLineageGuardrail.fitEvidencePath.notNormalizedAsProcedureEvidence);
  assert.equal(
    ny63.evidenceLineageGuardrail.fitEvidenceReference.observationArtifact,
    'SAMSUNG_NY63T8751SS_DF_CG13X_OBSERVATION_v1.json',
  );
});

test('NY63 captures dual-energy control_board topology without separate canonical nodes', () => {
  const ny63 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.ok(ny63.crossDomainControlArchitecture);
  assert.ok(ny63.crossDomainControlArchitecture.topology.includes('control_board'));
  assert.ok(ny63.crossDomainControlArchitecture.electricOvenDomain);
  assert.ok(ny63.crossDomainControlArchitecture.gasCooktopDomain);
  assert.equal(ny63.crossDomainControlArchitecture.gasCooktopDomain.bindsTo, 'surface_heating_system');

  const control = ny63.canonicalFunctionalMappings.find(
    (m: { canonicalId: string }) => m.canonicalId === 'control_board',
  );
  assert.equal(control.criticalDualFuelWitness, true);
  assert.ok(control.serviceManualEvidence.platformTerms.includes('spark_module'));
  assert.ok(control.serviceManualEvidence.platformTerms.includes('bake_relay_ry203'));
});

test('NY63 electric oven and gas cooktop map to established range_oven layers', () => {
  const ny63 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json'), 'utf8'),
  );
  const ids = ny63.canonicalFunctionalMappings.map((m: { canonicalId: string }) => m.canonicalId);

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

  const surface = ny63.canonicalFunctionalMappings.find(
    (m: { canonicalId: string }) => m.canonicalId === 'surface_heating_system',
  );
  assert.equal(surface.criticalDualFuelWitness, true);
  assert.ok(surface.serviceManualEvidence.platformTerms.includes('valve_cooktop'));

  const bake = ny63.canonicalFunctionalMappings.find(
    (m: { canonicalId: string }) => m.canonicalId === 'bake_heating_element',
  );
  assert.equal(bake.rangeOvenLayer, 'instanceScopes[]');
  assert.ok(bake.serviceManualEvidence.measurement.includes('19 Ω'));
});

test('NY63 measurements retain units, conditions, and dual-domain specs', () => {
  const ny63 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json'), 'utf8'),
  );

  const sensor = ny63.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'ny63-oven-sensor-ohms',
  );
  assert.equal(sensor.unit, 'ohms');
  assert.equal(sensor.nominalValue, 1080);
  assert.equal(sensor.expectedRange.openThreshold, 2950);

  const bake = ny63.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'ny63-bake-heater-ohms',
  );
  assert.equal(bake.expectedValue, 19);
  assert.equal(bake.rangeOvenBinding, 'instanceScopes.bake_heating_element');

  const broil = ny63.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'ny63-broil-heater-ohms',
  );
  assert.equal(broil.expectedValue, 13);

  const spark = ny63.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'ny63-spark-module-vac',
  );
  assert.equal(spark.expectedValue, 120);
  assert.equal(spark.implementationTerm, 'spark_module');
  assert.equal(spark.rangeOvenBinding, 'surface_heating_system');

  const lock = ny63.normalizedMeasurements.find(
    (m: { id: string }) => m.id === 'ny63-door-lock-motor-ohms',
  );
  assert.equal(lock.expectedRange.normalMin, 1750);
  assert.equal(lock.expectedRange.normalMax, 1850);
});

test('NY63 excludes dual-fuel hardware from canonical promotion', () => {
  const ny63 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json'), 'utf8'),
  );
  const excluded = ny63.excludedFromCanonicalPromotion.map((e: { term: string }) => e.term);

  for (const term of [
    'valve_cooktop',
    'spark_module',
    'switch_ignition',
    'electrode',
    'heater_bake',
    'heater_broil',
    'dual_fuel_range.json',
    'dual_energy_control_split',
  ]) {
    assert.ok(excluded.includes(term));
  }

  const vocab = ny63.implementationVocabulary.find(
    (v: { term: string }) => v.term === 'valve_cooktop',
  );
  assert.equal(vocab.classification, 'platform_implementation');
  assert.equal(vocab.energyDomain, 'gas_surface');
});

test('NY63 provenance audit passes with zero canonical mutation and CG-13 not reopened', () => {
  const ny63 = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NY63T8751SS_NORMALIZATION_v1.json'), 'utf8'),
  );

  assert.equal(ny63.provenanceAudit.status, 'passed');
  assert.equal(ny63.provenanceAudit.checks.procedureCount, 23);
  assert.equal(ny63.provenanceAudit.checks.gasCooktopProcedures, 8);
  assert.equal(ny63.provenanceAudit.checks.electricOvenProcedures, 12);
  assert.equal(ny63.provenanceAudit.checks.crossDomainControlArchitectureDocumented, true);
  assert.equal(ny63.provenanceAudit.checks.canonicalGraphUnchanged, true);
  assert.equal(ny63.provenanceAudit.checks.fitConclusionsNotNormalizedAsManualEvidence, true);
  assert.equal(ny63.provenanceAudit.checks.cg13NotReopened, true);
  assert.equal(ny63.definitionOfDone.met, true);

  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(ny63.provenanceAudit.canonicalIntegrity.newCanonicalOntologyFiles, 0);
});
