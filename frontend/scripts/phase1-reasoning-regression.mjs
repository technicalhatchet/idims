/**
 * Phase 1 reasoning presentation regression checks (presentation layer only).
 * Run: npx tsx scripts/phase1-reasoning-regression.mjs
 */
import path from 'path';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

const { evaluateDiagnosticIntelligence } = require(
  path.join(root, 'components/diagnostics/intelligence/diagnosticIntelligenceEngine.ts'),
);
const { buildMeasurementStatusMap } = require(
  path.join(root, 'components/diagnostics/knowledge/measurementContext.ts'),
);
const { buildReasoningPresentation } = require(
  path.join(root, 'components/solomon/reasoning/reasoningPresentation.ts'),
);

const templateId = 'refrigerator';
const fields = {
  'customer_complaint.complaint_tags': ['not_cooling'],
  freezer_temp: 'warm',
  fresh_food_temp: 'warm',
};

const measurementStatuses = buildMeasurementStatusMap(templateId, fields);
const intelligence = evaluateDiagnosticIntelligence(
  templateId,
  fields,
  measurementStatuses,
  {
    visitedStepKeys: ['complaint', 'preChecks', 'temperature'],
    defaultStepOrder: ['complaint', 'preChecks', 'temperature', 'visual', 'fans', 'defrost'],
    complaintChips: [],
    dmaNudges: null,
    fieldLabels: {},
    stepKeyLabels: {},
  },
);

const presentation = buildReasoningPresentation(intelligence, {}, {
  templateId,
  fields,
  measurementStatuses,
});

if (!presentation) {
  console.error('presentation is null — intelligence topCategories:', intelligence?.topCategories?.length);
  process.exit(1);
}

const failures = [];

function assert(name, condition, detail = '') {
  if (!condition) failures.push(`${name}: ${detail}`);
}

assert('presentation built', presentation !== null);
assert('lead cause title', presentation?.evidenceSummary.title === 'Lead cause');
assert(
  'no percent shares',
  !presentation?.evidenceSummary.lines.some((line) => /% of active evidence/.test(line.text)),
);
assert(
  'tier label present',
  presentation?.evidenceSummary.lines.some((line) =>
    ['Early lead', 'Trending lead', 'Strong lead', 'Confirmed fault path'].includes(line.text),
  ),
);
assert(
  'evidence score preserved',
  presentation?.evidenceSummary.lines.some((line) => /Evidence score \d+/.test(line.text)),
);
assert('why is synthesis not full ledger', presentation?.whyTop.lines.length <= 3);
assert('supporting collapsed by default', presentation?.supporting.defaultOpen === false);
assert('why this test tied to steps', presentation?.whyThisTest.lines.length > 0);
const whyTestTexts = presentation?.whyThisTest.lines.map((line) => line.text).join(' ');
assert(
  'why this test not generic only',
  !whyTestTexts.includes('Next guided step to sharpen'),
);
assert('prove wrong from rules', presentation?.proveWrong.lines.length > 0);
assert(
  'prove wrong not only templated',
  !presentation?.proveWrong.lines.every((line) =>
    line.text.includes('If this step contradicts') || line.text.includes('reconsider the lead'),
  ),
);
const triggerCount =
  presentation?.supporting.lines.filter((line) => line.triggerText).length
  + presentation?.whyThisTest.lines.filter((line) => line.triggerText).length;
assert('trigger context on ledger', triggerCount > 0, `found ${triggerCount}`);

if (failures.length) {
  console.error('FAILURES:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}

console.log('Phase 1 reasoning regression: PASS');
console.log('Lead:', presentation.evidenceSummary.lines[0]?.label, presentation.evidenceSummary.lines[0]?.text);
console.log('Why?:', presentation.whyTop.lines.map((l) => l.text).join(' | '));
console.log('Why this test sample:', presentation.whyThisTest.lines[0]?.text?.slice(0, 120));
console.log('Prove wrong sample:', presentation.proveWrong.lines[0]?.text?.slice(0, 120));
console.log('Supporting triggers:', triggerCount);
