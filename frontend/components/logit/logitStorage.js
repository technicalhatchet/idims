import {
  LOGIT_DRAFTS_KEY,
  LOGIT_LAST_PROJECT_KEY,
  LOGIT_PENDING_SAVES_KEY,
} from './logitUi';

function readJson(key, fallback) {
  if (typeof window === 'undefined') return fallback;
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson(key, value) {
  if (typeof window === 'undefined') return;
  localStorage.setItem(key, JSON.stringify(value));
}

export function getLastProjectId() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem(LOGIT_LAST_PROJECT_KEY);
}

export function setLastProjectId(projectId) {
  if (typeof window === 'undefined' || !projectId) return;
  localStorage.setItem(LOGIT_LAST_PROJECT_KEY, projectId);
}

export function loadLocalDrafts() {
  return readJson(LOGIT_DRAFTS_KEY, []);
}

export function saveLocalDraft(draft) {
  const drafts = loadLocalDrafts().filter((item) => item.localId !== draft.localId);
  drafts.unshift(draft);
  writeJson(LOGIT_DRAFTS_KEY, drafts.slice(0, 50));
}

export function removeLocalDraft(localId) {
  const drafts = loadLocalDrafts().filter((item) => item.localId !== localId);
  writeJson(LOGIT_DRAFTS_KEY, drafts);
}

export function loadPendingSaves() {
  return readJson(LOGIT_PENDING_SAVES_KEY, []);
}

export function savePendingSave(payload) {
  const pending = loadPendingSaves().filter((item) => item.localId !== payload.localId);
  pending.unshift(payload);
  writeJson(LOGIT_PENDING_SAVES_KEY, pending.slice(0, 20));
}

export function removePendingSave(localId) {
  const pending = loadPendingSaves().filter((item) => item.localId !== localId);
  writeJson(LOGIT_PENDING_SAVES_KEY, pending);
}

export function createLocalId() {
  return `local_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}
