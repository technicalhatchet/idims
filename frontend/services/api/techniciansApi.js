import { apiClient } from '../../utils/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get technicians with pagination and filters
 */
export const getTechnicians = async (params = {}) => {
  try {
    const response = await apiClient.get('/technicians', { params });
    return response.data;
  } catch (error) {
    console.error('Error fetching technicians:', error);
    throw error;
  }
};

/**
 * Get a specific technician by ID
 */
export const getTechnician = async (id) => {
  try {
    const response = await apiClient.get(`/technicians/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error fetching technician ${id}:`, error);
    throw error;
  }
};

/**
 * Create a new technician
 */
export const createTechnician = async (technicianData) => {
  try {
    const response = await apiClient.post('/technicians', technicianData);
    return response.data;
  } catch (error) {
    console.error('Error creating technician:', error);
    throw error;
  }
};

/**
 * Update an existing technician
 */
export const updateTechnician = async (id, technicianData) => {
  try {
    const response = await apiClient.put(`/technicians/${id}`, technicianData);
    return response.data;
  } catch (error) {
    console.error(`Error updating technician ${id}:`, error);
    throw error;
  }
};

/**
 * Delete a technician
 */
export const deleteTechnician = async (id) => {
  try {
    const response = await apiClient.delete(`/technicians/${id}`);
    return response.data;
  } catch (error) {
    console.error(`Error deleting technician ${id}:`, error);
    throw error;
  }
};

/**
 * Get technician workload for a period
 */
export const getTechnicianWorkload = async (id, startDate, endDate) => {
  try {
    const response = await apiClient.get(`/technicians/${id}/schedule`, { 
      params: { 
        start_date: startDate instanceof Date ? startDate.toISOString() : startDate,
        end_date: endDate instanceof Date ? endDate.toISOString() : endDate
      } 
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching technician ${id} schedule:`, error);
    throw error;
  }
};

/**
 * Get technician performance metrics
 */
export const getTechnicianPerformance = async (id, period = 'month') => {
  try {
    const response = await apiClient.get(`/technicians/${id}/performance`, { 
      params: { period } 
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching technician ${id} performance:`, error);
    throw error;
  }
};

/**
 * Get all available skills
 */
export async function getSkills() {
  return apiClient(`${API_URL}/api/technicians/skills`);
}

/**
 * Get technician availability for scheduling
 */
export const getTechnicianAvailability = async (id, startDate, endDate) => {
  try {
    const response = await apiClient.get(`/technicians/${id}/availability`, {
      params: {
        start_date: startDate instanceof Date ? startDate.toISOString() : startDate,
        end_date: endDate instanceof Date ? endDate.toISOString() : endDate
      }
    });
    return response.data;
  } catch (error) {
    console.error(`Error fetching technician ${id} availability:`, error);
    throw error;
  }
};

/**
 * Update technician availability
 */
export const updateTechnicianAvailability = async (id, availabilityData) => {
  try {
    const response = await apiClient.put(`/technicians/${id}/availability`, availabilityData);
    return response.data;
  } catch (error) {
    console.error(`Error updating technician ${id} availability:`, error);
    throw error;
  }
};
