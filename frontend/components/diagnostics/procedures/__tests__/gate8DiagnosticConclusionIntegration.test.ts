import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getComponentVerificationLevel } from '../../intelligence/componentVerification';
import { resolveDiagnosticForegroundState } from '../../intelligence/diagnosticForegroundState';
import {
  deriveProcedureDiagnosticConclusions,
  resolvePrimaryDiagnosticConclusion,
} from '../deriveProcedureDiagnosticConclusions';
import { deriveEvidenceSubjectConclusions } from '../deriveEvidenceSubjectConclusions';
import { resolveIntegratedPrimaryDiagnosticConclusion } from '../integratedProcedureDiagnosticConclusions';
import { getServiceProcedure } from '../procedureRegistry';
import {
  resolveProcedureRepairHeadline,
  resolveProcedureRunDisposition,
  resolveProcedureRunPresentation,
} from '../procedureRunPresentation';
import {
  buildDiagnosisPrefillFromProcedureComplete,
  procedureRunRequiresRepairAction,
  resolveWizardStepAfterProcedureComplete,
} from '../procedureWizardRouting';
import { createProcedureRun, getProcedureStep, submitProcedureStep } from '../procedureRunner';
import {
  fixtureRunLegacyUnscopedConfirm,
  SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE,
} from './fixtures/scopedEvidenceProcedureFixture';

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

function assertNoExternalPathFault(
  procedure: NonNullable<ReturnType<typeof getServiceProcedure>>,
  run: ReturnType<typeof createProcedureRun>,
) {
  const scoped = deriveProcedureDiagnosticConclusions(run, procedure);
  assert.ok(!scoped.some((c) => c.kind === 'external_path_fault'));
  const subject = deriveEvidenceSubjectConclusions(run, procedure);
  assert.ok(!subject.some((c) => c.kind === 'external_path_fault'));
}

function assertJourneyRepairBoundary(
  procedureId: string,
  procedure: NonNullable<ReturnType<typeof getServiceProcedure>>,
  run: ReturnType<typeof createProcedureRun>,
  templateId = 'washer',
) {
  assert.equal(resolveProcedureRunDisposition(run, procedure), 'action_required');
  assert.equal(procedureRunRequiresRepairAction(procedureId, run), true);
  assert.equal(resolveWizardStepAfterProcedureComplete(procedureId, run), null);

  const oemBefore = run.oemOutcome;
  const prefill = buildDiagnosisPrefillFromProcedureComplete(procedureId, run);
  assert.ok(prefill?.recommendedRepair);
  assert.equal(run.oemOutcome, oemBefore);

  const foreground = resolveDiagnosticForegroundState(
    evaluateDiagnosticIntelligence(templateId, {}, undefined, {
      procedureRuns: { [procedureId]: run },
    }),
    {
      procedureRuns: { [procedureId]: run },
      oemConfirmedRepairProcedureId: procedureId,
    },
  );
  assert.equal(foreground?.mode, 'confirmed_fault');
  assert.equal(foreground?.headline, resolveProcedureRepairHeadline(procedure, run));
}

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

// —— Golden case 1: external path fault witnesses ——

function completeDrainPumpPathOpen() {
  const procedureId = 'w8178558-drain-pump';
  const procedure = getServiceProcedure(procedureId);
  assert.ok(procedure);
  let run = createProcedureRun(procedure);
  run = advanceToStep(procedure, run, 'pump_at_component', true);
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '12.3' }).runState;
  run = advanceToStep(procedure, run, 'pump_at_ccu', true);
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: 'OL' }).runState;
  run = submitProcedureStep(procedure, run).runState;
  return { procedureId, procedure, run };
}

function completeHeaterOrNtcPathOpen(
  procedureId: 'w8178558-wash-heater' | 'w8178558-wash-ntc',
  componentStepId: string,
  passBranchValue: string,
  ccuStepId: string,
  terminalOutcomeId: string,
  completesOnCcuOpen: boolean,
) {
  const procedure = getServiceProcedure(procedureId);
  assert.ok(procedure);
  let run = createProcedureRun(procedure);
  const advanceVisual = procedureId === 'w8178558-wash-heater';
  run = advanceToStep(procedure, run, componentStepId, advanceVisual);
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: passBranchValue }).runState;
  run = advanceToStep(procedure, run, ccuStepId, false);
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: 'OL' }).runState;
  if (!completesOnCcuOpen) {
    run = submitProcedureStep(procedure, run).runState;
    assert.equal(run.currentStepId, terminalOutcomeId);
  }
  return { procedureId, procedure, run };
}

