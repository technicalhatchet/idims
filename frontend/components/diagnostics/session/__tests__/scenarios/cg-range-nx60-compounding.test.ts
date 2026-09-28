import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { FROZEN_ELECTRIC_RANGE_REV1_HASH } from '../../../knowledge/canonical/canonicalRegistry';
import { resolveDiagnosticGraph } from '../../../knowledge/canonical/resolveDiagnosticGraph';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-RANGE-NX60 compounding sequence 1 is closed with audit GREEN', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_COMPOUNDING_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.equal(compounding.sequence, 1);
  assert.equal(compounding.status, 'closed');
  assert.equal(audit.verdict, 'GREEN / NX60_COMPOUNDING_AUDIT_PASSED');
  assert.equal(parent.compoundingSequence[0].status, 'closed');
  assert.equal(parent.compoundingSequence[0].overlayFile, 'samsung_range_nx60.json');
});

test('NX60 overlay uses functional realization hierarchy — not flat Samsung fact dump', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_range_nx60.json'), 'utf8'),
  );
  const evidence = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NX60_RANGE_CG_RANGE_COMPOUNDING_EVIDENCE_v1.json'), 'utf8'),
  );

  assert.equal(overlay.status, 'published');
  assert.equal(evidence.compoundingCurve.canonicalExpansion, 0);
  assert.equal(evidence.compoundingCurve.functionalRealizations, 11);
  assert.ok(evidence.hierarchyTest.frozenKeepStable);

  const family = overlay.platformFamilies[0];
  assert.equal(family.functionalRealizations.length, 11);

  const sensor = family.functionalRealizations.find(
    (r: { canonicalLayer: string }) => r.canonicalLayer === 'temperature_sensor',
  );
  assert.ok(sensor);
  assert.equal(sensor.implementation.platformTerm, 'oven_sensor');
  assert.ok(sensor.diagnosticEvidence.spec.includes('1080'));

  const bake = family.functionalRealizations.find(
    (r: { canonicalLayer: string; implementation: { platformTerm: string } }) =>
      r.canonicalLayer === 'bake_heating_element' && r.implementation.platformTerm === 'bake_hsi',
  );
  assert.ok(bake);
  assert.ok(bake.diagnosticEvidence.spec.includes('40–400'));

  const valve = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) =>
      r.implementation.platformTerm === 'safety_valve',
  );
  assert.ok(valve);
  assert.ok(valve.diagnosticEvidence.spec.includes('3.3–3.6'));
});

test('NX60 compounding binds 14 procedures, 16 measurements, 11 decision branches', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_range_nx60.json'), 'utf8'),
  );
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_NORMALIZATION_v1.json'), 'utf8'),
  );
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_NX60_RANGE_overlay_mapping_table_v1.json'), 'utf8'),
  );

  const family = overlay.platformFamilies[0];
  assert.equal(family.procedureBindings.length, 14);
  assert.equal(family.measurementBindings.length, 16);
  assert.equal(family.decisionBranchBindings.length, 11);
  assert.equal(gate.accounting.proceduresBound, 14);
  assert.equal(gate.accounting.measurementsBound, 16);
  assert.equal(gate.accounting.decisionBranchesExecutable, 11);
  assert.equal(normalization.normalizedProcedures.length, 14);
  assert.equal(normalization.normalizedMeasurements.length, 16);
});

test('NX60 gas hardware remains in overlay — canonical contract unchanged', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_range_nx60.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  const electricHash = sha256File(join(CANONICAL, 'electric_range.json'));
  const rangeOvenHash = sha256File(join(CANONICAL, 'range_oven.json'));
  assert.equal(electricHash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(rangeOvenHash, RANGE_OVEN_HASH);
  assert.equal(audit.integrityChecks.electricRangeRev1Unchanged, true);
  assert.equal(audit.integrityChecks.rangeOvenUnchanged, true);

  const overlayIds = overlay.platformFamilies[0].add.components.map((c: { id: string }) => c.id);
  for (const term of ['bake_hsi', 'broil_hsi', 'safety_valve', 'spark_module', 'door_lock_motor']) {
    assert.ok(overlayIds.includes(term), `missing overlay component ${term}`);
  }

  assert.equal(overlay.compoundingEvidence.accounting.canonicalExpansion, 0);
  assert.ok(
    overlay.platformFamilies[0].routingRejections.some(
      (r: { conceptId: string }) => r.conceptId === 'oven_heating_system',
    ),
  );
});

test('published NX60 overlay resolves against frozen range_oven for gas_range template', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'gas_range',
    platformId: 'samsung_range_nx60',
    manufacturer: 'Samsung',
    model: 'NX60T8311SS',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'range_oven');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:Samsung'));
  assert.ok(resolved!.resolution.layers.includes('platform:samsung_range_nx60'));
  assert.ok(resolved!.components.some((c) => c.id === 'temperature_sensor'));
  assert.ok(resolved!.components.some((c) => c.id === 'surface_heating_system'));
  assert.ok(resolved!.components.some((c) => c.id === 'bake_hsi'));
  assert.ok(resolved!.components.some((c) => c.id === 'safety_valve'));
  assert.ok(!resolved!.components.some((c) => c.id === 'bake_heating_element'));
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'samsungnx60-oven-sensor'),
  );
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'samsungnx60-bake-ignitor'),
  );
});

test('NX60 sequence 1 audit gate unlocked NE58 sequence 2 (now closed separately)', () => {
  const nx60Audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.equal(nx60Audit.gateStatus.ne58CompoundingBlocked, true);
  assert.equal(nx60Audit.gateStatus.nextSequence, 2);
  assert.equal(parent.compoundingSequence[1].status, 'closed');
  assert.equal(parent.compoundingSequence[1].overlayFile, 'samsung_range_ne58.json');
});
