import assert from 'node:assert/strict';
import {
  deriveProcedureDiagnosticConclusions,
  resolvePrimaryDiagnosticConclusion,
} from '../../procedures/deriveProcedureDiagnosticConclusions';
import { getServiceProcedure } from '../../procedures/procedureRegistry';
import { resolveProcedureRepairHeadline } from '../../procedures/procedureRunPresentation';
import { createProcedureRun, getProcedureStep, submitProcedureStep } from '../../procedures/procedureRunner';
import { getRepairProcedure } from '../repairRegistry';
import {
  resolveRepairProcedureForDiagnosticRun,
  resolveRepairProcedureIdForDiagnosticRun,
} from '../resolveRepairProcedureForDiagnostic';
import { validateRepairProcedure } from '../validateRepairProcedure';

const DIAGNOSTIC_ID = 'w8178558-wash-heater';
const REPAIR_ID = 'w8178558-repair-wash-heater';

function advanceToHeaterAtComponent() {
  const procedure = getServiceProcedure(DIAGNOSTIC_ID);
  assert.ok(procedure);
  let run = createProcedureRun(procedure);
  while (run.currentStepId !== 'heater_at_component' && run.status === 'in_progress') {
    const step = getProcedureStep(procedure, run.currentStepId);
    assert.ok(step);
    if (step.type === 'visual_check' && step.requiresInput) {
      run = submitProcedureStep(procedure, run, { kind: 'checkpoint', value: 'yes' }).runState;
    } else {
      run = submitProcedureStep(procedure, run).runState;
    }
  }
  return { procedure, run };
}

function completeHeaterOpenAtComponent() {
  const { procedure, run: start } = advanceToHeaterAtComponent();
  let run = submitProcedureStep(procedure, start, { kind: 'measurement', value: 'OL' }).runState;
  if (run.status === 'in_progress' && run.currentStepId === 'replace_heater') {
    run = submitProcedureStep(procedure, run).runState;
  }
  assert.equal(run.status, 'completed');
  return { procedure, run };
}

function completeHeaterPathOpenAtCcu() {
  const { procedure, run: start } = advanceToHeaterAtComponent();
  let run = submitProcedureStep(procedure, start, { kind: 'measurement', value: '12' }).runState;
  while (run.currentStepId !== 'heater_at_ccu' && run.status === 'in_progress') {
    run = submitProcedureStep(procedure, run).runState;
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

function testStepOrderingAndProvenance() {
  const repair = getRepairProcedure(REPAIR_ID);
  assert.ok(repair);
  assert.deepEqual(repair.steps.map((s) => s.order), [5, 6]);
  const sources = [
    repair.source,
    ...repair.safety.map((s) => s.source),
    ...repair.beforeRepairChecks.map((s) => s.source),
    ...repair.steps.map((s) => s.source),
  ];
  for (const source of sources) {
    assert.equal(source.manualId, 'W8178558');
    assert.ok(source.sourceExcerpt?.length > 10);
    assert.ok(source.pages?.length);
  }
}

function testComponentFailureResolvesHeaterRepair() {
  const { procedure, run } = completeHeaterOpenAtComponent();
  assert.equal(resolveRepairProcedureIdForDiagnosticRun(DIAGNOSTIC_ID, run), REPAIR_ID);
  assert.equal(resolveRepairProcedureForDiagnosticRun(DIAGNOSTIC_ID, run)?.id, REPAIR_ID);
  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.match(headline || '', /heater/i);
}

function testPathFaultDoesNotMapToHeaterReplacement() {
  const { procedure, run } = completeHeaterPathOpenAtCcu();
  const primary = resolvePrimaryDiagnosticConclusion(
    deriveProcedureDiagnosticConclusions(run, procedure),
  );
  assert.equal(primary?.kind, 'external_path_fault');
  assert.equal(resolveRepairProcedureForDiagnosticRun(DIAGNOSTIC_ID, run), null);
  const headline = resolveProcedureRepairHeadline(procedure, run);
  assert.match(headline || '', /Inspect\/repair/i);
  assert.doesNotMatch(headline || '', /^Replace wash heater$/i);
}

function testNoFabricatedExtras() {
  const repair = getRepairProcedure(REPAIR_ID);
  assert.ok(repair);
  const blob = JSON.stringify(repair);
  assert.doesNotMatch(blob, /torque/i);
  assert.equal(repair.tools.length, 0);
  assert.equal(repair.parts.length, 0);
  assert.equal(repair.finalChecks.length, 0);
}

testRepairProcedureLoads();
testStepOrderingAndProvenance();
testComponentFailureResolvesHeaterRepair();
testPathFaultDoesNotMapToHeaterReplacement();
testNoFabricatedExtras();

console.log('repair2-w8178558-wash-heater.test.ts: ok');
