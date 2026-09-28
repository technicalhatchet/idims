import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

const CANONICAL = resolve(process.cwd(), 'components/diagnostics/knowledge/canonical');

const VENTED_DRYER_HASH =
  'db48a9a1271843fc63d871330c633f468c537fc14242c8d537e611375992b714';

const PERMITTED_OUTCOMES = [
  'candidate_ready_for_freeze',
  'discovery_insufficient',
  'existing_family_can_be_extended',
] as const;

const TRIANGULATION_CLASSIFICATIONS = [
  'cross_manufacturer_convergent',
  'partially_convergent',
  'manufacturer_specific',
  'unresolved',
] as const;

function sha256File(absolutePath: string): string {
  return createHash('sha256').update(readFileSync(absolutePath)).digest('hex');
}

function readJson(name: string): Record<string, unknown> {
  return JSON.parse(readFileSync(join(CALIBRATION, name), 'utf8'));
}

test('HP dryer discovery contract authorized — blocks hardware ontology', () => {
  const contract = readJson('CG_HEAT_PUMP_DRYER_DISCOVERY_CONTRACT_v1.json');
  assert.equal(contract.workstream, 'CG-HEAT-PUMP-DRYER-DISCOVERY');
  assert.equal(contract.status, 'active');
  assert.ok(
    (contract.centerpieceQuestion as { rejectedShortcut: string }).rejectedShortcut.includes(
      'compressor',
    ),
  );
  assert.ok((contract.notCreating as string[]).includes('heat_pump_dryer.json'));
});

test('HP dryer candidate: 2 new functions, 7 reused, no component promotion', () => {
  const candidate = readJson('heat_pump_dryer_functional_contract_candidate_v1.json');
  const newFns = candidate.proposedNewCanonicalFunctions as Array<{
    id: string;
    provenance: unknown[];
    implementationVocabularyNotPromoted: string[];
  }>;

  assert.equal(candidate.notCanonicalFile, true);
  assert.equal((candidate.minimalFunctionBudget as { newCoreFunctions: number }).newCoreFunctions, 2);
  assert.equal(
    (candidate.minimalFunctionBudget as { componentNodesPromoted: number }).componentNodesPromoted,
    0,
  );
  assert.equal(
    (candidate.minimalFunctionBudget as { refrigerationHardwareNodesRejected: number })
      .refrigerationHardwareNodesRejected,
    9,
  );

  const ids = newFns.map((f) => f.id);
  assert.ok(ids.includes('heat_pump_thermal_system'));
  assert.ok(ids.includes('sealed_moisture_rejection_path'));
  assert.ok(!ids.includes('compressor'));
  assert.ok(!ids.includes('evaporator'));

  for (const fn of newFns) {
    assert.ok(fn.provenance.length >= 3);
    assert.ok(fn.implementationVocabularyNotPromoted.length > 0);
  }

  const thermal = newFns.find((f) => f.id === 'heat_pump_thermal_system');
  assert.ok(thermal?.implementationVocabularyNotPromoted.includes('compressor'));
});

test('HP dryer discovery triangulation: cross-manufacturer convergent domains', () => {
  const triangulation = readJson('CG_HEAT_PUMP_DRYER_DISCOVERY_TRIANGULATION_v1.json');
  const proposed = triangulation.proposedNewFunctionalDomains as Array<{
    candidateId: string;
    classification: string;
  }>;

  for (const domain of proposed) {
    assert.ok(
      (TRIANGULATION_CLASSIFICATIONS as readonly string[]).includes(domain.classification),
    );
    assert.equal(domain.classification, 'cross_manufacturer_convergent');
  }

  const rejected = triangulation.rejectedCanonicalNodes as Array<{ node: string }>;
  assert.ok(rejected.some((r) => r.node === 'compressor'));
  assert.ok(rejected.some((r) => r.node === 'evaporator'));
});

test('HP dryer discovery closure: candidate_ready_for_freeze — no json created', () => {
  const closure = readJson('CG_HEAT_PUMP_DRYER_DISCOVERY_CLOSURE_v1.json');

  assert.ok(
    (PERMITTED_OUTCOMES as readonly string[]).includes(closure.discoveryOutcome as string),
  );
  assert.equal(closure.discoveryOutcome, 'candidate_ready_for_freeze');
  assert.equal(
    (closure.governanceConclusion as { heatPumpDryerJsonCreated: boolean }).heatPumpDryerJsonCreated,
    false,
  );
  assert.equal((closure.governanceConclusion as { freezeExecuted: boolean }).freezeExecuted, false);
  assert.equal(
    (closure.aioCompatibilitySummary as { aioCandidateModified: boolean }).aioCandidateModified,
    false,
  );
});

test('HP dryer discovery: vented_dryer hash unchanged; discovery did not freeze; AIO paused', () => {
  const closure = readJson('CG_HEAT_PUMP_DRYER_DISCOVERY_CLOSURE_v1.json');
  assert.equal(
    (closure.governanceConclusion as { heatPumpDryerJsonCreated: boolean }).heatPumpDryerJsonCreated,
    false,
  );
  assert.equal(sha256File(join(CANONICAL, 'vented_dryer.json')), VENTED_DRYER_HASH);

  const aioStatus = readJson('CG_AIO_LAUNDRY_COMBO_WORKSTREAM_STATUS_v1.json');
  assert.equal((aioStatus.returnStatus as { state: string }).state, 'COMPLETE');

  const candidate = readJson('aio_laundry_combo_functional_contract_candidate_v1.json');
  assert.equal(candidate.notCanonicalFile, true);
});

test('HP dryer candidate semantic boundaries reject refrigeration hardware copy', () => {
  const candidate = readJson('heat_pump_dryer_functional_contract_candidate_v1.json');
  const thermal = (candidate.proposedNewCanonicalFunctions as Array<{ id: string; semanticBoundary: string }>).find(
    (f) => f.id === 'heat_pump_thermal_system',
  );
  assert.ok(thermal?.semanticBoundary.includes('NOT synonym for compressor'));
});
