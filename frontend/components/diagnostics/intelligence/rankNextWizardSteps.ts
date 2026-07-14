import { listDiagnosticTests } from './testCatalog';
import type { CategoryEvidenceScore, EvidenceConfig, EvidenceRule } from './evidenceTypes';

export function rankNextWizardSteps(args: {
  config: EvidenceConfig;
  matchedRules: EvidenceRule[];
  topCategories: CategoryEvidenceScore[];
  visitedStepKeys: string[];
  defaultStepOrder: string[];
}): string[] {
  const { config, matchedRules, topCategories, visitedStepKeys, defaultStepOrder } = args;
  const visited = new Set(visitedStepKeys);
  const scores = new Map<string, number>();

  const bump = (stepKey: string, weight: number) => {
    if (!stepKey || visited.has(stepKey)) return;
    scores.set(stepKey, (scores.get(stepKey) || 0) + weight);
  };

  for (const rule of matchedRules) {
    if (rule.recommendStepKey) {
      bump(rule.recommendStepKey, 100);
    }
  }

  const topCategoryId = topCategories[0]?.id;
  if (topCategoryId) {
    const tests = listDiagnosticTests(config.templateId);
    for (const test of tests) {
      if (!test.wizardStepKey) continue;
      const relatedRules = config.rules.filter(
        (r) => r.target === topCategoryId && r.targetLayer === 'category',
      );
      if (relatedRules.some((r) => r.recommendStepKey === test.wizardStepKey)) {
        bump(test.wizardStepKey, 50);
      }
    }
  }

  const ranked = [...scores.entries()]
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      const ia = defaultStepOrder.indexOf(a[0]);
      const ib = defaultStepOrder.indexOf(b[0]);
      const pa = ia === -1 ? 999 : ia;
      const pb = ib === -1 ? 999 : ib;
      return pa - pb;
    })
    .map(([stepKey]) => stepKey);

  return ranked;
}
