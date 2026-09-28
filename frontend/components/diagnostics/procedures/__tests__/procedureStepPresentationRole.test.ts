import assert from 'node:assert/strict';
import { test } from 'node:test';

import { listServiceProcedureCatalog } from '../recommendServiceProcedures';
import { buildMeasurementContext } from '../../knowledge/platformRegistry';
import { getServiceProcedure } from '../procedureRegistry';
import {
  collectServiceModeInjectedStepIds,
  formatProcedureStepProgressLabel,
  resolveProcedureStepPresentationRole,
} from '../procedureStepPresentationRole';
import { formatOemContinuationBridgeMessage } from '../procedureStepPresentation';

const MEASUREMENT_CONTEXT = buildMeasurementContext({
  templateId: 'washer',
  equipmentMake: 'Whirlpool',
  equipmentModel: 'WFW8300',
});

test('catalog lists ServiceProcedure identities, not internal steps', () => {
  const catalog = listServiceProcedureCatalog({
    templateId: 'washer',
    measurementContext: MEASUREMENT_CONTEXT,
  });
  assert.ok(catalog.length > 0);
  for (const entry of catalog) {
    assert.equal(entry.procedureId, entry.procedure.id);
    assert.ok(entry.procedure.steps.length > 1);
  }
  const drain = catalog.find((item) => item.procedureId === 'w8178558-drain-pump');
  const motor = catalog.find((item) => item.procedureId === 'w8178558-motor-circuit');
  assert.ok(drain && motor);
  assert.notEqual(drain.procedureId, motor.procedureId);
});

test('service-mode bundle steps are roles inside one procedure, not separate procedures', () => {
  const drain = getServiceProcedure('w8178558-drain-pump');
  assert.ok(drain);
  const injected = collectServiceModeInjectedStepIds(drain);
  assert.ok(injected.size > 0);
  const manualStep = drain.steps.find((step) => injected.has(step.id));
  assert.ok(manualStep);
  assert.equal(resolveProcedureStepPresentationRole(drain, manualStep!), 'service_mode');
  const measurementStep = drain.steps.find((step) => step.type === 'measurement');
  assert.ok(measurementStep);
  assert.equal(resolveProcedureStepPresentationRole(drain, measurementStep!), 'component_test');
});

test('progress labels distinguish setup vs component test inside same procedure', () => {
  const labelSetup = formatProcedureStepProgressLabel(8, 13, 'service_mode');
  const labelTest = formatProcedureStepProgressLabel(9, 13, 'component_test');
  assert.match(labelSetup!, /Manufacturer setup step/i);
  assert.match(labelSetup!, /same procedure/i);
  assert.match(labelTest!, /Component test step/i);
  assert.doesNotMatch(labelTest!, /Manufacturer setup/i);
});

test('manufacturer path complete continuation copy avoids stale recommendation reason', () => {
  const message = formatOemContinuationBridgeMessage({
    manufacturerPathComplete: true,
    nextDirectionSummary: 'Remaining supported path: Main control board (CCU).',
    recommendationReason: 'This test checks the drain circuit before going deeper into the complaint.',
  });
  assert.match(message!, /Manufacturer diagnostic path complete/i);
  assert.match(message!, /control board/i);
  assert.doesNotMatch(message!, /drain circuit/i);
});
