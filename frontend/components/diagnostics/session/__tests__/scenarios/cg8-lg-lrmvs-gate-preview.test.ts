import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-8 LG gate table is contract-framed with zero expansion and discovery isolation', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'LG_LRMVS_FD_overlay_mapping_table_v1.json'), 'utf8'),
  );

  assert.ok(['gate_preview', 'gated', 'published'].includes(gate.status));
  assert.equal(gate.canonicalOntologyId, 'french_door_refrigerator');
  assert.equal(gate.accounting.canonicalExpansion, 0);
  assert.equal(gate.accounting.discoveryCorpusInheritance, 0);
  assert.equal(gate.accounting.canonicalInheritance, 5);
  assert.equal(gate.accounting.conditionalBinding, 7);
  assert.equal(gate.manufacturerIsolation.discoveryCorpusInheritanceCount, 0);
  assert.ok(gate.discoveryCorpusPolicy.referenceOnly);
});

test('CG-8 LG evidence includes three-way binding matrix', () => {
  const evidence = JSON.parse(
    readFileSync(join(CALIBRATION, 'LG_LRMVS_FD_CG8_COMPOUNDING_EVIDENCE_v1.json'), 'utf8'),
  );

  const matrix = evidence.threeWayBindingMatrix as Record<
    string,
    Record<string, string>
  >;
  assert.equal(matrix.door_switch.whirlpool, 'canonical');
  assert.equal(matrix.door_switch.samsung, 'abstention');
  assert.equal(matrix.door_switch.lg, 'abstention');
  assert.equal(matrix.condenser_fan.lg, 'conditional');
  assert.equal(matrix.condenser_fan.samsung, 'abstention');
  assert.equal(evidence.hardInvariants.canonicalExpansion, 0);
  assert.equal(evidence.hardInvariants.discoveryCorpusInheritance, 0);
});
