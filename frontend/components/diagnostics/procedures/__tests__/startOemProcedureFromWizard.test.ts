import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildOemProcedureStartPayload } from '../startOemProcedureFromWizard';

test('one start creates in_progress run and active procedure id', () => {
  const first = buildOemProcedureStartPayload({ procedureRuns: {} }, 'w8178558-door-lock');
  assert.ok(first);
  assert.equal(first.activeProcedureId, 'w8178558-door-lock');
  assert.equal(first.procedureRuns['w8178558-door-lock'].status, 'in_progress');

  const second = buildOemProcedureStartPayload(
    { procedureRuns: first.procedureRuns, activeProcedureId: first.activeProcedureId },
    'w8178558-door-lock',
  );
  assert.ok(second);
  assert.equal(second.procedureRuns['w8178558-door-lock'].status, 'in_progress');
  assert.equal(
    second.procedureRuns['w8178558-door-lock'].currentStepId,
    first.procedureRuns['w8178558-door-lock'].currentStepId,
  );
});

test('completed procedure cannot be started again from wizard offer', () => {
  const completed = buildOemProcedureStartPayload(
    {
      procedureRuns: {
        'w8178558-door-lock': {
          procedureId: 'w8178558-door-lock',
          version: '1.0.0',
          startedAt: '2026-03-12T10:00:00.000Z',
          currentStepId: 'done',
          completedStepIds: ['done'],
          stepInputs: {},
          status: 'completed',
        },
      },
    },
    'w8178558-door-lock',
  );
  assert.equal(completed, null);
});
