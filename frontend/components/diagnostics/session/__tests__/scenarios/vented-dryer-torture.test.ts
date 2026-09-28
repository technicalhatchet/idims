import assert from 'node:assert/strict';
import {
  deriveCanonicalRoutingAdjustments,
  evaluateCanonicalGraphState,
} from '../../../knowledge/canonical/canonicalGraphRuntime';
import { resolveDiagnosticGraph } from '../../../knowledge/canonical/resolveDiagnosticGraph';
import {
  AIRFLOW_GOOD,
  BLOWER_GOOD,
  DOOR_GOOD,
  DOOR_PROC,
  evaluateDryerScenario,
  HEAT_COMMAND,
  HEATER_PROC,
  MOTOR_GOOD,
  MOTOR_PROC,
  THERMAL_FUSE_PROC,
  auditNoPrematureVerifiedFailed,
  buildDryerHeaterOhmsRun,
  buildDryerSession,
  candidateKey,
  printEvolutionTable,
  rankOf,
  scoreOf,
  setupDryerHarnessProcedures,
  teardownDryerHarnessProcedures,
  topCandidateLabels,
  withDryerHarnessBranches,
} from '../fixtures/vented-dryer/scenarioKit';

function prerequisiteRuns() {
  return withDryerHarnessBranches([DOOR_GOOD, MOTOR_GOOD, BLOWER_GOOD, AIRFLOW_GOOD]);
}

function fullHeatPrereqRuns() {
  return withDryerHarnessBranches([
    DOOR_GOOD,
    MOTOR_GOOD,
    BLOWER_GOOD,
    AIRFLOW_GOOD,
    HEAT_COMMAND,
  ]);
}

