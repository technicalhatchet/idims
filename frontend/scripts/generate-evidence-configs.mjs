/**
 * One-shot generator: elimination JSON → Phase 6 evidence JSON (fridge-style richness).
 * Run: node scripts/generate-evidence-configs.mjs
 * Skips refrigerator (hand-authored pilot). Overwrites other template evidence files.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const ELIM_DIR = path.join(ROOT, 'components/diagnostics/knowledge/elimination');
const OUT_DIR = path.join(ROOT, 'components/diagnostics/knowledge/evidence');

const SKIP = new Set(['refrigerator']);

const SECTION_STEPS = {
  standalone_freezer: {
    temperature_checks: 'temperature',
    visual_inspection: 'visual',
    functional_checks: 'functional',
    defrost_circuit: 'defrost',
    compressor_sealed_system: 'sealedSystem',
    fans_and_electrical: 'fans',
  },
  washer: {
    visual_inspection: 'visual',
    functional_checks: 'functional',
    electrical_measurements: 'electrical',
    mechanical_controls: 'mechanical',
  },
  electric_dryer: {
    visual_inspection: 'visual',
    functional_checks: 'functional',
    heat_circuit: 'heat',
    motor_electrical: 'motor',
  },
  gas_dryer: {
    visual_inspection: 'visual',
    functional_checks: 'functional',
    gas_ignition: 'ignition',
    motor_electrical: 'motor',
  },
  stacked_laundry: {
    washer_section: 'washer',
    dryer_section: 'dryer',
    washer_measurements: 'washerElectrical',
    dryer_measurements: 'dryerElectrical',
  },
  aio_laundry: {
    wash_functions: 'wash',
    dry_functions: 'dry',
    wash_electrical: 'washElectrical',
    heat_pump_readings: 'heatPump',
  },
  dishwasher: {
    visual_inspection: 'visual',
    functional_checks: 'functional',
    heat_water: 'heat',
    motor_electrical: 'motor',
  },
  microwave: {
    visual_inspection: 'visual',
    functional_checks: 'functional',
    door_safety: 'door',
    hv_circuit: 'hv',
  },
  electric_range: {
    visual_inspection: 'visual',
    functional_checks: 'functional',
    terminal_block_readings: 'terminal',
    element_readings: 'elements',
    sensor_readings: 'sensor',
  },
  gas_range: {
    visual_inspection: 'visual',
    functional_checks: 'functional',
    electrical_readings: 'electrical',
    gas_flame_readings: 'flame',
  },
};

const CHIP_LABELS = {
  not_cooling: 'not cooling',
  frost_buildup: 'frost / ice buildup',
  leaking: 'leaking water',
  no_heat: 'no heat',
  not_drying: 'takes too long / damp clothes',
  no_spin: "won't tumble",
  wont_stop_spinning: "won't stop spinning",
  noisy: 'noisy / thumping',
  no_power: "dead / won't start",
  error_code: 'error code',
  weak_flame: 'weak flame',
  wont_drain: "won't drain",
  no_fill: 'no fill',
  wont_spin: "won't spin",
  wont_agitate: "won't agitate",
  lid_lock: 'lid lock issue',
  no_heat_dry: 'no heat dry',
  not_cleaning: 'not cleaning dishes',
  door_issue: 'door issue',
  sparking: 'sparking inside',
  no_bake: 'no bake heat',
  no_broil: 'no broil heat',
  uneven_heat: 'uneven oven heat',
  no_ignition: 'no ignition',
  no_oven_heat: 'no oven heat',
  surface_burners: 'surface burner issue',
  washer_drain: 'washer drain issue',
  washer_spin: 'washer spin issue',
  washer_fill: 'washer fill issue',
  dryer_no_heat: 'dryer no heat',
  dryer_not_drying: 'dryer not drying',
  dryer_no_tumble: 'dryer drum not turning',
  heat_pump_dry: 'heat-pump dry issue',
  condensate: 'condensate / drain issue',
  compressor: 'compressor issue',
};

function isFailureHypothesis(id) {
  return (
    id.endsWith('_failed')
    || id.endsWith('_fault')
    || id.includes('failed')
    || id.includes('fault')
    || id.includes('restricted')
    || id.includes('blocked')
  );
}

function isOkHypothesis(id) {
  return id.endsWith('_ok') || (!isFailureHypothesis(id) && id.includes('_ok'));
}

function toComponentId(hypothesisId) {
  return hypothesisId
    .replace(/_failed$/, '')
    .replace(/_fault$/, '')
    .replace(/_restricted$/, '')
    .replace(/_blocked$/, '')
    .replace(/_ok$/, '');
}

function inferStepKey(templateId, when) {
  const map = SECTION_STEPS[templateId] || {};
  if (when.type === 'field') {
    const section = when.path.split('.')[0];
    return map[section];
  }
  if (when.type === 'chip') return 'complaint';
  return undefined;
}

function whenArray(when) {
  return Array.isArray(when) ? when : [when];
}

function buildComponents(elimination, referenced) {
  const byId = new Map(elimination.hypotheses.map((h) => [h.id, h]));
  const seen = new Set();
  const components = [];

  for (const hypothesisId of referenced) {
    const hypothesis = byId.get(hypothesisId);
    if (!hypothesis) continue;
    const componentId = toComponentId(hypothesisId);
    if (seen.has(componentId)) continue;
    seen.add(componentId);

    const category = elimination.categories.find((c) => c.id === hypothesis.category);
    components.push({
      id: componentId,
      label: hypothesis.label.replace(/\s+(OK|good|failed|fault)$/i, '').trim() || hypothesis.label,
      categoryId: hypothesis.category,
      dmaTags: category?.dmaTags?.slice(0, 2),
    });
  }

  return components.sort((a, b) => a.id.localeCompare(b.id));
}

function generateEvidence(elimination) {
  const templateId = elimination.templateId;
  const hypothesisById = new Map(elimination.hypotheses.map((h) => [h.id, h]));
  const referenced = new Set();
  const rules = [];
  const ruleIds = new Set();

  function pushRule(rule) {
    if (ruleIds.has(rule.id)) return;
    ruleIds.add(rule.id);
    rules.push(rule);
  }

  for (const elimRule of elimination.rules) {
    const when = whenArray(elimRule.when);
    const stepKey = inferStepKey(templateId, elimRule.when);
    const primary = elimRule.when;

    if (primary.type === 'chip') {
      const chipId = primary.id;
      const chipLabel = CHIP_LABELS[chipId] || chipId.replace(/_/g, ' ');
      const categories = new Map();

      for (const hypothesisId of elimRule.suspect || []) {
        const hypothesis = hypothesisById.get(hypothesisId);
        if (!hypothesis) continue;
        const existing = categories.get(hypothesis.category) || 0;
        categories.set(hypothesis.category, Math.max(existing, 22));
      }

      for (const [categoryId, value] of categories) {
        const category = elimination.categories.find((c) => c.id === categoryId);
        pushRule({
          id: `chip_${chipId}_${categoryId}`,
          when,
          target: categoryId,
          targetLayer: 'category',
          effect: { effect: 'increase', value },
          explanation: `Complaint: ${chipLabel} — points toward ${category?.label || categoryId}.`,
          recommendStepKey: stepKey || 'complaint',
          dmaTags: category?.dmaTags?.slice(0, 2),
        });
      }
      continue;
    }

    for (const hypothesisId of elimRule.confirm || []) {
      referenced.add(hypothesisId);
      const hypothesis = hypothesisById.get(hypothesisId);
      if (!hypothesis) continue;
      const componentId = toComponentId(hypothesisId);
      const failed = isFailureHypothesis(hypothesisId);

      pushRule({
        id: `confirm_${elimRule.id}_${hypothesisId}`,
        when,
        target: componentId,
        targetLayer: 'component',
        effect: { effect: 'confirm' },
        explanation: `${hypothesis.label} — supported by diagnostic evidence.`,
        recommendStepKey: stepKey,
        dmaTags: hypothesis.category
          ? elimination.categories.find((c) => c.id === hypothesis.category)?.dmaTags?.slice(0, 1)
          : undefined,
      });

      if (failed) {
        pushRule({
          id: `cat_up_${elimRule.id}_${hypothesisId}`,
          when,
          target: hypothesis.category,
          targetLayer: 'category',
          effect: { effect: 'increase', value: primary.type === 'field' ? 35 : 38 },
          explanation: `${hypothesis.label} — category evidence increased.`,
          recommendStepKey: stepKey,
        });
      } else if (isOkHypothesis(hypothesisId)) {
        pushRule({
          id: `cat_down_${elimRule.id}_${hypothesisId}`,
          when,
          target: hypothesis.category,
          targetLayer: 'category',
          effect: { effect: 'decrease', value: 20 },
          explanation: `${hypothesis.label} — fault path less likely.`,
          recommendStepKey: stepKey,
        });
      }
    }

    for (const hypothesisId of elimRule.eliminate || []) {
      referenced.add(hypothesisId);
      const hypothesis = hypothesisById.get(hypothesisId);
      if (!hypothesis) continue;
      const componentId = toComponentId(hypothesisId);

      pushRule({
        id: `eliminate_${elimRule.id}_${hypothesisId}`,
        when,
        target: componentId,
        targetLayer: 'component',
        effect: { effect: 'eliminate' },
        explanation: `${hypothesis.label} ruled out by diagnostic evidence.`,
        recommendStepKey: stepKey,
      });

      if (isFailureHypothesis(hypothesisId)) {
        pushRule({
          id: `cat_unlikely_${elimRule.id}_${hypothesisId}`,
          when,
          target: hypothesis.category,
          targetLayer: 'category',
          effect: { effect: 'unlikely', value: 28 },
          explanation: `${hypothesis.label} ruled out — category less likely.`,
          recommendStepKey: stepKey,
        });
      }
    }

    for (const hypothesisId of elimRule.suspect || []) {
      referenced.add(hypothesisId);
      const hypothesis = hypothesisById.get(hypothesisId);
      if (!hypothesis) continue;
      pushRule({
        id: `suspect_${elimRule.id}_${hypothesisId}`,
        when,
        target: hypothesis.category,
        targetLayer: 'category',
        effect: { effect: 'increase', value: 18 },
        explanation: `Observation suggests ${hypothesis.label.toLowerCase()}.`,
        recommendStepKey: stepKey,
      });
    }
  }

  return {
    templateId,
    categories: elimination.categories.map((c) => ({
      id: c.id,
      label: c.label,
      dmaTags: c.dmaTags,
    })),
    components: buildComponents(elimination, referenced),
    rules,
  };
}

const files = fs.readdirSync(ELIM_DIR).filter((f) => f.endsWith('.json'));
let written = 0;

for (const file of files) {
  const templateId = file.replace('.json', '');
  if (SKIP.has(templateId)) {
    console.log(`skip ${templateId} (hand-authored)`);
    continue;
  }

  const elimination = JSON.parse(fs.readFileSync(path.join(ELIM_DIR, file), 'utf8'));
  const evidence = generateEvidence(elimination);
  const outPath = path.join(OUT_DIR, file);
  fs.writeFileSync(outPath, `${JSON.stringify(evidence, null, 2)}\n`);
  console.log(`wrote ${file} — ${evidence.rules.length} rules, ${evidence.components.length} components`);
  written += 1;
}

console.log(`\nDone. ${written} evidence files written to knowledge/evidence/`);
