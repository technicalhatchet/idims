import assert from 'node:assert/strict';
import { test } from 'node:test';

import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import { evaluateDiagnosticIntelligence } from '../../intelligence/diagnosticIntelligenceEngine';
import { getNextDiagnosticActions, hydrateDiagnosticSession } from '../../session';
import {
  listServiceProcedureCatalog,
  recommendServiceProcedures,
} from '../recommendServiceProcedures';
import { mergeProcedureCatalogWithRouteProcedures } from '../mergeProcedureCatalog';

const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

test('WFW8300 wont_spin route procedures appear in merged All OEM catalog', () => {
  const fields = { 'customer_complaint.complaint_tags': ['wont_spin'] };
  const intelligence = evaluateDiagnosticIntelligence('washer', fields, undefined, {
    visitedStepKeys: ['complaint'],
    defaultStepOrder: ['complaint', 'commonly_missed', 'visual', 'functional', 'electrical', 'mechanical', 'diagnosis'],
    procedureRuns: {},
  });
  const session = hydrateDiagnosticSession({
    payload: {
      templateId: 'washer',
      fields,
      visitedStepKeys: ['complaint'],
      currentStepKey: 'complaint',
      procedureRuns: {},
      activeProcedureId: null,
      timeline: [],
      evidenceSnapshot: null,
    },
    workOrder: { equipment_make: 'Whirlpool', equipment_model: 'WFW8300' },
    derived: { intelligence },
  });
  const actions = getNextDiagnosticActions({
    session,
    wizardContext: { intelligence, defaultStepOrder: ['complaint', 'visual', 'functional'] },
    procedureContext: {
      templateId: 'washer',
      measurementContext: MEASUREMENT_CONTEXT,
      intelligence,
      complaintChipIds: ['wont_spin'],
      errorCodes: [],
      procedureRuns: {},
    },
  });
  const routeIds = actions.candidates
    .filter((candidate) => candidate.type === 'service_procedure' && candidate.procedureId)
    .map((candidate) => candidate.procedureId as string);
  assert.ok(routeIds.length > 0, 'expected route service_procedure candidates');

  const ranked = recommendServiceProcedures({
    templateId: 'washer',
    measurementContext: MEASUREMENT_CONTEXT,
    intelligence,
    complaintChipIds: ['wont_spin'],
    errorCodes: [],
    procedureRuns: {},
  });
  const catalog = mergeProcedureCatalogWithRouteProcedures(
    listServiceProcedureCatalog({ templateId: 'washer', measurementContext: MEASUREMENT_CONTEXT }),
    routeIds,
    ranked,
  );
  const catalogIds = new Set(catalog.map((entry) => entry.procedureId));
  for (const id of routeIds) {
    assert.ok(catalogIds.has(id), `route procedure ${id} missing from merged catalog`);
  }
});
