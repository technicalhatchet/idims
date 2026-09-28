import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getComponentVerificationLevel } from '../../intelligence/componentVerification';
import {
  deriveProcedureDiagnosticConclusions,
  resolvePrimaryDiagnosticConclusion,
} from '../deriveProcedureDiagnosticConclusions';
import { getServiceProcedure } from '../procedureRegistry';
import {
  resolveProcedureRepairHeadline,
  resolveProcedureRunDisposition,
} from '../procedureRunPresentation';
import { createProcedureRun, getProcedureStep, submitProcedureStep } from '../procedureRunner';
import type { AppliedDiagnosticEffectEntry, DiagnosticEffect } from '../types';

function flatScopedEffects(run: { appliedDiagnosticEffects?: AppliedDiagnosticEffectEntry[] }) {
  const out: Array<DiagnosticEffect & { stepId: string; branchId?: string }> = [];
  for (const entry of run.appliedDiagnosticEffects || []) {
    for (const effect of entry.effects) {
      out.push({ ...effect, stepId: entry.stepId, branchId: entry.branchId });
    }
  }
  return out;
}

const PROCEDURE_ID = 'w10864849-test-07-drain-recirc-pump';
const LOAD_INSTANCE = 'j4_pins_1_3';

function advanceToStep(
  procedure: NonNullable<ReturnType<typeof getServiceProcedure>>,
  runState: ReturnType<typeof createProcedureRun>,
  targetStepId: string,
) {
  let run = runState;
  while (run.currentStepId !== targetStepId && run.status === 'in_progress') {
    const step = getProcedureStep(procedure, run.currentStepId);
    assert.ok(step, `missing step ${run.currentStepId}`);
    if (step.type === 'visual_check' && step.requiresInput) {
      run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'yes' }).runState;
      continue;
    }
    if (step.type === 'measurement' && step.requiresInput) {
      run = submitProcedureStep(procedure, run, {
        kind: 'measurement',
        value: '21',
      }).runState;
      continue;
    }
    run = submitProcedureStep(procedure, run).runState;
  }
  return run;
}

/** ACU-first happy path through J4/recirc/harness to at-load drain terminal pass. */
function walkToDrainTerminalPass() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);

  let run = createProcedureRun(procedure);
  run = advanceToStep(procedure, run, 'service_test_pumps');
  run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'no' }).runState;
  run = advanceToStep(procedure, run, 'j4_pump_ohms');
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '21' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '28' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'yes' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '21' }).runState;

  return { procedure, run };
}

/** Evidence-set witness: at-load verify + J4 through-path open (order-independent). */
function completeDrainJ4ExternalPathWitness() {
  const { procedure, run: terminalPassRun } = walkToDrainTerminalPass();
  const flat = flatScopedEffects(terminalPassRun);
  assert.equal(
    flat.some((e) => e.assertion === 'path_open' && e.loadInstanceKey === LOAD_INSTANCE),
    false,
  );
  assert.equal(
    flat.some((e) => e.assertion === 'component_verified' && e.loadInstanceKey === LOAD_INSTANCE),
    true,
  );

  const j4OpenEntry: AppliedDiagnosticEffectEntry = {
    stepId: 'j4_pump_ohms',
    branchId: 'drain_j4_open',
    at: new Date().toISOString(),
    effects: [
      {
        type: 'confirm',
        componentId: 'drain_pump',
        assertion: 'path_open',
        measurementScope: 'through_path',
        loadInstanceKey: LOAD_INSTANCE,
        testPointKey: 'j4_pump_ohms:J4:1 & 3',
        evidenceId: 'path_open_drain_pump_j4_pins_1_3_through_j4',
      },
    ],
  };

  const run = {
    ...terminalPassRun,
    appliedDiagnosticEffects: [...(terminalPassRun.appliedDiagnosticEffects || []), j4OpenEntry],
  };

  return { procedure, run };
}

function testScopedBranchesOnSeed() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);

  const j4Step = procedure.steps.find((s) => s.id === 'j4_pump_ohms');
  assert.equal(j4Step?.measurementContext?.scope, 'through_path');
  assert.equal(j4Step?.measurementContext?.loadInCircuit, true);

  const j4Open = j4Step?.branches?.find((b) => b.id === 'drain_j4_open');
  assert.equal(j4Open?.diagnosticEffects?.[0]?.assertion, 'path_open');
  assert.equal(j4Open?.diagnosticEffects?.[0]?.loadInstanceKey, LOAD_INSTANCE);
  assert.equal(j4Open?.diagnosticEffects?.[0]?.testPointKey, 'j4_pump_ohms:J4:1 & 3');

  const terminalPass = procedure.steps
    .find((s) => s.id === 'pump_terminal_ohms')
    ?.branches?.find((b) => b.id === 'drain_pump_pass');
  assert.equal(terminalPass?.diagnosticEffects?.[0]?.assertion, 'component_verified');
  assert.equal(terminalPass?.diagnosticEffects?.[0]?.loadInstanceKey, LOAD_INSTANCE);

  const harnessOpen = procedure.steps
    .find((s) => s.id === 'harness_pump_cont')
    ?.branches?.find((b) => b.id === 'ph_open');
  assert.equal(harnessOpen?.diagnosticEffects?.[0]?.assertion, undefined);
  assert.equal(
    harnessOpen?.diagnosticEffects?.[0]?.evidenceId,
    'confirm_drain_pump_ol_drain_pump_failed',
  );

  const recircOpen = procedure.steps
    .find((s) => s.id === 'recirc_j4_optional')
    ?.branches?.find((b) => b.id === 'recirc_j4_open');
  assert.equal(recircOpen?.diagnosticEffects?.[0]?.assertion, undefined);
}

