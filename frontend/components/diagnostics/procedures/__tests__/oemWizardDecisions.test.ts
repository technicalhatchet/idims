import assert from 'node:assert/strict';
import { test } from 'node:test';

import {
  clearOemWizardSkipsOnReentry,
  isOemWizardLeadSuppressedForProcedure,
  recordOemWizardLeadDecision,
  resolveOemWizardDisplayedProcedureId,
  shouldOfferOemWizardLead,
} from '../oemWizardDecisions';
import type { ProcedureRecommendation } from '../recommendServiceProcedures';
import { getServiceProcedure } from '../procedureRegistry';

function recommendation(procedureId: string): ProcedureRecommendation {
  const procedure = getServiceProcedure(procedureId);
  assert.ok(procedure);
  return { procedureId, procedure, reason: '', priority: 40 };
}

test('skip is scoped per procedure, not global legacy flag only', () => {
  const decisions = recordOemWizardLeadDecision(undefined, 'w8178558-door-lock', 'skipped');
  assert.equal(
    isOemWizardLeadSuppressedForProcedure('w8178558-door-lock', decisions),
    true,
  );
  assert.equal(
    isOemWizardLeadSuppressedForProcedure('w8178558-drain-pump', decisions),
    false,
  );
});

test('re-entering oem_test clears skip-only decisions', () => {
  const decisions = recordOemWizardLeadDecision(undefined, 'w8178558-door-lock', 'skipped');
  const cleared = clearOemWizardSkipsOnReentry(decisions, 'oem_test');
  assert.equal(cleared?.['w8178558-door-lock'], undefined);
});

test('resolveOemWizardDisplayedProcedureId prefers active runner over top offer', () => {
  const doorLock = 'w8178558-door-lock';
  const drainPump = 'w8178558-drain-pump';
  assert.equal(
    resolveOemWizardDisplayedProcedureId({
      activeProcedureId: doorLock,
      offeredProcedureId: drainPump,
    }),
    doorLock,
  );
});

test('resolveOemWizardDisplayedProcedureId uses offer when active runner is unset', () => {
  const doorLock = 'w8178558-door-lock';
  assert.equal(
    resolveOemWizardDisplayedProcedureId({
      activeProcedureId: null,
      offeredProcedureId: doorLock,
    }),
    doorLock,
  );
  assert.equal(
    resolveOemWizardDisplayedProcedureId({
      activeProcedureId: doorLock,
      offeredProcedureId: doorLock,
    }),
    doorLock,
  );
});

test('user_verified targets displayed active procedure when offer differs', () => {
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

test('skipped and user_verified are distinct decision kinds', () => {
  const skipped = recordOemWizardLeadDecision(undefined, 'w8178558-door-lock', 'skipped');
  const verified = recordOemWizardLeadDecision(undefined, 'w8178558-drain-pump', 'user_verified');
  assert.equal(skipped['w8178558-door-lock'].kind, 'skipped');
  assert.equal(verified['w8178558-drain-pump'].kind, 'user_verified');
  assert.notEqual(skipped['w8178558-door-lock'].kind, verified['w8178558-drain-pump'].kind);
});

test('user_verified suppresses re-offer for that procedure', () => {
  const decisions = recordOemWizardLeadDecision(undefined, 'w8178558-door-lock', 'user_verified');
  assert.equal(
    shouldOfferOemWizardLead(recommendation('w8178558-door-lock'), decisions),
    false,
  );
});
