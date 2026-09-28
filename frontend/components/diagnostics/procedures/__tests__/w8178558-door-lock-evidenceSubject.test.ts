import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getComponentVerificationLevel } from '../../intelligence/componentVerification';
import { deriveEvidenceSubjectConclusions } from '../deriveEvidenceSubjectConclusions';
import { deriveProcedureDiagnosticConclusions } from '../deriveProcedureDiagnosticConclusions';
import { getServiceProcedure } from '../procedureRegistry';
import { resolveProcedureRepairHeadline } from '../procedureRunPresentation';
import { createProcedureRun, submitProcedureStep } from '../procedureRunner';

const PROCEDURE_ID = 'w8178558-door-lock';

function startAtLockSolenoidStep() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);
  const run = {
    ...createProcedureRun(procedure),
    currentStepId: 'lock_solenoid_ohms',
    completedStepIds: ['safety_power_off', 'disconnect_dl3'],
  };
  return { procedure, run };
}

function completeUnlockSolenoidFailHarnessGood() {
  const { procedure, run: start } = startAtLockSolenoidStep();
  let run = start;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '60' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: 'OL' }).runState;
  run = submitProcedureStep(procedure, run).runState;
  run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'yes' }).runState;
  if (run.status === 'in_progress') {
    run = submitProcedureStep(procedure, run).runState;
  }
  return { procedure, run };
}

function completeHarnessOpenWitness() {
  const { procedure, run: start } = startAtLockSolenoidStep();
  let run = start;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: 'OL' }).runState;
  run = submitProcedureStep(procedure, run).runState;
  run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'no' }).runState;
  if (run.status === 'in_progress') {
    run = submitProcedureStep(procedure, run).runState;
  }
  return { procedure, run };
}

function completeDs2SwitchFaultWitness() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);
  let run = {
    ...createProcedureRun(procedure),
    currentStepId: 'door_switch_checkpoint',
    completedStepIds: [
      'safety_power_off',
      'disconnect_dl3',
      'lock_solenoid_ohms',
      'unlock_solenoid_ohms',
      'disconnect_ds2',
    ],
  };
  run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'no' }).runState;
  return { procedure, run };
}

function testSeedSubjectsAndPhysicalSetup() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);

  const lockStep = procedure.steps.find((s) => s.id === 'lock_solenoid_ohms');
  assert.equal(lockStep?.measurementContext?.scope, 'at_control_connector');
  assert.equal(lockStep?.measurementContext?.loadInCircuit, true);
  assert.equal(lockStep?.branches?.find((b) => b.id === 'lock_sol_pass')?.diagnosticEffects?.[0]?.evidenceSubjectKey, 'dl3_lock_solenoid');

  const unlockFail = procedure.steps
    .find((s) => s.id === 'unlock_solenoid_ohms')
    ?.branches?.find((b) => b.id === 'unlock_sol_open');
  assert.equal(unlockFail?.diagnosticEffects?.[0]?.evidenceSubjectKey, 'dl3_unlock_solenoid');

  const ds2 = procedure.steps.find((s) => s.id === 'door_switch_checkpoint');
  assert.equal(ds2?.measurementContext?.physicalTestSetup, 'positional_switch');

  const harness = procedure.steps.find((s) => s.id === 'harness_continuity_check');
  assert.equal(harness?.measurementContext?.physicalTestSetup, 'isolated_harness_pin_pin');
  assert.equal(harness?.measurementContext?.loadInCircuit, false);
  assert.equal(
    harness?.branches?.find((b) => b.id === 'harness_bad')?.diagnosticEffects?.[0]?.assertion,
    undefined,
  );
}

function testUnlockFailDoesNotHardConfirmWholeDoorLock() {
  const { procedure, run } = completeUnlockSolenoidFailHarnessGood();
  const conclusions = deriveEvidenceSubjectConclusions(run, procedure);
  const lock = conclusions.find((c) => c.evidenceSubjectKey === 'dl3_lock_solenoid');
  const unlock = conclusions.find((c) => c.evidenceSubjectKey === 'dl3_unlock_solenoid');

  assert.equal(lock?.kind, 'component_verified');
  assert.equal(unlock?.kind, 'component_failed');
  assert.equal(deriveProcedureDiagnosticConclusions(run, procedure).length, 0);

  const intelligence = evaluateDiagnosticIntelligence('washer', {}, undefined, {
    procedureRuns: { [PROCEDURE_ID]: run },
  });
  let doorLock: { id: string; state: string } | null = null;
  for (const components of Object.values(intelligence?.componentsByCategory || {})) {
    const match = components.find((item) => item.id === 'door_lock');
    if (match) doorLock = match;
  }
  assert.ok(doorLock);
  assert.notEqual(doorLock.state, 'confirmed');
  assert.equal(getComponentVerificationLevel(doorLock.state), 'unknown');

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.match(headline || '', /door lock/i);
}

function testHarnessFaultHeadline() {
  const { procedure, run } = completeHarnessOpenWitness();
  const harness = deriveEvidenceSubjectConclusions(run, procedure).find(
    (c) => c.evidenceSubjectKey === 'dl3_ds2_harness',
  );
  assert.equal(harness?.kind, 'component_failed');
  assert.equal(harness?.repairTargetHint, 'replace_harness_door_lock');

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.match(headline || '', /harness/i);
  assert.doesNotMatch(headline || '', /^Replace door lock$/i);
}

function testDs2FaultHeadline() {
  const { procedure, run } = completeDs2SwitchFaultWitness();
  const ds2 = deriveEvidenceSubjectConclusions(run, procedure).find(
    (c) => c.evidenceSubjectKey === 'ds2_door_switch',
  );
  assert.equal(ds2?.kind, 'component_failed');
  assert.equal(ds2?.repairTargetHint, 'replace_door_switch');

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.match(headline || '', /door switch/i);
}

testSeedSubjectsAndPhysicalSetup();
testUnlockFailDoesNotHardConfirmWholeDoorLock();
testHarnessFaultHeadline();
testDs2FaultHeadline();

console.log('w8178558-door-lock-evidenceSubject.test.ts: ok');