function testAcuFirstTerminalPassDoesNotImplyPathFault() {
  const { procedure, run } = walkToDrainTerminalPass();
  const scoped = deriveProcedureDiagnosticConclusions(run, procedure).find(
    (c) => c.loadInstanceKey === LOAD_INSTANCE,
  );
  assert.equal(scoped?.kind, 'no_repair_target');
  assert.equal(scoped?.componentState, 'verified_good');
  assert.equal(resolveProcedureRepairHeadline(procedure, run), null);
}

function testJ4OpenAloneIsNotExternalPathFault() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);

  let run = createProcedureRun(procedure);
  run = advanceToStep(procedure, run, 'service_test_pumps');
  run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'no' }).runState;
  run = advanceToStep(procedure, run, 'j4_pump_ohms');
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: 'OL' }).runState;

  const scoped = deriveProcedureDiagnosticConclusions(run, procedure).find(
    (c) => c.loadInstanceKey === LOAD_INSTANCE,
  );
  assert.equal(scoped?.kind, 'inconclusive');
  assert.equal(run.currentStepId, 'pump_obstruction');
}

function testEvidenceSetDerivesExternalPathFault() {
  const { procedure, run } = completeDrainJ4ExternalPathWitness();
  const conclusions = deriveProcedureDiagnosticConclusions(run, procedure);
  const scoped = conclusions.find((c) => c.loadInstanceKey === LOAD_INSTANCE);

  assert.equal(scoped?.kind, 'external_path_fault');
  assert.equal(scoped?.anchorComponentId, 'drain_pump');
  assert.equal(scoped?.componentState, 'verified_good');
  assert.equal(scoped?.pathRefs?.[0]?.connector, 'J4');
  assert.equal(scoped?.pathRefs?.[0]?.loadInstanceKey, LOAD_INSTANCE);
  assert.equal(scoped?.repairTargetHint, 'inspect_external_circuit');

  const primary = resolvePrimaryDiagnosticConclusion(conclusions);
  assert.equal(primary?.kind, 'external_path_fault');
  assert.equal(primary?.loadInstanceKey, LOAD_INSTANCE);

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.ok(headline);
  assert.match(headline, /J4-1 to J4-3/i);
  assert.doesNotMatch(headline, /^Replace drain pump$/i);
  assert.equal(resolveProcedureRunDisposition(run, procedure), 'action_required');
}

function testEvidenceSetOrderReversed() {
  const { procedure, run } = completeDrainJ4ExternalPathWitness();
  const effects = run.appliedDiagnosticEffects || [];
  const reversed = {
    ...run,
    appliedDiagnosticEffects: [...effects].reverse(),
  };
  const primary = resolvePrimaryDiagnosticConclusion(
    deriveProcedureDiagnosticConclusions(reversed, procedure),
  );
  assert.equal(primary?.kind, 'external_path_fault');
  assert.equal(primary?.loadInstanceKey, LOAD_INSTANCE);
}

function testRecircJ4OpenDoesNotScopeDrainInstance() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);

  let run = createProcedureRun(procedure);
  run = advanceToStep(procedure, run, 'service_test_pumps');
  run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'no' }).runState;
  run = advanceToStep(procedure, run, 'j4_pump_ohms');
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '21' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: 'OL' }).runState;

  const scoped = deriveProcedureDiagnosticConclusions(run, procedure).find(
    (c) => c.loadInstanceKey === LOAD_INSTANCE,
  );
  assert.equal(scoped, undefined);
}

function testIntelligenceNotGloballyFailedOnPathFaultWitness() {
  const { run } = completeDrainJ4ExternalPathWitness();
  const intelligence = evaluateDiagnosticIntelligence('washer', {}, undefined, {
    procedureRuns: { [PROCEDURE_ID]: run },
  });
  let pump: { id: string; state: string } | null = null;
  for (const components of Object.values(intelligence?.componentsByCategory || {})) {
    const match = components.find((item) => item.id === 'drain_pump');
    if (match) pump = match;
  }
  assert.ok(pump);
  assert.notEqual(pump.state, 'confirmed');
  assert.equal(pump.state, 'eliminated');
  assert.equal(getComponentVerificationLevel(pump.state), 'verified_good');
}

testScopedBranchesOnSeed();
testAcuFirstTerminalPassDoesNotImplyPathFault();
testJ4OpenAloneIsNotExternalPathFault();
testEvidenceSetDerivesExternalPathFault();
testEvidenceSetOrderReversed();
testRecircJ4OpenDoesNotScopeDrainInstance();
testIntelligenceNotGloballyFailedOnPathFaultWitness();

console.log('w10864849-test-07-drain-recirc-pump-scopedSemantics.test.ts: ok');
