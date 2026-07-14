import refrigeratorTests from '../knowledge/tests/refrigerator.json';
import type { DiagnosticTestDefinition } from './evidenceTypes';

const ALL_TESTS: DiagnosticTestDefinition[] = [
  ...(refrigeratorTests as DiagnosticTestDefinition[]),
];

const TESTS_BY_ID = new Map<string, DiagnosticTestDefinition>(
  ALL_TESTS.map((test) => [test.testId, test]),
);

const TESTS_BY_TEMPLATE = new Map<string, DiagnosticTestDefinition[]>();
for (const test of ALL_TESTS) {
  const list = TESTS_BY_TEMPLATE.get(test.templateId) || [];
  list.push(test);
  TESTS_BY_TEMPLATE.set(test.templateId, list);
}

export function getDiagnosticTest(testId: string): DiagnosticTestDefinition | null {
  return TESTS_BY_ID.get(testId) || null;
}

export function listDiagnosticTests(templateId?: string): DiagnosticTestDefinition[] {
  if (!templateId) return [...ALL_TESTS];
  return TESTS_BY_TEMPLATE.get(templateId) || [];
}

export function getTestsForCategory(
  templateId: string,
  categoryId: string,
  evidenceConfig?: { rules: Array<{ target: string; targetLayer: string; recommendStepKey?: string }> },
): DiagnosticTestDefinition[] {
  const tests = listDiagnosticTests(templateId);
  if (!evidenceConfig?.rules?.length) return tests;

  const stepKeys = new Set<string>();
  for (const rule of evidenceConfig.rules) {
    if (rule.target === categoryId && rule.targetLayer === 'category' && rule.recommendStepKey) {
      stepKeys.add(rule.recommendStepKey);
    }
  }
  if (!stepKeys.size) return tests;

  return tests.filter((t) => t.wizardStepKey && stepKeys.has(t.wizardStepKey));
}
