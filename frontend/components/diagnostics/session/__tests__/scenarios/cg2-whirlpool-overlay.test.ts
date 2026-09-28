import assert from 'node:assert/strict';
import { getCanonicalOntologyForTemplate } from '../../../knowledge/canonical/canonicalRegistry';
import { evaluateCanonicalGraphState } from '../../../knowledge/canonical/canonicalGraphRuntime';
import {
  getManufacturerOverlaysForOntology,
  platformFamilyApplies,
  resolveDiagnosticGraph,
  selectPlatformFamilyOverlay,
} from '../../../knowledge/canonical/resolveDiagnosticGraph';
import {
  resolveCanonicalDisplayTerm,
  resolveOemTermToCanonicalId,
  resolveProcedureIdToTestTargetId,
  resolveTestTargetIdToProcedureIds,
} from '../../../knowledge/canonical/resolveCanonicalAlias';
import { collectCanonicalCandidates } from '../../candidates/collectCanonicalCandidates';
import { rankDiagnosticCandidates } from '../../candidates/rankDiagnosticCandidates';
import {
  auditNoPrematureVerifiedFailed,
  buildMotorVoltageMeasurementRun,
  candidateKey,
  evaluateScenario,
  mergeProcedureRuns,
  printEvolutionTable,
  rankOf,
  scoreOf,
  serializeAndRehydrateScenario,
  topCandidateLabels,
  withHarnessBranches,
} from '../fixtures/fl-washer/scenarioKit';
import { hydrateDiagnosticSession } from '../../hydrateDiagnosticSession';
import { getWizardDefinition } from '../../../registry/wizardRegistry';
import { evaluateDiagnosticIntelligence } from '../../../intelligence/diagnosticIntelligenceEngine';
import type { ProcedureRunState } from '../../../procedures/types';
import { VISITED_STEP_KEYS, WONT_SPIN_FIELDS } from '../fixtures/fl-washer/scenarioKit';

const DOOR = 'w8178558-door-lock';
const DRAIN = 'w8178558-drain-pump';
const MOTOR = 'w8178558-motor-circuit';

const DOOR_GOOD = { stepId: 'door_lock_step', branchId: 'door_lock_verified_good' };
const DRAIN_GOOD = { stepId: 'drain_step', branchId: 'drain_verified_good' };
const COMMAND_PRESENT = { stepId: 'motor_command_step', branchId: 'motor_command_present' };

function buildWhirlpoolSession(procedureRuns: Record<string, ProcedureRunState> = {}) {
  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  const intelligence = evaluateDiagnosticIntelligence(
    'washer',
    WONT_SPIN_FIELDS,
    undefined,
    { visitedStepKeys: VISITED_STEP_KEYS, defaultStepOrder, procedureRuns },
  );
  return hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields: WONT_SPIN_FIELDS,
      visitedStepKeys: VISITED_STEP_KEYS,
      currentStepKey: 'functional',
      procedureRuns,
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WFW8300' },
    derived: { intelligence },
  });
}

