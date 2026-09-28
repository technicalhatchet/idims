import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDiagnosticPayloadPersistSignature } from '../../utils/diagnosticPayloadPersistSignature';

test('progress queue skips duplicate semantic payloads', () => {
  const payload = {
    templateId: 'washer',
    currentStepKey: 'oem_test',
    visitedStepKeys: ['complaint', 'oem_test'],
    fields: { 'electrical.motor_ohms': '14' },
  };
  const signatures: string[] = [];
  const queue = [payload, { ...payload }, payload];

  for (const item of queue) {
    const signature = buildDiagnosticPayloadPersistSignature(item);
    if (signatures.includes(signature)) continue;
    signatures.push(signature);
  }

  assert.equal(signatures.length, 1);
});
