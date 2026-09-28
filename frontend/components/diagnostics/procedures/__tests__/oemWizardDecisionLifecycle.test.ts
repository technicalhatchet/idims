import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  partitionOemCatalogEntries,
  recordOemWizardLeadDecision,
  resolveOemWizardDisplayedProcedureId,
  shouldShowOemWizardDecisionControls,
} from '../oemWizardDecisions';
import { executeOemWizardContinuationHandoff } from '../oemWizardContinuationHandoff';
import type { ProcedureRunState } from '../types';
import { getServiceProcedure } from '../procedureRegistry';
import type { ProcedureRecommendation } from '../recommendServiceProcedures';

function recommendation(procedureId: string): ProcedureRecommendation {
  const procedure = getServiceProcedure(procedureId);
  assert.ok(procedure);
  return { procedureId, procedure, reason: 'test', priority: 40 };
}

const completedRun = (procedureId: string): ProcedureRunState => ({
  procedureId,
  version: '1.0.0',
  startedAt: '2026-03-12T10:00:00.000Z',
  currentStepId: 'done',
  completedStepIds: ['done'],
  stepInputs: {},
  status: 'completed',
});

test('A initial OEM offer shows decision controls', () => {
  assert.equal(
    shouldShowOemWizardDecisionControls({
      readOnly: false,
      hasActiveRunner: false,
      offeredProcedureId: 'w8178558-door-lock',
      procedureRuns: {},
    }),
    true,
  );
});

test('B active OEM runner hides decision controls', () => {
  assert.equal(
    shouldShowOemWizardDecisionControls({
      readOnly: false,
      hasActiveRunner: true,
      offeredProcedureId: 'w8178558-door-lock',
      procedureRuns: {},
    }),
    false,
  );
});

test('C completed prior OEM + new offer shows decision controls for new procedure', () => {
  const doorLock = 'w8178558-door-lock';
  const drainPump = 'w8178558-drain-pump';
  assert.equal(
    shouldShowOemWizardDecisionControls({
      readOnly: false,
      hasActiveRunner: false,
      offeredProcedureId: drainPump,
      procedureRuns: { [doorLock]: completedRun(doorLock) },
    }),
    true,
  );
});

test('D active A with offer B — verify targets A not B', () => {
  const doorLock = 'w8178558-door-lock';
  const drainPump = 'w8178558-drain-pump';
  const target = resolveOemWizardDisplayedProcedureId({
    activeProcedureId: doorLock,
    offeredProcedureId: drainPump,
  });
  assert.equal(target, doorLock);
  const decisions = recordOemWizardLeadDecision(undefined, target!, 'user_verified');
  assert.equal(decisions[doorLock]?.kind, 'user_verified');
  assert.equal(decisions[drainPump], undefined);
});

test('E mechanical continuation plan does not imply OEM decision surface', () => {
  const doorLock = 'w8178558-door-lock';
  const jumps: string[] = [];
  executeOemWizardContinuationHandoff({ type: 'mechanical' }, {
    jumpToStepKey: (key) => jumps.push(key),
    startOemProcedure: () => {},
  });
  assert.deepEqual(jumps, ['mechanical']);
  assert.equal(
    shouldShowOemWizardDecisionControls({
      readOnly: false,
      hasActiveRunner: false,
      offeredProcedureId: null,
    }),
    false,
  );
});

test('F next_wizard_step handoff jumps wizard only', () => {
  const jumps: string[] = [];
  executeOemWizardContinuationHandoff({ type: 'next_wizard_step', wizardStepKey: 'visual' }, {
    jumpToStepKey: (key) => jumps.push(key),
    startOemProcedure: () => {},
  });
  assert.deepEqual(jumps, ['visual']);
});

test('G catalog partition never treats completed as available', () => {
  const doorLock = 'w8178558-door-lock';
  const drainPump = 'w8178558-drain-pump';
  const entries = [recommendation(doorLock), recommendation(drainPump)];
  const partitioned = partitionOemCatalogEntries(
    entries,
    { [doorLock]: completedRun(doorLock) },
    undefined,
  );
  assert.equal(partitioned.completed.length, 1);
  assert.equal(partitioned.completed[0].procedureId, doorLock);
  assert.equal(partitioned.available.length, 1);
  assert.equal(partitioned.available[0].procedureId, drainPump);
  const labels = partitioned.available.map((item) => item.procedure.title).join(' ');
  assert.doesNotMatch(labels, /All OEM tests/i);
});
