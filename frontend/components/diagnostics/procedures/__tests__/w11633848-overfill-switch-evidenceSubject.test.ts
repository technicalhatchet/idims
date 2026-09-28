import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getComponentVerificationLevel } from '../../intelligence/componentVerification';
import { deriveEvidenceSubjectConclusions } from '../deriveEvidenceSubjectConclusions';
import { deriveProcedureDiagnosticConclusions } from '../deriveProcedureDiagnosticConclusions';
import { getServiceProcedure } from '../procedureRegistry';
import {
  resolveProcedureRepairHeadline,
  resolveProcedureRunDisposition,
} from '../procedureRunPresentation';
import { createProcedureRun, getProcedureStep, submitProcedureStep } from '../procedureRunner';

const PROCEDURE_ID = 'w11633848-overfill-switch';

/** Bench P6 checks (service-mode entry is injected after safety; start at valve step). */
function startBenchOverfillRun() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);
  const run = {
    ...createProcedureRun(procedure),
    currentStepId: 'overfill_valve_ohms',
    completedStepIds: ['safety_power_off', 'overfill_prereq', 'disconnect_p6_overfill'],
  };
  return { procedure, run };
}

function completeFloatUpStuckClosedWitness() {
  const { procedure, run: benchRun } = startBenchOverfillRun();
  let run = benchRun;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '1200' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '2' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '2' }).runState;

  assert.equal(run.currentStepId, 'replace_float_switch');
  if (run.status === 'in_progress') {
    run = submitProcedureStep(procedure, run).runState;
  }
  assert.equal(run.status, 'completed');

  return { procedure, run };
}

function completeFillValveOpenWitness() {
  const { procedure, run: benchRun } = startBenchOverfillRun();
  let run = benchRun;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: 'OL' }).runState;

  assert.equal(run.currentStepId, 'replace_fill_valve_overfill');
  if (run.status === 'in_progress') {
    run = submitProcedureStep(procedure, run).runState;
  }

  return { procedure, run };
}

function testSeedSubjectKeysAndPhysicalSetup() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);

  const valvePass = procedure.steps
    .find((s) => s.id === 'overfill_valve_ohms')
    ?.branches?.find((b) => b.id === 'float_down_ohms_pass');
  assert.equal(valvePass?.diagnosticEffects?.[0]?.evidenceSubjectKey, 'fill_valve_coil');

  const floatDownPass = procedure.steps
    .find((s) => s.id === 'float_down_ohms')
    ?.branches?.find((b) => b.id === 'float_up_ohms_pass');
  assert.equal(floatDownPass?.diagnosticEffects?.[0]?.evidenceSubjectKey, 'overfill_float');

  const floatUpPass = procedure.steps
    .find((s) => s.id === 'float_up_ohms')
    ?.branches?.find((b) => b.id === 'float_up_pass');
  assert.equal(floatUpPass?.when?.kind, 'measurement_open');
  assert.equal(floatUpPass?.diagnosticEffects?.[0]?.type, 'eliminate');
  assert.equal(floatUpPass?.diagnosticEffects?.[0]?.evidenceSubjectKey, 'overfill_float');

  const floatUpFail = procedure.steps
    .find((s) => s.id === 'float_up_ohms')
    ?.branches?.find((b) => b.id === 'float_up_fail');
  assert.equal(floatUpFail?.diagnosticEffects?.[0]?.evidenceSubjectKey, 'overfill_float');
  assert.equal(floatUpFail?.diagnosticEffects?.[0]?.assertion, undefined);

  const floatStep = procedure.steps.find((s) => s.id === 'float_down_ohms');
  assert.equal(floatStep?.measurementContext?.physicalTestSetup, 'positional_switch');
}

function testFloatFailureDoesNotConfirmInletValve() {
  const { procedure, run } = completeFloatUpStuckClosedWitness();
  const conclusions = deriveEvidenceSubjectConclusions(run, procedure);
  const float = conclusions.find((c) => c.evidenceSubjectKey === 'overfill_float');
  const valve = conclusions.find((c) => c.evidenceSubjectKey === 'fill_valve_coil');

  assert.equal(float?.kind, 'component_failed');
  assert.equal(float?.repairTargetHint, 'replace_float_switch');
  assert.equal(valve?.kind, 'component_verified');

  const scoped = deriveProcedureDiagnosticConclusions(run, procedure);
  assert.equal(scoped.length, 0);

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.ok(headline);
  assert.match(headline, /float switch/i);
  assert.doesNotMatch(headline, /^Replace inlet valve$/i);
  assert.equal(resolveProcedureRunDisposition(run, procedure), 'action_required');

  const intelligence = evaluateDiagnosticIntelligence('dishwasher', {}, undefined, {
    procedureRuns: { [PROCEDURE_ID]: run },
  });
  let inlet: { id: string; state: string } | null = null;
  for (const components of Object.values(intelligence?.componentsByCategory || {})) {
    const match = components.find((item) => item.id === 'inlet_valve');
    if (match) inlet = match;
  }
  assert.ok(inlet);
  assert.notEqual(inlet.state, 'confirmed');
  assert.equal(getComponentVerificationLevel(inlet.state), 'verified_good');
}

function testValveFailureStillTargetsFillValve() {
  const { procedure, run } = completeFillValveOpenWitness();
  const conclusions = deriveEvidenceSubjectConclusions(run, procedure);
  const valve = conclusions.find((c) => c.evidenceSubjectKey === 'fill_valve_coil');
  assert.equal(valve?.kind, 'component_failed');
  assert.equal(valve?.repairTargetHint, 'replace_fill_valve');

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.match(headline || '', /fill valve/i);
}

testSeedSubjectKeysAndPhysicalSetup();
testFloatFailureDoesNotConfirmInletValve();
testValveFailureStillTargetsFillValve();

console.log('w11633848-overfill-switch-evidenceSubject.test.ts: ok');
