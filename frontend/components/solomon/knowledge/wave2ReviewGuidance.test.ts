import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  WAVE2_GUIDANCE,
  WAVE2_GUIDANCE_TITLE,
  WAVE2_REVIEW_CLASS,
} from './wave2ReviewGuidance.js';

test('Wave 2 guidance targets newPlatformKnowledge review class', () => {
  assert.equal(WAVE2_REVIEW_CLASS, 'newPlatformKnowledge');
});

test('Wave 2 guidance covers accept, reject, and defer with platform knowledge semantics', () => {
  assert.match(WAVE2_GUIDANCE.waveMeaning, /implementation knowledge/i);
  assert.match(WAVE2_GUIDANCE.decisions.accepted.guidance, /does not require changing frozen canonical ontology/i);
  assert.match(WAVE2_GUIDANCE.decisions.rejected.guidance, /extraction noise/i);
  assert.match(WAVE2_GUIDANCE.decisions.deferred.guidance, /new canonical abstraction/i);
});

test('Wave 2 guidance states accept is not promotion and references known patterns', () => {
  assert.match(WAVE2_GUIDANCE.promotionBoundary, /does not promote/i);
  assert.match(WAVE2_GUIDANCE.newCanonicalRule, /defer/i);
  assert.match(WAVE2_GUIDANCE.patternAwareness, /TEST #/);
});

test('Wave 2 guidance panel component renders guidance content', () => {
  const source = readFileSync(join(process.cwd(), 'components/solomon/knowledge/Wave2ReviewGuidancePanel.js'), 'utf8');
  assert.match(source, /WAVE2_GUIDANCE_TITLE/);
  assert.match(source, /data-testid="wave2-review-guidance"/);
});

test('workbench shows Wave 2 guidance only when newPlatformKnowledge filter is active', () => {
  const workbench = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'),
    'utf8',
  );
  assert.match(workbench, /Wave2ReviewGuidancePanel/);
  assert.match(workbench, /classFilter === WAVE2_REVIEW_CLASS/);
  assert.match(workbench, /Wave1ReviewGuidancePanel/);
});
