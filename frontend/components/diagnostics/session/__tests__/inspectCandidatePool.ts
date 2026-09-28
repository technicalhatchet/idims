/**
 * One-off inspection script — dump unified candidate pool for review gate.
 * Run: npx tsx components/diagnostics/session/__tests__/inspectCandidatePool.ts
 */
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getWizardDefinition } from '../../registry/wizardRegistry';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import { recommendServiceProcedures } from '../../procedures/recommendServiceProcedures';
import { rankNextWizardSteps } from '../../intelligence/rankNextWizardSteps';
import { getEvidenceConfig } from '../../intelligence/evidenceRegistry';
import {
  getNextDiagnosticActions,
  hydrateDiagnosticSession,
} from '../index';

const FIELDS = {
  'customer_complaint.complaint_tags': ['lid_lock'],
  'customer_complaint.error_codes': 'F22',
};

const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

function runFixture(label: string, visitedStepKeys: string[]) {
  const wizardDefinition = getWizardDefinition('washer');
  const defaultStepOrder = wizardDefinition?.defaultSteps.map(
    (step) => step.stepKey || step.sectionId,
  ) || [];

  const intelligence = evaluateDiagnosticIntelligence('washer', FIELDS, undefined, {
    visitedStepKeys,
    defaultStepOrder,
    procedureRuns: {},
  });

  const session = hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields: FIELDS,
      visitedStepKeys,
      currentStepKey: visitedStepKeys.at(-1) || 'complaint',
      procedureRuns: {},
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WFW8300' },
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

  const unified = getNextDiagnosticActions({
    session,
    wizardContext: { intelligence, wizardDefinition, defaultStepOrder },
    procedureContext,
    limit: 15,
  });

  const legacyOem = recommendServiceProcedures(procedureContext).slice(0, 8);
  const config = getEvidenceConfig('washer');
  const legacyWizard = config
    ? rankNextWizardSteps({
      config,
      matchedRules: [],
      topCategories: (intelligence?.topCategories || []).filter((c) => c.evidence > 0),
      visitedStepKeys,
      defaultStepOrder,
    })
    : [];

  console.log(`\n${'='.repeat(72)}`);
  console.log(`FIXTURE: ${label}`);
  console.log(`Visited: [${visitedStepKeys.join(', ')}]`);
  console.log(`${'='.repeat(72)}\n`);

  console.log('LEGACY OEM (recommendServiceProcedures top 8):');
  for (const rec of legacyOem) {
    console.log(
      `  ${rec.priority.toString().padStart(3)} | ${rec.procedureId.padEnd(28)} | ${rec.procedure.title}`,
    );
    console.log(`       reason: ${rec.reason}`);
  }

  console.log('\nLEGACY WIZARD (rankNextWizardSteps / intelligence.recommendedStepKeys):');
  console.log(`  intelligence keys: ${(intelligence?.recommendedStepKeys || []).join(' → ') || '(none)'}`);
  console.log(`  rankNextWizardSteps: ${legacyWizard.join(' → ') || '(none)'}`);

  console.log('\nUNIFIED POOL (getNextDiagnosticActions, eligible ranked):');
  console.log('  Score  | Type              | Target       | ID / step');
  console.log('  ' + '-'.repeat(66));
  for (const c of unified.candidates) {
    const type = c.type === 'service_procedure' ? 'OEM procedure' : 'Wizard step';
    const id = c.procedureId || c.wizardStepKey || c.id;
    const label = (c.label || id).slice(0, 40);
    console.log(
      `  ${c.score.toFixed(2).padStart(5)} | ${type.padEnd(17)} | ${(c.target || '-').padEnd(12)} | ${label}`,
    );
    console.log(
      `         boost=${c.scoreBreakdown.existingSystemBoost.toFixed(2)} source=${c.source.system}:${c.source.id}`,
    );
    if (c.reason) console.log(`         reason: ${c.reason.slice(0, 90)}`);
  }

  if (unified.blockedCandidates.length) {
    console.log(`\nBLOCKED (${unified.blockedCandidates.length}):`);
    for (const c of unified.blockedCandidates.slice(0, 5)) {
      console.log(`  ${c.id} — ${c.blockedReason}`);
    }
  }

  const top = unified.candidates[0];
  console.log('\nTOP UNIFIED:', top
    ? `${top.type} ${top.procedureId || top.wizardStepKey} (score ${top.score.toFixed(2)})`
    : '(none)');
  console.log('TOP LEGACY OEM:', legacyOem[0]?.procedureId, `(priority ${legacyOem[0]?.priority})`);
  console.log('TOP LEGACY WIZARD:', intelligence?.recommendedStepKeys?.[0] || '(none)');
}

runFixture('WFW8300 + F22 + lid_lock (complaint only visited)', ['complaint']);
runFixture('After functional only (visual skipped — invalid path)', ['complaint', 'functional']);
runFixture('After visual + functional (valid spine)', ['complaint', 'visual', 'functional']);
