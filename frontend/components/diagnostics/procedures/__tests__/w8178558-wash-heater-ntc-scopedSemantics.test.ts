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

type WitnessConfig = {
  procedureId: string;
  componentId: string;
  componentStepId: string;
  componentPassBranchId: string;
  componentPassValue: string;
  ccuStepId: string;
  ccuOpenBranchId: string;
  terminalOutcomeId: string;
  oemOutcomeSnippet: string;
  componentVerifiedEvidenceId: string;
  pathOpenEvidenceId: string;
  testPointKey: string;
  connector: string;
  legacyComponentOpenBranchId: string;
  legacyComponentOpenEvidenceId: string;
  advanceVisualChecks?: boolean;
  /** Branch uses terminal:true — run completes on CCU measurement step (no outcome step visit). */
  completesOnCcuOpen?: boolean;
};

const HEATER_WITNESS: WitnessConfig = {
  procedureId: 'w8178558-wash-heater',
  componentId: 'wash_heater',
  componentStepId: 'heater_at_component',
  componentPassBranchId: 'heater_comp_pass',
  componentPassValue: '12',
  ccuStepId: 'heater_at_ccu',
  ccuOpenBranchId: 'heater_ccu_open',
  terminalOutcomeId: 'replace_heater_or_harness',
  oemOutcomeSnippet: 'replace heater or harness',
  componentVerifiedEvidenceId: 'component_verified_wash_heater_at_load',
  pathOpenEvidenceId: 'path_open_wash_heater_through_he2',
  testPointKey: 'heater_at_ccu:HE2:1 & 2',
  connector: 'HE2',
  legacyComponentOpenBranchId: 'heater_comp_open',
  legacyComponentOpenEvidenceId: 'confirm_wash_heater_ol_wash_heater_failed',
  advanceVisualChecks: true,
};

const NTC_WITNESS: WitnessConfig = {
  procedureId: 'w8178558-wash-ntc',
  componentId: 'wash_ntc',
  componentStepId: 'ntc_at_component',
  componentPassBranchId: 'ntc_comp_pass',
  componentPassValue: '2300',
  ccuStepId: 'ntc_at_ccu',
  ccuOpenBranchId: 'ntc_ccu_open',
  terminalOutcomeId: 'replace_ntc_or_harness',
  oemOutcomeSnippet: 'sensor or harness',
  componentVerifiedEvidenceId: 'component_verified_wash_ntc_at_load',
  pathOpenEvidenceId: 'path_open_wash_ntc_through_th2',
  testPointKey: 'ntc_at_ccu:TH2:1 & 2',
  connector: 'TH2',
  legacyComponentOpenBranchId: 'ntc_comp_open',
  legacyComponentOpenEvidenceId: 'confirm_wash_ntc_ol_wash_ntc_failed',
  completesOnCcuOpen: true,
};

function advanceToStep(
  procedure: NonNullable<ReturnType<typeof getServiceProcedure>>,
  runState: ReturnType<typeof createProcedureRun>,
  targetStepId: string,
  advanceVisualChecks = false,
) {
  let run = runState;
  while (run.currentStepId !== targetStepId && run.status === 'in_progress') {
    const step = getProcedureStep(procedure, run.currentStepId);
    assert.ok(step, `missing step ${run.currentStepId}`);
    if (advanceVisualChecks && step.type === 'visual_check' && step.requiresInput) {
      run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'yes' }).runState;
      continue;
    }
    run = submitProcedureStep(procedure, run).runState;
  }
  return run;
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

function completeWitnessPathOpen(config: WitnessConfig) {
  const procedure = getServiceProcedure(config.procedureId);
  assert.ok(procedure);

  let run = createProcedureRun(procedure);
  run = advanceToStep(
    procedure,
    run,
    config.componentStepId,
    config.advanceVisualChecks ?? false,
  );
  run = submitProcedureStep(procedure, run, {
    kind: 'measurement',
    value: config.componentPassValue,
  }).runState;

  run = advanceToStep(procedure, run, config.ccuStepId, false);
  const openResult = submitProcedureStep(procedure, run, {
    kind: 'measurement',
    value: 'OL',
  });
  run = openResult.runState;

  if (config.completesOnCcuOpen) {
    assert.equal(run.status, 'completed');
    assert.equal(run.currentStepId, config.ccuStepId);
    assert.ok(openResult.matchedBranch?.oemOutcome?.toLowerCase().includes(config.oemOutcomeSnippet));
    const outcomeStep = getProcedureStep(procedure, config.terminalOutcomeId);
    assert.ok(outcomeStep?.oemOutcome?.toLowerCase().includes(config.oemOutcomeSnippet));
  } else {
    const outcomeStep = getProcedureStep(procedure, run.currentStepId);
    assert.ok(outcomeStep);
    assert.equal(outcomeStep.id, config.terminalOutcomeId);
    assert.ok(outcomeStep.oemOutcome?.toLowerCase().includes(config.oemOutcomeSnippet));

    run = submitProcedureStep(procedure, run).runState;
    assert.equal(run.status, 'completed');
    assert.equal(run.currentStepId, config.terminalOutcomeId);
  }

  return { procedure, run };
}

