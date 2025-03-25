// utils/notificationsApi.js
import { useApi } from '../hooks/useApi';

export function useNotificationsApi() {
  const { apiClient } = useApi();

  const getNotifications = async (params = {}) => {
    if (!apiClient) return [];
    
    try {
      const response = await apiClient('/notifications', {
        params
      });
      return response;
    } catch (error) {
      console.error('Error fetching notifications:', error);
      throw error;
    }
  };

  const markNotificationAsRead = async (notificationId) => {
    if (!apiClient) return;
    
    try {
      const response = await apiClient(`/notifications/${notificationId}/read`, {
        method: 'PUT'
      });
      return response;
    } catch (error) {
      console.error('Error marking notification as read:', error);
      throw error;
    }
  };

  const markAllNotificationsAsRead = async () => {
    if (!apiClient) return;
    
    try {
      const response = await apiClient('/notifications/read-all', {
        method: 'PUT'
      });
      return response;
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      throw error;
    }
  };

  return {
    getNotifications,
    markNotificationAsRead,
    markAllNotificationsAsRead
  };
}