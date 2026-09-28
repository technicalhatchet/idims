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
const DECISIONS_FILE = 'CG_MATCHER_IMPROVEMENT_REVIEW_DECISIONS_v1.json';
const REVIEW_FILE = 'CG_MATCHER_IMPROVEMENT_REVIEW_v1.json';
const ALLOWED_STATUSES = new Set(['approve', 'defer', 'reject', 'no_change']);

function decisionsPath() {
  return path.join(REVIEW_DIR, DECISIONS_FILE);
}

function reviewPath() {
  return path.join(CALIBRATION_DIR, REVIEW_FILE);
}

async function loadDecisions() {
  try {
    const raw = await fs.readFile(decisionsPath(), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        schemaVersion: 1,
        reportType: 'matcher_improvement_review_decisions',
        gateId: 'matcher-improvement-wave1',
        decisions: {},
      };
    }
    throw error;
  }
}

async function loadAllowedBacklogIds() {
  const raw = await fs.readFile(reviewPath(), 'utf8');
  const review = JSON.parse(raw);
  const items = review.reviewItems || [];
  return new Set(items.map((item) => item.backlogId).filter(Boolean));
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
    backlogId,
    reviewStatus,
    reason,
    batchRunId,
  } = req.body || {};

  if (!backlogId || typeof backlogId !== 'string') {
    return res.status(400).json({ error: 'backlogId is required' });
  }
  if (!ALLOWED_STATUSES.has(reviewStatus)) {
    return res.status(400).json({ error: 'reviewStatus must be approve, defer, reject, or no_change' });
  }

  const allowedIds = await loadAllowedBacklogIds();
  if (!allowedIds.has(backlogId)) {
    return res.status(400).json({ error: 'backlogId is not in the matcher improvement review gate' });
  }

  const reviewer = session.user.email || session.user.sub || 'unknown';
  const store = await loadDecisions();
  const now = new Date().toISOString();
  const existing = store.decisions[backlogId] || {};
  const history = Array.isArray(existing.history) ? [...existing.history] : [];
  history.push({
    at: now,
    reviewStatus,
    reviewer,
    reason: reason || null,
  });

  store.decisions[backlogId] = {
    ...existing,
    backlogId,
    reviewStatus,
    reviewer,
    reason: reason || null,
    batchRunId: batchRunId || existing.batchRunId || null,
    updatedAt: now,
    history,
  };

  await saveDecisions(store);

  return res.status(200).json({
    decision: store.decisions[backlogId],
    matcherImplementationAuthorized: false,
    message: 'Matcher improvement review recorded. Approval does not apply matcher changes.',
  });
});
