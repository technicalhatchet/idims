import assert from 'node:assert/strict';
import { test } from 'node:test';

import { evaluateDiagnosticIntelligence } from '../diagnosticIntelligenceEngine';
import { getWizardDefinition } from '../../registry/wizardRegistry';
import {
  formatDiyLeadCard,
  shouldShowLeadingHypothesis,
} from '../evidenceDisplay';
import {
  isComponentVerifiedGoodForHypothesis,
  resolveDiagnosticForegroundState,
} from '../diagnosticForegroundState';
import type { ProcedureRunState } from '../../procedures/types';
import { getServiceProcedure } from '../../procedures/procedureRegistry';
import {
  isOemStrongLeadPoolExhausted,
  shouldDeferGenericWizardAfterOemComplete,
} from '../../procedures/oemDiagnosticLifecycle';

const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
const visitedStepKeys = ['complaint', 'visual', 'functional', 'oem_test'];
const wizardDefinition = getWizardDefinition('washer');
const defaultStepOrder = wizardDefinition?.defaultSteps.map(
  (step) => step.stepKey || step.sectionId,
) || [];

function intelligenceForRuns(procedureRuns: Record<string, ProcedureRunState>) {
  return evaluateDiagnosticIntelligence('washer', fields, undefined, {
    visitedStepKeys,
    defaultStepOrder,
    procedureRuns,
  });
}

function completedEliminateRun(
  procedureId: string,
  stepId: string,
  branchId: string,
  componentId: string,
  evidenceId: string,
): ProcedureRunState {
  return {
    procedureId,
    version: '1.0.0',
    startedAt: '2026-03-12T10:00:00.000Z',
    currentStepId: 'verified_outcome',
    completedStepIds: [stepId, 'verified_outcome'],
    stepInputs: { [stepId]: { kind: 'checkpoint', value: 'yes' } },
    status: 'completed',
    appliedDiagnosticEffects: [{
      stepId,
      branchId,
      at: '2026-03-12T10:05:00.000Z',
      effects: [{ type: 'eliminate', componentId, evidenceId }],
    }],
  };
}

test('verified-good drain pump is not an active hypothesis', () => {
  const runs = {
    'w8178558-drain-pump': completedEliminateRun(
      'w8178558-drain-pump',
      'pump_at_component',
      'pump_comp_pass',
      'drain_pump',
      'eliminate_drain_pump_ol_drain_pump_ok',
    ),
  };
  const intelligence = intelligenceForRuns(runs);
  assert.equal(isComponentVerifiedGoodForHypothesis('drain_pump', intelligence), true);
  const foreground = resolveDiagnosticForegroundState(intelligence, { procedureRuns: runs });
  assert.notEqual(foreground?.headline.toLowerCase(), 'drain pump');
  if (foreground?.mode === 'active_hypothesis') {
    assert.notEqual(foreground.categoryId, 'drain_pump');
  }
});

test('verified-good motor cannot be foreground hypothesis with ranking percent', () => {
  const runs = {
    'w8178558-door-lock': completedEliminateRun(
      'w8178558-door-lock',
      'live_test_door_lock',
      'lock_energizes_yes',
      'door_lock',
      'eliminate_door_lock_open_door_lock_ok',
    ),
    'w8178558-drain-pump': completedEliminateRun(
      'w8178558-drain-pump',
      'pump_at_component',
      'pump_comp_pass',
      'drain_pump',
      'eliminate_drain_pump_ol_drain_pump_ok',
    ),
    'w8178558-motor-circuit': completedEliminateRun(
      'w8178558-motor-circuit',
      'motor_resistance',
      'motor_pass',
      'drive_motor',
      'eliminate_drive_motor_ol_drive_motor_ok',
    ),
  };
  const intelligence = intelligenceForRuns(runs);
  const lead = formatDiyLeadCard(intelligence, { procedureRuns: runs });
  assert.ok(lead);
  assert.equal(lead.showPercent, false);
  assert.notEqual(lead.foregroundMode, 'active_hypothesis');
  assert.ok(!lead.headline.toLowerCase().includes('drive motor') || lead.foregroundMode !== 'active_hypothesis');
});

test('hypothesis card remains visible after negative OEM evidence', () => {
  const runs = {
    'w8178558-drain-pump': completedEliminateRun(
      'w8178558-drain-pump',
      'pump_at_component',
      'pump_comp_pass',
      'drain_pump',
      'eliminate_drain_pump_ol_drain_pump_ok',
    ),
  };
  const intelligence = intelligenceForRuns(runs);
  assert.equal(
    shouldShowLeadingHypothesis(intelligence, {
      visitedStepKeys,
      procedureRuns: runs,
      currentStepKey: 'oem_test',
    }),
    true,
  );
});

