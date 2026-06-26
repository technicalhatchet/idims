import { buildApiUrl, getAuthHeaders } from '../../utils/api-client';

export async function uploadPartsLookupLogo(file, { providerId } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (providerId) {
    form.append('provider_id', providerId);
  }

  const headers = await getAuthHeaders();
  const url = buildApiUrl('settings/parts/logo');

  const response = await fetch(url, {
    method: 'POST',
    headers,
    body: form,
    credentials: 'include',
  });

  if (!response.ok) {
    let detail = 'Logo upload failed';
    try {
      const err = await response.json();
      detail = err.detail || err.message || detail;
    } catch (_) {
      /* ignore */
    }
    throw new Error(typeof detail === 'string' ? detail : 'Logo upload failed');
  }

  return response.json();
}
