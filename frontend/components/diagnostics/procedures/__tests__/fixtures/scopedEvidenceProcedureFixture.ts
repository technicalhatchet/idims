import type { ProcedureRunState, ServiceProcedure } from '../../types';

const BASE_SOURCE = {
  manualId: 'FIXTURE-MANUAL',
  manualTitle: 'Fixture manual',
  oemTestNumber: '1',
  oemTestTitle: 'Fixture test',
  pages: [1],
};

/** Isolated procedure — not production W8178558 seed. */
export const SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE: ServiceProcedure = {
  id: 'fixture-scoped-drain-pump-path',
  version: '1.0.0',
  title: 'Fixture: load vs path drain test',
  platformId: 'fixture_platform_washer',
  componentIds: ['drain_pump'],
  source: BASE_SOURCE,
  entryStepId: 'pump_at_component',
  steps: [
    {
      id: 'pump_at_component',
      order: 1,
      type: 'measurement',
      title: 'Drain pump at component',
      measurementKnowledgeId: 'fixtureDrainPumpOhms',
      testPoint: {
        connector: 'Drain pump',
        pins: '1 & 2',
        label: 'At component',
      },
      measurementContext: {
        scope: 'at_load',
        loadInCircuit: false,
      },
      requiresInput: true,
      branches: [],
    },
    {
      id: 'pump_at_control_connector',
      order: 2,
      type: 'measurement',
      title: 'Drain pump at control connector',
      measurementKnowledgeId: 'fixtureDrainPumpOhms',
      testPoint: {
        connector: 'CTRL1',
        pins: '1 & 2',
        label: 'At control connector',
      },
      measurementContext: {
        scope: 'at_control_connector',
        loadInCircuit: true,
        disconnectHints: ['CTRL1@control'],
      },
      requiresInput: true,
      branches: [],
    },
    {
      id: 'replace_pump_or_harness',
      order: 3,
      type: 'outcome',
      title: 'Replace pump or harness',
      oemOutcome: 'Pump good at component but fault at connector — replace pump or harness.',
      requiresInput: false,
    },
    {
      id: 'replace_pump',
      order: 4,
      type: 'outcome',
      title: 'Replace drain pump',
      oemOutcome: 'Replace drain pump when open at component.',
      requiresInput: false,
    },
    {
      id: 'pump_verified',
      order: 5,
      type: 'outcome',
      title: 'Drain pump verified',
      oemOutcome: 'Pump and path verified.',
      requiresInput: false,
    },
  ],
};

export const OTHER_PLATFORM_SCOPED_PROCEDURE: ServiceProcedure = {
  id: 'fixture-other-platform-motor-path',
  version: '1.0.0',
  title: 'Fixture: motor path on another platform',
  platformId: 'fixture_platform_dryer',
  componentIds: ['drive_motor'],
  source: BASE_SOURCE,
  entryStepId: 'motor_at_component',
  steps: [
    {
      id: 'motor_at_component',
      order: 1,
      type: 'measurement',
      title: 'Motor at component',
      requiresInput: true,
      branches: [],
      measurementContext: { scope: 'at_load', loadInCircuit: false },
    },
    {
      id: 'motor_at_control_connector',
      order: 2,
      type: 'measurement',
      title: 'Motor at control connector',
      requiresInput: true,
      branches: [],
      testPoint: { connector: 'MTR1', pins: '1 & 2', label: 'Control' },
      measurementContext: { scope: 'at_control_connector', loadInCircuit: true },
    },
    {
      id: 'replace_motor_or_harness',
      order: 3,
      type: 'outcome',
      title: 'Replace motor or harness',
      requiresInput: false,
    },
  ],
};

function baseRun(overrides: Partial<ProcedureRunState>): ProcedureRunState {
  return {
    procedureId: SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE.id,
    version: '1.0.0',
    startedAt: '2026-03-28T12:00:00.000Z',
    currentStepId: 'replace_pump_or_harness',
    completedStepIds: ['pump_at_component', 'pump_at_control_connector'],
    stepInputs: {},
    status: 'completed',
    ...overrides,
  };
}

