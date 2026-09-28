import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  buildOemProcedureNavigationGate,
  isOemProcedureNavigationBlocked,
} from '../oemProcedureNavGate';

test('stale activeProcedureId without run does not block wizard navigation', () => {
  assert.equal(
    isOemProcedureNavigationBlocked('w8178558-motor-circuit', {}),
    false,
  );
  assert.equal(buildOemProcedureNavigationGate('w8178558-motor-circuit', {}), null);
});

test('in-progress OEM run blocks navigation', () => {
  assert.equal(
    isOemProcedureNavigationBlocked('w8178558-motor-circuit', {
      'w8178558-motor-circuit': {
        procedureId: 'w8178558-motor-circuit',
        version: '1.0.0',
        status: 'in_progress',
        currentStepId: 'safety_power_off',
        completedStepIds: [],
        stepInputs: {},
      },
    }),
    true,
  );
});
