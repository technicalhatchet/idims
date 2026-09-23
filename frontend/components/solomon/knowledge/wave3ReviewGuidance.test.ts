import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import {
  WAVE3_GUIDANCE,
  WAVE3_GUIDANCE_TITLE,
  WAVE3_REVIEW_CLASS,
} from './wave3ReviewGuidance.js';

test('Wave 3 guidance targets newCanonicalKnowledge review class', () => {
  assert.equal(WAVE3_REVIEW_CLASS, 'newCanonicalKnowledge');
});

test('Wave 3 guidance distinguishes wave 3 from wave 2 and promotion boundary', () => {
  assert.match(WAVE3_GUIDANCE.waveContrast, /Wave 2/i);
  assert.match(WAVE3_GUIDANCE.waveContrast, /canonical functional abstraction/i);
  assert.match(WAVE3_GUIDANCE.promotionBoundary, /does NOT mutate/i);
  assert.match(WAVE3_GUIDANCE.architecturePath, /promotion/i);
});

test('Wave 3 guidance panel component renders guidance content', () => {
  const source = readFileSync(join(process.cwd(), 'components/solomon/knowledge/Wave3ReviewGuidancePanel.js'), 'utf8');
  assert.match(source, /WAVE3_GUIDANCE_TITLE/);
  assert.match(source, /data-testid="wave3-review-guidance"/);
});

test('workbench shows Wave 3 guidance only when newCanonicalKnowledge filter is active', () => {
  const workbench = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'),
    'utf8',
  );
  assert.match(workbench, /Wave3ReviewGuidancePanel/);
  assert.match(workbench, /classFilter === WAVE3_REVIEW_CLASS/);
  assert.match(workbench, /Wave2ReviewGuidancePanel/);
});

test('detail panel uses Wave 3 highlight path without removing Wave 2', () => {
  const detail = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewDetailPanel.js'),
    'utf8',
  );
  assert.match(detail, /wave3-review-highlight/);
  assert.match(detail, /wave2-review-highlight/);
  assert.match(detail, /reviewSectionPreviewsForCandidate/);
});
