import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { deriveEvidenceSubjectConclusions } from '../deriveEvidenceSubjectConclusions';
import { deriveProcedureDiagnosticConclusions } from '../deriveProcedureDiagnosticConclusions';
import { getServiceProcedure } from '../procedureRegistry';
import { resolveProcedureRepairHeadline } from '../procedureRunPresentation';
import { createProcedureRun, submitProcedureStep } from '../procedureRunner';

const PROCEDURE_ID = 'w11169652-test-01-acu-power';

function startAtLineInput() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);
  const run = {
    ...createProcedureRun(procedure),
    currentStepId: 'line_if_input',
    completedStepIds: [
      'safety_power_off',
      'access_electronics',
      'visual_if_acu',
      'restore_power_line',
    ],
  };
  return { procedure, run };
}

function completeRfiOutputFailWitness() {
  const { procedure, run: start } = startAtLineInput();
  let run = start;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '120' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '0' }).runState;
  return { procedure, run };
}

function completeJ2HarnessFailWitness() {
  const { procedure, run: start } = startAtLineInput();
  let run = start;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '120' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '120' }).runState;
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '0' }).runState;
  return { procedure, run };
}

function testVoltageSegmentsUseSupplyPhysicalSetup() {
  const procedure = getServiceProcedure(PROCEDURE_ID);
  assert.ok(procedure);
  const lineIn = procedure.steps.find((s) => s.id === 'line_if_input');
  assert.equal(lineIn?.measurementContext?.physicalTestSetup, 'supply_voltage_segment');
  assert.equal(lineIn?.measurementContext?.loadInCircuit, false);
  assert.equal(
    lineIn?.branches?.find((b) => b.id === 'line_in_ok')?.diagnosticEffects?.[0]?.evidenceSubjectKey,
    'rfi_line_input',
  );
  assert.equal(
    lineIn?.branches?.find((b) => b.id === 'line_in_ok')?.diagnosticEffects?.[0]?.assertion,
    undefined,
  );
}

function testNoPathFaultDerivation() {
  const { procedure, run } = completeRfiOutputFailWitness();
  assert.equal(deriveProcedureDiagnosticConclusions(run, procedure).length, 0);
}

function testRfiOutputFailDoesNotCollapseSupply() {
  const { procedure, run } = completeRfiOutputFailWitness();
  const conclusions = deriveEvidenceSubjectConclusions(run, procedure);
  const input = conclusions.find((c) => c.evidenceSubjectKey === 'rfi_line_input');
  const output = conclusions.find((c) => c.evidenceSubjectKey === 'rfi_line_output');

  assert.equal(input?.kind, 'component_verified');
  assert.equal(output?.kind, 'component_failed');
  assert.equal(output?.repairTargetHint, 'replace_rfi_filter');

  const intelligence = evaluateDiagnosticIntelligence('washer', {}, undefined, {
    procedureRuns: { [PROCEDURE_ID]: run },
  });
  let supply: { id: string; state: string } | null = null;
  for (const components of Object.values(intelligence?.componentsByCategory || {})) {
    const match = components.find((item) => item.id === 'supply');
    if (match) supply = match;
  }
  assert.ok(supply);
  assert.notEqual(supply.state, 'confirmed');

  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.match(headline || '', /RFI filter/i);
}

function testJ2HarnessRepairHint() {
  const { procedure, run } = completeJ2HarnessFailWitness();
  const j2 = deriveEvidenceSubjectConclusions(run, procedure).find(
    (c) => c.evidenceSubjectKey === 'acu_j2_line_neutral',
  );
  assert.equal(j2?.kind, 'component_failed');
  assert.equal(j2?.repairTargetHint, 'repair_j2_harness');
  assert.match(resolveProcedureRepairHeadline(procedure, run) || '', /J2 harness/i);
}

testVoltageSegmentsUseSupplyPhysicalSetup();
testNoPathFaultDerivation();
testRfiOutputFailDoesNotCollapseSupply();
testJ2HarnessRepairHint();

console.log('w11169652-test-01-acu-power-evidenceSubject.test.ts: ok');
