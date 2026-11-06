import assert from 'node:assert/strict';
import test from 'node:test';

import {
  parseCommaSeparatedUSAddress,
  resolveWorkOrderServiceAddressBlock,
  streetAlreadyIncludesUnit,
} from '../appointment-scheduling.js';

test('parseCommaSeparatedUSAddress: City, ST, ZIP as separate parts', () => {
  const block = parseCommaSeparatedUSAddress(
    '3040 Byrnwyck W, Unit 109, Maumee, OH, 43537',
  );
  assert.equal(block.line1, '3040 Byrnwyck W, Unit 109');
  assert.equal(block.line2, 'Maumee, OH 43537');
});

test('parseCommaSeparatedUSAddress: drops trailing USA', () => {
  const block = parseCommaSeparatedUSAddress(
    '3040 Byrnwyck W, Unit 109, Maumee, OH, 43537, USA',
  );
  assert.equal(block.line1, '3040 Byrnwyck W, Unit 109');
  assert.equal(block.line2, 'Maumee, OH 43537');
});

test('parseCommaSeparatedUSAddress: address with no unit', () => {
  const block = parseCommaSeparatedUSAddress('928 W Wayne, Maumee, OH, 43537');
  assert.equal(block.line1, '928 W Wayne');
  assert.equal(block.line2, 'Maumee, OH 43537');
});

test('streetAlreadyIncludesUnit detects Unit/Apt/#', () => {
  assert.equal(
    streetAlreadyIncludesUnit('3040 Byrnwyck W, Unit 109', '109'),
    true,
  );
  assert.equal(streetAlreadyIncludesUnit('12 Main St, Apt 2B', '2B'), true);
  assert.equal(streetAlreadyIncludesUnit('12 Main St, #3', '3'), true);
  assert.equal(streetAlreadyIncludesUnit('12 Main St', '109'), false);
});

test('resolveWorkOrderServiceAddressBlock: no duplicate unit', () => {
  const block = resolveWorkOrderServiceAddressBlock({
    service_location: {
      address: '3040 Byrnwyck W, Unit 109, Maumee, OH, 43537',
    },
    property: {
      address: '3040 Byrnwyck W, Maumee, OH, 43537',
      unit_number: '109',
    },
  });
  assert.equal(block.line1, '3040 Byrnwyck W, Unit 109');
  assert.equal(block.line2, 'Maumee, OH 43537');
  assert.ok(!/Unit 109.*Unit 109/i.test(block.line1));
});

test('resolveWorkOrderServiceAddressBlock: no unit stays clean', () => {
  const block = resolveWorkOrderServiceAddressBlock({
    service_location: { address: '928 W Wayne, Maumee, OH, 43537' },
    property: { address: '928 W Wayne, Maumee, OH, 43537', unit_number: null },
  });
  assert.equal(block.line1, '928 W Wayne');
  assert.equal(block.line2, 'Maumee, OH 43537');
});
