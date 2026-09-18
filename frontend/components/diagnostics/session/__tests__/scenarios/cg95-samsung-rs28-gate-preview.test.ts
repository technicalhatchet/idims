import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-9.5 Samsung RS28 gate table is contract-framed with zero canonical expansion', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_RS28_SXS_overlay_mapping_table_v1.json'), 'utf8'),
  );

  assert.ok(['gate_preview', 'gated', 'published'].includes(gate.status));
  assert.equal(gate.canonicalOntologyId, 'french_door_refrigerator');
  assert.equal(gate.platformId, 'samsung_sxs');
  assert.equal(gate.accounting.canonicalExpansion, 0);
  assert.equal(gate.accounting.discoveryCorpusInheritance, 0);
  assert.equal(gate.gateFraming.cg9AutoApprovalBlocked, true);
  assert.equal(gate.accounting.canonicalInheritance, 5);
  assert.equal(gate.accounting.conditionalBinding, 7);
  assert.equal(gate.manufacturerIsolation.rf23bbOverlayDependentCount, 0);
});

test('CG-9.5 Samsung RS28 gate audit boundaries cover C-fan ambiguity and CG-9 isolation', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_RS28_SXS_overlay_mapping_table_v1.json'), 'utf8'),
  );

  const boundaries = gate.auditBoundaries as Record<string, string[]>;
  for (const id of [
    'samsung-rs28-compressor-inverter-conditional',
    'samsung-rs28-inverter-board-platform',
    'samsung-rs28-temp-fresh-food-conditional',
    'samsung-rs28-c-fan-platform',
    'samsung-rs28-condenser-fan-abstention',
    'samsung-rs28-cg9-evidence-isolation',
    'samsung-rs28-aggregate-resurrection-blocked',
  ]) {
    const found = Object.values(boundaries).some((rows) => rows.includes(id));
    assert.ok(found, `missing audit boundary teaching row ${id}`);
  }
});

test('CG-9.5 Samsung RS28 compounding evidence reports SxS production compounding', () => {
  const evidence = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_RS28_SXS_CG95_COMPOUNDING_EVIDENCE_v1.json'), 'utf8'),
  );

  assert.equal(evidence.headlineMetric.canonicalExpansion, 0);
  assert.equal(evidence.compoundingCurve.canonicalInheritance, 5);
  assert.equal(evidence.compoundingCurve.conditionalBinding, 7);
  assert.equal(evidence.compoundingCurve.discoveryCorpusInheritance, 0);
  assert.ok(evidence.hierarchyTest.cg9CalibrationNotAutoPromoted);
  assert.ok(evidence.hierarchyTest.manufacturerIsolationEnforced);
});