function runCg2Acceptance(): void {
  const canonicalSnapshot = JSON.stringify(getCanonicalOntologyForTemplate('washer'));

  const canonicalOnly = resolveDiagnosticGraph({ templateId: 'washer' });
  assert.ok(canonicalOnly);
  assert.deepEqual(canonicalOnly.resolution.layers, ['canonical']);
  assert.equal(canonicalOnly.procedureBindings.length, 0);

  const whirlpoolResolved = resolveDiagnosticGraph({
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WFW8300',
    platformId: 'whirlpool_duet_sport',
  });
  assert.ok(whirlpoolResolved);
  assert.ok(whirlpoolResolved.resolution.layers.includes('manufacturer:Whirlpool'));
  assert.ok(whirlpoolResolved.resolution.layers.includes('platform:whirlpool_duet_sport_ccu_mcu'));
  assert.ok(whirlpoolResolved.procedureBindings.length >= 3);

  assert.equal(
    JSON.stringify(getCanonicalOntologyForTemplate('washer')),
    canonicalSnapshot,
    'canonical source must not mutate when overlay resolves',
  );

  const hasDirectCcuMotor = whirlpoolResolved.relationships.some(
    (rel) => rel.from === 'control_board' && rel.to === 'drive_motor' && rel.type === 'controls',
  );
  assert.equal(hasDirectCcuMotor, false, 'explicit override should remove CCU→motor direct control');

  const hasCcuMcuCommand = whirlpoolResolved.relationships.some(
    (rel) => rel.from === 'control_board' && rel.to === 'motor_controller' && rel.type === 'commands',
  );
  assert.ok(hasCcuMcuCommand, 'Whirlpool overlay should add CCU→MCU command path');

  const canonicalDirect = canonicalOnly.relationships.some(
    (rel) => rel.from === 'control_board' && rel.to === 'drive_motor' && rel.type === 'controls',
  );
  assert.ok(canonicalDirect, 'canonical layer should still contain CCU→motor when loaded alone');

  assert.equal(resolveOemTermToCanonicalId('CCU', whirlpoolResolved), 'control_board');
  assert.equal(resolveOemTermToCanonicalId('MCU', whirlpoolResolved), 'motor_controller');
  assert.equal(
    resolveCanonicalDisplayTerm('control_board', whirlpoolResolved),
    'CCU (Central Control Unit)',
  );

  assert.equal(
    resolveProcedureIdToTestTargetId('w8178558-door-lock', whirlpoolResolved),
    'door_lock_test',
  );
  assert.ok(
    resolveTestTargetIdToProcedureIds('door_lock_test', whirlpoolResolved).includes(DOOR),
  );

  const motorBinding = whirlpoolResolved.measurementBindings.find(
    (item) => item.measurementKnowledgeId === 'whirlpoolDuetSportWasherMotorOhms',
  );
  assert.ok(motorBinding);
  assert.equal(motorBinding.units, 'Ω');
  assert.equal(motorBinding.procedureId, MOTOR);

  const overlayFile = getManufacturerOverlaysForOntology('front_load_washer')[0];
  const family = selectPlatformFamilyOverlay(overlayFile, {
    templateId: 'washer',
    manufacturer: 'Whirlpool',
    model: 'WFW8300',
    platformId: 'whirlpool_duet_sport',
  });
  assert.ok(family);
  assert.ok(
    platformFamilyApplies(family, {
      templateId: 'washer',
      manufacturer: 'Whirlpool',
      model: 'WFW8300',
      platformId: 'whirlpool_duet_sport',
    }),
  );
  assert.equal(
    platformFamilyApplies(family, {
      templateId: 'washer',
      manufacturer: 'Samsung',
      model: 'WF45T6000',
      platformId: 'samsung_fl_washer_wf6000r',
    }),
    false,
  );

  const session = buildWhirlpoolSession();
  const graphState = evaluateCanonicalGraphState(session);
  assert.ok(graphState?.resolutionLayers?.includes('platform:whirlpool_duet_sport_ccu_mcu'));

  const candidates = collectCanonicalCandidates(session);
  assert.ok(candidates.length > 0, 'canonical candidates must not disappear when overlay resolves');
  const ranked = rankDiagnosticCandidates(candidates);
  assert.ok(ranked.length > 0);

  const doorCandidate = ranked.find((item) => item.procedureId === DOOR);
  assert.ok(doorCandidate?.label?.includes('Door Lock'), 'OEM terminology preserved in candidate label');

  const evolution: Array<{ stage: string; top: string[]; evidence: string }> = [];
  const initial = evaluateScenario();
  evolution.push({
    stage: 'Initial',
    top: topCandidateLabels(initial.result),
    evidence: 'Resolved Whirlpool graph — unknown prerequisites',
  });
  auditNoPrematureVerifiedFailed(initial.intelligence, 'Initial');

  const afterDoor = evaluateScenario(withHarnessBranches([DOOR_GOOD]));
  evolution.push({
    stage: 'Door good',
    top: topCandidateLabels(afterDoor.result),
    evidence: 'door_lock_authorized via harness + OEM branches',
  });

  const afterDrain = evaluateScenario(withHarnessBranches([DOOR_GOOD, DRAIN_GOOD]));
  evolution.push({
    stage: 'Drain good',
    top: topCandidateLabels(afterDrain.result),
    evidence: 'drain_completion established',
  });

  const commandRuns = withHarnessBranches([DOOR_GOOD, DRAIN_GOOD, COMMAND_PRESENT]);
  const afterCommand = evaluateScenario(commandRuns);
  evolution.push({
    stage: 'Command present',
    top: topCandidateLabels(afterCommand.result),
    evidence: 'motor_command_present',
  });

  const withMeasurement = mergeProcedureRuns(
    commandRuns,
    buildMotorVoltageMeasurementRun('37'),
  );
  const afterMeasurement = evaluateScenario(withMeasurement);
  evolution.push({
    stage: '37 VAC',
    top: topCandidateLabels(afterMeasurement.result),
    evidence: 'motor_output_abnormal + OEM spec path',
  });
  auditNoPrematureVerifiedFailed(afterMeasurement.intelligence, '37 VAC');

  printEvolutionTable(evolution);

  assert.ok(rankOf(initial.result.candidates, DOOR) >= 0);
  assert.ok(rankOf(initial.result.candidates, MOTOR) >= 0);
  assert.ok(
    scoreOf(afterDrain.result.candidates, MOTOR) > scoreOf(afterDoor.result.candidates, MOTOR),
    'motor score should rise as Whirlpool-resolved prerequisites accumulate',
  );
  assert.ok(
    scoreOf(afterCommand.result.candidates, MOTOR) > scoreOf(afterDrain.result.candidates, MOTOR),
    'motor score should continue rising when command established',
  );

  const replayed = serializeAndRehydrateScenario(withMeasurement);
  const beforeKeys = afterMeasurement.result.candidates.map(candidateKey);
  const afterKeys = replayed.candidates.map(candidateKey);
  assert.deepEqual(afterKeys.slice(0, 5), beforeKeys.slice(0, 5), 'serialize/reload should preserve ordering');
}

runCg2Acceptance();
console.log('cg2-whirlpool-overlay: OK');
