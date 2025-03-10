import { apiClient } from '@/utils/fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get technicians with pagination and filters
 */
export async function getTechnicians(params = {}) {
  const { page = 1, limit = 10, search, status, skill } = params;
  
  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  if (search) queryParams.append('search', search);
  if (status) queryParams.append('status', status);
  if (skill) queryParams.append('skill', skill);
  
  return apiClient(`${API_URL}/api/technicians?${queryParams.toString()}`);
}

/**
 * Get a specific technician by ID
 */
export async function getTechnician(id) {
  return apiClient(`${API_URL}/api/technicians/${id}`);
}

/**
 * Create a new technician
 */
export async function createTechnician(technicianData) {
  return apiClient(`${API_URL}/api/technicians`, {
    method: 'POST',
    body: JSON.stringify(technicianData),
  });
}

/**
 * Update an existing technician
 */
export async function updateTechnician(id, technicianData) {
  return apiClient(`${API_URL}/api/technicians/${id}`, {
    method: 'PUT',
    body: JSON.stringify(technicianData),
  });
}

/**
 * Delete a technician
 */
export async function deleteTechnician(id) {
  const response = await apiClient(`${API_URL}/api/technicians/${id}`, {
    method: 'DELETE',
  });
  
  return response === null; // 204 No Content
}

/**
 * Get technician workload for a period
 */
export async function getTechnicianWorkload(id, startDate, endDate) {
  const queryParams = new URLSearchParams();
  queryParams.append('start_date', startDate.toISOString());
  queryParams.append('end_date', endDate.toISOString());
  
  return apiClient(`${API_URL}/api/technicians/${id}/workload?${queryParams.toString()}`);
}

/**
 * Get technician performance metrics
 */
export async function getTechnicianPerformance(id, period = 'month') {
  const queryParams = new URLSearchParams();
  queryParams.append('period', period);
  
  return apiClient(`${API_URL}/api/technicians/${id}/performance?${queryParams.toString()}`);
}

/**
 * Get all available skills
 */
export async function getSkills() {
  return apiClient(`${API_URL}/api/technicians/skills`);
}

/**
 * Get technician availability for scheduling
 */
export async function getTechnicianAvailability(id, startDate, endDate) {
  const queryParams = new URLSearchParams();
  queryParams.append('start_date', startDate.toISOString());
  queryParams.append('end_date', endDate.toISOString());
  
  return apiClient(`${API_URL}/api/technicians/${id}/availability?${queryParams.toString()}`);
}

/**
 * Update technician availability
 */
export async function updateTechnicianAvailability(id, availabilityData) {
  return apiClient(`${API_URL}/api/technicians/${id}/availability`, {
    method: 'PUT',
    body: JSON.stringify(availabilityData),
  });
}
