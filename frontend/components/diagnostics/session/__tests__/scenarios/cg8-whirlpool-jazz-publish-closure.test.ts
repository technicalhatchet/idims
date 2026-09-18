import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createHash } from 'node:crypto';
import { test } from 'node:test';

import { resolveDiagnosticGraph } from '../../../knowledge/canonical/resolveDiagnosticGraph';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');
const EXPECTED_CANONICAL_HASH = 'adc2614e10d27f2462a95ccb372b5dff5017a77fb6ff72f58561df5dd8fb4cf9';

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-8 WP1 observation records intentional abstentions and zero expansion', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'W10322959_fd_cg8_compounding_observation_v1.json'), 'utf8'),
  );
  assert.equal(obs.verdict.canonicalInheritances, 6);
  assert.equal(obs.verdict.conditionalBindings, 4);
  assert.equal(obs.verdict.overlayLearningEvents, 4);
  assert.equal(obs.verdict.intentionalAbstentions, 4);
  assert.equal(obs.verdict.canonicalExpansion, 0);
  assert.equal(obs.verdict.freezeReopening, 0);
});

test('published Jazz overlay resolves against frozen french_door rev1', () => {
  const canonicalHash = sha256File(join(CANONICAL, 'french_door_refrigerator.json'));
  assert.equal(canonicalHash, EXPECTED_CANONICAL_HASH);

  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/whirlpool_jazz_french_door.json'), 'utf8'),
  );
  assert.equal(overlay.status, 'published');
  assert.equal(overlay.compoundingEvidence.accounting.canonicalExpansion, 0);

  const resolved = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'whirlpool_jazz_french_door',
    manufacturer: 'Whirlpool',
    model: 'WRF535SW',
  });
  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'french_door_refrigerator');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:Whirlpool'));
  assert.ok(resolved!.components.some((c) => c.id === 'control_board'));
  assert.ok(resolved!.components.some((c) => c.id === 'defrost_thermostat'));
  assert.ok(!resolved!.components.some((c) => c.id === 'compressor'));
  assert.ok(!resolved!.components.some((c) => c.id === 'temperature_sensor'));
  assert.ok(resolved!.procedureBindings?.some((b) => b.procedureId === 'w10322959-test-06-damper'));
});
