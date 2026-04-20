import { apiClient } from '../utils/api-client';

export async function getNotifications(page = 1, limit = 20) {
    return apiClient('notifications', {
        params: { page, limit }
    });
}

export async function markNotificationAsRead(notificationId) {
    return apiClient(`notifications/${notificationId}/read`, {
        method: 'POST'
    });
}

export async function deleteNotification(notificationId) {
    return apiClient(`notifications/${notificationId}`, {
        method: 'DELETE'
    });
}

export async function clearAllNotifications() {
    return apiClient('notifications/clear', {
        method: 'POST'
    });
} 