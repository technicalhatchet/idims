import assert from 'node:assert/strict';
import { test } from 'node:test';

import { resolveExcludeWorkOrderIdForApi } from '../resolveExcludeWorkOrderIdForApi';

test('solomon draft scope ids are not sent to work-order APIs', () => {
  assert.equal(resolveExcludeWorkOrderIdForApi('solomon-new'), null);
  assert.equal(
    resolveExcludeWorkOrderIdForApi('solomon-1da8eb3a-7f05-4eba-9e5a-ff6cd0ea86f9'),
    null,
  );
});

test('real work order uuid passes through', () => {
  const id = '1da8eb3a-7f05-4eba-9e5a-ff6cd0ea86f9';
  assert.equal(resolveExcludeWorkOrderIdForApi(id), id);
});
