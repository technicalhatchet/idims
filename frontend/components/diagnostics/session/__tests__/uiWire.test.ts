import assert from 'node:assert/strict';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getWizardDefinition } from '../../registry/wizardRegistry';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import {
  buildUnifiedWizardRecommendedStepKeys,
  mergeOemProcedureWizardSteps,
} from '../../procedures/procedureWizardLead';
import {
  recommendServiceProcedures,
} from '../../procedures/recommendServiceProcedures';
import {
  extractUnifiedWizardStepKeys,
  getNextDiagnosticActions,
  hydrateDiagnosticSession,
  resolveUnifiedOemLeadRecommendation,
} from '../index';

const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

function buildDoorLockFixture() {
  const fields = {
    'customer_complaint.complaint_tags': ['lid_lock'],
    'customer_complaint.error_codes': 'F22',
  };
  const visitedStepKeys = ['complaint'];
  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];
  const intelligence = evaluateDiagnosticIntelligence('washer', fields, undefined, {
    visitedStepKeys,
    defaultStepOrder,
    procedureRuns: {},
  });
  const session = hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields,
      visitedStepKeys,
      currentStepKey: 'complaint',
      procedureRuns: {},
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: {
      equipment_make: 'Whirlpool',
      equipment_model: 'WFW8300',
    },
    derived: { intelligence },
  });
  const procedureContext = {
    templateId: 'washer',
    measurementContext: MEASUREMENT_CONTEXT,
    intelligence,
    complaintChipIds: ['lid_lock'],
    errorCodes: ['F22'],
    procedureRuns: {},
  };
  const procedureRecommendations = recommendServiceProcedures(procedureContext);
  const unified = getNextDiagnosticActions({
    session,
    wizardContext: { intelligence, wizardDefinition, defaultStepOrder },
    procedureContext,
  });

  return {
    intelligence,
    procedureRecommendations,
    unified,
    visitedStepKeys,
    procedureContext,
  };
}

function testUnifiedOemLeadMatchesLegacyTop() {
  const { procedureRecommendations, unified } = buildDoorLockFixture();
  const unifiedTopId = unified.candidates.find(
    (item) => item.type === 'service_procedure',
  )?.procedureId;
  const unifiedLead = resolveUnifiedOemLeadRecommendation(
    procedureRecommendations,
    unifiedTopId,
  );
  const legacyLead = procedureRecommendations[0];

  assert.ok(unifiedLead);
  assert.equal(unifiedLead.procedureId, legacyLead.procedureId);
}

function testUnifiedWizardKeysAlignWithLegacyMerge() {
  const {
    intelligence,
    procedureRecommendations,
    unified,
    visitedStepKeys,
  } = buildDoorLockFixture();

  const unifiedWizardKeys = extractUnifiedWizardStepKeys(unified.candidates);
  const fallback = intelligence?.recommendedStepKeys || [];
  const legacyMerged = mergeOemProcedureWizardSteps(
    fallback,
    procedureRecommendations[0],
    visitedStepKeys,
    true,
    {},
  );
  const unifiedMerged = buildUnifiedWizardRecommendedStepKeys(
    unifiedWizardKeys,
    fallback,
    procedureRecommendations[0],
    visitedStepKeys,
    true,
    {},
  );

  assert.equal(unifiedMerged[0], legacyMerged[0]);
  assert.deepEqual(new Set(unifiedMerged), new Set(legacyMerged));
}

const tests: Array<[string, () => void]> = [
  ['unified OEM lead matches legacy top', testUnifiedOemLeadMatchesLegacyTop],
  ['unified wizard merge matches legacy merge', testUnifiedWizardKeysAlignWithLegacyMerge],
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
  console.log(`\n${tests.length} ui-wire tests passed`);
}
