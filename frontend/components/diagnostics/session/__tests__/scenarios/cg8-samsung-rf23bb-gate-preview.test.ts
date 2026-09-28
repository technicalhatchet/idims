import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-8 Samsung gate table is contract-framed with zero canonical expansion', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_RF23BB_FD_overlay_mapping_table_v1.json'), 'utf8'),
  );

  assert.ok(['gate_preview', 'gated', 'published'].includes(gate.status));
  assert.equal(gate.canonicalOntologyId, 'french_door_refrigerator');
  assert.equal(gate.accounting.canonicalExpansion, 0);
  assert.equal(gate.gateFraming.question, 'What does this manual teach us about the frozen contract?');
  assert.equal(gate.gateFraming.manufacturerBoundary, 'stricter — RF23BB evidence independent of Whirlpool Jazz overlay');
  assert.equal(gate.accounting.canonicalInheritance, 5);
  assert.equal(gate.accounting.conditionalBinding, 7);
  assert.equal(gate.manufacturerIsolation.whirlpoolOverlayDependentCount, 0);
});

test('CG-8 Samsung gate audit boundaries cover inverter split and compartment thermistors', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_RF23BB_FD_overlay_mapping_table_v1.json'), 'utf8'),
  );

  const boundaries = gate.auditBoundaries as Record<string, string[]>;
  for (const id of [
    'samsung-compressor-inverter-conditional',
    'samsung-inverter-board-platform',
    'samsung-temp-fridge-conditional',
    'samsung-temp-flex-conditional',
    'samsung-aggregate-resurrection-blocked',
  ]) {
    const found = Object.values(boundaries).some((rows) => rows.includes(id));
    assert.ok(found, `missing audit boundary teaching row ${id}`);
  }
});

test('CG-8 Samsung compounding evidence reports architecture divergence absorbed', () => {
  const evidence = JSON.parse(
    readFileSync(join(CALIBRATION, 'SAMSUNG_RF23BB_FD_CG8_COMPOUNDING_EVIDENCE_v1.json'), 'utf8'),
  );

  assert.equal(evidence.headlineMetric.canonicalExpansion, 0);
  assert.equal(evidence.compoundingCurve.canonicalInheritance, 5);
  assert.equal(evidence.compoundingCurve.conditionalBinding, 7);
  assert.ok(evidence.hierarchyTest.conditionalAbsorbsArchitecture);
  assert.ok(evidence.hierarchyTest.manufacturerIsolationEnforced);
  assert.equal(evidence.comparisonToWP1.samsungRf23bb.doorSwitchWithheld, true);
});