function testScopedEffectsOnWitnessBranches(config: WitnessConfig) {
  const procedure = getServiceProcedure(config.procedureId);
  assert.ok(procedure);

  const passBranch = procedure.steps
    .find((s) => s.id === config.componentStepId)
    ?.branches?.find((b) => b.id === config.componentPassBranchId);
  const openBranch = procedure.steps
    .find((s) => s.id === config.ccuStepId)
    ?.branches?.find((b) => b.id === config.ccuOpenBranchId);

  assert.equal(passBranch?.diagnosticEffects?.[0]?.assertion, 'component_verified');
  assert.equal(passBranch?.diagnosticEffects?.[0]?.measurementScope, 'at_load');
  assert.equal(passBranch?.diagnosticEffects?.[0]?.evidenceId, config.componentVerifiedEvidenceId);

  assert.equal(openBranch?.diagnosticEffects?.[0]?.assertion, 'path_open');
  assert.equal(openBranch?.diagnosticEffects?.[0]?.measurementScope, 'through_path');
  assert.equal(openBranch?.diagnosticEffects?.[0]?.evidenceId, config.pathOpenEvidenceId);
  assert.equal(openBranch?.diagnosticEffects?.[0]?.testPointKey, config.testPointKey);

  const componentStep = procedure.steps.find((s) => s.id === config.componentStepId);
  assert.equal(componentStep?.measurementContext?.scope, 'at_load');
  assert.equal(componentStep?.measurementContext?.loadInCircuit, false);

  const ccuStep = procedure.steps.find((s) => s.id === config.ccuStepId);
  assert.equal(ccuStep?.measurementContext?.scope, 'through_path');
  assert.equal(ccuStep?.measurementContext?.loadInCircuit, true);
}

function testWitnessRunConclusionAndHeadline(config: WitnessConfig) {
  const { procedure, run } = completeWitnessPathOpen(config);

  const conclusions = deriveProcedureDiagnosticConclusions(run, procedure);
  const primary = resolvePrimaryDiagnosticConclusion(conclusions);

  assert.equal(primary?.kind, 'external_path_fault');
  assert.equal(primary?.anchorComponentId, config.componentId);
  assert.equal(primary?.componentState, 'verified_good');
  assert.equal(primary?.pathRefs?.[0]?.connector, config.connector);
  assert.equal(primary?.pathRefs?.[0]?.stepId, config.ccuStepId);
  assert.ok(primary?.oemNarrative?.oemOutcome?.toLowerCase().includes(config.oemOutcomeSnippet));

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.ok(headline);
  assert.match(headline, /Inspect\/repair/i);
  assert.doesNotMatch(headline, /Replace wash/i);

  assert.equal(resolveProcedureRunDisposition(run, procedure), 'action_required');
}

function testWitnessIntelligenceNotConfirmedFailed(config: WitnessConfig) {
  const { run } = completeWitnessPathOpen(config);
  const intelligence = evaluateDiagnosticIntelligence('washer', {}, undefined, {
    procedureRuns: { [config.procedureId]: run },
  });
  const component = findComponentState(intelligence, config.componentId);
  assert.ok(component);
  assert.equal(component.state, 'eliminated');
  assert.equal(getComponentVerificationLevel(component.state), 'verified_good');
  assert.notEqual(component.state, 'confirmed');
}

function testFrozenSnapshotRetainsCcuTestPoint(config: WitnessConfig) {
  const { run } = completeWitnessPathOpen(config);
  const snapshot = run.stepEvaluations?.[config.ccuStepId];
  assert.ok(snapshot);
  assert.equal(snapshot.context?.testPoint?.connector, config.connector);
  assert.equal(snapshot.context?.measurementContext?.loadInCircuit, true);
  assert.equal(snapshot.context?.measurementContext?.scope, 'through_path');
}

function testComponentOpenBranchStillUsesLegacyFailureId(config: WitnessConfig) {
  const procedure = getServiceProcedure(config.procedureId);
  assert.ok(procedure);
  const openAtComponent = procedure.steps
    .find((s) => s.id === config.componentStepId)
    ?.branches?.find((b) => b.id === config.legacyComponentOpenBranchId);
  assert.equal(openAtComponent?.diagnosticEffects?.[0]?.evidenceId, config.legacyComponentOpenEvidenceId);
  assert.equal(openAtComponent?.diagnosticEffects?.[0]?.assertion, undefined);
}

function testCcuWarnBranchStillLegacy(config: WitnessConfig) {
  const procedure = getServiceProcedure(config.procedureId);
  assert.ok(procedure);
  const warnBranchId = config.procedureId.includes('heater') ? 'heater_ccu_warn' : 'ntc_ccu_warn';
  const warn = procedure.steps
    .find((s) => s.id === config.ccuStepId)
    ?.branches?.find((b) => b.id === warnBranchId);
  assert.ok(warn);
  assert.equal(warn.diagnosticEffects?.[0]?.assertion, undefined);
  assert.equal(warn.diagnosticEffects?.[0]?.evidenceId, config.legacyComponentOpenEvidenceId);
}

for (const config of [HEATER_WITNESS, NTC_WITNESS]) {
  testScopedEffectsOnWitnessBranches(config);
  testWitnessRunConclusionAndHeadline(config);
  testWitnessIntelligenceNotConfirmedFailed(config);
  testFrozenSnapshotRetainsCcuTestPoint(config);
  testComponentOpenBranchStillUsesLegacyFailureId(config);
  testCcuWarnBranchStillLegacy(config);
}

console.log('w8178558-wash-heater-ntc-scopedSemantics.test.ts: ok');
