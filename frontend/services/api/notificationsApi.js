import { apiClient } from '../../utils/fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get notifications
 */
export async function getNotifications(params = {}) {
  const { page = 1, limit = 20, is_read } = params;
  
  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  if (is_read !== undefined) queryParams.append('is_read', is_read);
  
  return apiClient(`${API_URL}/api/notifications?${queryParams.toString()}`);
}

/**
 * Mark notification as read
 */
export async function markNotificationAsRead(id) {
  return apiClient(`${API_URL}/api/notifications/${id}/read`, {
    method: 'PUT',
  });
}

/**
 * Mark all notifications as read
 */
export async function markAllNotificationsAsRead() {
  return apiClient(`${API_URL}/api/notifications/read-all`, {
    method: 'PUT',
  });
}

/**
 * Send custom notification
 */
export async function sendCustomNotification(notificationData) {
  return apiClient(`${API_URL}/api/notifications/send`, {
    method: 'POST',
    body: JSON.stringify(notificationData),
  });
}