function testGoldenCase1ExternalPathFault() {
  const witnesses = [
    { ...completeDrainPumpPathOpen(), componentId: 'drain_pump', connector: 'DP2' },
    {
      ...completeHeaterOrNtcPathOpen(
        'w8178558-wash-heater',
        'heater_at_component',
        '12',
        'heater_at_ccu',
        'replace_heater_or_harness',
        false,
      ),
      componentId: 'wash_heater',
      connector: 'HE2',
    },
    {
      ...completeHeaterOrNtcPathOpen(
        'w8178558-wash-ntc',
        'ntc_at_component',
        '2300',
        'ntc_at_ccu',
        'replace_ntc_or_harness',
        true,
      ),
      componentId: 'wash_ntc',
      connector: 'TH2',
    },
  ];

  for (const witness of witnesses) {
    const { procedureId, procedure, run, componentId, connector } = witness;
    const effects = run.appliedDiagnosticEffects?.flatMap((e) => e.effects) || [];
    assert.ok(effects.some((e) => e.assertion === 'component_verified'));
    assert.ok(effects.some((e) => e.assertion === 'path_open'));

    const primary = resolveIntegratedPrimaryDiagnosticConclusion(run, procedure);
    assert.equal(primary?.kind, 'external_path_fault');
    assert.equal(primary?.anchorComponentId, componentId);
    assert.equal(primary?.componentState, 'verified_good');
    assert.equal(primary?.pathRefs?.[0]?.connector, connector);

    const headline = resolveProcedureRepairHeadline(procedure, run);
    assert.match(headline || '', /Inspect\/repair/i);
    assert.doesNotMatch(headline || '', /Replace wash/i);
    assert.doesNotMatch(headline || '', /Replace drain pump/i);

    const intelligence = evaluateDiagnosticIntelligence('washer', {}, undefined, {
      procedureRuns: { [procedureId]: run },
    });
    const component = findComponentState(intelligence, componentId);
    assert.ok(component);
    assert.equal(getComponentVerificationLevel(component.state), 'verified_good');
    assert.notEqual(component.state, 'confirmed');

    assertJourneyRepairBoundary(procedureId, procedure, run);
  }
}

// —— Golden case 2: cold coil load instance ——

function testGoldenCase2ColdCoilInstance() {
  const procedureId = 'w8178558-inlet-valves';
  const procedure = getServiceProcedure(procedureId);
  assert.ok(procedure);
  let run = createProcedureRun(procedure);
  run = advanceToStep(procedure, run, 'valve_at_component', true);
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '800' }).runState;
  run = advanceToStep(procedure, run, 'valve_cold_ccu', true);
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: 'OL' }).runState;
  run = submitProcedureStep(procedure, run).runState;

  const conclusions = deriveProcedureDiagnosticConclusions(run, procedure);
  const cold = conclusions.find((c) => c.loadInstanceKey === 'cold_coil');
  assert.equal(cold?.kind, 'external_path_fault');
  assert.equal(resolvePrimaryDiagnosticConclusion(conclusions)?.loadInstanceKey, 'cold_coil');
  assert.equal(conclusions.filter((c) => c.loadInstanceKey === 'hot_coil').length, 0);

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.match(headline || '', /cold inlet valve coil circuit/i);
  assert.doesNotMatch(headline || '', /^Replace inlet valve$/i);

  const intelligence = evaluateDiagnosticIntelligence('washer', {}, undefined, {
    procedureRuns: { [procedureId]: run },
  });
  const inlet = findComponentState(intelligence, 'inlet_valve');
  assert.ok(inlet);
  assert.equal(getComponentVerificationLevel(inlet.state), 'verified_good');

  assertJourneyRepairBoundary(procedureId, procedure, run);
}

// —— Golden case 3: overfill float subject ——