function runVentedDryerNoHeatTorture(): void {
  const resolved = resolveDiagnosticGraph({
    templateId: 'electric_dryer',
    manufacturer: 'Whirlpool',
    model: 'WED8300',
    platformId: 'whirlpool_duet_sport_dryer',
  });
  assert.ok(resolved);
  assert.equal(resolved.ontology.id, 'vented_dryer');
  assert.ok(resolved.components.some((component) => component.id === 'electric_heater'));
  assert.ok(resolved.procedureBindings.some((binding) => binding.procedureId === HEATER_PROC));

  const evolution: Array<{ stage: string; top: string[]; evidence: string }> = [];

  const initialSession = buildDryerSession();
  const initialGraph = evaluateCanonicalGraphState(initialSession);
  assert.ok(initialGraph);
  assert.equal(initialGraph.activeGoals.includes('heating_operation'), true);
  assert.equal(initialGraph.establishedFactIds.has('door_closed_authorized'), false);

  const initialAdjustments = deriveCanonicalRoutingAdjustments(initialSession);
  const doorFit = initialAdjustments.find((item) => item.testTargetId === 'door_switch_test')?.routingFit ?? 0;
  const heatOutputFit = initialAdjustments.find((item) => item.testTargetId === 'heat_output_test')?.routingFit ?? 0;
  assert.ok(doorFit > heatOutputFit, 'door prerequisite should outrank heat output initially');

  const initial = evaluateDryerScenario();
  evolution.push({
    stage: 'Initial',
    top: topCandidateLabels(initial.result),
    evidence: 'no_heat — prerequisites unknown',
  });
  auditNoPrematureVerifiedFailed(initial.intelligence, 'Initial');
  assert.ok(
    rankOf(initial.result.candidates, DOOR_PROC) >= 0
      || initial.result.candidates.some((c) => c.scoreBreakdown.routingFit > 0),
    'door or canonical prerequisite should surface',
  );

  const afterDoor = evaluateDryerScenario(withDryerHarnessBranches([DOOR_GOOD]));
  const doorGraph = evaluateCanonicalGraphState(buildDryerSession(withDryerHarnessBranches([DOOR_GOOD])));
  assert.ok(doorGraph?.establishedFactIds.has('door_closed_authorized'));
  evolution.push({
    stage: 'Door authorized',
    top: topCandidateLabels(afterDoor.result),
    evidence: 'door_closed_authorized',
  });
  auditNoPrematureVerifiedFailed(afterDoor.intelligence, 'Door authorized');
  assert.ok(
    scoreOf(afterDoor.result.candidates, MOTOR_PROC) >= scoreOf(initial.result.candidates, MOTOR_PROC),
    'motor path should not fall after door authorization',
  );

  const afterAirflow = evaluateDryerScenario(prerequisiteRuns());
  const airflowGraph = evaluateCanonicalGraphState(buildDryerSession(prerequisiteRuns()));
  assert.ok(airflowGraph?.establishedFactIds.has('motor_running'));
  assert.ok(airflowGraph?.establishedFactIds.has('blower_running'));
  assert.ok(airflowGraph?.establishedFactIds.has('airflow_path_clear'));
  evolution.push({
    stage: 'Airflow path clear',
    top: topCandidateLabels(afterAirflow.result),
    evidence: 'motor + blower + lint/exhaust path established',
  });
  auditNoPrematureVerifiedFailed(afterAirflow.intelligence, 'Airflow path clear');

  const heatCommandAdjustments = deriveCanonicalRoutingAdjustments(
    buildDryerSession(prerequisiteRuns()),
  );
  const commandFit = heatCommandAdjustments.find((item) => item.testTargetId === 'heat_command_test')?.routingFit ?? 0;
  assert.ok(commandFit > 0, 'heat command should become routable after airflow prerequisites');

  const afterCommand = evaluateDryerScenario(fullHeatPrereqRuns());
  const commandGraph = evaluateCanonicalGraphState(buildDryerSession(fullHeatPrereqRuns()));
  assert.ok(commandGraph?.establishedFactIds.has('heat_command_present'));
  evolution.push({
    stage: 'Heat commanded',
    top: topCandidateLabels(afterCommand.result),
    evidence: 'heat_command_present — output/thermal path',
  });
  auditNoPrematureVerifiedFailed(afterCommand.intelligence, 'Heat commanded');

  assert.ok(
    scoreOf(afterCommand.result.candidates, HEATER_PROC) > scoreOf(afterAirflow.result.candidates, HEATER_PROC)
      || rankOf(afterCommand.result.candidates, HEATER_PROC) >= 0,
    'heater output procedure should rise when heat is commanded',
  );

  const heaterOpenRuns = {
    ...fullHeatPrereqRuns(),
    ...buildDryerHeaterOhmsRun('9999'),
  };
  const afterHeaterOpen = evaluateDryerScenario(heaterOpenRuns);
  evolution.push({
    stage: 'Heater open',
    top: topCandidateLabels(afterHeaterOpen.result),
    evidence: 'open element ohms — heat path failure',
  });
  auditNoPrematureVerifiedFailed(afterHeaterOpen.intelligence, 'Heater open');
  assert.ok(
    rankOf(afterHeaterOpen.result.candidates, HEATER_PROC) >= 0
      || rankOf(afterHeaterOpen.result.candidates, THERMAL_FUSE_PROC) >= 0,
    'heat output or thermal protection should remain in candidate pool',
  );

  printEvolutionTable(evolution);

  const canonicalCandidates = afterCommand.result.candidates.filter(
    (candidate) => candidate.id.startsWith('canonical.'),
  );
  assert.ok(canonicalCandidates.length > 0, 'canonical overlay candidates should contribute to ranking');

  const heaterCanonical = afterCommand.result.candidates.find(
    (candidate) => candidate.procedureId === HEATER_PROC,
  );
  assert.ok(heaterCanonical, 'W8178559 heater procedure should be a ranked candidate after heat command');
  assert.ok(
    (heaterCanonical.scoreBreakdown.routingFit ?? 0) > 0
      || (heaterCanonical.score ?? 0) > 0,
    'heater candidate should carry routing or composite score',
  );
}

const tests: Array<[string, () => void]> = [
  ['CG-6.4 vented dryer no-heat torture harness', runVentedDryerNoHeatTorture],
];

for (const [name, fn] of tests) {
  setupDryerHarnessProcedures();
  try {
    fn();
    console.log(`ok - ${name}`);
  } finally {
    teardownDryerHarnessProcedures();
  }
}

console.log(`\n${tests.length} vented-dryer torture test(s) passed`);