export function fixtureRunComponentGoodPathOpen(): ProcedureRunState {
  return baseRun({
    currentStepId: 'replace_pump_or_harness',
    oemOutcome: SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE.steps.find(
      (s) => s.id === 'replace_pump_or_harness',
    )?.oemOutcome,
    stepEvaluations: {
      pump_at_component: {
        knowledgeId: 'fixtureDrainPumpOhms',
        rawInput: '12.3',
        parsedValue: 12.3,
        unit: 'Ω',
        evaluation: { status: 'normal', message: 'In range' },
        evaluatedAt: '2026-03-28T12:01:00.000Z',
        context: {
          testPoint: SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE.steps[0].testPoint,
          measurementContext: SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE.steps[0].measurementContext,
        },
      },
      pump_at_control_connector: {
        knowledgeId: 'fixtureDrainPumpOhms',
        rawInput: 'OL',
        parsedValue: null,
        unit: 'Ω',
        evaluation: { status: 'critical', message: 'Open' },
        evaluatedAt: '2026-03-28T12:02:00.000Z',
        context: {
          testPoint: SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE.steps[1].testPoint,
          measurementContext: SCOPED_DRAIN_PUMP_FIXTURE_PROCEDURE.steps[1].measurementContext,
        },
      },
    },
    appliedDiagnosticEffects: [
      {
        stepId: 'pump_at_component',
        branchId: 'pass',
        at: '2026-03-28T12:01:00.000Z',
        effects: [{
          type: 'eliminate',
          componentId: 'drain_pump',
          assertion: 'component_verified',
          measurementScope: 'at_load',
        }],
      },
      {
        stepId: 'pump_at_control_connector',
        branchId: 'open',
        at: '2026-03-28T12:02:00.000Z',
        effects: [{
          type: 'confirm',
          componentId: 'drain_pump',
          assertion: 'path_open',
          measurementScope: 'at_control_connector',
          testPointKey: 'pump_at_control_connector:CTRL1:1 & 2',
        }],
      },
    ],
  });
}

export function fixtureRunComponentOpenAtLoad(): ProcedureRunState {
  return baseRun({
    currentStepId: 'replace_pump',
    completedStepIds: ['pump_at_component'],
    appliedDiagnosticEffects: [{
      stepId: 'pump_at_component',
      branchId: 'open',
      at: '2026-03-28T12:01:00.000Z',
      effects: [{
        type: 'confirm',
        componentId: 'drain_pump',
        assertion: 'component_failed',
        measurementScope: 'at_load',
        evidenceId: 'confirm_drain_pump_ol_drain_pump_failed',
      }],
    }],
  });
}

export function fixtureRunBothGood(): ProcedureRunState {
  return baseRun({
    currentStepId: 'pump_verified',
    appliedDiagnosticEffects: [
      {
        stepId: 'pump_at_component',
        at: '2026-03-28T12:01:00.000Z',
        effects: [{
          type: 'eliminate',
          componentId: 'drain_pump',
          assertion: 'component_verified',
          measurementScope: 'at_load',
        }],
      },
      {
        stepId: 'pump_at_control_connector',
        at: '2026-03-28T12:02:00.000Z',
        effects: [{
          type: 'eliminate',
          componentId: 'drain_pump',
          assertion: 'path_verified',
          measurementScope: 'at_control_connector',
        }],
      },
    ],
  });
}

export function fixtureRunContradicted(): ProcedureRunState {
  return baseRun({
    currentStepId: 'replace_pump',
    appliedDiagnosticEffects: [
      {
        stepId: 'pump_at_component',
        at: '2026-03-28T12:01:00.000Z',
        effects: [{
          type: 'eliminate',
          componentId: 'drain_pump',
          assertion: 'component_verified',
          measurementScope: 'at_load',
        }],
      },
      {
        stepId: 'pump_at_component',
        at: '2026-03-28T12:02:00.000Z',
        effects: [{
          type: 'confirm',
          componentId: 'drain_pump',
          assertion: 'component_failed',
          measurementScope: 'at_load',
        }],
      },
    ],
  });
}

export function fixtureRunPathOpenWithoutLoadInCircuit(): ProcedureRunState {
  return baseRun({
    currentStepId: 'replace_pump_or_harness',
    appliedDiagnosticEffects: [{
      stepId: 'pump_at_control_connector',
      at: '2026-03-28T12:02:00.000Z',
      effects: [{
        type: 'confirm',
        componentId: 'drain_pump',
        assertion: 'path_open',
        measurementScope: 'at_control_connector',
      }],
    }],
    stepEvaluations: {
      pump_at_control_connector: {
        knowledgeId: 'fixtureDrainPumpOhms',
        rawInput: 'OL',
        parsedValue: null,
        unit: 'Ω',
        evaluation: { status: 'critical', message: 'Open' },
        evaluatedAt: '2026-03-28T12:02:00.000Z',
        context: {
          measurementContext: { scope: 'at_control_connector' },
        },
      },
    },
  });
}

export function fixtureRunLegacyUnscopedConfirm(): ProcedureRunState {
  return baseRun({
    currentStepId: 'replace_pump',
    completedStepIds: ['pump_at_component'],
    appliedDiagnosticEffects: [{
      stepId: 'pump_at_component',
      at: '2026-03-28T12:01:00.000Z',
      effects: [{
        type: 'confirm',
        componentId: 'drain_pump',
        evidenceId: 'confirm_drain_pump_ol_drain_pump_failed',
      }],
    }],
    stepEvaluations: {
      pump_at_component: {
        knowledgeId: 'fixtureDrainPumpOhms',
        rawInput: 'OL',
        parsedValue: null,
        unit: 'Ω',
        evaluation: { status: 'critical', message: 'Open' },
        evaluatedAt: '2026-03-28T12:01:00.000Z',
      },
    },
  });
}