function testGoldenCase3OverfillFloat() {
  const procedureId = 'w11633848-overfill-switch';
  const procedure = getServiceProcedure(procedureId);
  assert.ok(procedure);
  let run = {
    ...createProcedureRun(procedure),
    currentStepId: 'overfill_valve_ohms',
    completedStepIds: ['safety_power_off', 'overfill_prereq', 'disconnect_p6_overfill'],
  };
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '1200' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '2' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '2' }).runState;
  if (run.status === 'in_progress') {
    run = submitProcedureStep(procedure, run).runState;
  }

  const conclusions = deriveEvidenceSubjectConclusions(run, procedure);
  const float = conclusions.find((c) => c.evidenceSubjectKey === 'overfill_float');
  const valve = conclusions.find((c) => c.evidenceSubjectKey === 'fill_valve_coil');
  assert.equal(float?.kind, 'component_failed');
  assert.equal(valve?.kind, 'component_verified');
  assertNoExternalPathFault(procedure, run);

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.match(headline || '', /float switch/i);
  assert.doesNotMatch(headline || '', /^Replace inlet valve$/i);

  const intelligence = evaluateDiagnosticIntelligence('dishwasher', {}, undefined, {
    procedureRuns: { [procedureId]: run },
  });
  const inlet = findComponentState(intelligence, 'inlet_valve');
  assert.ok(inlet);
  assert.equal(getComponentVerificationLevel(inlet.state), 'verified_good');

  assertJourneyRepairBoundary(procedureId, procedure, run, 'dishwasher');
}

// —— Golden case 4: door lock subjects ——

