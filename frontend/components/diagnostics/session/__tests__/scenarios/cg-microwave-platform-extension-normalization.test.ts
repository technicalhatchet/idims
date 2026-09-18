import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

const CALIBRATION = join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);

test('ME21 platform extension inherits Samsung ME11 witness normalization', () => {
  const extension = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_SAMSUNG_ME21_PLATFORM_EXTENSION_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(extension.status, 'approved');
  assert.equal(extension.witnessNormalization, 'CG_MICROWAVE_SAMSUNG_ME11_NORMALIZATION_v1.json');
  assert.equal(extension.inheritancePolicy.deltaFunctionalMappings, 0);
  assert.equal(extension.inheritancePolicy.requiresSeparateCompounding, false);
  assert.equal(extension.inheritancePolicy.canonicalPromotionCount, 0);

  const me21 = contract.platformExtensions.find(
    (e: { targetId: string }) => e.targetId === 'samsung_me21_otr_extension',
  );
  assert.ok(me21);
  assert.equal(me21.witnessTargetId, 'samsung_me11_otr');
});

test('LMVM platform extension inherits LG LMHM2237 witness normalization', () => {
  const extension = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_LG_LMVM_PLATFORM_EXTENSION_v1.json'), 'utf8'),
  );
  const contract = JSON.parse(
    readFileSync(join(CALIBRATION, 'CG_MICROWAVE_NORMALIZATION_CONTRACT_v1.json'), 'utf8'),
  );

  assert.equal(extension.status, 'approved');
  assert.equal(extension.witnessNormalization, 'CG_MICROWAVE_LG_LMHM2237_NORMALIZATION_v1.json');
  assert.equal(extension.inheritancePolicy.deltaFunctionalMappings, 0);
  assert.equal(extension.inheritancePolicy.requiresSeparateCompounding, false);

  const lmvm = contract.platformExtensions.find(
    (e: { targetId: string }) => e.targetId === 'lg_lmvm_otr_extension',
  );
  assert.ok(lmvm);
  assert.equal(lmvm.witnessTargetId, 'lg_lmhm2237_otr');
});
