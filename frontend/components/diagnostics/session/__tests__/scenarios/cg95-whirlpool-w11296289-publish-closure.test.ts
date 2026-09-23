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

test('CG-9.5 WP2 observation records full KEEP inheritance and zero expansion', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'W11296289_SXS_cg95_compounding_observation_v1.json'), 'utf8'),
  );
  assert.equal(obs.verdict.canonicalInheritances, 6);
  assert.equal(obs.verdict.conditionalBindings, 6);
  assert.equal(obs.verdict.overlayLearningEvents, 10);
  assert.equal(obs.verdict.intentionalAbstentions, 4);
  assert.equal(obs.verdict.canonicalExpansion, 0);
  assert.equal(obs.compoundingSequence, 2);
});

test('published Whirlpool SxS overlay resolves with door_switch and condenser_fan bindings', () => {
  const canonicalHash = sha256File(join(CANONICAL, 'french_door_refrigerator.json'));
  assert.equal(canonicalHash, EXPECTED_CANONICAL_HASH);

  const overlay = JSON.parse(
    readFileSync(
      join(CANONICAL, 'manufacturer_overlays/whirlpool_sxs_w11296289.json'),
      'utf8',
    ),
  );
  assert.equal(overlay.status, 'published');
  assert.equal(overlay.compoundingEvidence.phase, 'CG-9.5');

  const family = overlay.platformFamilies[0];
  assert.equal(family.platformId, 'whirlpool_sxs_w11296289');

  const implementationBlob = JSON.stringify({
    aliases: family.oemTermAliases,
    components: family.add.components,
    bindings: family.procedureBindings,
  }).toLowerCase();
  assert.ok(!implementationBlob.includes('samsungrs28'));
  assert.ok(!implementationBlob.includes('inverter_board'));
  assert.ok(!implementationBlob.includes('w10322959-test'));

  const resolved = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'whirlpool_sxs_w11296289',
    manufacturer: 'Whirlpool',
    model: 'WRS325SDHZ',
  });
  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'french_door_refrigerator');
  assert.equal(resolved!.resolution.platformId, 'whirlpool_sxs_w11296289');
  assert.ok(resolved!.components.some((c) => c.id === 'door_switch'));
  assert.ok(resolved!.components.some((c) => c.id === 'em3y60_compressor'));
  assert.ok(!resolved!.components.some((c) => c.id === 'compressor'));
  assert.ok(!resolved!.components.some((c) => c.id === 'condenser_fan'));
  assert.ok(
    resolved!.procedureBindings?.some(
      (b) => b.procedureId === 'w11296289-test-21-rc-door-switch',
    ),
  );
  assert.ok(
    family.conditionalConceptBindings.some(
      (b: { conditionalConceptId: string }) => b.conditionalConceptId === 'condenser_fan',
    ),
  );
});

test('five refrigerator overlays are platform-isolated', () => {
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
  const lg = resolveDiagnosticGraph({
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

  const platforms = [
    jazz!.resolution.platformId,
    samsungFd!.resolution.platformId,
    lg!.resolution.platformId,
    samsungSxs!.resolution.platformId,
    whirlpoolSxs!.resolution.platformId,
  ];
  assert.deepEqual(new Set(platforms).size, 5);
  for (const graph of [jazz, samsungFd, lg, samsungSxs, whirlpoolSxs]) {
    assert.equal(graph!.ontology.id, 'french_door_refrigerator');
  }
});

test('prior overlays byte-stable after Whirlpool SxS WP2 publish', () => {
  const publication = JSON.parse(
    readFileSync(join(CALIBRATION, 'publication_W11296289_SXS_CG95.json'), 'utf8'),
  );
  assert.equal(publication.headlineMetric.canonicalExpansion, 0);
  assert.equal(publication.canonicalHashBefore, publication.canonicalHashAfter);
  assert.equal(publication.canonicalHashAfter, EXPECTED_CANONICAL_HASH);

  const samsungSxs = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/samsung_sxs.json'), 'utf8'),
  );
  assert.equal(samsungSxs.status, 'published');
  assert.equal(samsungSxs.compoundingEvidence.workPackage, 'WP1');
});
