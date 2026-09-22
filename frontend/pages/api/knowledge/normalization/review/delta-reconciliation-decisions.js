import { promises as fs } from 'fs';
import path from 'path';
import { getSession, withApiAuthRequired } from '@auth0/nextjs-auth0';
import { getUserRole } from '../../../../../utils/auth0-helpers';

const STAFF_ROLES = new Set(['admin', 'manager', 'technician']);
const REVIEW_DIR = path.join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/review',
);
const CALIBRATION_DIR = path.join(
  process.cwd(),
  'components/diagnostics/knowledge/normalization/calibration',
);
const DECISIONS_FILE = 'CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_DECISIONS_v1.json';
const QUEUE_FILE = 'CG_MATCHER_IMPROVEMENT_DELTA_RECONCILIATION_QUEUE_v1.json';
const POPULATION_A = new Set(['accept_staged', 'defer_staged', 'reject_staged']);
const POPULATION_B = new Set(['accept_staged', 'keep_production_baseline', 'defer_review']);

function decisionsPath() {
  return path.join(REVIEW_DIR, DECISIONS_FILE);
}

function queuePath() {
  return path.join(CALIBRATION_DIR, QUEUE_FILE);
}

async function loadDecisions() {
  try {
    const raw = await fs.readFile(decisionsPath(), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        schemaVersion: 1,
        reportType: 'matcher_improvement_delta_reconciliation_decisions',
        gateId: 'matcher-improvement-delta-reconciliation-v1',
        decisions: {},
        automaticDecisionsApplied: false,
      };
    }
    throw error;
  }
}

async function loadQueueIndex() {
  const raw = await fs.readFile(queuePath(), 'utf8');
  const queue = JSON.parse(raw);
  const index = new Map();
  (queue.populationA || []).forEach((item) => {
    if (item?.decisionId) {
      index.set(item.decisionId, { ...item, population: 'A' });
    }
  });
  (queue.populationB || []).forEach((item) => {
    if (item?.decisionId) {
      index.set(item.decisionId, { ...item, population: 'B' });
    }
  });
  return index;
}

async function saveDecisions(store) {
  await fs.mkdir(REVIEW_DIR, { recursive: true });
  await fs.writeFile(decisionsPath(), `${JSON.stringify(store, null, 2)}\n`, 'utf8');
}

function isStaffUser(user) {
  const role = getUserRole(user);
  return STAFF_ROLES.has(role);
}

export default withApiAuthRequired(async function handler(req, res) {
  const session = await getSession(req, res);
  if (!session?.user || !isStaffUser(session.user)) {
    return res.status(403).json({ error: 'Staff access required' });
  }

  if (req.method === 'GET') {
    const store = await loadDecisions();
    return res.status(200).json(store);
  }

  if (req.method !== 'POST') {
    res.setHeader('Allow', ['GET', 'POST']);
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    decisionId,
    population,
    decision,
    rationale,
    candidateKey,
    baselineClassification,
    stagedClassification,
    baselineTarget,
    stagedTarget,
  } = req.body || {};

  if (!decisionId || typeof decisionId !== 'string') {
    return res.status(400).json({ error: 'decisionId is required' });
  }
  if (!population || (population !== 'A' && population !== 'B')) {
    return res.status(400).json({ error: 'population must be A or B' });
  }
  const allowed = population === 'A' ? POPULATION_A : POPULATION_B;
  if (!allowed.has(decision)) {
    return res.status(400).json({ error: `decision not allowed for population ${population}` });
  }

  const queueIndex = await loadQueueIndex();
  const queueItem = queueIndex.get(decisionId);
  if (!queueItem) {
    return res.status(400).json({ error: 'decisionId is not in the delta reconciliation queue' });
  }
  if (queueItem.population !== population) {
    return res.status(400).json({ error: 'population does not match queue item' });
  }

  const reviewer = session.user.email || session.user.sub || 'unknown';
  const store = await loadDecisions();
  const now = new Date().toISOString();
  const existing = store.decisions[decisionId] || {};
  const history = Array.isArray(existing.history) ? [...existing.history] : [];
  history.push({
    at: now,
    decision,
    reviewer,
    rationale: rationale || null,
  });

  store.automaticDecisionsApplied = false;
  store.decisions[decisionId] = {
    ...existing,
    decisionId,
    candidateKey: candidateKey || queueItem.candidateKey,
    population,
    decision,
    reviewer,
    rationale: rationale || null,
    baselineClassification: baselineClassification ?? queueItem.baselineClassification ?? null,
    stagedClassification: stagedClassification ?? queueItem.stagedClassification ?? null,
    baselineTarget: baselineTarget ?? queueItem.baselineProposedCanonicalId ?? null,
    stagedTarget: stagedTarget ?? queueItem.stagedProposedCanonicalId ?? null,
    updatedAt: now,
    history,
  };

  await saveDecisions(store);

  return res.status(200).json({
    decision: store.decisions[decisionId],
    message: 'Delta reconciliation decision recorded. Does not modify production candidates or the 796 review decisions.',
  });
});
