import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-9.5 LG LSC27926 gate table is contract-framed with zero canonical expansion', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'LG_LSC27926_SXS_overlay_mapping_table_v1.json'), 'utf8'),
  );

  assert.ok(['gate_preview', 'gated', 'published'].includes(gate.status));
  assert.equal(gate.canonicalOntologyId, 'french_door_refrigerator');
  assert.equal(gate.platformId, 'lg_sxs');
  assert.equal(gate.accounting.canonicalExpansion, 0);
  assert.equal(gate.accounting.discoveryCorpusInheritance, 0);
  assert.equal(gate.gateFraming.cg9AutoApprovalBlocked, true);
  assert.equal(gate.accounting.canonicalInheritance, 6);
  assert.equal(gate.accounting.conditionalBinding, 7);
  assert.equal(gate.manufacturerIsolation.crossOverlayDependentCount, 0);
});

test('CG-9.5 LG gate audit boundaries cover door_switch and conventional compressor', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'LG_LSC27926_SXS_overlay_mapping_table_v1.json'), 'utf8'),
  );

  const boundaries = gate.auditBoundaries as Record<string, string[]>;
  for (const id of [
    'lg-sxs-door-switch',
    'lg-sxs-condenser-fan-conditional',
    'lg-sxs-compressor-relay-conditional',
    'lg-sxs-cg9-r2-evidence-isolation',
    'lg-sxs-aggregate-resurrection-blocked',
  ]) {
    const found = Object.values(boundaries).some((rows) => rows.includes(id));
    assert.ok(found, `missing audit boundary teaching row ${id}`);
  }
});

test('CG-9.5 LG compounding evidence reports six-overlay hierarchy proof', () => {
  const evidence = JSON.parse(
    readFileSync(join(CALIBRATION, 'LG_LSC27926_SXS_CG95_COMPOUNDING_EVIDENCE_v1.json'), 'utf8'),
  );

  assert.equal(evidence.headlineMetric.canonicalExpansion, 0);
  assert.equal(evidence.compoundingCurve.canonicalInheritance, 6);
  assert.equal(evidence.compoundingCurve.conditionalBinding, 7);
  assert.ok(evidence.hierarchyTest.cg9CalibrationNotAutoPromoted);
  assert.equal(evidence.compoundingSequence, 3);
});
