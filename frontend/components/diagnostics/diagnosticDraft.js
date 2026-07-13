export function getDiagnosticDraftKey(workOrderId, noteId = null) {
  if (!workOrderId) return null;
  if (noteId) return `idims:diag-draft:${workOrderId}:edit:${noteId}`;
  return `idims:diag-draft:${workOrderId}:new`;
}

export function clearDiagnosticDraft(draftKey) {
  if (!draftKey) return;
  try {
    localStorage.removeItem(draftKey);
  } catch {
    // ignore
  }
}

export function persistDiagnosticDraft(draftKey, payload) {
  if (!draftKey) return;
  try {
    localStorage.setItem(
      draftKey,
      JSON.stringify({
        ...payload,
        savedAt: Date.now(),
      }),
    );
  } catch {
    // ignore quota / private mode
  }
}

export function loadDiagnosticDraft(draftKey) {
  if (!draftKey) return null;
  try {
    const raw = localStorage.getItem(draftKey);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed?.templateId) return null;
    return parsed;
  } catch {
    return null;
  }
}