test('motor and door lock are distinct ServiceProcedure identities', () => {
  const door = getServiceProcedure('w8178558-door-lock');
  const motor = getServiceProcedure('w8178558-motor-circuit');
  assert.ok(door && motor);
  assert.notEqual(door.id, motor.id);
});

test('motor circuit procedure contains multiple internal steps including service mode path', () => {
  const motor = getServiceProcedure('w8178558-motor-circuit');
  assert.ok(motor);
  assert.ok(motor.steps.length > 5);
  const titles = motor.steps.map((step) => step.title.toLowerCase()).join(' ');
  assert.match(titles, /motor|diagnostic|test|mode|measurement/i);
});

test('OEM exhaustion after verified-good stack never shows ranking percent', () => {
  const runs = {
    'w8178558-door-lock': completedEliminateRun(
      'w8178558-door-lock',
      'live_test_door_lock',
      'lock_energizes_yes',
      'door_lock',
      'eliminate_door_lock_open_door_lock_ok',
    ),
    'w8178558-drain-pump': completedEliminateRun(
      'w8178558-drain-pump',
      'pump_at_component',
      'pump_comp_pass',
      'drain_pump',
      'eliminate_drain_pump_ol_drain_pump_ok',
    ),
    'w8178558-motor-circuit': completedEliminateRun(
      'w8178558-motor-circuit',
      'motor_resistance',
      'motor_pass',
      'drive_motor',
      'eliminate_drive_motor_ol_drive_motor_ok',
    ),
  };
  const intelligence = intelligenceForRuns(runs);
  const lead = formatDiyLeadCard(intelligence, {
    procedureRuns: runs,
    oemDiagnosticPathExhausted: true,
    oemManufacturerPathActive: true,
  });
  assert.ok(lead);
  assert.equal(lead.showPercent, false);
  assert.equal(lead.percent, null);
  assert.notEqual(lead.foregroundMode, 'active_hypothesis');
  assert.ok(
    ['oem_path_complete', 'remaining_upstream_path', 'no_supported_fault'].includes(lead.foregroundMode),
  );
});

test('OEM active phase copy references manufacturer path when gathering', () => {
  const intelligence = intelligenceForRuns({});
  const foreground = resolveDiagnosticForegroundState(intelligence, {
    oemManufacturerPathActive: true,
    oemDiagnosticPathExhausted: false,
    oemCurrentTestFocus: '5-8 Drive Motor Circuit',
  });
  assert.ok(foreground);
  assert.equal(foreground.mode, 'continuing_tests');
  assert.equal(foreground.tierLabel, 'Next test');
  assert.match(foreground.headline, /drive motor circuit/i);
  assert.ok(!foreground.headline.toLowerCase().includes('no failed component'));
});

test('active OEM path does not use no_supported_fault headline', () => {
  const runs = {
    'w8178558-door-lock': completedEliminateRun(
      'w8178558-door-lock',
      'live_test_door_lock',
      'lock_energizes_yes',
      'door_lock',
      'eliminate_door_lock_open_door_lock_ok',
    ),
  };
  const intelligence = intelligenceForRuns(runs);
  const foreground = resolveDiagnosticForegroundState(intelligence, {
    procedureRuns: runs,
    oemManufacturerPathActive: true,
    oemDiagnosticPathExhausted: false,
    oemCurrentTestFocus: '5-8 Drive Motor Circuit',
  });
  assert.ok(foreground);
  assert.notEqual(foreground.mode, 'no_supported_fault');
  assert.notEqual(foreground.headline, 'No failed component identified');
});

test('generic wizard deferred when OEM pool exhausted', () => {
  assert.equal(shouldDeferGenericWizardAfterOemComplete('mechanical', true), true);
  assert.equal(shouldDeferGenericWizardAfterOemComplete('next_wizard_step', true), true);
  assert.equal(shouldDeferGenericWizardAfterOemComplete('next_oem', true), false);
  assert.equal(
    isOemStrongLeadPoolExhausted({
      candidates: [{ id: 'w.mechanical', type: 'wizard_step', wizardStepKey: 'mechanical', eligible: true, score: 1, scoreBreakdown: { existingSystemBoost: 0, hypothesisAlignment: 0, routingFit: 0, branchBoost: 0, measurementBoost: 0, deprioritizationPenalty: 0, repeatPenalty: 0 }, source: { system: 'wizard', id: 'mechanical' }, target: 'mechanical', procedureId: null }],
      procedureRecommendations: [],
      procedureRuns: { 'w8178558-motor-circuit': { status: 'completed' } as ProcedureRunState },
      oemRunnerEnabled: true,
    }),
    true,
  );
});
