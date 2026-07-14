import refrigeratorTests from '../knowledge/tests/refrigerator.json';
import { buildTestsForTemplate } from './buildTestCatalogForTemplate';
import type { DiagnosticTestDefinition } from './evidenceTypes';

const HAND_CRAFTED_TESTS = new Map<string, DiagnosticTestDefinition[]>([
  ['refrigerator', refrigeratorTests as DiagnosticTestDefinition[]],
]);

const GENERATED_TEST_CACHE = new Map<string, DiagnosticTestDefinition[]>();

function testsForTemplate(templateId: string): DiagnosticTestDefinition[] {
  if (HAND_CRAFTED_TESTS.has(templateId)) {
    return HAND_CRAFTED_TESTS.get(templateId) || [];
  }

  const cached = GENERATED_TEST_CACHE.get(templateId);
  if (cached) return cached;

  const built = buildTestsForTemplate(templateId);
  GENERATED_TEST_CACHE.set(templateId, built);
  return built;
}

const ALL_TEMPLATE_IDS = [
  'refrigerator',
  'standalone_freezer',
  'washer',
  'electric_dryer',
  'gas_dryer',
  'stacked_laundry',
  'aio_laundry',
  'dishwasher',
  'microwave',
  'electric_range',
  'gas_range',
];

const ALL_TESTS: DiagnosticTestDefinition[] = ALL_TEMPLATE_IDS.flatMap((templateId) =>
  testsForTemplate(templateId),
);

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
