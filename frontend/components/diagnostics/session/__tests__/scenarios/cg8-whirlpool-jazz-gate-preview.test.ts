import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-8 Jazz gate table is contract-framed with zero canonical expansion', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'WHIRLPOOL_JAZZ_FD_overlay_mapping_table_v1.json'), 'utf8'),
  );

  assert.ok(['gate_preview', 'gated', 'published'].includes(gate.status));
  assert.equal(gate.canonicalOntologyId, 'french_door_refrigerator');
  assert.equal(gate.accounting.canonicalExpansion, 0);
  assert.equal(gate.gateFraming.question, 'What does this manual teach us about the frozen contract?');
  assert.equal(gate.accounting.canonicalInheritance, 6);
  assert.equal(gate.accounting.conditionalBinding, 4);
  const status = gate.status;
  if (status === 'gate_preview') {
    assert.ok(gate.accounting.unresolved >= 3);
  } else {
    assert.equal(gate.accounting.intentionalAbstentions, 4);
  }
});

test('CG-8 Jazz gate audit boundaries cover compressor relay and compartment thermistors', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'WHIRLPOOL_JAZZ_FD_overlay_mapping_table_v1.json'), 'utf8'),
  );

  const teachingIds = new Set(
    (gate.contractTeachingRows as Array<{ teachingId: string }>).map((row) => row.teachingId),
  );
  for (const id of [
    'jazz-compressor-relay-conditional',
    'jazz-compressor-relay-platform',
    'jazz-ff-thermistor-conditional',
    'jazz-fz-thermistor-conditional',
  ]) {
    assert.ok(teachingIds.has(id), `missing audit boundary teaching row ${id}`);
  }
});

test('CG-8 compounding evidence reports hierarchy behaving as designed', () => {
  const evidence = JSON.parse(
    readFileSync(join(CALIBRATION, 'WHIRLPOOL_JAZZ_FD_CG8_COMPOUNDING_EVIDENCE_v1.json'), 'utf8'),
  );

  assert.equal(evidence.compoundingCurve.canonicalExpansion, 0);
  assert.equal(evidence.compoundingCurve.canonicalInheritance, 6);
  assert.ok(evidence.hierarchyTest.frozenKeepStable);
  assert.ok(evidence.hierarchyTest.conditionalAbsorbsArchitecture);
});
