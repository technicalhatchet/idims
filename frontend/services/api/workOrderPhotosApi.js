import { apiClient, buildApiUrl, getAuthHeaders } from '../../utils/api-client';

const BASE = 'work-orders';

export async function getWorkOrderPhotos(workOrderId) {
  return apiClient(`${BASE}/${workOrderId}/photos`);
}

export async function uploadWorkOrderPhoto(workOrderId, file, { description, isModelSnTag } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (description) form.append('description', description);
  form.append('is_model_sn_tag', isModelSnTag ? 'true' : 'false');

  const headers = await getAuthHeaders();
  const url = buildApiUrl(`${BASE}/${workOrderId}/photos`);

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include',
  });

  if (!response.ok) {
    let detail = 'Photo upload failed';
    try {
      const err = await response.json();
      detail = err.detail || err.message || detail;
    } catch (_) { /* ignore */ }
    throw new Error(typeof detail === 'string' ? detail : 'Photo upload failed');
  }
  return response.json();
}

export function getWorkOrderPhotoDownloadUrl(photoId) {
  return buildApiUrl(`${BASE}/photos/${photoId}/download`);
}

export async function fetchWorkOrderPhotoBlob(photoId) {
  const headers = await getAuthHeaders();
  const url = getWorkOrderPhotoDownloadUrl(photoId);
  const response = await fetch(url, { headers, credentials: 'include' });
  if (!response.ok) {
    let detail = 'Could not open photo';
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch (_) { /* ignore */ }
    throw new Error(typeof detail === 'string' ? detail : detail);
  }
  const blob = await response.blob();
  return {
    blobUrl: URL.createObjectURL(blob),
    mimeType: blob.type || response.headers.get('content-type') || '',
  };
}
