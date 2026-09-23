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

test('CG-RANGE-NE58 compounding sequence 2 is closed with audit GREEN after NX60 S1', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_COMPOUNDING_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );
  const nx60Audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NX60_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(nx60Audit.verdict, 'GREEN / NX60_COMPOUNDING_AUDIT_PASSED');
  assert.equal(compounding.sequence, 2);
  assert.equal(compounding.status, 'closed');
  assert.equal(audit.verdict, 'GREEN / NE58_COMPOUNDING_AUDIT_PASSED');
  assert.equal(parent.compoundingSequence[1].status, 'closed');
  assert.equal(parent.compoundingSequence[1].overlayFile, 'samsung_range_ne58.json');
});

test('NE58 overlay realizes induction under surface_heating_system — not canonical promotion', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_range_ne58.json'), 'utf8'),
  );
  const evidence = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'SAMSUNG_NE58R9560WS_RANGE_CG_RANGE_COMPOUNDING_EVIDENCE_v1.json'),
      'utf8',
    ),
  );

  assert.equal(overlay.status, 'published');
  assert.equal(evidence.compoundingCurve.canonicalExpansion, 0);
  assert.ok(evidence.hierarchyTest.surfaceHeatingAbsorbsInduction);
  assert.ok(evidence.hierarchyTest.isolatedFromNx60GasOverlay);

  const family = overlay.platformFamilies[0];
  const inverter = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) =>
      r.implementation.platformTerm === 'inverter_pcb',
  );
  assert.equal(inverter.canonicalLayer, 'surface_heating_system');
  assert.ok(inverter.diagnosticEvidence.spec.includes('IGBT'));

  const bake = family.functionalRealizations.find(
    (r: { canonicalLayer: string; implementation: { platformTerm: string } }) =>
      r.canonicalLayer === 'bake_heating_element' && r.implementation.platformTerm === 'heater_bake',
  );
  assert.ok(bake.diagnosticEvidence.spec.includes('17–19'));
});

test('NE58 compounding binds all normalized procedures, measurements, and decision branches', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_range_ne58.json'), 'utf8'),
  );
  const normalization = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_NORMALIZATION_v1.json'), 'utf8'),
  );

  const family = overlay.platformFamilies[0];
  assert.equal(family.procedureBindings.length, normalization.normalizedProcedures.length);
  assert.equal(family.measurementBindings.length, normalization.normalizedMeasurements.length);
  assert.equal(family.decisionBranchBindings.length, normalization.normalizedDecisionBranches.length);
  assert.equal(normalization.normalizedProcedures.length, 24);
  assert.equal(normalization.normalizedMeasurements.length, 25);
  assert.equal(normalization.provenanceAudit.checks.branchCount, 11);
  assert.equal(overlay.compoundingEvidence.accounting.measurementsBound, 25);
});

test('NE58 induction hardware in overlay only — canonical contract and NX60 overlay unchanged', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_range_ne58.json'), 'utf8'),
  );

  const electricHash = sha256File(join(CANONICAL, 'electric_range.json'));
  const rangeOvenHash = sha256File(join(CANONICAL, 'range_oven.json'));
  assert.equal(electricHash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(rangeOvenHash, RANGE_OVEN_HASH);
  assert.equal(audit.integrityChecks.nx60OverlayUnmodified, true);

  const ids = overlay.platformFamilies[0].add.components.map((c: { id: string }) => c.id);
  for (const term of ['inverter_pcb', 'igbt', 'top_sensor', 'induction_coil', 'filter_pcb_fuse']) {
    assert.ok(ids.includes(term));
  }
  assert.ok(
    overlay.platformFamilies[0].routingRejections.some(
      (r: { conceptId: string }) => r.conceptId === 'induction_range.json',
    ),
  );
});

test('published NE58 overlay resolves against frozen range_oven for induction_range template', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'induction_range',
    platformId: 'samsung_range_ne58',
    manufacturer: 'Samsung',
    model: 'NE58R9560WS',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'range_oven');
  assert.ok(resolved!.components.some((c) => c.id === 'surface_heating_system'));
  assert.ok(resolved!.components.some((c) => c.id === 'inverter_pcb'));
  assert.ok(resolved!.components.some((c) => c.id === 'heater_bake'));
  assert.ok(!resolved!.components.some((c) => c.id === 'bake_heating_element'));
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'ne58r-pan-detection'),
  );
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'ne58r-bake-heater-component'),
  );
});

test('NE58 sequence 2 audit gate unlocked NY63 sequence 3 (now closed separately)', () => {
  const ne58Audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NE58R9560WS_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.equal(ne58Audit.gateStatus.ny63CompoundingBlocked, true);
  assert.equal(ne58Audit.gateStatus.nextSequence, 3);
  assert.equal(parent.compoundingSequence[2].status, 'closed');
  assert.equal(parent.compoundingSequence[2].overlayFile, 'samsung_range_ny63.json');
});
