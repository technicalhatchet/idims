import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getSchedule, 
  scheduleAppointment, 
  getAvailableSlots
} from '../services/api/schedulingApi';

/**
 * Format a date for query keys - using just the date part
 */
function formatDateKey(date) {
  return date ? date.toISOString().split('T')[0] : undefined;
}

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
  
  return useQuery({
    queryKey: [
      'schedule', 
      formatDateKey(startDate), 
      formatDateKey(endDate), 
      technicianId, 
      clientId, 
      viewType
    ],
    queryFn: () => getSchedule(startDate, endDate, technicianId, clientId, viewType),
    enabled: !!startDate && !!endDate,
    keepPreviousData: true,
    ...options,
  });
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
  
  return useQuery({
    queryKey: ['availableSlots', formatDateKey(date), technicianId, durationMinutes],
    queryFn: () => getAvailableSlots(date, technicianId, durationMinutes),
    enabled: !!date,
    ...options,
  });
}

/**
 * Hook for scheduling operations
 */
export function useScheduleMutations() {
  const queryClient = useQueryClient();
  
  // Schedule appointment
  const scheduleMutation = useMutation({
    mutationFn: ({ workOrderId, startTime, endTime, technicianId, notes }) => 
      scheduleAppointment(workOrderId, startTime, endTime, technicianId, notes),
    onSuccess: (data) => {
      // Invalidate schedule data
      queryClient.invalidateQueries({queryKey: ['schedule']});
      
      // Invalidate work order data
      if (data.work_order_id) {
        queryClient.invalidateQueries({queryKey: ['workOrder', data.work_order_id]});
        queryClient.invalidateQueries({queryKey: ['workOrders']});
      }
      
      // Invalidate technician availability if applicable
      if (data.technician_id) {
        queryClient.invalidateQueries({queryKey: ['technicianAvailability', data.technician_id]});
      }
      
      return data;
    },
  });
  
  return {
    scheduleAppointment: scheduleMutation.mutateAsync,
    isLoading: scheduleMutation.isLoading,
    error: scheduleMutation.error,
  };
}
