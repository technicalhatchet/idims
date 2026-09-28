import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

import microwaveOntology from '../../../knowledge/canonical/microwave.json';
import rangeOvenOntology from '../../../knowledge/canonical/range_oven.json';
import {
  FROZEN_MICROWAVE_REV1_HASH,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';

const RANGE_OVEN_HASH =
  'e29bb5fafe2afacdba3b45a1ec8e4ec0b73c78d51ff6319bb6a7c0e20a7b4fc5';

const MICROWAVE_PRE_FREEZE_HASH =
  '5a5e77a73b4d587432bbfd98af0cfcc448f6372469fab479ffb45ea19f1b69ad';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-MICROWAVE-FREEZE lock closes microwave architecture', () => {
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_LOCK_v1.json'), 'utf8'),
  );
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_CLOSURE_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(lock.status, 'closed_successful');
  assert.equal(lock.verdict, 'CLOSED / MICROWAVE_ARCHITECTURE_COMPLETE');
  assert.equal(closure.verdict, 'CLOSED / MICROWAVE_FAMILY_LOCKED');
  assert.equal(contract.status, 'closed');
  assert.equal(contract.freezeLock, 'CG_MICROWAVE_FREEZE_LOCK_v1.json');
  assert.equal(lock.ontologyLayers.canonicalComponents.count, 7);
  assert.equal(lock.ontologyLayers.conditionalConcepts.count, 2);
  assert.equal(lock.headlineMetrics.componentPromotionCount, 0);
});

test('microwave rev1 frozen hash is byte-stable and exported from registry', () => {
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_LOCK_v1.json'), 'utf8'),
  );

  assert.equal(microwaveOntology.ontology.frozen, true);
  assert.equal(microwaveOntology.ontology.frozenRevision, 'rev1');
  assert.ok(String(microwaveOntology.ontology.frozenNote).includes('CG_MICROWAVE_FREEZE_LOCK_v1.json'));

  const hash = sha256File(join(CANONICAL, 'microwave.json'));
  assert.equal(hash, FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(lock.canonicalOntology.hash, FROZEN_MICROWAVE_REV1_HASH);
  assert.equal(lock.canonicalOntology.hashBeforeFreeze, MICROWAVE_PRE_FREEZE_HASH);
  assert.equal(lock.byteStabilityProof.canonicalHashAfterFreeze, FROZEN_MICROWAVE_REV1_HASH);
});

test('resolver registers microwave template and OTR platforms', () => {
  assert.equal(resolveCanonicalOntologyId('microwave'), 'microwave');
  assert.equal(resolveCanonicalOntologyId('microwave', 'lg_microwave_otr'), 'microwave');
  assert.equal(resolveCanonicalOntologyId('microwave', 'samsung_microwave_otr'), 'microwave');
});

test('range_oven untouched — normalization/compounding not authorized', () => {
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_CLOSURE_v1.json'), 'utf8'),
  );
  const lock = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_FREEZE_LOCK_v1.json'), 'utf8'),
  );

  assert.equal(sha256File(join(CANONICAL, 'range_oven.json')), RANGE_OVEN_HASH);
  assert.equal(rangeOvenOntology.ontology.frozen, true);
  assert.equal(closure.governanceConclusion.rangeOvenHashMutated, false);
  assert.equal(closure.governanceConclusion.normalizationAuthorized, false);
  assert.equal(closure.governanceConclusion.compoundingAuthorized, false);
  assert.ok(lock.futureWorkPolicy.normalizationCompounding.includes('STOP'));
});
