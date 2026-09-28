import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getWizardDefinition } from '../../registry/wizardRegistry';
import { getComplaintChipIds } from '../../routing/routingEngine';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import type { ProcedureRunState } from '../../procedures/types';
import { mergeDiagnosticCandidateList } from '../candidates/collectDiagnosticCandidates';
import { normalizeWizardCandidates } from '../candidates/normalizeWizardCandidates';
import { createEmptyScoreBreakdown, type NextTestCandidate } from '../candidates/types';
import {
  getNextDiagnosticActions,
  resolveLegacyDiagnosticLeader,
} from '../getNextDiagnosticActions';
import { hydrateDiagnosticSession } from '../hydrateDiagnosticSession';

const DOOR_LOCK_FIELDS = {
  'customer_complaint.complaint_tags': ['lid_lock'],
  'customer_complaint.error_codes': 'F22',
};

const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

function buildDoorLockSession(overrides: {
  visitedStepKeys?: string[];
  procedureRuns?: Record<string, ProcedureRunState>;
} = {}) {
  const payload = {
    templateId: 'washer',
    fields: DOOR_LOCK_FIELDS,
    visitedStepKeys: overrides.visitedStepKeys || ['complaint'],
    currentStepKey: overrides.visitedStepKeys?.at(-1) || 'complaint',
    procedureRuns: overrides.procedureRuns || {},
    activeProcedureId: null,
    timeline: [],
    evidenceSnapshot: null,
  };

  const intelligence = evaluateDiagnosticIntelligence('washer', payload.fields, undefined, {
    visitedStepKeys: payload.visitedStepKeys,
    defaultStepOrder: getWizardDefinition('washer')?.defaultSteps.map(
      (step) => step.stepKey || step.sectionId,
    ) || [],
    procedureRuns: payload.procedureRuns,
  });

  const session = hydrateDiagnosticSession({
    payload,
    workOrder: {
      equipment_make: 'Whirlpool',
      equipment_model: 'WFW8300',
    },
    derived: { intelligence },
  });

  return {
    session,
    intelligence,
    complaintChipIds: getComplaintChipIds(payload.fields),
    errorCodes: ['F22'],
  };
}

function testD_wizardDoorLockCandidate() {
  const { session, intelligence } = buildDoorLockSession();
  const wizardCandidates = normalizeWizardCandidates(session, {
    intelligence: {
      ...intelligence!,
      recommendedStepKeys: ['mechanical', ...(intelligence?.recommendedStepKeys || [])],
    },
  });

  const doorLockWizard = wizardCandidates.find((item) => item.wizardStepKey === 'mechanical');
  assert.ok(doorLockWizard, 'expected mechanical wizard_step for door lock routing');
  assert.equal(doorLockWizard.type, 'wizard_step');
  assert.equal(doorLockWizard.wizardStepKey, 'mechanical');
  assert.equal(doorLockWizard.target, 'door_lock');
}

function testE_oemDoorLockProcedure() {
  const { session, intelligence } = buildDoorLockSession();

  const result = getNextDiagnosticActions({
    session,
    wizardContext: { intelligence },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['lid_lock'],
      errorCodes: ['F22'],
      procedureRuns: {},
    },
  });

  const oemCandidate = result.candidates.find(
    (item) => item.procedureId === 'w8178558-door-lock',
  );
  assert.ok(oemCandidate, 'expected w8178558-door-lock candidate');
  assert.equal(oemCandidate.type, 'service_procedure');
  assert.equal(oemCandidate.procedureId, 'w8178558-door-lock');
}

function testF_duplicateProcedureMergesBoost() {
  const base: NextTestCandidate = {
    id: 'oem.w8178558-door-lock',
    type: 'service_procedure',
    target: 'door_lock',
    source: { system: 'oem', id: 'w8178558-door-lock' },
    wizardStepKey: null,
    procedureId: 'w8178558-door-lock',
    score: 0,
    scoreBreakdown: { ...createEmptyScoreBreakdown(), existingSystemBoost: 0.55 },
    eligible: true,
  };
  const duplicate: NextTestCandidate = {
    ...base,
    id: 'canonical.w8178558-door-lock',
    source: { system: 'canonical', id: 'w8178558-door-lock' },
    scoreBreakdown: { ...createEmptyScoreBreakdown(), existingSystemBoost: 0.82 },
  };

  const merged = mergeDiagnosticCandidateList([base, duplicate]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].procedureId, 'w8178558-door-lock');
  assert.equal(merged[0].scoreBreakdown.existingSystemBoost, 0.82);
}

