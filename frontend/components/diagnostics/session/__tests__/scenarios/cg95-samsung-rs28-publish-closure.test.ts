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

test('CG-9.5 WP1 observation records SxS compounding and zero expansion', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_RS28_SXS_cg95_compounding_observation_v1.json'), 'utf8'),
  );
  assert.equal(obs.verdict.canonicalInheritances, 5);
  assert.equal(obs.verdict.conditionalBindings, 7);
  assert.equal(obs.verdict.overlayLearningEvents, 10);
  assert.equal(obs.verdict.intentionalAbstentions, 4);
  assert.equal(obs.verdict.canonicalExpansion, 0);
  assert.equal(obs.verdict.discoveryCorpusInheritance, 0);
  assert.equal(obs.compoundingSequence, 1);
});

test('published Samsung SxS overlay resolves against frozen refrigerator contract', () => {
  const canonicalHash = sha256File(join(CANONICAL, 'french_door_refrigerator.json'));
  assert.equal(canonicalHash, EXPECTED_CANONICAL_HASH);

  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_sxs.json'), 'utf8'),
  );
  assert.equal(overlay.status, 'published');
  assert.equal(overlay.compoundingEvidence.headlineMetric.canonicalExpansion, 0);
  assert.equal(overlay.compoundingEvidence.phase, 'CG-9.5');

  const family = overlay.platformFamilies[0];
  assert.equal(family.platformId, 'samsung_sxs');
  assert.ok(family.appliesTo.platformIds.includes('samsung_sxs'));

  const implementationBlob = JSON.stringify({
    aliases: family.oemTermAliases,
    components: family.add.components,
    bindings: family.procedureBindings,
  }).toLowerCase();
  assert.ok(!implementationBlob.includes('samsungbespoke'));
  assert.ok(!implementationBlob.includes('em2y60'));

  const resolved = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'samsung_sxs',
    manufacturer: 'Samsung',
    model: 'RS28A500ASR',
  });
  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'french_door_refrigerator');
  assert.equal(resolved!.resolution.platformId, 'samsung_sxs');
  assert.ok(resolved!.resolution.layers.includes('manufacturer:Samsung'));
  assert.ok(resolved!.components.some((c) => c.id === 'control_board'));
  assert.ok(resolved!.components.some((c) => c.id === 'inverter_board'));
  assert.ok(resolved!.components.some((c) => c.id === 'c_fan_convertible'));
  assert.ok(!resolved!.components.some((c) => c.id === 'compressor'));
  assert.ok(!resolved!.components.some((c) => c.id === 'temperature_sensor'));
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'samsungrs28-inverter-communication'),
  );
  assert.ok(
    !family.conditionalConceptBindings.some(
      (b: { conditionalConceptId: string }) => b.conditionalConceptId === 'condenser_fan',
    ),
  );
  assert.ok(
    family.deferredArtifacts.some(
      (d: { teachingId: string }) => d.teachingId === 'samsung-rs28-condenser-fan-abstention',
    ),
  );
});

test('samsung_sxs platform does not resolve RF23BB french-door overlay', () => {
  const rf23bb = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'samsung_fridge_bespoke',
    manufacturer: 'Samsung',
    model: 'RF23BB8600',
  });
  const sxs = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'samsung_sxs',
    manufacturer: 'Samsung',
    model: 'RS28A500ASR',
  });
  assert.ok(rf23bb);
  assert.ok(sxs);
  assert.equal(rf23bb!.resolution.platformId, 'samsung_fridge_bespoke');
  assert.equal(sxs!.resolution.platformId, 'samsung_sxs');
  assert.ok(
    !sxs!.procedureBindings?.some((b) => String(b.procedureId).startsWith('samsungbespoke-')),
  );
  assert.ok(
    !rf23bb!.procedureBindings?.some((b) => String(b.procedureId).startsWith('samsungrs28-')),
  );
});

test('CG-8 french-door overlays unchanged after Samsung SxS WP1 publish', () => {
  const jazz = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/whirlpool_jazz_french_door.json'), 'utf8'),
  );
  const rf23bb = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_fridge_bespoke.json'), 'utf8'),
  );
  const lg = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/lg_lrmvs.json'), 'utf8'),
  );
  assert.equal(jazz.status, 'published');
  assert.equal(rf23bb.status, 'published');
  assert.equal(lg.status, 'published');
  assert.equal(rf23bb.compoundingEvidence.workPackage, 'WP2');
});
