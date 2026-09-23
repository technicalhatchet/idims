import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { DIAGNOSTIC_TEMPLATES } from '../../../../../constants/diagnosticTemplates';
import {
  PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID,
  RANGE_IMPLEMENTATION_TEMPLATE_IDS,
} from '../../../knowledge/canonical/canonicalOntologyAliases';
import { resolveCanonicalOntologyId } from '../../../knowledge/canonical/canonicalRegistry';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const VALID_CLASSIFICATIONS = new Set([
  'existing_canonical_family',
  'variant_of_existing_graph',
  'requires_fit_test',
  'requires_new_canonical_graph',
  'out_of_scope',
]);

const APPLIANCE_TEMPLATE_IDS = DIAGNOSTIC_TEMPLATES.map((t) => t.id).filter(
  (id) => !['customer_complaint', 'diagnosis'].includes(id),
);

function loadInventory() {
  return JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_CANONICAL_FAMILY_INVENTORY_v1.json'), 'utf8'),
  );
}

function loadAudit() {
  return JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_CANONICAL_FAMILY_INVENTORY_AUDIT_v1.json'), 'utf8'),
  );
}

test('CG-CANONICAL-FAMILY-INVENTORY is classification-only gate with audit green', () => {
  const inventory = loadInventory();
  const audit = loadAudit();

  assert.equal(inventory.workstream, 'CG-CANONICAL-FAMILY-INVENTORY');
  assert.equal(inventory.status, 'closed');
  assert.equal(inventory.verdict, 'GREEN / CANONICAL_FAMILY_INVENTORY_COMPLETE');
  assert.ok(inventory.coreConstraint.includes('classification does not authorize'));
  assert.equal(inventory.minimumAdditionalCanonicalGraphs.confirmedRequired, 0);
  assert.equal(audit.verdict, 'GREEN / CANONICAL_FAMILY_INVENTORY_GATE_APPROVED');
  assert.equal(audit.auditQuestions.every((q: { answer: boolean }) => q.answer), true);
});

test('range_oven is EXISTING CANONICAL FAMILY — LOCKED — DO NOT REOPEN', () => {
  const inventory = loadInventory();
  const audit = loadAudit();
  const rangeFamily = inventory.existingCanonicalFamilies.families.find(
    (f: { canonicalOntologyId: string }) => f.canonicalOntologyId === 'range_oven',
  );
  const rangeCategory = inventory.categoryInventory.find(
    (c: { categoryId: string }) => c.categoryId === 'range_oven_freestanding',
  );

  assert.equal(PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID, 'range_oven');
  assert.equal(rangeFamily.architectureStatus, 'LOCKED — DO NOT REOPEN');
  assert.equal(rangeFamily.doNotReopen, true);
  assert.equal(rangeCategory.doNotReopen, true);
  assert.ok(rangeFamily.inventoryPolicy.includes('coverage work only'));
  assert.ok(rangeCategory.inventoryNote.includes('Not a fit-test candidate'));

  const fitQueue = audit.fitTestPriorityQueue.map(
    (item: { categoryId: string }) => item.categoryId,
  );
  assert.ok(!fitQueue.includes('range_oven_freestanding'));
  assert.ok(inventory.explicitNonGoals.some((g: string) => g.includes('Reopen range_oven')));

  for (const templateId of RANGE_IMPLEMENTATION_TEMPLATE_IDS) {
    assert.equal(resolveCanonicalOntologyId(templateId), 'range_oven');
  }
});

test('every category uses a valid classification bucket', () => {
  const inventory = loadInventory();
  const buckets = inventory.classificationBuckets;

  for (const category of inventory.categoryInventory) {
    assert.ok(VALID_CLASSIFICATIONS.has(category.classification));
    assert.ok(buckets.includes(category.classification));
  }

  for (const family of inventory.existingCanonicalFamilies.families) {
    assert.equal(family.classification, 'existing_canonical_family');
  }
});

