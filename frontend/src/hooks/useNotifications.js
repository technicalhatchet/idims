import { useQuery, useMutation, useQueryClient } from 'react-query';
import { getNotifications, markNotificationAsRead, markAllNotificationsAsRead } from '@/services/api/notificationsApi';

export function useNotifications(params = {}) {
  const queryClient = useQueryClient();
  
  // Get notifications
  const { data, isLoading, error, refetch } = useQuery(
    ['notifications', params],
    () => getNotifications(params),
    {
      staleTime: 30000, // 30 seconds
    }
  );
  
  // Mark as read mutation
  const markAsReadMutation = useMutation(markNotificationAsRead, {
    onSuccess: () => {
      queryClient.invalidateQueries('notifications');
    },
  });
  
  // Mark all as read mutation
  const markAllAsReadMutation = useMutation(markAllNotificationsAsRead, {
    onSuccess: () => {
      queryClient.invalidateQueries('notifications');
    },
  });
  
  return {
    notifications: data?.items || [],
    unreadCount: data?.items?.filter(n => !n.is_read).length || 0,
    isLoading,
    error,
    refetch,
    markAsRead: markAsReadMutation.mutateAsync,
    markAllAsRead: markAllAsReadMutation.mutateAsync,
    isMutating: markAsReadMutation.isLoading || markAllAsReadMutation.isLoading,
  };
}