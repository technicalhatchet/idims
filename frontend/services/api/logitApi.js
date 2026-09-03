import { apiClient } from '../../utils/api-client';

export async function fetchLogitProjects() {
  return apiClient('logit/projects');
}

export async function createLogitProject(payload) {
  return apiClient('logit/projects', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateLogitProject(projectId, payload) {
  return apiClient(`logit/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteLogitProject(projectId) {
  return apiClient(`logit/projects/${projectId}`, {
    method: 'DELETE',
  });
}

export async function fetchLogitEntries(projectId) {
  return apiClient(`logit/projects/${projectId}/entries`);
}

export async function fetchLogitEntry(entryId) {
  return apiClient(`logit/entries/${entryId}`);
}

export async function classifyLogitObservation(projectId, transcript, observationType) {
  return apiClient('logit/classify', {
    method: 'POST',
    body: JSON.stringify({
      project_id: projectId,
      transcript,
      observation_type: observationType,
    }),
  });
}

export async function createLogitEntry(payload) {
  return apiClient('logit/entries', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function updateLogitEntry(entryId, payload) {
  return apiClient(`logit/entries/${entryId}`, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}

export async function deleteLogitEntry(entryId) {
  return apiClient(`logit/entries/${entryId}`, {
    method: 'DELETE',
  });
}
