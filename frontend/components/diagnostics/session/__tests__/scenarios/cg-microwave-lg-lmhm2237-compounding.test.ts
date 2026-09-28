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

test('CG-MICROWAVE-LG compounding sequence 1 closed — audit pending human review', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_LG_LMHM2237_COMPOUNDING_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_LG_LMHM2237_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const parent = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.equal(compounding.sequence, 1);
  assert.equal(compounding.status, 'closed');
  assert.equal(audit.status, 'closed');
  assert.equal(audit.verdict, 'GREEN / LG_COMPOUNDING_AUDIT_PASSED');
  assert.equal(parent.compoundingSequence[0].status, 'closed');
  assert.equal(parent.compoundingSequence[0].overlayFile, 'lg_microwave_otr.json');
  assert.equal(parent.compoundingSequence[1].status, 'closed');
});

test('LG overlay uses functional realization hierarchy — magnetron under rf_cavity', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/lg_microwave_otr.json'), 'utf8'),
  );
  const evidence = JSON.parse(
    readFileSync(
      join(CALIBRATION, 'LG_LMHM2237_MICROWAVE_CG_MICROWAVE_COMPOUNDING_EVIDENCE_v1.json'),
      'utf8',
    ),
  );

  assert.equal(overlay.status, 'published');
  assert.equal(evidence.compoundingCurve.canonicalExpansion, 0);
  assert.equal(evidence.hierarchyTest.magnetronUnderRfCavity, true);
  assert.equal(evidence.hierarchyTest.staleRealizesNotPropagated, true);

  const family = overlay.platformFamilies[0];
  assert.equal(family.functionalRealizations.length, 13);

  const magnetron = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) => r.implementation.platformTerm === 'magnetron',
  );
  assert.equal(magnetron?.canonicalLayer, 'rf_cavity');
  assert.ok(magnetron?.diagnosticEvidence.precedenceNote?.includes('rf_cavity'));

  const hvXfmr = family.functionalRealizations.find(
    (r: { implementation: { platformTerm: string } }) =>
      r.implementation.platformTerm === 'hv_transformer',
  );
  assert.equal(hvXfmr?.canonicalLayer, 'hv_generation');
});

test('LG compounding binds 12 procedures, 12 measurements, 12 decision branches', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/lg_microwave_otr.json'), 'utf8'),
  );
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'LG_LMHM2237_MICROWAVE_overlay_mapping_table_v1.json'), 'utf8'),
  );

  const family = overlay.platformFamilies[0];
  assert.equal(family.procedureBindings.length, 12);
  assert.equal(family.measurementBindings.length, 12);
  assert.equal(family.decisionBranchBindings.length, 12);
  assert.equal(gate.accounting.proceduresBound, 12);
  assert.equal(gate.accounting.measurementsBound, 12);
  assert.equal(gate.accounting.decisionBranchesExecutable, 12);
});

test('LG HV hardware remains overlay — canonical microwave unchanged', () => {
  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/lg_microwave_otr.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_LG_LMHM2237_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(sha256File(join(CANONICAL, 'microwave.json')), FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(sha256File(join(CANONICAL, 'range_oven.json')), RANGE_OVEN_HASH);
  assert.equal(audit.integrityChecks.microwaveRev1Unchanged, true);
  assert.equal(audit.precedenceChecks.magnetronImplementsCanonicalId, 'rf_cavity');

  const overlayIds = overlay.platformFamilies[0].add.components.map((c: { id: string }) => c.id);
  for (const term of ['magnetron', 'hv_transformer', 'hv_capacitor', 'hv_diode', 'hv_fuse']) {
    assert.ok(overlayIds.includes(term), `missing overlay component ${term}`);
  }

  const magnetronComponent = overlay.platformFamilies[0].add.components.find(
    (c: { id: string }) => c.id === 'magnetron',
  );
  assert.equal(magnetronComponent.implementsCanonicalId, 'rf_cavity');
  assert.equal(overlay.compoundingEvidence.accounting.staleMagnetronRealizesNotPropagated, true);

  assert.ok(
    overlay.platformFamilies[0].routingRejections.some(
      (r: { verdict: string }) => r.verdict === 'reject_hv_generation_realization',
    ),
  );
});

test('published LG overlay resolves against frozen microwave for lg_microwave_otr', () => {
  const resolved = resolveDiagnosticGraph({
    templateId: 'microwave',
    platformId: 'lg_microwave_otr',
    manufacturer: 'LG',
    model: 'LMHM2237BD',
  });

  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'microwave');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:LG'));
  assert.ok(resolved!.resolution.layers.includes('platform:lg_microwave_otr'));
  assert.ok(resolved!.components.some((c) => c.id === 'hv_generation'));
  assert.ok(resolved!.components.some((c) => c.id === 'rf_cavity'));
  assert.ok(resolved!.components.some((c) => c.id === 'magnetron'));
  assert.ok(!resolved!.components.some((c) => c.id === 'magnetron' && c.categoryId === 'hv_circuit'));
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'lgotrmw-magnetron'),
  );
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'lgotrmw-hv-transformer'),
  );

  const magnetronBinding = resolved!.procedureBindings?.find(
    (b) => b.procedureId === 'lgotrmw-magnetron',
  );
  assert.ok(magnetronBinding?.canonicalComponents?.includes('rf_cavity'));
});

test('microwave overlay registry includes LG from sequence 1 audit', () => {
  const overlays = getManufacturerOverlaysForOntology('microwave');
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_LG_LMHM2237_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  assert.ok(overlays.some((o) => o.manufacturer === 'LG'));
  assert.equal(audit.verdict, 'GREEN / LG_COMPOUNDING_AUDIT_PASSED');
});
