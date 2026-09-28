import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const REPO_ROOT = resolve(process.cwd(), '..');
const CANDIDATES = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/candidates/SAMSUNG-NE58H-INDUCTION-RANGE',
);

test('P05 range routing — surface_element maps to surface_heating_system', () => {
  const mappings = JSON.parse(
    readFileSync(join(CANDIDATES, 'canonical_mapping_candidates.json'), 'utf8'),
  );
  const surface = mappings.candidates.find(
    (entry: { sourceTerm: string }) => entry.sourceTerm === 'surface_element',
  );
  assert.equal(surface?.status, 'candidate');
  assert.equal(surface?.canonicalId, 'surface_heating_system');
});

test('P05 range routing — CG-12 induction overlays bind surface heat procedures', () => {
  const overlays = JSON.parse(readFileSync(join(CANDIDATES, 'overlay_candidates.json'), 'utf8'));
  const procedureIds = overlays.candidates.map(
    (entry: { procedureId: string }) => entry.procedureId,
  );
  assert.ok(procedureIds.includes('ne58h-induction-igbt-sensor'));
  assert.ok(procedureIds.includes('ne58h-induction-pan-detection'));
  assert.ok(procedureIds.includes('ne58h-induction-comm-inverter'));
});

test('P05 range routing — pipeline manifest uses range_oven ontology', () => {
  const manifest = JSON.parse(readFileSync(join(CANDIDATES, 'pipeline_manifest.json'), 'utf8'));
  assert.equal(manifest.ontologyId, 'range_oven');
  assert.ok(manifest.counts.mappingCandidates > 0);
  assert.ok(manifest.counts.overlayCandidates > 1);
});

test('P05 range routing — core range components map via range seed aliases', () => {
  const mappings = JSON.parse(
    readFileSync(join(CANDIDATES, 'canonical_mapping_candidates.json'), 'utf8'),
  );
  const mainControl = mappings.candidates.find(
    (entry: { sourceTerm: string }) => entry.sourceTerm === 'main_control',
  );
  const displayPanel = mappings.candidates.find(
    (entry: { sourceTerm: string }) => entry.sourceTerm === 'display_panel',
  );
  assert.equal(mainControl?.canonicalId, 'control_board');
  assert.equal(displayPanel?.canonicalId, 'user_interface');
});
