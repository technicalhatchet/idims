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

test('CG-8 WP3 observation records discovery isolation and zero expansion', () => {
  const obs = JSON.parse(
    readFileSync(join(CALIBRATION, 'LG_LRMVS_fd_cg8_compounding_observation_v1.json'), 'utf8'),
  );
  assert.equal(obs.verdict.canonicalInheritances, 5);
  assert.equal(obs.verdict.conditionalBindings, 7);
  assert.equal(obs.verdict.overlayLearningEvents, 7);
  assert.equal(obs.verdict.intentionalAbstentions, 4);
  assert.equal(obs.verdict.canonicalExpansion, 0);
  assert.equal(obs.verdict.discoveryCorpusInheritance, 0);
});

test('published LG overlay resolves with hard invariants and prior overlay stability', () => {
  const publication = JSON.parse(
    readFileSync(join(CALIBRATION, 'publication_LG_LRMVS_FD_CG8.json'), 'utf8'),
  );

  assert.equal(publication.canonicalHashAfter, EXPECTED_CANONICAL_HASH);
  assert.equal(publication.hardInvariants.canonicalExpansion, 0);
  assert.equal(publication.hardInvariants.discoveryCorpusInheritance, 0);
  assert.equal(
    publication.priorOverlayHashesBefore.whirlpool_jazz,
    publication.priorOverlayHashesAfter.whirlpool_jazz,
  );
  assert.equal(
    publication.priorOverlayHashesBefore.samsung_rf23bb,
    publication.priorOverlayHashesAfter.samsung_rf23bb,
  );

  const overlay = JSON.parse(
    readFileSync(join(CANONICAL, 'manufacturer_overlays/lg_lrmvs.json'), 'utf8'),
  );
  assert.equal(overlay.status, 'published');

  const resolved = resolveDiagnosticGraph({
    templateId: 'refrigerator',
    platformId: 'lg_lrmvs',
    manufacturer: 'LG',
    model: 'LRMVS3006',
  });
  assert.ok(resolved);
  assert.equal(resolved!.ontology.id, 'french_door_refrigerator');
  assert.ok(resolved!.components.some((c) => c.id === 'linear_compressor'));
  assert.ok(resolved!.components.some((c) => c.id === 'control_board'));
  assert.ok(!resolved!.components.some((c) => c.id === 'compressor'));
  assert.ok(
    resolved!.procedureBindings?.some((b) => b.procedureId === 'lglrmvs-condenser-fan'),
  );
  assert.ok(
    !resolved!.procedureBindings?.some(
      (b) =>
        b.procedureId?.startsWith('lglrmvs-') &&
        (b.canonicalComponents || []).includes('door_switch'),
    ),
  );
});
