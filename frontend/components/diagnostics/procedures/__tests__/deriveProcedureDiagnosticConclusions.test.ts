import assert from 'node:assert/strict';
import {
  deriveProcedureDiagnosticConclusions,
  resolvePrimaryDiagnosticConclusion,
} from '../deriveProcedureDiagnosticConclusions';
import type { ProcedureRunState } from '../types';
import {
  fixtureRunBothGood,
  fixtureRunComponentGoodPathOpen,
  fixtureRunComponentOpenAtLoad,
  fixtureRunContradicted,
  fixtureRunLegacyUnscopedConfirm,
  fixtureRunPathOpenWithoutLoadInCircuit,
  OTHER_PLATFORM_SCOPED_PROCEDURE,
  SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE,
} from './fixtures/scopedEvidenceProcedureFixture';

function testComponentGoodPathOpen() {
  const run = fixtureRunComponentGoodPathOpen();
  const conclusions = deriveProcedureDiagnosticConclusions(run, SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE);
  const primary = resolvePrimaryDiagnosticConclusion(conclusions);

  assert.equal(conclusions.length, 1);
  assert.equal(primary?.kind, 'external_path_fault');
  assert.equal(primary?.anchorComponentId, 'drain_pump');
  assert.equal(primary?.componentState, 'verified_good');
  assert.ok(primary?.pathRefs?.length);
  assert.equal(primary?.pathRefs?.[0].connector, 'CTRL1');
  assert.ok(primary?.oemNarrative?.oemOutcome?.includes('replace pump or harness'));
}

function testComponentFailedAtLoad() {
  const run = fixtureRunComponentOpenAtLoad();
  const primary = resolvePrimaryDiagnosticConclusion(
    deriveProcedureDiagnosticConclusions(run, SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE),
  );
  assert.equal(primary?.kind, 'component_failed');
  assert.equal(primary?.componentState, 'verified_failed');
}

function testBothGoodNoRepairTarget() {
  const run = fixtureRunBothGood();
  const primary = resolvePrimaryDiagnosticConclusion(
    deriveProcedureDiagnosticConclusions(run, SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE),
  );
  assert.equal(primary?.kind, 'no_repair_target');
  assert.equal(primary?.componentState, 'verified_good');
}

function testContradicted() {
  const run = fixtureRunContradicted();
  const primary = resolvePrimaryDiagnosticConclusion(
    deriveProcedureDiagnosticConclusions(run, SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE),
  );
  assert.equal(primary?.kind, 'contradicted');
}

function testPathOpenWithoutLoadInCircuitInconclusive() {
  const run = fixtureRunPathOpenWithoutLoadInCircuit();
  const primary = resolvePrimaryDiagnosticConclusion(
    deriveProcedureDiagnosticConclusions(run, SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE),
  );
  assert.equal(primary?.kind, 'inconclusive');
}

function testLegacyUnscopedReturnsNoConclusions() {
  const run = fixtureRunLegacyUnscopedConfirm();
  const conclusions = deriveProcedureDiagnosticConclusions(run, SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE);
  assert.equal(conclusions.length, 0);
}

function testCrossPlatformUsesSameDerivation() {
  const run: ProcedureRunState = {
    ...fixtureRunComponentGoodPathOpen(),
    procedureId: OTHER_PLATFORM_SCOPED_PROCEDURE.id,
    appliedDiagnosticEffects: [
      {
        stepId: 'motor_at_component',
        at: '2026-03-28T12:01:00.000Z',
        effects: [{
          type: 'eliminate',
          componentId: 'drive_motor',
          assertion: 'component_verified',
          measurementScope: 'at_load',
        }],
      },
      {
        stepId: 'motor_at_control_connector',
        at: '2026-03-28T12:02:00.000Z',
        effects: [{
          type: 'confirm',
          componentId: 'drive_motor',
          assertion: 'path_open',
          measurementScope: 'at_control_connector',
        }],
      },
    ],
    stepEvaluations: {
      motor_at_control_connector: {
        knowledgeId: 'fixtureMotorOhms',
        rawInput: 'OL',
        parsedValue: null,
        unit: 'Ω',
        evaluation: { status: 'critical' as const, message: 'Open' },
        evaluatedAt: '2026-03-28T12:02:00.000Z',
        context: {
          testPoint: OTHER_PLATFORM_SCOPED_PROCEDURE.steps[1].testPoint,
          measurementContext: OTHER_PLATFORM_SCOPED_PROCEDURE.steps[1].measurementContext,
        },
      },
    },
  };
  const primary = resolvePrimaryDiagnosticConclusion(
    deriveProcedureDiagnosticConclusions(run, OTHER_PLATFORM_SCOPED_PROCEDURE),
  );
  assert.equal(primary?.kind, 'external_path_fault');
  assert.equal(primary?.anchorComponentId, 'drive_motor');
}

testComponentGoodPathOpen();
testComponentFailedAtLoad();
testBothGoodNoRepairTarget();
testContradicted();
testPathOpenWithoutLoadInCircuitInconclusive();
testLegacyUnscopedReturnsNoConclusions();
testCrossPlatformUsesSameDerivation();

function testLoadInstanceKeyIsolatesEvidence() {
  const run: ProcedureRunState = {
    ...fixtureRunComponentGoodPathOpen(),
    appliedDiagnosticEffects: [
      {
        stepId: 'pump_at_control_connector',
        at: '2026-03-28T12:02:00.000Z',
        branchId: 'path_open',
        effects: [
          {
            type: 'confirm',
            componentId: 'drain_pump',
            assertion: 'path_open',
            measurementScope: 'through_path',
            loadInstanceKey: 'cold_coil',
            testPointKey: 'x:CTRL1:1 & 2',
            evidenceId: 'path_open_test',
          },
        ],
      },
      {
        stepId: 'pump_at_component',
        at: '2026-03-28T12:01:00.000Z',
        branchId: 'pass',
        effects: [
          {
            type: 'eliminate',
            componentId: 'drain_pump',
            assertion: 'component_verified',
            measurementScope: 'at_load',
            loadInstanceKey: 'cold_coil',
            evidenceId: 'component_verified_test',
          },
        ],
      },
    ],
    stepEvaluations: {
      ...fixtureRunComponentGoodPathOpen().stepEvaluations,
    },
  };
  const conclusions = deriveProcedureDiagnosticConclusions(run, SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE);
  const cold = conclusions.find((c) => c.loadInstanceKey === 'cold_coil');
  const defaultInstance = conclusions.find((c) => !c.loadInstanceKey);
  assert.equal(cold?.kind, 'external_path_fault');
  assert.equal(defaultInstance, undefined);
}

testLoadInstanceKeyIsolatesEvidence();

console.log('deriveProcedureDiagnosticConclusions.test.ts: ok');