test('requires_fit_test entries have bounded next steps and promotion blocked', () => {
  const inventory = loadInventory();
  const fitEntries = inventory.categoryInventory.filter(
    (c: { classification: string }) => c.classification === 'requires_fit_test',
  );

  assert.ok(fitEntries.length >= 5);
  for (const entry of fitEntries) {
    assert.ok(entry.boundedNextStep, `${entry.categoryId} missing boundedNextStep`);
    assert.ok(entry.boundedNextStep.startsWith('CG-'), entry.boundedNextStep);
    assert.equal(entry.promotionBlocked, true);
    assert.notEqual(entry.classification, 'requires_new_canonical_graph');
  }
});

test('no category is classified requires_new_canonical_graph without fit test first', () => {
  const inventory = loadInventory();
  const newGraphEntries = inventory.categoryInventory.filter(
    (c: { classification: string }) => c.classification === 'requires_new_canonical_graph',
  );

  assert.equal(newGraphEntries.length, 0);
  assert.equal(inventory.classificationSummary.requires_new_canonical_graph, 0);
});

test('all wizard appliance templateIds are accounted for in inventory', () => {
  const inventory = loadInventory();
  const covered = new Set<string>();

  for (const family of inventory.existingCanonicalFamilies.families) {
    if (family.wizardTemplateId) covered.add(family.wizardTemplateId);
    if (family.wizardTemplateIds) {
      for (const id of family.wizardTemplateIds) covered.add(id);
    }
    if (family.implementationTemplates) {
      for (const id of family.implementationTemplates) covered.add(id);
    }
  }

  for (const category of inventory.categoryInventory) {
    if (category.wizardTemplateId) covered.add(category.wizardTemplateId);
    if (category.wizardTemplateIds) {
      for (const id of category.wizardTemplateIds) covered.add(id);
    }
  }

  for (const templateId of APPLIANCE_TEMPLATE_IDS) {
    assert.ok(covered.has(templateId), `templateId ${templateId} not covered`);
  }

  assert.equal(inventory.wizardTemplateCoverage.allAccountedFor, true);
  assert.deepEqual(
    inventory.wizardTemplateCoverage.templateIds.sort(),
    [...APPLIANCE_TEMPLATE_IDS].sort(),
  );
});

test('classification summary counts match category inventory', () => {
  const inventory = loadInventory();
  const summary = inventory.classificationSummary;
  const counts: Record<string, number> = {
    existing_canonical_family: 0,
    variant_of_existing_graph: 0,
    requires_fit_test: 0,
    requires_new_canonical_graph: 0,
    out_of_scope: 0,
  };

  for (const category of inventory.categoryInventory) {
    counts[category.classification as keyof typeof counts] += 1;
  }

  for (const [bucket, count] of Object.entries(summary)) {
    assert.equal(counts[bucket], count, `bucket ${bucket} mismatch`);
  }
});

test('variant_of_existing_graph entries are hypotheses unless provenVariant is true', () => {
  const inventory = loadInventory();
  const variants = inventory.categoryInventory.filter(
    (c: { classification: string }) => c.classification === 'variant_of_existing_graph',
  );

  assert.ok(inventory.variantLifecycle.rule.includes('variant hypotheses'));
  for (const entry of variants) {
    if (entry.provenVariant === true) {
      assert.equal(entry.fitTestClosed, true, entry.categoryId);
    } else {
      assert.equal(entry.provenVariant, false, entry.categoryId);
      assert.notEqual(entry.provenVariant, true);
    }
  }

  const standaloneFreezer = inventory.categoryInventory.find(
    (c: { categoryId: string }) => c.categoryId === 'standalone_freezer',
  );
  assert.equal(standaloneFreezer.classification, 'requires_fit_test');
  assert.notEqual(standaloneFreezer.provenVariant, true);
});

test('fit-test priority queue excludes locked range and references inventory categories', () => {
  const audit = loadAudit();
  const inventory = loadInventory();
  const categoryIds = new Set(
    inventory.categoryInventory.map((c: { categoryId: string }) => c.categoryId),
  );

  assert.ok(audit.fitTestPriorityQueue.length >= 5);
  for (const item of audit.fitTestPriorityQueue) {
    assert.ok(categoryIds.has(item.categoryId));
    assert.ok(item.contractId.startsWith('CG-'));
    assert.notEqual(item.categoryId, 'range_oven_freestanding');
  }

  assert.ok(
    audit.explicitExclusions.some((e: string) => e.includes('range_oven')),
  );
});
