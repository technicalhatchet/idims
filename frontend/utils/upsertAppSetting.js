import { apiClient } from './api-client';

/** True when PATCH /api/settings/:key failed because the row does not exist yet. */
export function isSettingNotFoundError(err) {
  if (!err) return false;
  if (err.status === 404) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('not found');
}

/**
 * PATCH app setting value, or POST /api/settings/ to create on first save.
 * @param {{ key: string, value: unknown, description?: string }} params
 */
export async function upsertAppSetting({ key, value, description = '' }) {
  try {
    return await apiClient(`/api/settings/${key}`, {
      method: 'PATCH',
      body: JSON.stringify({ value }),
    });
  } catch (err) {
    if (!isSettingNotFoundError(err)) {
      throw err;
    }
    return await apiClient('/api/settings/', {
      method: 'POST',
      body: JSON.stringify({
        key,
        value,
        description,
      }),
    });
  }
}
