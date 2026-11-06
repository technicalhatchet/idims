import { apiClient } from '../../utils/api-client';

/**
 * Get user profile settings (rail prefs, display name, etc.)
 */
export async function getUserSettings() {
  return apiClient('/api/settings/user');
}

/**
 * Update user profile settings
 */
export async function updateUserSettings(settingsData) {
  return apiClient('/api/settings/user', {
    method: 'PUT',
    body: JSON.stringify(settingsData),
  });
}
