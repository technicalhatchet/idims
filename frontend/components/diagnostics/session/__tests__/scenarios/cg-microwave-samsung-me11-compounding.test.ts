import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { FROZEN_MICROWAVE_REV1_HASH } from '../../../knowledge/canonical/canonicalRegistry';
import {
  getManufacturerOverlaysForOntology,
  resolveDiagnosticGraph,
} from '../../../knowledge/canonical/resolveDiagnosticGraph';

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

test('CG-MICROWAVE-Samsung compounding sequence 2 closed — audit green', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_SAMSUNG_ME11_COMPOUNDING_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_SAMSUNG_ME11_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_COMPOUNDING_v1.json'), 'utf8'),
  );
  const lgAudit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_LG_LMHM2237_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(lgAudit.verdict, 'GREEN / LG_COMPOUNDING_AUDIT_PASSED');
  assert.equal(compounding.sequence, 2);
  assert.equal(compounding.status, 'closed');
  assert.equal(audit.status, 'closed');
  assert.equal(audit.verdict, 'GREEN / SAMSUNG_COMPOUNDING_AUDIT_PASSED');
  assert.equal(parent.compoundingSequence[1].status, 'closed');
  assert.equal(parent.exitCriteria.compoundingAuditsGreen, true);
  assert.equal(parent.exitCriteria.familyClosureBlocked, true);
  assert.equal(parent.exitCriteria.familyClosurePlanningAuthorized, true);
});

test('Samsung overlay binds four-TCO network and magnetron under rf_cavity — Samsung evidence only', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_microwave_otr.json'), 'utf8'),
  );
  const evidence = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'SAMSUNG_ME11_MICROWAVE_CG_MICROWAVE_COMPOUNDING_EVIDENCE_v1.json'),
      'utf8',
    ),
  );

  assert.equal(overlay.evidenceIndependence.noBorrowFromLgOverlay, true);
  assert.equal(evidence.evidenceIndependence.lgEvidenceBorrowing, 0);
  assert.equal(evidence.hierarchyTest.fourTcoUnderThermalProtection, true);

  const family = overlay.platformFamilies[0];
  const tco = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) =>
      r.implementation.platformTerm === 'four_tco_network',
  );
  assert.equal(tco?.canonicalLayer, 'thermal_protection');

  const magnetron = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) => r.implementation.platformTerm === 'magnetron',
  );
  assert.equal(magnetron?.canonicalLayer, 'rf_cavity');

  const vent = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) =>
      r.implementation.platformTerm === 'vent_blower_motor',
  );
  assert.equal(vent?.canonicalLayer, 'ventilation_otr');
});

test('Samsung compounding rejects LG-only realizations', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_microwave_otr.json'), 'utf8'),
  );
  const family = overlay.platformFamilies[0];
  const overlayIds = family.add.components.map((c: { id: string }) => c.id);

  assert.ok(!overlayIds.includes('pcb_thermistor'));
  assert.ok(!overlayIds.includes('noise_filter_coil'));
  assert.ok(!overlayIds.includes('hv_fuse'));
  assert.ok(
    family.routingRejections.some(
      (r: { verdict: string }) => r.verdict === 'reject_lg_only_borrowing',
    ),
  );

  for (const realization of family.functionalRealizations) {
    assert.equal(realization.provenance.sourceManual, 'SAMSUNG-ME11-MICROWAVE');
    assert.equal(realization.provenance.normalizationRef, 'CG_MICROWAVE_SAMSUNG_ME11_NORMALIZATION_v1.json');
  }
});

test('Samsung compounding binds 14 procedures, 13 measurements, 14 decision branches', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_microwave_otr.json'), 'utf8'),
  );
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_ME11_MICROWAVE_overlay_mapping_table_v1.json'), 'utf8'),
  );

  const family = overlay.platformFamilies[0];
  assert.equal(family.procedureBindings.length, 14);
  assert.equal(family.measurementBindings.length, 13);
  assert.equal(family.decisionBranchBindings.length, 14);
  assert.equal(gate.accounting.lgEvidenceBorrowing, 0);
});

test('Samsung overlay preserves frozen microwave — canonical expansion zero', () => {
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_SAMSUNG_ME11_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(sha256File(join(CANONICAL, 'microwave.json')), FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(sha256File(join(CANONICAL, 'range_oven.json')), RANGE_OVEN_HASH);
  assert.equal(audit.integrityChecks.samsungEvidenceIndependent, true);
  assert.equal(audit.independenceChecks.rejectedLgOnlyRealizations.includes('pcb_thermistor'), true);

  const magnetron = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_microwave_otr.json'), 'utf8'),
  ).platformFamilies[0].add.components.find((c: { id: string }) => c.id === 'magnetron');
  assert.equal(magnetron.implementsCanonicalId, 'rf_cavity');
});

test('published Samsung overlay resolves against frozen microwave for samsung_microwave_otr', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'microwave',
    platformId: 'samsung_microwave_otr',
    manufacturer: 'Samsung',
    model: 'ME11A7510DSAA',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'microwave');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:Samsung'));
  assert.ok(resolved!.components.some((c) => c.id === 'magnetron'));
  assert.ok(resolved!.components.some((c) => c.id === 'vent_blower_motor'));
  assert.ok(resolved!.components.some((c) => c.id === 'cavity_tco'));

  const magnetronBinding = resolved!.procedureBindings?.find(
    (b) => b.procedureId === 'samsungotrmw-magnetron',
  );
  assert.ok(magnetronBinding?.canonicalComponents?.includes('rf_cavity'));

  const ventBinding = resolved!.procedureBindings?.find(
    (b) => b.procedureId === 'samsungotrmw-vent-motor',
  );
  assert.ok(ventBinding?.conditionalConcepts?.includes('ventilation_otr'));
});

test('microwave registry has LG + Samsung overlays — family closure planning authorized', () => {
  const overlays = getManufacturerOverlaysForOntology('microwave');
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_SAMSUNG_ME11_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(overlays.length, 2);
  assert.deepEqual(
    overlays.map((o) => o.manufacturer).sort(),
    ['LG', 'Samsung'],
  );
  assert.equal(audit.gateStatus.familyClosureBlocked, true);
  assert.equal(audit.gateStatus.familyClosurePlanningAuthorized, true);
});
