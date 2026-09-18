import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-9.5 Whirlpool W11296289 gate table is contract-framed with zero canonical expansion', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'W11296289_SXS_overlay_mapping_table_v1.json'), 'utf8'),
  );

  assert.ok(['gate_preview', 'gated', 'published'].includes(gate.status));
  assert.equal(gate.canonicalOntologyId, 'french_door_refrigerator');
  assert.equal(gate.platformId, 'whirlpool_sxs_w11296289');
  assert.equal(gate.accounting.canonicalExpansion, 0);
  assert.equal(gate.accounting.discoveryCorpusInheritance, 0);
  assert.equal(gate.gateFraming.cg9AutoApprovalBlocked, true);
  assert.equal(gate.accounting.canonicalInheritance, 6);
  assert.equal(gate.accounting.conditionalBinding, 6);
  assert.equal(gate.manufacturerIsolation.crossOverlayDependentCount, 0);
});

test('CG-9.5 Whirlpool gate audit boundaries cover door_switch and condenser_fan', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'W11296289_SXS_overlay_mapping_table_v1.json'), 'utf8'),
  );

  const boundaries = gate.auditBoundaries as Record<string, string[]>;
  for (const id of [
    'whirlpool-sxs-door-switch',
    'whirlpool-sxs-condenser-fan-conditional',
    'whirlpool-sxs-compressor-relay-conditional',
    'whirlpool-sxs-cg9-r2-evidence-isolation',
    'whirlpool-sxs-aggregate-resurrection-blocked',
  ]) {
    const found = Object.values(boundaries).some((rows) => rows.includes(id));
    assert.ok(found, `missing audit boundary teaching row ${id}`);
  }
});

test('CG-9.5 Whirlpool compounding evidence reports five-overlay hierarchy proof', () => {
  const evidence = JSON.parse(
    readFileSync(join(CALIBRATION, 'W11296289_SXS_CG95_COMPOUNDING_EVIDENCE_v1.json'), 'utf8'),
  );

  assert.equal(evidence.headlineMetric.canonicalExpansion, 0);
  assert.equal(evidence.compoundingCurve.canonicalInheritance, 6);
  assert.equal(evidence.compoundingCurve.conditionalBinding, 6);
  assert.ok(evidence.hierarchyTest.cg9CalibrationNotAutoPromoted);
  assert.equal(evidence.comparisonToWP1.whirlpoolW11296289.condenserFanBound, true);
  assert.equal(evidence.comparisonToWP1.whirlpoolW11296289.doorSwitchWithheld, false);
});
