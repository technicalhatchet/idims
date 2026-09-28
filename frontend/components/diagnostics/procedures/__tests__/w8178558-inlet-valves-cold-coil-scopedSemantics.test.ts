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

const PROCEDURE_ID = 'w8178558-inlet-valves';

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
    run = submitProcedureStep(procedure, run).runState;
  }
  return run;
}

function completeColdCoilPathOpenWitness() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);

  let run = createProcedureRun(procedure);
  run = advanceToStep(procedure, run, 'valve_at_component');
  run = submitProcedureStep(procedure, run, {
    kind: 'measurement',
    value: '800',
  }).runState;

  run = advanceToStep(procedure, run, 'valve_cold_ccu');
  run = submitProcedureStep(procedure, run, {
    kind: 'measurement',
    value: 'OL',
  }).runState;

  assert.equal(run.currentStepId, 'replace_valve');
  run = submitProcedureStep(procedure, run).runState;
  assert.equal(run.status, 'completed');

  return { procedure, run };
}

function testColdCoilScopedBranches() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);

  const pass = procedure.steps
    .find((s) => s.id === 'valve_at_component')
    ?.branches?.find((b) => b.id === 'valve_comp_pass');
  const open = procedure.steps
    .find((s) => s.id === 'valve_cold_ccu')
    ?.branches?.find((b) => b.id === 'valve_cold_open');
  const hotOpen = procedure.steps
    .find((s) => s.id === 'valve_hot_ccu')
    ?.branches?.find((b) => b.id === 'valve_hot_open');

  assert.equal(pass?.diagnosticEffects?.[0]?.loadInstanceKey, 'cold_coil');
  assert.equal(pass?.diagnosticEffects?.[0]?.assertion, 'component_verified');
  assert.equal(open?.diagnosticEffects?.[0]?.assertion, 'path_open');
  assert.equal(open?.diagnosticEffects?.[0]?.loadInstanceKey, 'cold_coil');
  assert.equal(open?.diagnosticEffects?.[0]?.testPointKey, 'valve_cold_ccu:VCH7:1 & 3 (cold)');

  assert.equal(hotOpen?.diagnosticEffects?.[0]?.assertion, undefined);
  assert.equal(hotOpen?.diagnosticEffects?.[0]?.evidenceId, 'confirm_inlet_valve_ol_inlet_valve_failed');

  const ccuStep = procedure.steps.find((s) => s.id === 'valve_cold_ccu');
  assert.equal(ccuStep?.measurementContext?.loadInCircuit, true);
  assert.equal(ccuStep?.measurementContext?.scope, 'through_path');
}

function testColdCoilConclusionAndHeadline() {
  const { procedure, run } = completeColdCoilPathOpenWitness();
  const conclusions = deriveProcedureDiagnosticConclusions(run, procedure);
  const cold = conclusions.find((c) => c.loadInstanceKey === 'cold_coil');
  const primary = resolvePrimaryDiagnosticConclusion(conclusions);

  assert.equal(cold?.kind, 'external_path_fault');
  assert.equal(cold?.anchorComponentId, 'inlet_valve');
  assert.equal(cold?.componentState, 'verified_good');
  assert.equal(cold?.pathRefs?.[0]?.connector, 'VCH7');
  assert.equal(cold?.pathRefs?.[0]?.loadInstanceKey, 'cold_coil');
  assert.equal(cold?.repairTargetHint, 'inspect_external_circuit');

  assert.equal(primary?.loadInstanceKey, 'cold_coil');
  assert.equal(primary?.kind, 'external_path_fault');

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.ok(headline);
  assert.match(headline, /cold inlet valve coil circuit/i);
  assert.match(headline, /VCH7/i);
  assert.doesNotMatch(headline, /^Replace inlet valve$/i);

  assert.equal(resolveProcedureRunDisposition(run, procedure), 'action_required');
}

function testColdCoilIntelligenceNotGloballyFailed() {
  const { run } = completeColdCoilPathOpenWitness();
  const intelligence = evaluateDiagnosticIntelligence('washer', {}, undefined, {
    procedureRuns: { [PROCEDURE_ID]: run },
  });
  let inlet: { id: string; state: string } | null = null;
  for (const components of Object.values(intelligence?.componentsByCategory || {})) {
    const match = components.find((item) => item.id === 'inlet_valve');
    if (match) inlet = match;
  }
  assert.ok(inlet);
  assert.notEqual(inlet.state, 'confirmed');
  assert.equal(inlet.state, 'eliminated');
  assert.equal(getComponentVerificationLevel(inlet.state), 'verified_good');
}

function testEvidenceSetOrderReversedStillDerives() {
  const { procedure, run } = completeColdCoilPathOpenWitness();
  const effects = run.appliedDiagnosticEffects || [];
  const reversed = {
    ...run,
    appliedDiagnosticEffects: [...effects].reverse(),
  };
  const primary = resolvePrimaryDiagnosticConclusion(
    deriveProcedureDiagnosticConclusions(reversed, procedure),
  );
  assert.equal(primary?.kind, 'external_path_fault');
  assert.equal(primary?.loadInstanceKey, 'cold_coil');
}

testColdCoilScopedBranches();
testColdCoilConclusionAndHeadline();
testColdCoilIntelligenceNotGloballyFailed();
testEvidenceSetOrderReversedStillDerives();

console.log('w8178558-inlet-valves-cold-coil-scopedSemantics.test.ts: ok');
