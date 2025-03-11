import { apiClient } from '@/utils/fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get schedule data for a date range
 */
export async function getSchedule(
  startDate, 
  endDate, 
  technicianId = null, 
  clientId = null, 
  viewType = 'day'
) {
  const queryParams = new URLSearchParams();
  
  // Required parameters
  queryParams.append('start_date', startDate.toISOString());
  queryParams.append('end_date', endDate.toISOString());
  queryParams.append('view_type', viewType);
  
  // Optional filters
  if (technicianId) queryParams.append('technician_id', technicianId);
  if (clientId) queryParams.append('client_id', clientId);
  
  return apiClient(`${API_URL}/api/schedule?${queryParams.toString()}`);
}

/**
 * Schedule an appointment
 */
export async function scheduleAppointment(
  workOrderId, 
  startTime, 
  endTime, 
  technicianId = null, 
  notes = null
) {
  return apiClient(`${API_URL}/api/schedule`, {
    method: 'POST',
    body: JSON.stringify({
      work_order_id: workOrderId,
      start_time: startTime instanceof Date ? startTime.toISOString() : startTime,
      end_time: endTime instanceof Date ? endTime.toISOString() : endTime,
      technician_id: technicianId,
      notes: notes
    }),
  });
}

/**
 * Get available appointment slots for a date
 */
export async function getAvailableSlots(
  date, 
  technicianId = null, 
  durationMinutes = 60
) {
  const queryParams = new URLSearchParams();
  
  // Required parameters
  queryParams.append('date', date.toISOString());
  queryParams.append('duration_minutes', durationMinutes);
  
  // Optional filters
  if (technicianId) queryParams.append('technician_id', technicianId);
  
  return apiClient(`${API_URL}/api/schedule/available-slots?${queryParams.toString()}`);
}

/**
 * Check technician availability
 */
export async function getTechnicianScheduleAvailability(
  technicianId, 
  startDate, 
  endDate
) {
  const queryParams = new URLSearchParams();
  queryParams.append('start_date', startDate.toISOString());
  queryParams.append('end_date', endDate.toISOString());
  
  return apiClient(`${API_URL}/api/technicians/${technicianId}/availability?${queryParams.toString()}`);
}

/**
 * Get conflicts for a time slot
 */
export async function getScheduleConflicts(
  startTime, 
  endTime, 
  technicianId = null,
  excludeWorkOrderId = null
) {
  const queryParams = new URLSearchParams();
  queryParams.append('start_time', startTime.toISOString());
  queryParams.append('end_time', endTime.toISOString());
  
  if (technicianId) queryParams.append('technician_id', technicianId);
  if (excludeWorkOrderId) queryParams.append('exclude_work_order_id', excludeWorkOrderId);
  
  return apiClient(`${API_URL}/api/schedule/conflicts?${queryParams.toString()}`);
}
