import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getWorkOrderAppointments, 
  getWorkOrderAppointment,
  createWorkOrderAppointment, 
  updateWorkOrderAppointment, 
  deleteWorkOrderAppointment 
} from '../utils/api-client/workOrdersApi';

export function useWorkOrderAppointments(workOrderId, options = {}) {
  return useQuery({
    queryKey: ['workOrderAppointments', workOrderId],
    queryFn: () => getWorkOrderAppointments(workOrderId),
    enabled: !!workOrderId,
    ...options,
  });
}

export function useWorkOrderAppointment(workOrderId, appointmentId, options = {}) {
  return useQuery({
    queryKey: ['workOrderAppointment', workOrderId, appointmentId],
    queryFn: () => getWorkOrderAppointment(workOrderId, appointmentId),
    enabled: !!workOrderId && !!appointmentId,
    ...options,
  });
}

export function useWorkOrderAppointmentMutations(workOrderId) {
  const queryClient = useQueryClient();

  const createAppointmentMutation = useMutation({
    mutationFn: (data) => createWorkOrderAppointment(workOrderId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrderAppointments', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
    }
  });

  const updateAppointmentMutation = useMutation({
    mutationFn: ({ appointmentId, data }) => updateWorkOrderAppointment(workOrderId, appointmentId, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workOrderAppointments', workOrderId] });
      if (data && data.id) {
        queryClient.invalidateQueries({ queryKey: ['workOrderAppointment', workOrderId, data.id] });
      }
      queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
    }
  });

  const deleteAppointmentMutation = useMutation({
    mutationFn: (appointmentId) => deleteWorkOrderAppointment(workOrderId, appointmentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workOrderAppointments', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['workOrder', workOrderId] });
    }
  });

  return {
    createAppointmentMutation,
    updateAppointmentMutation,
    deleteAppointmentMutation
  };
} 