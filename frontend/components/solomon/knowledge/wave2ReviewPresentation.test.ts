import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { test } from 'node:test';

import { mapsToSectionPreview, whatSectionPreview } from './candidateReviewWorkflow.js';
import {
  isNewPlatformKnowledgeCandidate,
  reviewSectionPreviewsForCandidate,
  wave2DiagnosticKnowledgeLines,
  wave2ListRowPrimaryLabel,
  wave2MapsToSectionPreview,
  wave2WhatSectionPreview,
} from './wave2ReviewPresentation.js';

const WAVE1_RECORD = {
  candidateId: 'W8178558::canonical_mapping::map-door-lock',
  reviewClass: 'existingCanonicalMapping',
  manualId: 'W8178558',
  what: {
    manualId: 'W8178558',
    procedureId: 'w8178558-door-lock',
    sourceTerm: 'door_lock',
  },
  mapsTo: {
    proposedCanonicalId: 'door_lock',
    mappingType: 'alias',
    candidateType: 'canonicalMapping',
  },
};

const WAVE2_MEASUREMENT = {
  candidateId: 'test::overlay::meas',
  reviewClass: 'newPlatformKnowledge',
  manualId: 'INSIGNIA-DWR3-DISHWASHER',
  what: {
    sourceTerm: 'overlay-generated-id',
    procedureId: 'nsdwr3ss1-drain-pump',
    manualId: 'INSIGNIA-DWR3-DISHWASHER',
  },
  mapsTo: {
    proposedCanonicalId: 'drain_test',
    candidateType: 'measurementBinding',
  },
  where: {
    provenanceSources: [
      {
        type: 'measurement',
        measurementKnowledgeId: 'insigniaDishwasherDrainPumpOhms',
        stepTitle: 'Drain pump winding resistance',
      },
    ],
  },
  context: { platformId: 'insignia_dishwasher' },
};

test('Wave 1 section previews stay on default hierarchy', () => {
  const previews = reviewSectionPreviewsForCandidate(WAVE1_RECORD);
  assert.equal(previews.wave2, false);
  assert.deepEqual(previews.what, whatSectionPreview(WAVE1_RECORD));
  assert.deepEqual(previews.mapsTo, mapsToSectionPreview(WAVE1_RECORD));
});

test('Wave 2 WHAT preview prioritizes procedureId and de-emphasizes sourceTerm', () => {
  const preview = wave2WhatSectionPreview(WAVE2_MEASUREMENT);
  assert.equal(preview.primary, 'nsdwr3ss1-drain-pump');
  const sourceLine = preview.secondaryLines.find((line) => line.label === 'sourceTerm:');
  assert.equal(sourceLine?.deemphasize, true);
  assert.equal(sourceLine?.value, 'overlay-generated-id');
});

test('Wave 2 MAPS TO preview emphasizes candidateType', () => {
  const preview = wave2MapsToSectionPreview(WAVE2_MEASUREMENT);
  assert.equal(preview.primary, 'drain_test');
  const typeLine = preview.secondaryLines.find((line) => line.label === 'candidateType:');
  assert.equal(typeLine?.emphasize, true);
  assert.equal(typeLine?.value, 'measurementBinding');
});

test('Wave 2 diagnostic lines use measurement provenance only', () => {
  const lines = wave2DiagnosticKnowledgeLines(WAVE2_MEASUREMENT);
  assert.equal(lines.length, 2);
  assert.match(lines[0].value, /Drain pump winding resistance/);
  assert.match(lines[1].value, /insigniaDishwasherDrainPumpOhms/);
  assert.equal(wave2DiagnosticKnowledgeLines(WAVE1_RECORD).length, 0);
});

test('Wave 2 list row uses procedureId instead of sourceTerm as primary', () => {
  assert.equal(wave2ListRowPrimaryLabel(WAVE2_MEASUREMENT), 'nsdwr3ss1-drain-pump');
  assert.equal(isNewPlatformKnowledgeCandidate(WAVE2_MEASUREMENT), true);
  assert.equal(isNewPlatformKnowledgeCandidate(WAVE1_RECORD), false);
});

test('detail panel applies Wave 2 highlight header without changing Wave 1 header', () => {
  const detail = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewDetailPanel.js'),
    'utf8',
  );
  assert.match(detail, /reviewSectionPreviewsForCandidate/);
  assert.match(detail, /wave2-review-highlight/);
  assert.match(detail, /formatSourceTermLabel\(selected\)/);
});

test('workbench list uses Wave 2 row labels only for newPlatformKnowledge records', () => {
  const workbench = readFileSync(
    join(process.cwd(), 'components/solomon/knowledge/CandidateReviewWorkbench.js'),
    'utf8',
  );
  assert.match(workbench, /isNewPlatformKnowledgeCandidate\(record\)/);
  assert.match(workbench, /wave2ListRowPrimaryLabel/);
  assert.match(workbench, /formatSourceTermLabel\(record\)/);
});
