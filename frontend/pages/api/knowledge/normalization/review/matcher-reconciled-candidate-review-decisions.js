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
const DECISIONS_FILE = 'CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_DECISIONS_v1.json';
const SCOPE_FILE = 'CG_MATCHER_RECONCILED_CANDIDATE_REVIEW_v1.json';
const ALLOWED = new Set(['accepted', 'deferred', 'rejected']);

function decisionsPath() {
  return path.join(REVIEW_DIR, DECISIONS_FILE);
}

function scopePath() {
  return path.join(CALIBRATION_DIR, SCOPE_FILE);
}

async function loadDecisions() {
  try {
    const raw = await fs.readFile(decisionsPath(), 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return {
        schemaVersion: 1,
        reportType: 'matcher_reconciled_candidate_review_decisions',
        gateId: 'matcher-reconciled-candidate-review-v1',
        decisions: {},
        automaticDecisionsApplied: false,
        mergedIntoProductionReviewDecisions: false,
      };
    }
    throw error;
  }
}

async function loadScopeIndex() {
  const raw = await fs.readFile(scopePath(), 'utf8');
  const scope = JSON.parse(raw);
  const index = new Map();
  (scope.scopeRecords || []).forEach((item) => {
    if (item?.decisionId) {
      index.set(item.decisionId, item);
    }
  });
  return { scope, index };
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

  const { decisionId, decision, rationale, notes } = req.body || {};
  if (!decisionId || typeof decisionId !== 'string') {
    return res.status(400).json({ error: 'decisionId is required' });
  }
  if (!ALLOWED.has(decision)) {
    return res.status(400).json({ error: 'decision must be accepted, deferred, or rejected' });
  }

  const { scope, index } = await loadScopeIndex();
  if (scope.status !== 'GREEN') {
    return res.status(400).json({ error: 'matcher-reconciled review gate is not GREEN' });
  }
  const scopeItem = index.get(decisionId);
  if (!scopeItem) {
    return res.status(400).json({ error: 'decisionId is not in the 52-record review scope' });
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
    rationale: rationale || notes || null,
  });

  store.automaticDecisionsApplied = false;
  store.mergedIntoProductionReviewDecisions = false;
  store.decisions[decisionId] = {
    ...existing,
    decisionId,
    candidateId: scopeItem.candidateId,
    candidateKey: scopeItem.candidateKey,
    manualId: scopeItem.manualId,
    procedureId: scopeItem.procedureId,
    procedureFamily: scopeItem.procedureFamily,
    decision,
    reviewer,
    timestamp: now,
    updatedAt: now,
    currentReviewClass: scopeItem.currentReviewClass,
    currentProposedCanonicalId: scopeItem.currentProposedCanonicalId,
    matcherImprovement: scopeItem.matcherImprovement,
    deltaReconciliationDecision: scopeItem.deltaReconciliationDecision,
    productionReconciliation: scopeItem.productionReconciliation,
    rationale: rationale || notes || null,
    history,
  };

  await saveDecisions(store);

  return res.status(200).json({
    decision: store.decisions[decisionId],
    message:
      'Matcher-reconciled review decision recorded. Does not promote canonical knowledge or modify the 796 production review decisions.',
  });
});
