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

const PROCEDURE_ID = 'w8178558-drain-pump';

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

function completeWitnessPathOpenAtDp2() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);

  let run = createProcedureRun(procedure);
  run = advanceToStep(procedure, run, 'pump_at_component');
  run = submitProcedureStep(procedure, run, {
    kind: 'measurement',
    value: '12.3',
  }).runState;

  run = advanceToStep(procedure, run, 'pump_at_ccu');
  run = submitProcedureStep(procedure, run, {
    kind: 'measurement',
    value: 'OL',
  }).runState;

  const outcomeStep = getProcedureStep(procedure, run.currentStepId);
  assert.ok(outcomeStep);
  assert.equal(outcomeStep.id, 'replace_pump_or_harness');

  run = submitProcedureStep(procedure, run).runState;
  assert.equal(run.status, 'completed');
  assert.equal(run.currentStepId, 'replace_pump_or_harness');

  return { procedure, run };
}

function findComponentState(
  intelligence: ReturnType<typeof evaluateDiagnosticIntelligence> | null,
  componentId: string,
) {
  if (!intelligence) return null;
  for (const components of Object.values(intelligence.componentsByCategory || {})) {
    const match = components.find((item) => item.id === componentId);
    if (match) return match;
  }
  return null;
}

function testScopedEffectsOnWitnessBranches() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);

  const passBranch = procedure.steps
    .find((s) => s.id === 'pump_at_component')
    ?.branches?.find((b) => b.id === 'pump_comp_pass');
  const openBranch = procedure.steps
    .find((s) => s.id === 'pump_at_ccu')
    ?.branches?.find((b) => b.id === 'pump_ccu_open');

  assert.equal(passBranch?.diagnosticEffects?.[0]?.assertion, 'component_verified');
  assert.equal(passBranch?.diagnosticEffects?.[0]?.evidenceId, 'component_verified_drain_pump_at_load');
  assert.equal(openBranch?.diagnosticEffects?.[0]?.assertion, 'path_open');
  assert.equal(openBranch?.diagnosticEffects?.[0]?.evidenceId, 'path_open_drain_pump_through_dp2');
  assert.equal(openBranch?.diagnosticEffects?.[0]?.testPointKey, 'pump_at_ccu:DP2:1 & 2');

  const ccuStep = procedure.steps.find((s) => s.id === 'pump_at_ccu');
  assert.equal(ccuStep?.measurementContext?.loadInCircuit, true);
  assert.equal(ccuStep?.measurementContext?.scope, 'through_path');
}

function testWitnessRunConclusionAndHeadline() {
  const { procedure, run } = completeWitnessPathOpenAtDp2();

  const conclusions = deriveProcedureDiagnosticConclusions(run, procedure);
  const primary = resolvePrimaryDiagnosticConclusion(conclusions);

  assert.equal(primary?.kind, 'external_path_fault');
  assert.equal(primary?.anchorComponentId, 'drain_pump');
  assert.equal(primary?.componentState, 'verified_good');
  assert.equal(primary?.pathRefs?.[0]?.connector, 'DP2');
  assert.equal(primary?.pathRefs?.[0]?.stepId, 'pump_at_ccu');
  assert.ok(primary?.oemNarrative?.oemOutcome?.includes('replace pump or harness'));

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.ok(headline);
  assert.match(headline, /Inspect\/repair/i);
  assert.doesNotMatch(headline, /Replace drain pump/i);

  assert.equal(resolveProcedureRunDisposition(run, procedure), 'action_required');
}

function testWitnessIntelligenceNotConfirmedFailed() {
  const { run } = completeWitnessPathOpenAtDp2();
  const intelligence = evaluateDiagnosticIntelligence('washer', {}, undefined, {
    procedureRuns: { [PROCEDURE_ID]: run },
  });
  const pump = findComponentState(intelligence, 'drain_pump');
  assert.ok(pump);
  assert.equal(pump.state, 'eliminated');
  assert.equal(getComponentVerificationLevel(pump.state), 'verified_good');
  assert.notEqual(pump.state, 'confirmed');
}

function testFrozenSnapshotRetainsDp2TestPoint() {
  const { run } = completeWitnessPathOpenAtDp2();
  const snapshot = run.stepEvaluations?.pump_at_ccu;
  assert.ok(snapshot);
  assert.equal(snapshot.context?.testPoint?.connector, 'DP2');
  assert.equal(snapshot.context?.measurementContext?.loadInCircuit, true);
}

function testComponentOpenBranchStillUsesLegacyFailureId() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);
  const openAtPump = procedure.steps
    .find((s) => s.id === 'pump_at_component')
    ?.branches?.find((b) => b.id === 'pump_comp_open');
  assert.equal(openAtPump?.diagnosticEffects?.[0]?.evidenceId, 'confirm_drain_pump_ol_drain_pump_failed');
  assert.equal(openAtPump?.diagnosticEffects?.[0]?.assertion, undefined);
}

testScopedEffectsOnWitnessBranches();
testWitnessRunConclusionAndHeadline();
testWitnessIntelligenceNotConfirmedFailed();
testFrozenSnapshotRetainsDp2TestPoint();
testComponentOpenBranchStillUsesLegacyFailureId();

console.log('w8178558-drain-pump-scopedSemantics.test.ts: ok');
