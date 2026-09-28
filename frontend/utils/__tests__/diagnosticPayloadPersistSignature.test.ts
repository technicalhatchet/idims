import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildDiagnosticPayloadPersistSignature } from '../diagnosticPayloadPersistSignature';

test('identical semantic payloads produce the same persist signature', () => {
  const a = {
    templateId: 'washer',
    currentStepKey: 'oem_test',
    visitedStepKeys: ['complaint', 'oem_test'],
    fields: { 'electrical.motor_ohms': '14' },
    procedureRuns: {},
    activeProcedureId: null,
  };
  const b = {
    ...a,
    fields: { 'electrical.motor_ohms': '14' },
  };
  assert.equal(
    buildDiagnosticPayloadPersistSignature(a),
    buildDiagnosticPayloadPersistSignature(b),
  );
});

test('field edits change the persist signature', () => {
  const base = {
    templateId: 'washer',
    fields: { 'electrical.motor_ohms': '14' },
  };
  const edited = {
    templateId: 'washer',
    fields: { 'electrical.motor_ohms': '12' },
  };
  assert.notEqual(
    buildDiagnosticPayloadPersistSignature(base),
    buildDiagnosticPayloadPersistSignature(edited),
  );
});
