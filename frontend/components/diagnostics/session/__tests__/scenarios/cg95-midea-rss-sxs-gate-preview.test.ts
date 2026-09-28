import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-9.5 Midea RSS gate table is contract-framed with zero canonical expansion', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'MIDEA_RSS_SXS_overlay_mapping_table_v1.json'), 'utf8'),
  );

  assert.ok(['gate_preview', 'gated', 'published'].includes(gate.status));
  assert.equal(gate.canonicalOntologyId, 'french_door_refrigerator');
  assert.equal(gate.platformId, 'midea_rss');
  assert.equal(gate.accounting.canonicalExpansion, 0);
  assert.equal(gate.accounting.discoveryCorpusInheritance, 0);
  assert.equal(gate.gateFraming.cg9AutoApprovalBlocked, true);
  assert.equal(gate.accounting.canonicalInheritance, 3);
  assert.equal(gate.accounting.conditionalBinding, 5);
  assert.equal(gate.manufacturerIsolation.crossOverlayDependentCount, 0);
});

test('CG-9.5 Midea RSS gate audit boundaries cover VFD compressor and door_switch abstention', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'MIDEA_RSS_SXS_overlay_mapping_table_v1.json'), 'utf8'),
  );

  const boundaries = gate.auditBoundaries as Record<string, string[]>;
  for (const id of [
    'midearss-compressor-vfd-conditional',
    'midearss-door-switch-abstention',
    'midearss-vfd-inverter-platform',
    'midearss-cg9-r2-evidence-isolation',
    'midearss-aggregate-resurrection-blocked',
  ]) {
    const found = Object.values(boundaries).some((rows) => rows.includes(id));
    assert.ok(found, `missing audit boundary teaching row ${id}`);
  }
});

test('CG-9.5 Midea RSS compounding evidence reports seven-overlay hierarchy proof', () => {
  const evidence = JSON.parse(
    readFileSync(join(CALIBRATION, 'MIDEA_RSS_SXS_CG95_COMPOUNDING_EVIDENCE_v1.json'), 'utf8'),
  );

  assert.equal(evidence.headlineMetric.canonicalExpansion, 0);
  assert.equal(evidence.compoundingCurve.canonicalInheritance, 3);
  assert.equal(evidence.compoundingCurve.conditionalBinding, 5);
  assert.ok(evidence.hierarchyTest.cg9CalibrationNotAutoPromoted);
  assert.equal(evidence.compoundingSequence, 4);
});
