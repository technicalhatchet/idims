import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  FROZEN_ELECTRIC_RANGE_REV1_HASH,
  getCanonicalOntologyById,
  getCanonicalOntologyForTemplate,
  resolveCanonicalOntologyId,
} from '../../../knowledge/canonical/canonicalRegistry';
import {
  CANONICAL_ONTOLOGY_LEGACY_ALIASES,
  PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID,
  RANGE_IMPLEMENTATION_TEMPLATE_IDS,
} from '../../../knowledge/canonical/canonicalOntologyAliases';
import { resolveDefaultDiagnosticTemplateId } from '../../../../../constants/diagnosticTemplates';

import electricRangeOntology from '../../../knowledge/canonical/electric_range.json';
import rangeOvenOntology from '../../../knowledge/canonical/range_oven.json';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const CANONICAL = join(process.cwd(), 'components/diagnostics/knowledge/canonical');

function sha256File(path: string): string {
  return createHash('sha256').update(readFileSync(path)).digest('hex');
}

test('CG-RANGE-IMPLEMENTATION-GATE alias registry routes legacy electric_range to range_oven', () => {
  const registry = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_CANONICAL_ONTOLOGY_ALIAS_REGISTRY_v1.json'), 'utf8'),
  );

  assert.equal(PRIMARY_RANGE_CANONICAL_ONTOLOGY_ID, 'range_oven');
  assert.equal(CANONICAL_ONTOLOGY_LEGACY_ALIASES.electric_range, 'range_oven');
  assert.equal(registry.primaryCanonicalId, 'range_oven');
  assert.equal(registry.legacyAliases[0].aliasId, 'electric_range');
  assert.equal(registry.legacyAliases[0].frozenHistoricalHash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
});

test('all range implementation templates resolve to shared range_oven canonical contract', () => {
  for (const templateId of RANGE_IMPLEMENTATION_TEMPLATE_IDS) {
    assert.equal(resolveCanonicalOntologyId(templateId, 'samsung_range_nx60'), 'range_oven');
    assert.equal(resolveCanonicalOntologyId(templateId, 'whirlpool_freestanding_range'), 'range_oven');
  }

  const ontology = getCanonicalOntologyForTemplate('gas_range', 'samsung_range_nx60');
  assert.ok(ontology);
  assert.equal(ontology?.ontology.id, 'range_oven');
  assert.equal(ontology?.ontology.frozen, true);

  const viaAlias = getCanonicalOntologyById('electric_range');
  assert.ok(viaAlias);
  assert.equal(viaAlias?.ontology.id, 'range_oven');
});

test('range_oven identity adopts CG-10 rev1 graph without mutating electric_range.json', () => {
  const hash = sha256File(join(CANONICAL, 'electric_range.json'));
  assert.equal(hash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.equal(electricRangeOntology.ontology.id, 'electric_range');
  assert.equal(electricRangeOntology.ontology.frozenRevision, 'rev1');

  assert.equal(rangeOvenOntology.ontology.id, 'range_oven');
  assert.equal(rangeOvenOntology.ontology.organizationalLineage?.adoptedFrom, 'electric_range');
  assert.equal(
    rangeOvenOntology.ontology.organizationalLineage?.adoptedHash,
    FROZEN_ELECTRIC_RANGE_REV1_HASH,
  );
  assert.equal(rangeOvenOntology.components.length, electricRangeOntology.components.length);
});

test('implementation gate does not create fuel-specific canonical ontology files', () => {
  for (const filename of ['gas_range.json', 'induction_range.json', 'dual_fuel_range.json']) {
    assert.equal(existsSync(join(CANONICAL, filename)), false);
  }
});

test('explicit template routing registers induction and dual-fuel implementation templates', () => {
  assert.equal(resolveCanonicalOntologyId('induction_range', 'samsung_range_ne58'), 'range_oven');
  assert.equal(resolveCanonicalOntologyId('dual_fuel_range', 'samsung_range_ny63'), 'range_oven');

  assert.equal(
    resolveDefaultDiagnosticTemplateId({
      equipment_subtype: 'range',
      description: 'Samsung NY63 dual fuel range no bake',
    }),
    'dual_fuel_range',
  );
  assert.equal(
    resolveDefaultDiagnosticTemplateId({
      equipment_subtype: 'range',
      description: 'Samsung NE58R induction cooktop not heating',
    }),
    'induction_range',
  );
});

test('CG-RANGE-IMPLEMENTATION-GATE is closed with regression green', () => {
  const gate = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_ORGANIZATIONAL_IMPLEMENTATION_GATE_v1.json'), 'utf8'),
  );
  const closure = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_ORGANIZATIONAL_IMPLEMENTATION_GATE_CLOSURE_v1.json'), 'utf8'),
  );

  assert.equal(gate.status, 'closed');
  assert.equal(closure.status, 'closed');
  assert.equal(gate.successCriteria.regressionGreen, true);
  assert.equal(gate.successCriteria.closureArtifact, 'CG_RANGE_ORGANIZATIONAL_IMPLEMENTATION_GATE_CLOSURE_v1.json');
  assert.equal(gate.approvedOrganizationalIdentity.primaryCanonicalId, 'range_oven');
  assert.equal(gate.approvedTemplateRouting.resolveTo, 'range_oven');
  assert.ok(gate.implementationTasks.some((task: { id: string }) => task.id === 'establish_legacy_alias'));
  assert.ok(gate.implementationTasks.some((task: { id: string }) => task.id === 'update_resolver'));
  assert.equal(closure.unlocks.normalization, 'CG-RANGE-NORMALIZATION');
});
