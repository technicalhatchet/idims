import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  getSchedule, 
  scheduleAppointment, 
  getAvailableSlots
} from '@/services/api/schedulingApi';

/**
 * Hook for schedule data with filters
 */
export function useSchedule(params = {}, options = {}) {
  const { 
    startDate,
    endDate,
    technicianId,
    clientId,
    viewType = 'day'
  } = params;
  
  return useQuery(
    [
      'schedule', 
      startDate?.toISOString(), 
      endDate?.toISOString(), 
      technicianId, 
      clientId, 
      viewType
    ],
    () => getSchedule(startDate, endDate, technicianId, clientId, viewType),
    {
      enabled: !!startDate && !!endDate,
      keepPreviousData: true,
      ...options,
    }
  );
}

/**
 * Hook for available appointment slots
 */
export function useAvailableSlots(params = {}, options = {}) {
  const { 
    date,
    technicianId,
    durationMinutes = 60
  } = params;
  
  return useQuery(
    ['availableSlots', date?.toISOString(), technicianId, durationMinutes],
    () => getAvailableSlots(date, technicianId, durationMinutes),
    {
      enabled: !!date,
      ...options,
    }
  );
}

/**
 * Hook for scheduling operations
 */
export function useScheduleMutations() {
  const queryClient = useQueryClient();
  
  // Schedule appointment
  const scheduleMutation = useMutation(
    ({ workOrderId, startTime, endTime, technicianId, notes }) => 
      scheduleAppointment(workOrderId, startTime, endTime, technicianId, notes),
    {
      onSuccess: (data) => {
        // Invalidate schedule data
        queryClient.invalidateQueries('schedule');
        
        // Invalidate work order data
        if (data.work_order_id) {
          queryClient.invalidateQueries(['workOrder', data.work_order_id]);
          queryClient.invalidateQueries('workOrders');
        }
        
        // Invalidate technician availability if applicable
        if (data.technician_id) {
          queryClient.invalidateQueries(['technicianAvailability', data.technician_id]);
        }
        
        return data;
      },
    }
  );
  
  return {
    scheduleAppointment: scheduleMutation.mutateAsync,
    isLoading: scheduleMutation.isLoading,
    error: scheduleMutation.error,
  };
}
