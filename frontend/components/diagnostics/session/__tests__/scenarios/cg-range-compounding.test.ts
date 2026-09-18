import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { FROZEN_ELECTRIC_RANGE_REV1_HASH } from '../../../knowledge/canonical/canonicalRegistry';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('CG-RANGE-COMPOUNDING is closed after all four sequences audit GREEN', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );
  const audit = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json'), 'utf8'),
  );
  const sequence = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_FAMILY_WORKSTREAM_SEQUENCE_v1.json'), 'utf8'),
  );

  assert.equal(audit.verdict, 'GREEN / NORMALIZATION_AUDIT_PASSED');
  assert.equal(compounding.status, 'closed');
  assert.equal(compounding.verdict, 'GREEN / RANGE_COMPOUNDING_COMPLETE');
  assert.equal(compounding.priorPhaseClosed, 'CG_RANGE_NORMALIZATION_AUDIT_v1.json');
  assert.equal(sequence.disciplinedSequence[6].status, 'active');
  assert.equal(sequence.disciplinedSequence[6].phase, 'CG-RANGE-COMPOUNDING');
});

test('CG-RANGE-COMPOUNDING binds four normalized targets to range_oven without ontology redesign', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.equal(compounding.targetCanonicalIdentity.primaryId, 'range_oven');
  assert.equal(compounding.targetCanonicalIdentity.frozenContractHash, FROZEN_ELECTRIC_RANGE_REV1_HASH);
  assert.ok(compounding.coreConstraint.includes('does not redesign the ontology established'));

  const order = compounding.normalizedEvidenceInputs.map(
    (entry: { targetId: string }) => entry.targetId,
  );
  assert.deepEqual(order, [
    'samsung_nx60_gas',
    'samsung_ne58r9560ws_induction',
    'samsung_ny63t8751ss_dual_fuel',
    'whirlpool_w11174814_corpus',
  ]);

  const w111 = compounding.normalizedEvidenceInputs[3];
  assert.equal(w111.role, 'corroboration');
  assert.equal(w111.notRetroactiveFitEvidence, true);

  assert.ok(
    compounding.immutableRules.some((rule: string) => rule.includes('gas_range.json')),
  );
  assert.equal(compounding.exitCriteria.canonicalGraphUnchanged, true);
  assert.equal(compounding.exitCriteria.electricRangeRev1HashUnchanged, true);
});

test('CG-RANGE-COMPOUNDING deliverables target canonical functional knowledge and overlays', () => {
  const compounding = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_RANGE_COMPOUNDING_v1.json'), 'utf8'),
  );

  assert.ok(compounding.compoundingDeliverables.canonicalFunctionalKnowledge);
  assert.ok(compounding.compoundingDeliverables.platformOverlays);
  assert.ok(compounding.allowedCanonicalTargets.components.includes('surface_heating_system'));
  assert.ok(compounding.allowedCanonicalTargets.instanceScopes.includes('bake_heating_element'));
  assert.ok(compounding.nextDisciplinedStep.includes('STOP'));
  assert.equal(compounding.compoundingSequence[0].status, 'closed');
  assert.equal(compounding.compoundingSequence[0].overlayFile, 'samsung_range_nx60.json');
  assert.equal(compounding.compoundingSequence[1].status, 'closed');
  assert.equal(compounding.compoundingSequence[1].overlayFile, 'samsung_range_ne58.json');
  assert.equal(compounding.compoundingSequence[2].status, 'closed');
  assert.equal(compounding.compoundingSequence[2].overlayFile, 'samsung_range_ny63.json');
  assert.equal(compounding.compoundingSequence[3].status, 'closed');
  assert.equal(compounding.compoundingSequence[3].role, 'corroboration');
  assert.equal(
    compounding.compoundingSequence[3].overlayFile,
    'whirlpool_freestanding_range_w11174814.json',
  );
  assert.equal(compounding.exitCriteria.sequencesComplete, '4/4');
  assert.equal(compounding.exitCriteria.platformOverlaysPublished, true);
});