function testGoldenCase4DoorLockSubjects() {
  const procedureId = 'w8178558-door-lock';
  const procedure = getServiceProcedure(procedureId);
  assert.ok(procedure);

  const startAtLock = () => ({
    ...createProcedureRun(procedure),
    currentStepId: 'lock_solenoid_ohms',
    completedStepIds: ['safety_power_off', 'disconnect_dl3'],
  });

  let unlockRun = startAtLock();
  unlockRun = submitProcedureStep(procedure, unlockRun, { kind: 'measurement', value: '60' }).runState;
  unlockRun = submitProcedureStep(procedure, unlockRun, { kind: 'measurement', value: 'OL' }).runState;
  unlockRun = submitProcedureStep(procedure, unlockRun).runState;
  unlockRun = submitProcedureStep(procedure, unlockRun, { kind: 'checkpoint', value: 'yes' }).runState;
  const unlockConclusions = deriveEvidenceSubjectConclusions(unlockRun, procedure);
  assert.equal(
    unlockConclusions.find((c) => c.evidenceSubjectKey === 'dl3_unlock_solenoid')?.kind,
    'component_failed',
  );
  assert.equal(
    unlockConclusions.find((c) => c.evidenceSubjectKey === 'dl3_lock_solenoid')?.kind,
    'component_verified',
  );
  assertNoExternalPathFault(procedure, unlockRun);
  assert.match(resolveProcedureRepairHeadline(procedure, unlockRun) || '', /door lock/i);

  let harnessRun = startAtLock();
  harnessRun = submitProcedureStep(procedure, harnessRun, { kind: 'measurement', value: 'OL' }).runState;
  harnessRun = submitProcedureStep(procedure, harnessRun).runState;
  harnessRun = submitProcedureStep(procedure, harnessRun, { kind: 'checkpoint', value: 'no' }).runState;
  const harness = deriveEvidenceSubjectConclusions(harnessRun, procedure).find(
    (c) => c.evidenceSubjectKey === 'dl3_ds2_harness',
  );
  assert.equal(harness?.kind, 'component_failed');
  assert.equal(harness?.repairTargetHint, 'replace_harness_door_lock');
  assertNoExternalPathFault(procedure, harnessRun);
  assert.match(resolveProcedureRepairHeadline(procedure, harnessRun) || '', /harness/i);

  let ds2Run = {
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
  ds2Run = submitProcedureStep(procedure, ds2Run, { kind: 'checkpoint', value: 'no' }).runState;
  const ds2 = deriveEvidenceSubjectConclusions(ds2Run, procedure).find(
    (c) => c.evidenceSubjectKey === 'ds2_door_switch',
  );
  assert.equal(ds2?.kind, 'component_failed');
  assert.match(resolveProcedureRepairHeadline(procedure, ds2Run) || '', /door switch/i);

  let ccuRun = {
    ...createProcedureRun(procedure),
    currentStepId: 'live_test_door_lock',
    completedStepIds: [
      'safety_power_off',
      'disconnect_dl3',
      'lock_solenoid_ohms',
      'unlock_solenoid_ohms',
      'disconnect_ds2',
      'door_switch_checkpoint',
      'reconnect_door_lock_harness',
      'service_mode_before_lock_test',
      'manual_touchpad_entry',
    ],
  };
  ccuRun = submitProcedureStep(procedure, ccuRun, { kind: 'checkpoint', value: 'no' }).runState;
  if (ccuRun.status === 'in_progress' && ccuRun.currentStepId === 'suspect_ccu_door_lock') {
    ccuRun = submitProcedureStep(procedure, ccuRun).runState;
  }
  assertNoExternalPathFault(procedure, ccuRun);
  const ccuIntel = evaluateDiagnosticIntelligence('washer', {}, undefined, {
    procedureRuns: { [procedureId]: ccuRun },
  });
  const board = findComponentState(ccuIntel, 'control_board');
  assert.ok(board);
  assert.equal(board.state, 'confirmed');
  const presentation = resolveProcedureRunPresentation(procedureId, ccuRun);
  assert.equal(presentation.disposition, 'action_required');
  assert.match(presentation.headline, /control|CCU/i);
}

// —— Golden case 5: ACU voltage segmentation ——

function testGoldenCase5AcuVoltageSegmentation() {
  const procedureId = 'w11169652-test-01-acu-power';
  const procedure = getServiceProcedure(procedureId);
  assert.ok(procedure);

  const startAtLine = () => ({
    ...createProcedureRun(procedure),
    currentStepId: 'line_if_input',
    completedStepIds: ['safety_power_off', 'access_electronics', 'visual_if_acu', 'restore_power_line'],
  });

  let rfiRun = startAtLine();
  rfiRun = submitProcedureStep(procedure, rfiRun, { kind: 'measurement', value: '120' }).runState;
  rfiRun = submitProcedureStep(procedure, rfiRun, { kind: 'measurement', value: '0' }).runState;
  assertNoExternalPathFault(procedure, rfiRun);
  const rfiOut = deriveEvidenceSubjectConclusions(rfiRun, procedure).find(
    (c) => c.evidenceSubjectKey === 'rfi_line_output',
  );
  assert.equal(rfiOut?.kind, 'component_failed');
  assert.match(resolveProcedureRepairHeadline(procedure, rfiRun) || '', /RFI filter/i);
  assertJourneyRepairBoundary(procedureId, procedure, rfiRun);

  let j2Run = startAtLine();
  j2Run = submitProcedureStep(procedure, j2Run, { kind: 'measurement', value: '120' }).runState;
  j2Run = submitProcedureStep(procedure, j2Run, { kind: 'measurement', value: '120' }).runState;
  j2Run = submitProcedureStep(procedure, j2Run, { kind: 'measurement', value: '0' }).runState;
  const j2 = deriveEvidenceSubjectConclusions(j2Run, procedure).find(
    (c) => c.evidenceSubjectKey === 'acu_j2_line_neutral',
  );
  assert.equal(j2?.repairTargetHint, 'repair_j2_harness');
  assert.match(resolveProcedureRepairHeadline(procedure, j2Run) || '', /J2 harness/i);

  let ledRun = startAtLine();
  ledRun = submitProcedureStep(procedure, ledRun, { kind: 'measurement', value: '120' }).runState;
  ledRun = submitProcedureStep(procedure, ledRun, { kind: 'measurement', value: '120' }).runState;
  ledRun = submitProcedureStep(procedure, ledRun, { kind: 'measurement', value: '120' }).runState;
  ledRun = submitProcedureStep(procedure, ledRun, { kind: 'checkpoint', value: 'no' }).runState;
  const led = deriveEvidenceSubjectConclusions(ledRun, procedure).find(
    (c) => c.evidenceSubjectKey === 'acu_status_led',
  );
  assert.equal(led?.repairTargetHint, 'replace_acu');
  assert.match(resolveProcedureRepairHeadline(procedure, ledRun) || '', /ACU/i);
  const supplyIntel = evaluateDiagnosticIntelligence('washer', {}, undefined, {
    procedureRuns: { [procedureId]: ledRun },
  });
  const supply = findComponentState(supplyIntel, 'supply');
  assert.ok(supply);
  assert.notEqual(supply.state, 'confirmed');
}

function testLegacyUnscopedConfirmUnchanged() {
  const run = fixtureRunLegacyUnscopedConfirm();
  const procedure = SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE;
  assert.equal(resolveIntegratedPrimaryDiagnosticConclusion(run, procedure), null);
  assert.equal(resolveProcedureRunDisposition(run, procedure), 'action_required');
  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.match(headline || '', /drain/i);
}

testGoldenCase1ExternalPathFault();
testGoldenCase2ColdCoilInstance();
testGoldenCase3OverfillFloat();
testGoldenCase4DoorLockSubjects();
testGoldenCase5AcuVoltageSegmentation();
testLegacyUnscopedConfirmUnchanged();

console.log('gate8DiagnosticConclusionIntegration.test.ts: ok');
