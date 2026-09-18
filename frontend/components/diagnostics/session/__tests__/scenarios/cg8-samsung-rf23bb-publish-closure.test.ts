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

test('CG-8 WP2 observation records stricter boundary and zero expansion', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_RF23BB_fd_cg8_compounding_observation_v1.json'), 'utf8'),
  );
  assert.equal(obs.verdict.canonicalInheritances, 5);
  assert.equal(obs.verdict.conditionalBindings, 7);
  assert.equal(obs.verdict.overlayLearningEvents, 7);
  assert.equal(obs.verdict.intentionalAbstentions, 4);
  assert.equal(obs.verdict.canonicalExpansion, 0);
  assert.equal(obs.verdict.freezeReopening, 0);
  assert.equal(obs.compoundingSequence, 2);
});

test('published Samsung overlay resolves against frozen french_door rev1 without Jazz leak', () => {
  const canonicalHash = sha256File(join(CANONICAL, 'french_door_refrigerator.json'));
  assert.equal(canonicalHash, EXPECTED_CANONICAL_HASH);

  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_fridge_bespoke.json'), 'utf8'),
  );
  assert.equal(overlay.status, 'published');
  assert.equal(overlay.compoundingEvidence.headlineMetric.canonicalExpansion, 0);

  const implementationBlob = JSON.stringify({
    aliases: overlay.platformFamilies[0].oemTermAliases,
    components: overlay.platformFamilies[0].add.components,
    bindings: overlay.platformFamilies[0].procedureBindings,
  }).toLowerCase();
  assert.ok(!implementationBlob.includes('em2y60'));
  assert.ok(!implementationBlob.includes('relay_drive_em2y60'));
  assert.ok(!implementationBlob.includes('defrost_thermostat'));

  const resolved = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'samsung_fridge_bespoke',
    manufacturer: 'Samsung',
    model: 'RF23BB8600',
  });
  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'french_door_refrigerator');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:Samsung'));
  assert.ok(resolved!.components.some((c) => c.id === 'control_board'));
  assert.ok(resolved!.components.some((c) => c.id === 'inverter_board'));
  assert.ok(!resolved!.components.some((c) => c.id === 'compressor'));
  assert.ok(!resolved!.components.some((c) => c.id === 'temperature_sensor'));
  assert.ok(resolved!.components.some((c) => c.id === 'door_switch'));
  assert.ok(
    !resolved!.procedureBindings?.some(
      (b) =>
        b.procedureId?.startsWith('samsungbespoke-') &&
        (b.canonicalComponents || []).includes('door_switch'),
    ),
  );
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'samsungbespoke-compressor-inverter'),
  );
  assert.ok(
    overlay.platformFamilies[0].deferredArtifacts.some(
      (d: { teachingId: string }) => d.teachingId === 'samsung-door-switch-abstention',
    ),
  );
});

test('Whirlpool Jazz overlay unchanged after Samsung WP2 publish', () => {
  const jazz = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/whirlpool_jazz_french_door.json'), 'utf8'),
  );
  assert.equal(jazz.status, 'published');
  assert.equal(jazz.compoundingEvidence.workPackage, 'WP1');
});
