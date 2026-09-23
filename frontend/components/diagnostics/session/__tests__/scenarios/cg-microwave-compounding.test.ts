import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import { FROZEN_MICROWAVE_REV1_HASH } from '../../../knowledge/canonical/canonicalRegistry';
import microwaveReferenceOverlay from '../../../knowledge/canonical/platform_overlays/microwave.reference.json';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-MICROWAVE-COMPOUNDING is closed green after both manufacturer audits', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_COMPOUNDING_v1.json'), 'utf8'),
  );
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FROZEN_METADATA_GOVERNANCE_CLOSURE_v1.json'), 'utf8'),
  );
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );

  assert.equal(closure.verdict, 'GREEN / BRANCH_A_APPROVED');
  assert.equal(compounding.status, 'closed');
  assert.equal(compounding.verdict, 'GREEN / MICROWAVE_COMPOUNDING_COMPLETE');
  assert.equal(compounding.workstream, 'CG-MICROWAVE-COMPOUNDING');
  assert.equal(compounding.targetCanonicalIdentity.frozenHash, FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(compounding.exitCriteria.compoundingAuditsGreen, true);
  assert.equal(sequence.stopGate.compoundingBlocked, false);
  assert.equal(sequence.stopGate.workstreamComplete, true);

  const compoundingPhase = sequence.disciplinedSequence.find(
    (p: { phase: string }) => p.phase === 'CG-MICROWAVE-COMPOUNDING',
  );
  assert.equal(compoundingPhase?.status, 'closed');
});

test('compounding enforces magnetron → rf_cavity precedence — stale realizes must not propagate', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_COMPOUNDING_v1.json'), 'utf8'),
  );

  const precedence = compounding.implementationRealizationPrecedence;
  assert.equal(precedence.authoritativeMapping.magnetron, 'rf_cavity');
  assert.equal(precedence.staleMetadataException.frozenStaleValue, 'hv_generation');
  assert.equal(precedence.staleMetadataException.nonAuthoritative, true);
  assert.equal(precedence.staleMetadataException.mustNotPropagateToCompoundedKnowledge, true);
  assert.ok(
    compounding.immutableRules.some((rule: string) =>
      rule.includes('overlayOnlyConcepts.magnetron.realizes'),
    ),
  );
  assert.equal(compounding.exitCriteria.staleMagnetronRealizesNotPropagated, true);

  const lgPlatform = microwaveReferenceOverlay.platforms.find(
    (p: { platformId: string }) => p.platformId === 'lg_microwave_otr',
  );
  assert.equal(lgPlatform?.componentAliases.magnetron, 'rf_cavity');
});

test('compounding sequence binds LG then Samsung normalized evidence without canonical expansion', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_COMPOUNDING_v1.json'), 'utf8'),
  );

  const order = compounding.normalizedEvidenceInputs.map(
    (entry: { targetId: string }) => entry.targetId,
  );
  assert.deepEqual(order, ['lg_lmhm2237_otr', 'samsung_me11_otr']);
  assert.equal(compounding.compoundingSequence[0].status, 'closed');
  assert.equal(compounding.compoundingSequence[0].overlayFile, 'lg_microwave_otr.json');
  assert.equal(compounding.compoundingSequence[1].status, 'closed');
  assert.equal(compounding.compoundingSequence[1].overlayFile, 'samsung_microwave_otr.json');
  assert.equal(compounding.exitCriteria.bothTargetsCompounded, true);
  assert.equal(compounding.exitCriteria.compoundingAuditsGreen, true);
  assert.equal(compounding.exitCriteria.familyClosureBlocked, true);
  assert.equal(compounding.exitCriteria.familyClosurePlanningAuthorized, true);
  assert.equal(compounding.allowedCanonicalTargets.core.length, 7);
  assert.ok(compounding.allowedCanonicalTargets.platformOnly.includes('magnetron'));
  assert.equal(sha256File(join(CANONICAL, 'microwave.json')), FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(sha256File(join(CANONICAL, 'range_oven.json')), RANGE_OVEN_HASH);
});
