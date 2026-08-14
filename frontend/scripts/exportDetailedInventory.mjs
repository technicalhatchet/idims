/**
 * Batch 0 (rigorous) — detailed signal inventories for pattern authoring.
 * Generates per-template markdown with ID → label → source → type → values → routing/visibility → combinability.
 *
 * Run: node frontend/scripts/exportDetailedInventory.mjs [templateId ...]
 * Default: refrigerator, standalone_freezer
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');
const catalogPath = path.join(__dirname, '../../backend/app/data/diagnostic_template_catalog.json');
const outDir = path.join(root, 'components/diagnostics/knowledge/pattern-catalog');

const DEFAULT_TEMPLATES = ['refrigerator', 'standalone_freezer'];

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

const VISIBILITY_FILES = {
  refrigerator: 'refrigerator/refrigeratorFieldVisibility.ts',
  standalone_freezer: 'standalone_freezer/standaloneFreezerFieldVisibility.ts',
  gas_dryer: 'gas_dryer/gasDryerFieldVisibility.ts',
  electric_dryer: 'electric_dryer/electricDryerFieldVisibility.ts',
};

const ROUTING_FILES = {
  refrigerator: 'refrigerator/refrigeratorRouting.ts',
  standalone_freezer: 'standalone_freezer/standaloneFreezerRouting.ts',
  gas_dryer: 'gas_dryer/gasDryerRouting.ts',
  electric_dryer: 'electric_dryer/electricDryerRouting.ts',
};

const FIELD_BINDINGS_FILE = path.join(root, 'components/diagnostics/knowledge/fieldBindings.ts');

const FIELD_VALUE_HINTS = {
  yn: 'yes, no',
  tri: 'good, fair, bad',
  gb: 'good, bad',
  check: 'checked (checklist)',
  text: 'free text / numeric',
  textarea: 'free text',
};

function readComplaintChips(templateId) {
  const rel = COMPLAINT_FILES[templateId];
  if (!rel) return [];
  const src = fs.readFileSync(path.join(root, 'components/diagnostics', rel), 'utf8');
  const chips = [];
  const re = /id:\s*'([^']+)',?\s*\n\s*label:\s*(?:'([^']*)'|"([^"]*)")/g;
  let m;
  while ((m = re.exec(src)) !== null) {
    chips.push({ id: m[1], label: (m[2] || m[3] || '').replace(/\\'/g, "'") });
  }
  return chips;
}

function loadMeasurementKnowledge() {
  const seedDir = path.join(root, 'components/diagnostics/knowledge/seed');
  const byId = {};
  for (const f of fs.readdirSync(seedDir)) {
    if (!f.startsWith('measurement-knowledge')) continue;
    const arr = JSON.parse(fs.readFileSync(path.join(seedDir, f), 'utf8'));
    for (const m of arr) byId[m.id] = m;
  }
  return byId;
}

function readFieldBindingsForTemplate(templateId) {
  const src = fs.readFileSync(FIELD_BINDINGS_FILE, 'utf8');
  const map = {};
  const constNames = {
    refrigerator: 'REFRIGERATOR_FIELD_KNOWLEDGE',
    washer: 'WASHER_FIELD_KNOWLEDGE',
    electric_dryer: 'ELECTRIC_DRYER_FIELD_KNOWLEDGE',
    gas_dryer: 'GAS_DRYER_FIELD_KNOWLEDGE',
    stacked_laundry: 'STACKED_LAUNDRY_FIELD_KNOWLEDGE',
    aio_laundry: 'AIO_LAUNDRY_FIELD_KNOWLEDGE',
    dishwasher: 'DISHWASHER_FIELD_KNOWLEDGE',
    electric_range: 'ELECTRIC_RANGE_FIELD_KNOWLEDGE',
    gas_range: 'GAS_RANGE_FIELD_KNOWLEDGE',
    microwave: 'MICROWAVE_FIELD_KNOWLEDGE',
  };
  const constName = constNames[templateId];
  if (constName) {
    const constRe = new RegExp(`const ${constName}[^=]*=\\s*\\{([^}]+)\\}`, 's');
    const cm = constRe.exec(src);
    if (cm) {
      const pairRe = /'([^']+)':\s*'([^']+)'/g;
      let p;
      while ((p = pairRe.exec(cm[1])) !== null) map[p[1]] = p[2];
    }
  }
  const inlineRe = new RegExp(`${templateId}:\\s*\\{([^}]+)\\}`, 's');
  const inline = inlineRe.exec(src);
  if (inline) {
    const pairRe = /'([^']+)':\s*'([^']+)'/g;
    let p;
    while ((p = pairRe.exec(inline[1])) !== null) map[p[1]] = p[2];
  }
  return Object.entries(map).map(([fieldKey, knowledgeId]) => ({ fieldKey, knowledgeId }));
}

function readVisibilityRules(templateId) {
  const rel = VISIBILITY_FILES[templateId];
  if (!rel) return [];
  const src = fs.readFileSync(path.join(root, 'components/diagnostics', rel), 'utf8');
  const rules = [];
  const blockRe = /\{\s*id:\s*'([^']+)',?\s*field:\s*'([^']+)',?\s*showWhen:\s*\[([\s\S]*?)\],\s*\}/g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    const triggers = [];
    const chipRe = /\{\s*type:\s*'chip',\s*id:\s*'([^']+)'/g;
    const fieldRe = /\{\s*type:\s*'field',\s*path:\s*'([^']+)',?\s*equals:\s*'([^']+)'/g;
    let c;
    while ((c = chipRe.exec(m[3])) !== null) triggers.push(`chip:${c[1]}`);
    while ((c = fieldRe.exec(m[3])) !== null) triggers.push(`field:${c[1]}=${c[2]}`);
    rules.push({ id: m[1], field: m[2], triggers });
  }
  return rules;
}

function readRoutingChipEnables(templateId) {
  const rel = ROUTING_FILES[templateId];
  if (!rel) return [];
  const chipIds = readComplaintChips(templateId).map((c) => c.id);
  const src = fs.readFileSync(path.join(root, 'components/diagnostics', rel), 'utf8');
  const routes = [];
  const blockRe = /\{\s*id:\s*'([^']+)',?\s*label:\s*'([^']+)',?\s*when:\s*\[([\s\S]*?)\],\s*enable:\s*\[([\s\S]*?)\],/g;
  let m;
  while ((m = blockRe.exec(src)) !== null) {
    if (m[3].includes('type:')) continue;
    const whenChips = chipIds.filter((id) => m[3].includes(`'${id}'`));
    const enable = m[4].match(/'([^']+)'/g)?.map((s) => s.replace(/'/g, '')) || [];
    if (!whenChips.length) continue;
    routes.push({ id: m[1], label: m[2], whenChips, enable });
  }
  return routes;
}

function readElimination(templateId) {
  const file = path.join(root, `components/diagnostics/knowledge/elimination/${templateId}.json`);
  if (!fs.existsSync(file)) return { hypotheses: [], rules: [] };
  const j = JSON.parse(fs.readFileSync(file, 'utf8'));
  return { hypotheses: j.hypotheses || [], rules: j.rules || [] };
}

function readEvidence(templateId) {
  const file = path.join(root, `components/diagnostics/knowledge/evidence/${templateId}.json`);
  if (!fs.existsSync(file)) return [];
  return JSON.parse(fs.readFileSync(file, 'utf8')).rules || [];
}

function formatWhen(when) {
  if (!when) return '—';
  const clauses = Array.isArray(when) ? when : [when];
  return clauses
    .map((c) => {
      if (c.type === 'chip') return `chip:${c.id}`;
      if (c.type === 'field') return `field:${c.path}=${c.equals}`;
      if (c.type === 'measurement') return `measurement:${c.knowledgeId} in ${(c.statusIn || []).join('|')}`;
      if (c.type === 'test') return `test:${c.testId}`;
      return JSON.stringify(c);
    })
    .join(' AND ');
}

function formatRanges(m) {
  if (!m?.ranges) return '—';
  const parts = [];
  if (m.ranges.normal) {
    const n = m.ranges.normal;
    parts.push(`normal ${n.min ?? ''}-${n.max ?? ''}`);
  }
  if (m.ranges.warning) {
    const w = m.ranges.warning;
    parts.push(`warning ${w.min ?? ''}-${w.max ?? ''}`);
  }
  if (m.ranges.critical) {
    const c = m.ranges.critical;
    const bits = [];
    if (c.below != null) bits.push(`<${c.below}`);
    if (c.above != null) bits.push(`>${c.above}`);
    parts.push(`critical ${bits.join(' or ')}`);
  }
  return parts.join('; ') || '—';
}

function buildDetailedMarkdown(templateId, catalogTemplate, measurements) {
  const chips = readComplaintChips(templateId);
  const bindings = readFieldBindingsForTemplate(templateId);
  const visibility = readVisibilityRules(templateId);
  const routing = readRoutingChipEnables(templateId);
  const elim = readElimination(templateId);
  const evidence = readEvidence(templateId);

  const lines = [];
  lines.push(`# Signal inventory — ${templateId}`);
  lines.push('');
  lines.push('Batch 0 rigorous inventory. Every ID is from the repo. Regenerate: `node frontend/scripts/exportDetailedInventory.mjs`');
  lines.push('');
  lines.push('See also: [SIGNAL_INVENTORY.md](./SIGNAL_INVENTORY.md) (all templates), [PATTERN_CATALOG.md](./PATTERN_CATALOG.md) (Batch 1 drafts).');
  lines.push('');

  lines.push('## 1. Complaint signals');
  lines.push('');
  lines.push('| Signal ID | Label | Source | Type | Can combine? | Notes |');
  lines.push('|-----------|-------|--------|------|--------------|-------|');
  for (const c of chips) {
    lines.push(`| \`${c.id}\` | ${c.label} | \`${COMPLAINT_FILES[templateId]}\` | chip | Yes (multi-select) | |`);
  }
  lines.push('');
  lines.push('### Combinability');
  lines.push('');
  const comboNotes = [
    'Complaint chips are **multi-select** — any combination can be selected in the UI.',
    '',
    '**Common co-occurring clusters** (not enforced):',
    '- Cooling: `not_cooling` often pairs with section-specific weak cooling chips',
    '- Frost path: `frost_buildup` + cooling complaints',
    '',
    '**Semantic opposites** (UI allows both; interpret carefully):',
  ];
  if (templateId === 'standalone_freezer') {
    comboNotes.push('- `too_cold` vs `not_cooling`');
  }
  comboNotes.push('- Section weak cooling chips are **not** mutually exclusive');
  comboNotes.push('');
  comboNotes.push('**Elimination hypothesis `oppositeId` pairs** are true mutual exclusivity.');
  lines.push(comboNotes.join('\n'));
  lines.push('');

  if (routing.length) {
    lines.push('### Routing (chip → enabled wizard steps)');
    lines.push('');
    lines.push('| Route ID | When (chip keywords) | Enables stepKeys |');
    lines.push('|----------|----------------------|------------------|');
    for (const r of routing) {
      lines.push(`| \`${r.id}\` | ${r.whenChips.slice(0, 4).join(', ')}${r.whenChips.length > 4 ? '…' : ''} | ${r.enable.join(', ')} |`);
    }
    lines.push('');
  }

  lines.push('## 2. Wizard field signals');
  lines.push('');
  lines.push('| Field path | Label | Type | Values | Step / section | Visibility | Smart measurement |');
  lines.push('|------------|-------|------|--------|----------------|------------|-------------------|');
  for (const section of catalogTemplate.sections || []) {
    for (const f of section.fields || []) {
      const key = `${section.id}.${f.id}`;
      const bind = bindings.find((b) => b.fieldKey === key);
      const vis = visibility.find((v) => v.field === key);
      const visNote = vis ? `showWhen: ${vis.triggers.join(' OR ')}` : 'always when step enabled';
      const smart = bind ? `\`${bind.knowledgeId}\`` : '—';
      lines.push(
        `| \`${key}\` | ${f.label || f.id} | ${f.type} | ${FIELD_VALUE_HINTS[f.type] || f.type} | \`${section.id}\` | ${visNote} | ${smart} |`,
      );
    }
  }
  lines.push('');

  lines.push('## 3. Smart measurements');
  lines.push('');
  const knowledgeIds = new Set(bindings.map((b) => b.knowledgeId));
  for (const rule of elim.rules) {
    const w = rule.when;
    if (w?.type === 'measurement' && w.knowledgeId) knowledgeIds.add(w.knowledgeId);
  }
  lines.push('| Knowledge ID | Name | Unit | Normal | Warning | Critical | Bound field(s) | Status states |');
  lines.push('|--------------|------|------|--------|---------|----------|----------------|---------------|');
  for (const kid of [...knowledgeIds].sort()) {
    const m = measurements[kid];
    const bound = bindings.filter((b) => b.knowledgeId === kid).map((b) => b.fieldKey).join(', ') || '—';
    if (!m) {
      lines.push(`| \`${kid}\` | — | — | — | — | — | ${bound} | normal, warning, critical |`);
      continue;
    }
    lines.push(
      `| \`${kid}\` | ${m.name} | ${m.unit} | ${formatRanges(m).split(';')[0] || '—'} | ${(formatRanges(m).split(';')[1] || '—').trim()} | ${(formatRanges(m).split(';')[2] || '—').trim()} | ${bound} | normal, warning, critical |`,
    );
  }
  lines.push('');

  lines.push('## 4. Elimination suspects (Phase 5)');
  lines.push('');
  lines.push('| Hypothesis ID | Label | Category | Opposite |');
  lines.push('|---------------|-------|----------|----------|');
  for (const h of elim.hypotheses) {
    lines.push(`| \`${h.id}\` | ${h.label} | \`${h.category}\` | ${h.oppositeId ? `\`${h.oppositeId}\`` : '—'} |`);
  }
  lines.push('');
  lines.push('### Elimination triggers');
  lines.push('');
  lines.push('| Rule ID | Trigger | Eliminate | Confirm | Suspect |');
  lines.push('|---------|---------|-----------|---------|---------|');
  for (const r of elim.rules) {
    const trigger = formatWhen(r.when);
    lines.push(
      `| \`${r.id}\` | ${trigger} | ${(r.eliminate || []).map((x) => `\`${x}\``).join(', ') || '—'} | ${(r.confirm || []).map((x) => `\`${x}\``).join(', ') || '—'} | ${(r.suspect || []).map((x) => `\`${x}\``).join(', ') || '—'} |`,
    );
  }
  lines.push('');

  // Shared triggers analysis
  const triggerToRules = {};
  for (const r of elim.rules) {
    const t = formatWhen(r.when);
    if (!triggerToRules[t]) triggerToRules[t] = [];
    triggerToRules[t].push(r.id);
  }
  const shared = Object.entries(triggerToRules).filter(([, ids]) => ids.length >= 2);
  if (shared.length) {
    lines.push('### Triggers shared by 2+ elimination rules');
    lines.push('');
    for (const [t, ids] of shared) {
      lines.push(`- **${t}** → ${ids.map((id) => `\`${id}\``).join(', ')}`);
    }
    lines.push('');
  }

  lines.push('## 5. Existing evidence rules');
  lines.push('');
  const multi = evidence.filter((r) => r.when?.length > 1);
  const single = evidence.filter((r) => r.when?.length === 1);
  lines.push(`Total: **${evidence.length}** (${single.length} single-signal, ${multi.length} multi-signal).`);
  lines.push('');
  lines.push('| Rule ID | When | Target | Layer | Effect | Multi? |');
  lines.push('|---------|------|--------|-------|--------|--------|');
  for (const r of evidence) {
    const effect = r.effect?.effect === 'increase' ? `+${r.effect.value}` : r.effect?.effect || '—';
    lines.push(
      `| \`${r.id}\` | ${formatWhen(r.when)} | \`${r.target}\` | ${r.targetLayer || '—'} | ${effect} | ${r.when?.length > 1 ? '**yes**' : 'no'} |`,
    );
  }
  lines.push('');
  if (multi.length) {
    lines.push('### Existing multi-signal rules (do not duplicate)');
    lines.push('');
    for (const r of multi) {
      lines.push(`- \`${r.id}\`: ${formatWhen(r.when)} → \`${r.target}\` (${r.explanation || ''})`);
    }
    lines.push('');
  }

  return lines.join('\n');
}

const templates = process.argv.slice(2).length ? process.argv.slice(2) : DEFAULT_TEMPLATES;
const catalog = JSON.parse(fs.readFileSync(catalogPath, 'utf8'));
const measurements = loadMeasurementKnowledge();

fs.mkdirSync(outDir, { recursive: true });

for (const tid of templates) {
  const t = catalog.find((c) => c.id === tid);
  if (!t) {
    console.warn(`Skip unknown template: ${tid}`);
    continue;
  }
  const md = buildDetailedMarkdown(tid, t, measurements);
  const out = path.join(outDir, `INVENTORY_${tid.toUpperCase()}.md`);
  fs.writeFileSync(out, md);
  console.log(`Wrote ${out}`);
}
