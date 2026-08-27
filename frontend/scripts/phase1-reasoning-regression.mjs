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
const { formatDiyLeadCard } = require(
  path.join(root, 'components/diagnostics/intelligence/evidenceDisplay.ts'),
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

const sheetPresentation = buildReasoningPresentation(intelligence, {}, {
  templateId,
  fields,
  measurementStatuses,
  layout: 'sheet',
});

const failures = [];

function assert(name, condition, detail = '') {
  if (!condition) failures.push(`${name}: ${detail}`);
}

assert('sheet presentation built', sheetPresentation !== null);
assert(
  'no percent share in sheet lead',
  !sheetPresentation?.evidenceSummary.lines.some((line) => /% of active evidence/.test(line.text)),
);
assert('diy lead card has percent', formatDiyLeadCard(intelligence)?.percent > 0);
assert('why is single synthesis', sheetPresentation?.whyTop.lines.length === 1);
assert(
  'why no so far duplication',
  !sheetPresentation?.whyTop.lines.some((line) => line.text.startsWith('So far:')),
);
assert('supporting collapsed', sheetPresentation?.supporting.defaultOpen === false);
assert('why this test single line', sheetPresentation?.whyThisTest.lines.length <= 1);
assert(
  'c3 renamed',
  sheetPresentation?.proveWrong.title === 'What would change my mind?',
);
assert(
  'inline lead empty in sheet mode',
  sheetPresentation?.evidenceSummary.lines.length === 0,
);

if (failures.length) {
  console.error('FAILURES:');
  failures.forEach((f) => console.error('  -', f));
  process.exit(1);
}

console.log('Phase 1 reasoning regression: PASS');
console.log('DIY card:', formatDiyLeadCard(intelligence)?.percent, formatDiyLeadCard(intelligence)?.strengthWord);
console.log('Why:', sheetPresentation.whyTop.lines[0]?.text?.slice(0, 100));
console.log('Why test:', sheetPresentation.whyThisTest.lines[0]?.text?.slice(0, 100));