function testG_completedDoorLockExcludedFromEligible() {
  const completedRun: ProcedureRunState = {
    procedureId: 'w8178558-door-lock',
    version: '1.0.0',
    startedAt: '2026-03-12T10:00:00.000Z',
    currentStepId: 'complete',
    completedStepIds: ['complete'],
    stepInputs: {},
    status: 'completed',
  };

  const { session, intelligence } = buildDoorLockSession({
    visitedStepKeys: ['complaint', 'mechanical'],
    procedureRuns: {
      'w8178558-door-lock': completedRun,
    },
  });

  const result = getNextDiagnosticActions({
    session,
    wizardContext: { intelligence },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['lid_lock'],
      errorCodes: ['F22'],
      procedureRuns: session.payload.procedureRuns,
    },
  });

  assert.ok(
    !result.candidates.some((item) => item.procedureId === 'w8178558-door-lock'),
    'completed OEM procedure should not rank as next action',
  );
  assert.ok(
    !result.candidates.some((item) => item.wizardStepKey === 'mechanical'),
    'visited mechanical step should not rank as next action',
  );
  assert.ok(
    result.blockedCandidates.some((item) => item.procedureId === 'w8178558-door-lock'),
    'completed procedure should appear in blocked list',
  );
}

function testQ_intelligenceFeedsWizardCandidates() {
  const { session, intelligence } = buildDoorLockSession();
  assert.ok(intelligence?.recommendedStepKeys?.length, 'intelligence should rank wizard steps');

  const result = getNextDiagnosticActions({
    session,
    wizardContext: { intelligence },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['lid_lock'],
      errorCodes: ['F22'],
    },
  });

  const topWizard = result.candidates.find((item) => item.type === 'wizard_step');
  assert.ok(topWizard);
  assert.ok(
    intelligence.recommendedStepKeys.includes(topWizard.wizardStepKey || ''),
    'unified wizard candidate should come from intelligence ranker output',
  );
}

function testParityMatchesLegacyLeader() {
  const fixtures = [
    buildDoorLockSession(),
    buildDoorLockSession({ visitedStepKeys: ['complaint', 'functional'] }),
  ];

  let matches = 0;
  for (const fixture of fixtures) {
    const { session, intelligence, complaintChipIds, errorCodes } = fixture;
    const procedureContext = {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds,
      errorCodes,
      procedureRuns: session.payload.procedureRuns,
    };
    const wizardContext = { intelligence };

    const unified = getNextDiagnosticActions({
      session,
      wizardContext,
      procedureContext,
    });
    const legacy = resolveLegacyDiagnosticLeader(
      wizardContext,
      procedureContext,
      session.navigation.visitedStepKeys,
    );
    const top = unified.candidates[0];
    if (!legacy || !top) continue;

    const legacyId = legacy.type === 'wizard_step' ? top.wizardStepKey : top.procedureId;
    const matchesLegacy =
      (legacy.type === 'wizard_step' && top.type === 'wizard_step' && legacy.id === top.wizardStepKey)
      || (legacy.type === 'service_procedure'
        && top.type === 'service_procedure'
        && legacy.id === top.procedureId);

    if (matchesLegacy) matches += 1;
  }

  assert.ok(
    matches / fixtures.length >= 0.5,
    `parity: unified leader should align with legacy in most fixtures (got ${matches}/${fixtures.length})`,
  );
}

const tests: Array<[string, () => void]> = [
  ['D wizard door_lock candidate', testD_wizardDoorLockCandidate],
  ['E OEM door-lock procedure', testE_oemDoorLockProcedure],
  ['F duplicate procedure merge', testF_duplicateProcedureMergesBoost],
  ['G completed door lock excluded', testG_completedDoorLockExcludedFromEligible],
  ['Q intelligence feeds wizard candidates', testQ_intelligenceFeedsWizardCandidates],
  ['parity legacy leader', testParityMatchesLegacyLeader],
];

let failed = 0;
for (const [name, fn] of tests) {
  try {
    fn();
    console.log(`ok - ${name}`);
  } catch (error) {
    failed += 1;
    console.error(`not ok - ${name}`);
    console.error(error);
  }
}

if (failed > 0) {
  process.exitCode = 1;
} else {
  console.log(`\n${tests.length} candidate tests passed`);
}
