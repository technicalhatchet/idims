import { apiClient } from '../../utils/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Get appointments for a work order
 * @param {string} workOrderId - The ID of the work order
 * @returns {Promise<Object>} - The appointments data
 */
export async function getWorkOrderAppointments(workOrderId) {
  try {
    return await apiClient(`api/work-orders/${workOrderId}/appointments?limit=500`);
  } catch (error) {
    console.error('Error fetching work order appointments:', error);
    throw error;
  }
}

/**
 * Create a new appointment for a work order
 * @param {string} workOrderId - The ID of the work order
 * @param {Object} appointmentData - The appointment data to create
 * @returns {Promise<Object>} - The created appointment
 */
export async function createWorkOrderAppointment(workOrderId, appointmentData) {
  try {
    return await apiClient(`api/work-orders/${workOrderId}/appointments`, {
      method: 'POST',
      body: JSON.stringify(appointmentData),
    });
  } catch (error) {
    console.error('Error creating work order appointment:', error);
    throw error;
  }
}

/**
 * Update an existing appointment
 * @param {string} appointmentId - The ID of the appointment to update
 * @param {Object} appointmentData - The updated appointment data
 * @returns {Promise<Object>} - The updated appointment
 */
export async function updateAppointment(appointmentId, appointmentData) {
  try {
    return await apiClient(`api/work-orders/appointments/${appointmentId}`, {
      method: 'PUT',
      body: JSON.stringify(appointmentData),
    });
  } catch (error) {
    console.error('Error updating appointment:', error);
    throw error;
  }
}

/**
 * Delete an appointment
 * @param {string} appointmentId - The ID of the appointment to delete
 * @returns {Promise<Object|null>} - Returns null for successful deletion (204 No Content)
 */
export async function deleteAppointment(appointmentId) {
  try {
    const result = await apiClient(`api/work-orders/appointments/${appointmentId}`, {
      method: 'DELETE',
    });
    
    // 204 No Content will return null, which is expected
    return result;
  } catch (error) {
    console.error('Error deleting appointment:', error);
    throw error;
  }
}

/**
 * Get a specific appointment by ID
 * @param {string} appointmentId - The ID of the appointment to retrieve
 * @returns {Promise<Object>} - The appointment data
 */
export async function getAppointment(appointmentId) {
  try {
    return await apiClient(`api/work-orders/appointments/${appointmentId}`);
  } catch (error) {
    console.error('Error fetching appointment:', error);
    throw error;
  }
}

/**
 * Hook for work order appointments
 */
export function useWorkOrderAppointments(workOrderId, options = {}) {
  return useQuery({
    queryKey: ['workOrderAppointments', workOrderId],
    queryFn: () => getWorkOrderAppointments(workOrderId),
    enabled: !!workOrderId,
    ...options,
  });
}

/**
 * Hook for a single appointment
 */
export function useAppointment(appointmentId, options = {}) {
  return useQuery({
    queryKey: ['appointment', appointmentId],
    queryFn: () => getAppointment(appointmentId),
    enabled: !!appointmentId,
    ...options,
  });
}

/**
 * Hook for appointment mutations
 */
export function useAppointmentMutations() {
  const queryClient = useQueryClient();
  
  // Create appointment
  const createAppointmentMutation = useMutation({
    mutationFn: ({ workOrderId, data }) => createWorkOrderAppointment(workOrderId, data),
    onSuccess: (_, { workOrderId }) => {
      queryClient.invalidateQueries({ queryKey: ['workOrderAppointments', workOrderId] });
    },
  });
  
  // Update appointment
  const updateAppointmentMutation = useMutation({
    mutationFn: ({ appointmentId, data, workOrderId }) => updateAppointment(appointmentId, data),
    onSuccess: (_, { workOrderId }) => {
      if (workOrderId) {
        queryClient.invalidateQueries({ queryKey: ['workOrderAppointments', workOrderId] });
      }
      queryClient.invalidateQueries({ queryKey: ['appointment', _.id] });
    },
  });
  
  // Delete appointment
  const deleteAppointmentMutation = useMutation({
    mutationFn: (appointmentId) => deleteAppointment(appointmentId),
    onSuccess: (_, __, context) => {
      if (context && context.workOrderId) {
        queryClient.invalidateQueries({ queryKey: ['workOrderAppointments', context.workOrderId] });
      }
    },
  });
  
  return {
    createAppointment: createAppointmentMutation.mutateAsync,
    updateAppointment: updateAppointmentMutation.mutateAsync,
    deleteAppointment: deleteAppointmentMutation.mutateAsync,
    isCreating: createAppointmentMutation.isPending,
    isUpdating: updateAppointmentMutation.isPending,
    isDeleting: deleteAppointmentMutation.isPending,
  };
}

/**
 * Fetches the full schedule for a specific technician on a given date.
 * @param {string} technicianId - The UUID of the technician.
 * @param {string} scheduleDate - The date in YYYY-MM-DD format.
 * @returns {Promise<Array>} A promise that resolves to an array of appointment objects.
 */
export const getTechnicianSchedule = async (technicianId, scheduleDate) => {
  console.log(`[api/appointmentsApi] Fetching schedule for tech ${technicianId} on date ${scheduleDate}`);
  if (!technicianId || !scheduleDate) {
    console.error('[api/appointmentsApi] technicianId and scheduleDate are required for getTechnicianSchedule.');
    // Returning an empty array mimics a failed fetch or no data, preventing crashes downstream
    return []; 
  }
  try {
    // Ensure the date is in YYYY-MM-DD format
    let formattedDate = scheduleDate;
    if (scheduleDate.includes('T')) {
      // If the date includes time (ISO format), strip it
      formattedDate = scheduleDate.split('T')[0];
    }
    
    // Construct the query parameters
    const params = new URLSearchParams({
      technician_id: technicianId,
      schedule_date: formattedDate
    }).toString();
    
    // Use apiClient to make the authenticated GET request
    const response = await apiClient(`api/work-orders/appointments/schedule?${params}`);
    
    console.log(`[api/appointmentsApi] Raw response for getTechnicianSchedule:`, response);

    // Assuming the API returns the array of appointments directly
    // Perform basic validation if needed
    if (Array.isArray(response)) {
        console.log(`[api/appointmentsApi] Successfully fetched ${response.length} schedule items.`);
        return response;
    } else {
        console.warn('[api/appointmentsApi] getTechnicianSchedule did not receive an array:', response);
        return []; // Return empty array if the format is unexpected
    }
  } catch (error) {
    console.error(`[api/appointmentsApi] Error fetching technician schedule for ${technicianId} on ${scheduleDate}:`, error);
    // Return empty array so the scheduler can continue with local data
    return []; 
  }
}; 