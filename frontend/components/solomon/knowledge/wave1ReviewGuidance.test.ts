import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  WAVE1_GUIDANCE,
  WAVE1_GUIDANCE_TITLE,
  WAVE1_REVIEW_CLASS,
} from './wave1ReviewGuidance.js';

test('Wave 1 guidance targets existingCanonicalMapping review class', () => {
  assert.equal(WAVE1_REVIEW_CLASS, 'existingCanonicalMapping');
});

test('Wave 1 guidance covers accept, reject, and defer with examples', () => {
  assert.match(WAVE1_GUIDANCE.waveMeaning, /already-frozen canonical function/i);
  assert.match(WAVE1_GUIDANCE.decisions.accepted.guidance, /without distortion/i);
  assert.match(WAVE1_GUIDANCE.decisions.rejected.guidance, /contradicted/i);
  assert.match(WAVE1_GUIDANCE.decisions.deferred.guidance, /insufficient/i);
  assert.match(WAVE1_GUIDANCE.decisions.accepted.example, /door_lock/i);
  assert.match(WAVE1_GUIDANCE.decisions.rejected.example, /door_lock/i);
  assert.match(WAVE1_GUIDANCE.decisions.deferred.example, /defer/i);
});

test('Wave 1 guidance states accept is not promotion and defers new ontology', () => {
  assert.match(WAVE1_GUIDANCE.promotionBoundary, /not canonical promotion/i);
  assert.match(WAVE1_GUIDANCE.promotionBoundary, /No canonical graph mutation/i);
  assert.match(WAVE1_GUIDANCE.newCanonicalRule, /do not invent/i);
  assert.match(WAVE1_GUIDANCE.evidenceHierarchy, /procedure/i);
});

test('Wave 1 guidance panel component renders guidance content', () => {
  const source = readFileSync(join(process.cwd(), 'components/solomon/knowledge/Wave1ReviewGuidancePanel.js'), 'utf8');
  assert.match(source, /WAVE1_GUIDANCE_TITLE/);
  assert.match(source, /data-testid="wave1-review-guidance"/);
  assert.match(source, /decisions\.accepted/);
  assert.match(source, /decisions\.rejected/);
  assert.match(source, /decisions\.deferred/);
  assert.match(source, /promotionBoundary/);
  assert.match(source, /newCanonicalRule/);
  assert.match(source, /evidenceHierarchy/);
});

test('workbench shows Wave 1 guidance only when existingCanonicalMapping filter is active', () => {
  const workbench = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'),
    'utf8',
  );
  assert.match(workbench, /Wave1ReviewGuidancePanel/);
  assert.match(workbench, /classFilter === WAVE1_REVIEW_CLASS/);
  assert.match(workbench, /WAVE1_REVIEW_CLASS/);
});

test('workbench decision controls remain single-candidate accept/reject/defer', () => {
  const workbench = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'),
    'utf8',
  );
  assert.match(workbench, /\['accepted', 'rejected', 'deferred'\]/);
  assert.match(workbench, /submitDecision\(status\)/);
  assert.ok(!/bulk/i.test(workbench));
  assert.ok(!/plan_promotion|apply_promotion|promotionLedger/i.test(workbench));
});
