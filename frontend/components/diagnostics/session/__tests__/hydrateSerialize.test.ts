import assert from 'node:assert/strict';
import {
  parseDiagnosticNotePayload,
  serializeDiagnosticNotePayload,
} from '../../../../constants/diagnosticTemplates.js';
import type { ProcedureRunState } from '../../procedures/types';
import type { LooseDiagnosticPayload } from '../types';
import { hydrateDiagnosticSession } from '../hydrateDiagnosticSession';
import { serializeDiagnosticSession } from '../serializeDiagnosticSession';

const SAMPLE_PROCEDURE_RUN: ProcedureRunState = {
  procedureId: 'w8178558-door-lock',
  version: '1.0.0',
  startedAt: '2026-03-12T10:00:00.000Z',
  currentStepId: 'safety_power_off',
  completedStepIds: [],
  stepInputs: {},
  status: 'in_progress',
};

const FIXTURE_PAYLOAD: LooseDiagnosticPayload = {
  templateId: 'washer',
  appointmentId: 'appt-1',
  fields: {
    'customer_complaint.complaint_tags': ['wont_spin'],
    'customer_complaint.error_codes': 'F22',
  },
  visitedStepKeys: ['complaint', 'functional', 'electrical'],
  currentStepKey: 'electrical',
  procedureRuns: {
    'w8178558-door-lock': SAMPLE_PROCEDURE_RUN,
  },
  activeProcedureId: 'w8178558-door-lock',
  timeline: [
    {
      at: '2026-03-12T10:00:00.000Z',
      stepKey: 'complaint',
      action: 'entered',
    },
  ],
  evidenceSnapshot: {
    matchedRuleCount: 2,
    capturedAt: '2026-03-12T10:00:00.000Z',
  },
  skippedOemWizardStep: false,
  oemRepairDecisionPending: null,
  oemRepairDecision: null,
};

function testHydrationPreservesNavigationAndPayload() {
  const session = hydrateDiagnosticSession({
    payload: FIXTURE_PAYLOAD,
    workOrder: {
      equipment_make: 'Whirlpool',
      equipment_model: 'WFW8300',
    },
    sessionId: 'test-session-1',
  });

  assert.equal(session.navigation.currentStepKey, 'electrical');
  assert.deepEqual(session.navigation.visitedStepKeys, ['complaint', 'functional', 'electrical']);
  assert.equal(session.payload.activeProcedureId, 'w8178558-door-lock');
  assert.equal(session.payload.procedureRuns['w8178558-door-lock'].status, 'in_progress');
  assert.equal(session.payload.timeline.length, 1);
  const snapshot = session.payload.evidenceSnapshot as { matchedRuleCount?: number };
  assert.equal(snapshot.matchedRuleCount, 2);
  assert.equal(session.appliance.manufacturer, 'Whirlpool');
  assert.equal(session.appliance.model, 'WFW8300');
  assert.equal(session.appliance.ontology, 'front_load_washer');
  assert.ok(session.symptoms.some((symptom) => symptom.id === 'wont_spin'));
  assert.ok(session.symptoms.some((symptom) => symptom.id === 'F22'));
  assert.equal(session.state.status, 'in_progress');
}

function testSerializeRoundTrip() {
  const session = hydrateDiagnosticSession({
    payload: FIXTURE_PAYLOAD,
    sessionId: 'test-session-2',
  });
  const serialized = serializeDiagnosticSession(session, FIXTURE_PAYLOAD);

  assert.equal(serialized.currentStepKey, 'electrical');
  assert.deepEqual(serialized.visitedStepKeys, ['complaint', 'functional', 'electrical']);
  assert.equal(serialized.activeProcedureId, 'w8178558-door-lock');
  assert.equal(serialized.procedureRuns?.['w8178558-door-lock']?.status, 'in_progress');
  assert.equal(serialized._diagnosticSessionId, 'test-session-2');
  assert.equal(serialized.templateId, 'washer');
}

function testNoteParseSerializeContract() {
  const payload = {
    ...FIXTURE_PAYLOAD,
    currentStepKey: 'mechanical',
    visitedStepKeys: ['complaint', 'oem_test', 'mechanical'],
  };

  const json = serializeDiagnosticNotePayload(payload);
  const parsed = parseDiagnosticNotePayload(json) as LooseDiagnosticPayload;

  assert.equal(parsed.currentStepKey, 'mechanical');
  assert.deepEqual(parsed.visitedStepKeys, ['complaint', 'oem_test', 'mechanical']);
  assert.equal(parsed.procedureRuns?.['w8178558-door-lock']?.status, 'in_progress');
  assert.equal(parsed.activeProcedureId, 'w8178558-door-lock');
}

function run() {
  testHydrationPreservesNavigationAndPayload();
  testSerializeRoundTrip();
  testNoteParseSerializeContract();
  console.log('hydrateSerialize.test.ts: all tests passed');
}

run();
