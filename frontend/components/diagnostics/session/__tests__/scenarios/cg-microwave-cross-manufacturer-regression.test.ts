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

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('cross-manufacturer regression proof locked after both compounding audits green', () => {
  const proof = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_CROSS_MANUFACTURER_REGRESSION_PROOF_v1.json'), 'utf8'),
  );
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_COMPOUNDING_v1.json'), 'utf8'),
  );
  const lgAudit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_LG_LMHM2237_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );
  const samsungAudit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_SAMSUNG_ME11_COMPOUNDING_AUDIT_v1.json'), 'utf8'),
  );

  assert.equal(proof.status, 'locked');
  assert.equal(compounding.verdict, 'GREEN / MICROWAVE_COMPOUNDING_COMPLETE');
  assert.equal(compounding.exitCriteria.compoundingAuditsGreen, true);
  assert.equal(lgAudit.verdict, 'GREEN / LG_COMPOUNDING_AUDIT_PASSED');
  assert.equal(samsungAudit.verdict, 'GREEN / SAMSUNG_COMPOUNDING_AUDIT_PASSED');
  assert.equal(proof.rollup.canonicalExpansion, 0);
  assert.equal(proof.rollup.lgEvidenceBorrowing, 0);
});

test('both overlays resolve ME21 and LMVM model patterns without cross-manufacturer bleed', () => {
  const overlays = getManufacturerOverlaysForOntology('microwave');
  assert.equal(overlays.length, 2);

  const lgMe21 = resolveDiagnosticGraph({
    templateId: 'microwave',
    platformId: 'lg_microwave_otr',
    manufacturer: 'LG',
    model: 'LMVM2031ST',
  });
  const samsungMe21 = resolveDiagnosticGraph({
    templateId: 'microwave',
    platformId: 'samsung_microwave_otr',
    manufacturer: 'Samsung',
    model: 'ME21A706BQN',
  });

  assert.ok(lgMe21);
  assert.ok(samsungMe21);
  assert.equal(sha256File(join(CANONICAL, 'microwave.json')), FROZEN_MICROWAVE_REV1_HASH);

  const lgMagnetron = lgMe21!.components.find((c) => c.id === 'magnetron');
  const samsungMagnetron = samsungMe21!.components.find((c) => c.id === 'magnetron');
  assert.equal(lgMagnetron?.implementsCanonicalId, 'rf_cavity');
  assert.equal(samsungMagnetron?.implementsCanonicalId, 'rf_cavity');

  assert.ok(!lgMe21!.components.some((c) => c.id === 'vent_blower_motor'));
  assert.ok(samsungMe21!.components.some((c) => c.id === 'vent_blower_motor'));
  assert.ok(!samsungMe21!.components.some((c) => c.id === 'pcb_thermistor'));
});

test('family closure complete — workstream terminally closed', () => {
  const plan = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FAMILY_CLOSURE_PLAN_v1.json'), 'utf8'),
  );
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );

  assert.equal(plan.status, 'closed');
  assert.equal(plan.familyClosureExecuted, true);
  assert.equal(plan.gateStatus.familyClosureComplete, true);
  assert.equal(plan.gateStatus.compoundingAuditsGreen, true);
  assert.equal(plan.gateStatus.familyClosurePlanningComplete, true);

  const closurePhase = sequence.disciplinedSequence.find(
    (p: { phase: string }) => p.phase === 'CG-MICROWAVE-FAMILY-CLOSURE',
  );
  assert.equal(closurePhase?.status, 'closed');
  assert.equal(sequence.stopGate.workstreamComplete, true);
});
