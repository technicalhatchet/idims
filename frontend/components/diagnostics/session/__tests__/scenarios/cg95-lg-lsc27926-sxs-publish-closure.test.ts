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

test('CG-9.5 WP3 observation records KEEP inheritance and zero expansion', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'LG_LSC27926_SXS_cg95_compounding_observation_v1.json'), 'utf8'),
  );
  assert.equal(obs.verdict.canonicalInheritances, 6);
  assert.equal(obs.verdict.conditionalBindings, 7);
  assert.equal(obs.verdict.overlayLearningEvents, 10);
  assert.equal(obs.verdict.intentionalAbstentions, 3);
  assert.equal(obs.verdict.canonicalExpansion, 0);
  assert.equal(obs.compoundingSequence, 3);
});

test('published LG SxS overlay resolves with door_switch and relay-drive compressor', () => {
  const canonicalHash = sha256File(join(CANONICAL, 'french_door_refrigerator.json'));
  assert.equal(canonicalHash, EXPECTED_CANONICAL_HASH);

  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/lg_sxs.json'), 'utf8'),
  );
  assert.equal(overlay.status, 'published');
  assert.equal(overlay.compoundingEvidence.phase, 'CG-9.5');
  assert.equal(overlay.compoundingEvidence.workPackage, 'WP3');

  const family = overlay.platformFamilies[0];
  assert.equal(family.platformId, 'lg_sxs');

  const implementationBlob = JSON.stringify({
    aliases: family.oemTermAliases,
    components: family.add.components,
    bindings: family.procedureBindings,
  }).toLowerCase();
  assert.ok(!implementationBlob.includes('lglrmvs-'));
  assert.ok(!implementationBlob.includes('linear_compressor'));
  assert.ok(!implementationBlob.includes('samsungrs28-'));
  assert.ok(!implementationBlob.includes('w11296289-'));
  assert.ok(!implementationBlob.includes('w10322959-'));

  const resolved = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'lg_sxs',
    manufacturer: 'LG',
    model: 'LSC27926ST',
  });
  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'french_door_refrigerator');
  assert.equal(resolved!.resolution.platformId, 'lg_sxs');
  assert.ok(resolved!.components.some((c) => c.id === 'door_switch'));
  assert.ok(resolved!.components.some((c) => c.id === 'conventional_compressor'));
  assert.ok(!resolved!.components.some((c) => c.id === 'compressor'));
  assert.ok(!resolved!.components.some((c) => c.id === 'condenser_fan'));
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'lgsxs-door-switch'),
  );
  assert.ok(
    family.conditionalConceptBindings.some(
      (b: { conditionalConceptId: string }) => b.conditionalConceptId === 'condenser_fan',
    ),
  );
});

test('six refrigerator overlays are platform-isolated', () => {
  const jazz = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'whirlpool_jazz_french_door',
    manufacturer: 'Whirlpool',
    model: 'WRF535SW',
  });
  const samsungFd = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'samsung_fridge_bespoke',
    manufacturer: 'Samsung',
    model: 'RF23BB8600',
  });
  const lgFd = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'lg_lrmvs',
    manufacturer: 'LG',
    model: 'LRMVS3006S',
  });
  const samsungSxs = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'samsung_sxs',
    manufacturer: 'Samsung',
    model: 'RS28A500ASR',
  });
  const whirlpoolSxs = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'whirlpool_sxs_w11296289',
    manufacturer: 'Whirlpool',
    model: 'WRS325SDHZ',
  });
  const lgSxs = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'lg_sxs',
    manufacturer: 'LG',
    model: 'LSC27926ST',
  });

  const platforms = [
    jazz!.resolution.platformId,
    samsungFd!.resolution.platformId,
    lgFd!.resolution.platformId,
    samsungSxs!.resolution.platformId,
    whirlpoolSxs!.resolution.platformId,
    lgSxs!.resolution.platformId,
  ];
  assert.deepEqual(new Set(platforms).size, 6);
  for (const graph of [jazz, samsungFd, lgFd, samsungSxs, whirlpoolSxs, lgSxs]) {
    assert.equal(graph!.ontology.id, 'french_door_refrigerator');
  }
});

test('prior five overlays byte-stable after LG SxS WP3 publish', () => {
  const publication = JSON.parse(
    readFileSync(join(CALIBRATION, 'publication_LG_LSC27926_SXS_CG95.json'), 'utf8'),
  );
  assert.equal(publication.headlineMetric.canonicalExpansion, 0);
  assert.equal(publication.canonicalHashBefore, publication.canonicalHashAfter);
  assert.equal(publication.canonicalHashAfter, EXPECTED_CANONICAL_HASH);
});
