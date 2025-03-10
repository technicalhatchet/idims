import { apiClient } from '@/utils/fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get application settings by key
 */
export async function getSetting(key) {
  return apiClient(`${API_URL}/api/settings/${key}`);
}

/**
 * Get multiple application settings by keys
 */
export async function getSettings(keys = []) {
  const queryParams = new URLSearchParams();
  keys.forEach(key => queryParams.append('keys', key));
  
  return apiClient(`${API_URL}/api/settings?${queryParams.toString()}`);
}

/**
 * Update an application setting
 */
export async function updateSetting(key, value) {
  return apiClient(`${API_URL}/api/settings/${key}`, {
    method: 'PUT',
    body: JSON.stringify({ value }),
  });
}

/**
 * Get user profile settings
 */
export async function getUserSettings() {
  return apiClient(`${API_URL}/api/settings/user`);
}

/**
 * Update user profile settings
 */
export async function updateUserSettings(settingsData) {
  return apiClient(`${API_URL}/api/settings/user`, {
    method: 'PUT',
    body: JSON.stringify(settingsData),
  });
}

/**
 * Get company settings
 */
export async function getCompanySettings() {
  return apiClient(`${API_URL}/api/settings/company`);
}

/**
 * Update company settings
 */
export async function updateCompanySettings(companyData) {
  return apiClient(`${API_URL}/api/settings/company`, {
    method: 'PUT',
    body: JSON.stringify(companyData),
  });
}

/**
 * Get notification templates
 */
export async function getNotificationTemplates() {
  return apiClient(`${API_URL}/api/settings/notification-templates`);
}

/**
 * Update notification template
 */
export async function updateNotificationTemplate(id, templateData) {
  return apiClient(`${API_URL}/api/settings/notification-templates/${id}`, {
    method: 'PUT',
    body: JSON.stringify(templateData),
  });
}

/**
 * Get invoice settings
 */
export async function getInvoiceSettings() {
  return apiClient(`${API_URL}/api/settings/invoices`);
}

/**
 * Update invoice settings
 */
export async function updateInvoiceSettings(settingsData) {
  return apiClient(`${API_URL}/api/settings/invoices`, {
    method: 'PUT',
    body: JSON.stringify(settingsData),
  });
}

/**
 * Get work order settings
 */
export async function getWorkOrderSettings() {
  return apiClient(`${API_URL}/api/settings/work-orders`);
}

/**
 * Update work order settings
 */
export async function updateWorkOrderSettings(settingsData) {
  return apiClient(`${API_URL}/api/settings/work-orders`, {
    method: 'PUT',
    body: JSON.stringify(settingsData),
  });
}

/**
 * Get integration settings
 */
export async function getIntegrationSettings(integration) {
  return apiClient(`${API_URL}/api/settings/integrations/${integration}`);
}

/**
 * Update integration settings
 */
export async function updateIntegrationSettings(integration, settingsData) {
  return apiClient(`${API_URL}/api/settings/integrations/${integration}`, {
    method: 'PUT',
    body: JSON.stringify(settingsData),
  });
}

/**
 * Test integration connection
 */
export async function testIntegrationConnection(integration, credentials) {
  return apiClient(`${API_URL}/api/settings/integrations/${integration}/test`, {
    method: 'POST',
    body: JSON.stringify(credentials),
  });
}

/**
 * Get system information
 */
export async function getSystemInfo() {
  return apiClient(`${API_URL}/api/settings/system-info`);
}
