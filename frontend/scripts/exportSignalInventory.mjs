/**
 * Batch 0 — export available diagnostic signals per template for multi-signal pattern work.
 * Run: node frontend/scripts/exportSignalInventory.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const catalogPath = path.join(__dirname, '../../backend/app/data/diagnostic_template_catalog.json');
const outPath = path.join(root, 'components/diagnostics/knowledge/pattern-catalog/SIGNAL_INVENTORY.md');

const TEMPLATE_IDS = [
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

const COMPLAINT_FILES = {
  refrigerator: 'refrigerator/refrigeratorComplaints.ts',
  standalone_freezer: 'standalone_freezer/standaloneFreezerComplaints.ts',
  washer: 'washer/washerComplaints.ts',
  electric_dryer: 'electric_dryer/electricDryerComplaints.ts',
  gas_dryer: 'gas_dryer/gasDryerComplaints.ts',
  stacked_laundry: 'stacked_laundry/stackedLaundryComplaints.ts',
  aio_laundry: 'aio_laundry/aioLaundryComplaints.ts',
  dishwasher: 'dishwasher/dishwasherComplaints.ts',
  microwave: 'microwave/microwaveComplaints.ts',
  electric_range: 'electric_range/electricRangeComplaints.ts',
  gas_range: 'gas_range/gasRangeComplaints.ts',
};

const WIZARD_FILES = {
  refrigerator: 'refrigerator/refrigeratorWizard.ts',
  standalone_freezer: 'standalone_freezer/standaloneFreezerWizard.ts',
  washer: 'washer/washerWizard.ts',
  electric_dryer: 'electric_dryer/electricDryerWizard.ts',
  gas_dryer: 'gas_dryer/gasDryerWizard.ts',
  stacked_laundry: 'stacked_laundry/stackedLaundryWizard.ts',
  aio_laundry: 'aio_laundry/aioLaundryWizard.ts',
  dishwasher: 'dishwasher/dishwasherWizard.ts',
  microwave: 'microwave/microwaveWizard.ts',
  electric_range: 'electric_range/electricRangeWizard.ts',
  gas_range: 'gas_range/gasRangeWizard.ts',
};

function readComplaintChips(templateId) {
  const rel = COMPLAINT_FILES[templateId];
  if (!rel) return [];
  const file = path.join(root, 'components/diagnostics', rel);
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, 'utf8');
  const chips = [];
  const re = /id:\s*'([^']+)',?\s*\n\s*label:\s*(?:'([^']*)'|"([^"]*)")/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    const label = (m[2] || m[3] || '').replace(/\\'/g, "'");
    chips.push({ id: m[1], label });
  }
  return chips;
}

function readFieldBindings() {
  const file = path.join(root, 'components/diagnostics/knowledge/fieldBindings.ts');
  const src = fs.readFileSync(file, 'utf8');
  const byTemplate = {};
  const blockRe = /const (\w+)_FIELD_KNOWLEDGE[^=]*=\s*\{([^}]+)\}/gs;
  const standaloneRe = /standalone_freezer:\s*\{([^}]+)\}/s;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    const name = m[1].toLowerCase().replace(/_/g, '_');
    const map = parseBindingBlock(m[2]);
    const templateKey = name.replace('_field_knowledge', '').replace(/_/g, '_');
    const idMap = {
      refrigerator: 'refrigerator',
      washer: 'washer',
      electric_dryer: 'electric_dryer',
      gas_dryer: 'gas_dryer',
      stacked_laundry: 'stacked_laundry',
      aio_laundry: 'aio_laundry',
      dishwasher: 'dishwasher',
      electric_range: 'electric_range',
      gas_range: 'gas_range',
      microwave: 'microwave',
    };
    const tid = idMap[templateKey] || templateKey;
    if (tid && TEMPLATE_IDS.includes(tid)) byTemplate[tid] = map;
  }
  const standalone = standaloneRe.exec(src);
  if (standalone) byTemplate.standalone_freezer = parseBindingBlock(standalone[1]);
  return byTemplate;
}

function parseBindingBlock(block) {
  const entries = [];
  const re = /'([^']+)':\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(block)) !== null) {
    entries.push({ fieldKey: m[1], knowledgeId: m[2] });
  }
  return entries;
}

function readEvidenceMeta(templateId) {
  const file = path.join(root, `components/diagnostics/knowledge/evidence/${templateId}.json`);
  if (!fs.existsSync(file)) return { categories: [], components: [], multiSignalRules: 0, rules: 0 };
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const multi = (j.rules || []).filter((r) => r.when && r.when.length > 1).length;
  return {
    categories: (j.categories || []).map((c) => c.id),
    components: (j.components || []).map((c) => c.id),
    multiSignalRules: multi,
    rules: (j.rules || []).length,
  };
}

function readWizardSteps(templateId) {
  const rel = WIZARD_FILES[templateId];
  if (!rel) return [];
  const file = path.join(root, 'components/diagnostics', rel);
  if (!fs.existsSync(file)) return [];
  const src = fs.readFileSync(file, 'utf8');
  const steps = [];
  const re = /stepKey:\s*'([^']+)'/g;
  let m;
  while ((m = re.exec(src)) !== null) steps.push(m[1]);
  return [...new Set(steps)];
}

function readEliminationSignals(templateId) {
  const file = path.join(root, `components/diagnostics/knowledge/elimination/${templateId}.json`);
  if (!fs.existsSync(file)) return { fieldPaths: [], knowledgeIds: [] };
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  const fieldPaths = new Set();
  const knowledgeIds = new Set();
  for (const rule of j.rules || []) {
    const w = rule.when;
    if (!w) continue;
    if (w.type === 'field' && w.path) fieldPaths.add(w.path);
    if (w.type === 'measurement' && w.knowledgeId) knowledgeIds.add(w.knowledgeId);
  }
  return {
    fieldPaths: [...fieldPaths].sort(),
    knowledgeIds: [...knowledgeIds].sort(),
  };
}

function fieldTypeGroup(type) {
  if (type === 'number' || type === 'measurement') return 'measurement';
  if (type === 'yn' || type === 'tri' || type === 'chip') return 'observation';
  if (type === 'check') return 'checklist';
  if (type === 'text' || type === 'textarea') return 'text';
  return type || 'other';
}

function buildMarkdown(catalog, bindings, meta) {
  const lines = [];
  lines.push('# Diagnostic signal inventory (Batch 0)');
  lines.push('');
  lines.push('Reference for **multi-signal pattern** authoring. Evidence rules use **AND** logic: every clause in `when` must match.');
  lines.push('');
  lines.push('## Signal types');
  lines.push('');
  lines.push('| Type | Evidence `when` clause | Notes |');
  lines.push('|------|------------------------|-------|');
  lines.push('| Complaint chip | `{ "type": "chip", "id": "<chip_id>" }` | From complaint step tags |');
  lines.push('| Field observation | `{ "type": "field", "path": "<section>.<field>", "equals": "<value>" }` | yn/tri/chip values: `yes`/`no`, `good`/`bad`, etc. |');
  lines.push('| Smart measurement | `{ "type": "measurement", "knowledgeId": "<id>", "statusIn": ["normal","warning","critical"] }` | Auto-evaluated numeric fields |');
  lines.push('| Test filled | `{ "type": "test", "testId": "<id>", "filled": true }` | From test catalog |');
  lines.push('');
  lines.push('## Templates overview');
  lines.push('');
  lines.push('| Template | Chips | Wizard steps | Fields | Smart measurements | Evidence rules | Multi-signal rules |');
  lines.push('|----------|-------|----------------|--------|--------------------|--------------|-------------------|');
  for (const tid of TEMPLATE_IDS) {
    const t = catalog.find((c) => c.id === tid);
    const chips = readComplaintChips(tid);
    const steps = readWizardSteps(tid);
    const fieldCount = t ? t.sections.reduce((n, s) => n + (s.fields?.length || 0), 0) : 0;
    const smart = (bindings[tid] || []).length;
    const ev = meta[tid];
    lines.push(
      `| ${tid} | ${chips.length} | ${steps.length} | ${fieldCount} | ${smart} | ${ev.rules} | ${ev.multiSignalRules} |`,
    );
  }
  lines.push('');
  lines.push('---');
  lines.push('');

  for (const tid of TEMPLATE_IDS) {
    const t = catalog.find((c) => c.id === tid);
    if (!t) continue;
    const chips = readComplaintChips(tid);
    const steps = readWizardSteps(tid);
    const ev = meta[tid];
    const smart = bindings[tid] || [];

    lines.push(`## ${tid}`);
    lines.push('');
    lines.push(`**Evidence categories:** ${ev.categories.join(', ') || '—'}`);
    lines.push('');
    if (ev.components.length) {
      lines.push(`**Components:** ${ev.components.join(', ')}`);
      lines.push('');
    }

    lines.push('### Wizard steps (`recommendStepKey`)');
    lines.push('');
    for (const s of steps) lines.push(`- \`${s}\``);
    lines.push('');

    lines.push('### Complaint chips');
    lines.push('');
    if (!chips.length) lines.push('_None_');
    for (const c of chips) lines.push(`- \`${c.id}\` — ${c.label}`);
    lines.push('');

    lines.push('### Fields by section');
    lines.push('');
    for (const section of t.sections || []) {
      lines.push(`#### ${section.id} — ${section.title || section.id}`);
      lines.push('');
      if (!section.fields?.length) {
        lines.push('_No fields_');
        lines.push('');
        continue;
      }
      for (const f of section.fields) {
        const key = `${section.id}.${f.id}`;
        const smartBind = smart.find((b) => b.fieldKey === key);
        const smartNote = smartBind ? ` → **${smartBind.knowledgeId}**` : '';
        lines.push(`- \`${key}\` (${f.type}) — ${f.label || f.id}${smartNote}`);
      }
      lines.push('');
    }

    const elim = readEliminationSignals(tid);
    if (elim.fieldPaths.length || elim.knowledgeIds.length) {
      lines.push('### Elimination rule signals (Phase 5)');
      lines.push('');
      if (elim.fieldPaths.length) {
        lines.push('**Field paths:**');
        for (const p of elim.fieldPaths) lines.push(`- \`${p}\``);
        lines.push('');
      }
      if (elim.knowledgeIds.length) {
        lines.push('**Measurement knowledge IDs:**');
        for (const k of elim.knowledgeIds) lines.push(`- \`${k}\``);
        lines.push('');
      }
    }

    if (smart.length) {
      lines.push('### Smart measurement bindings');
      lines.push('');
      lines.push('| Field key | Knowledge ID |');
      lines.push('|-----------|--------------|');
      for (const b of smart) {
        lines.push(`| \`${b.fieldKey}\` | \`${b.knowledgeId}\` |`);
      }
      lines.push('');
    }

    lines.push('### Pattern authoring notes');
    lines.push('');
    lines.push('- Combine chips + fields + measurements in one rule `when` array (AND).');
    lines.push('- Prefer `statusIn` on measurements over raw field equals for temps/ohms/amps.');
    lines.push(`- Existing multi-signal rules in evidence JSON: **${ev.multiSignalRules}**`);
    lines.push('');
    lines.push('---');
    lines.push('');
  }

  lines.push('## Next: Batch 1 pattern catalog');
  lines.push('');
  lines.push('Draft multi-signal rows in [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (refrigerator + standalone_freezer).');
  lines.push('Rigorous per-template inventories: `INVENTORY_<TEMPLATE>.md` via `exportDetailedInventory.mjs`.');
  lines.push('Only use signal IDs listed above.');
  lines.push('');

  return lines.join('\n');
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const bindings = readFieldBindings();
const meta = Object.fromEntries(TEMPLATE_IDS.map((id) => [id, readEvidenceMeta(id)]));
const md = buildMarkdown(catalog, bindings, meta);

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
