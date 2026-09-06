/** URL helpers for LoGiT — each screen is a real path so browser back works. */

export const LOGIT_ROOT = '/logit';

export function parseLogitSlug(slug) {
  const parts = Array.isArray(slug) ? slug : slug ? [slug] : [];
  if (parts.length === 0) {
    return { screen: 'projects', projectId: null, observationType: null, entryId: null };
  }

  const [projectId, ...rest] = parts;
  if (rest.length === 0) {
    return { screen: 'capture', projectId, observationType: null, entryId: null };
  }

  const [section, ...tail] = rest;
  if (section === 'capture' && tail[0]) {
    return { screen: 'type_capture', projectId, observationType: tail[0], entryId: null };
  }
  if (section === 'transcript') {
    return { screen: 'transcript', projectId, observationType: null, entryId: null };
  }
  if (section === 'review') {
    return { screen: 'review', projectId, observationType: null, entryId: null };
  }
  if (section === 'log') {
    return { screen: 'log', projectId, observationType: null, entryId: null };
  }
  if (section === 'entries' && tail[0]) {
    return { screen: 'entry', projectId, observationType: null, entryId: tail[0] };
  }

  return { screen: 'capture', projectId, observationType: null, entryId: null };
}

export function logitProjectsPath() {
  return LOGIT_ROOT;
}

export function logitCapturePath(projectId) {
  return `${LOGIT_ROOT}/${projectId}`;
}

export function logitTypeCapturePath(projectId, observationType) {
  return `${LOGIT_ROOT}/${projectId}/capture/${observationType}`;
}

export function logitTranscriptPath(projectId) {
  return `${LOGIT_ROOT}/${projectId}/transcript`;
}

export function logitReviewPath(projectId) {
  return `${LOGIT_ROOT}/${projectId}/review`;
}

export function logitLogPath(projectId) {
  return `${LOGIT_ROOT}/${projectId}/log`;
}

export function logitEntryPath(projectId, entryId) {
  return `${LOGIT_ROOT}/${projectId}/entries/${entryId}`;
}
