import assert from 'node:assert/strict';
import {
  deriveProcedureDiagnosticConclusions,
  resolvePrimaryDiagnosticConclusion,
} from '../../procedures/deriveProcedureDiagnosticConclusions';
import { getServiceProcedure } from '../../procedures/procedureRegistry';
import { createProcedureRun, getProcedureStep, submitProcedureStep } from '../../procedures/procedureRunner';
import { getRepairProcedure } from '../repairRegistry';
import {
  resolveRepairProcedureForDiagnosticRun,
  resolveRepairProcedureIdForDiagnosticRun,
} from '../resolveRepairProcedureForDiagnostic';
import { validateRepairProcedure } from '../validateRepairProcedure';

const DIAGNOSTIC_ID = 'w8178558-drain-pump';
const REPAIR_ID = 'w8178558-repair-drain-pump';

function completePathOpenWitness() {
  const procedure = getServiceProcedure(DIAGNOSTIC_ID);
  assert.ok(procedure);
  let run = createProcedureRun(procedure);
  while (run.currentStepId !== 'pump_at_component' && run.status === 'in_progress') {
    const step = getProcedureStep(procedure, run.currentStepId);
    assert.ok(step);
    if (step.type === 'visual_check' && step.requiresInput) {
      run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'yes' }).runState;
    } else {
      run = submitProcedureStep(procedure, run).runState;
    }
  }
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: '12' }).runState;
  while (run.currentStepId !== 'pump_at_ccu' && run.status === 'in_progress') {
    const step = getProcedureStep(procedure, run.currentStepId);
    assert.ok(step);
    if (step.type === 'visual_check' && step.requiresInput) {
      run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'yes' }).runState;
    } else {
      run = submitProcedureStep(procedure, run).runState;
    }
  }
  run = submitProcedureStep(procedure, run, { kind: 'measurement', value: 'OL' }).runState;
  run = submitProcedureStep(procedure, run).runState;
  assert.equal(run.status, 'completed');
  return { procedure, run };
}

function testRepairProcedureLoads() {
  const repair = getRepairProcedure(REPAIR_ID);
  assert.ok(repair);
  assert.equal(repair.repairTarget.diagnosticProcedureIds[0], DIAGNOSTIC_ID);
  assert.equal(validateRepairProcedure(repair).length, 0);
}

function testProvenanceOnEveryStep() {
  const repair = getRepairProcedure(REPAIR_ID);
  assert.ok(repair);
  const all = [
    repair.source,
    ...repair.safety.map((s) => s.source),
    ...repair.beforeRepairChecks.map((s) => s.source),
    ...repair.steps.map((s) => s.source),
    ...repair.finalChecks.map((s) => s.source),
    ...repair.tools.map((t) => t.source),
  ];
  for (const source of all) {
    assert.ok(source.manualId === 'W8178558');
    assert.ok(source.sourceExcerpt?.length > 10);
    assert.ok(source.pages?.length);
    assert.ok(source.extractedTextFile?.includes('8178558'));
  }
}

function testStepOrderingDeterministic() {
  const repair = getRepairProcedure(REPAIR_ID);
  assert.ok(repair);
  const orders = repair.steps.map((s) => s.order);
  assert.deepEqual(orders, [4, 5, 6, 7, 8, 9]);
  const sorted = repair.steps.slice().sort((a, b) => a.order - b.order);
  assert.deepEqual(sorted.map((s) => s.id), repair.steps.map((s) => s.id));
}

function testDiagnosticTargetResolvesRepairProcedure() {
  const { procedure, run } = completePathOpenWitness();
  const primary = resolvePrimaryDiagnosticConclusion(
    deriveProcedureDiagnosticConclusions(run, procedure),
  );
  assert.equal(primary?.kind, 'external_path_fault');
  assert.equal(resolveRepairProcedureIdForDiagnosticRun(DIAGNOSTIC_ID, run), REPAIR_ID);
  const repair = resolveRepairProcedureForDiagnosticRun(DIAGNOSTIC_ID, run);
  assert.equal(repair?.id, REPAIR_ID);
}

function testNoFabricatedTorqueOrFastenerCounts() {
  const repair = getRepairProcedure(REPAIR_ID);
  assert.ok(repair);
  const blob = JSON.stringify(repair);
  assert.doesNotMatch(blob, /torque/i);
  assert.doesNotMatch(blob, /ft-lb/i);
  assert.equal(repair.parts.length, 0);
}

function testUnmappedDiagnosticReturnsNull() {
  const procedure = getServiceProcedure('w8178558-wash-heater');
  assert.ok(procedure);
  const run = createProcedureRun(procedure);
  assert.equal(resolveRepairProcedureForDiagnosticRun('w8178558-wash-heater', run), null);
}

testRepairProcedureLoads();
testProvenanceOnEveryStep();
testStepOrderingDeterministic();
testDiagnosticTargetResolvesRepairProcedure();
testNoFabricatedTorqueOrFastenerCounts();
testUnmappedDiagnosticReturnsNull();

console.log('repair1-w8178558-drain-pump.test.ts: ok');
