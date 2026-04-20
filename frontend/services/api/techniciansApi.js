import { apiClient } from '../../utils/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get technicians with pagination and filters
 */
export async function getTechnicians(params = {}) {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    
    const url = `technicians?${queryParams.toString()}`;
    const result = await apiClient(url);
    return result;
  } catch (error) {
    console.error('Error fetching technicians:', error);
    throw error;
  }
}

/**
 * Get a specific technician by ID
 */
export async function getTechnician(id) {
  try {
    console.log(`[TECHNICIAN API] Fetching technician with ID: ${id}`);
    const result = await apiClient(`technicians/${id}`);
    console.log(`[TECHNICIAN API] Successfully retrieved technician data:`, result);
    console.log(`[TECHNICIAN API] User data exists:`, !!result.user);
    if (result.user) {
      console.log(`[TECHNICIAN API] User data:`, {
        id: result.user.id,
        email: result.user.email,
        name: `${result.user.first_name} ${result.user.last_name}`
      });
    }
    return result;
  } catch (error) {
    console.error(`[TECHNICIAN API] Error fetching technician ${id}:`, error);
    throw error;
  }
}

/**
 * Create a new technician
 */
export async function createTechnician(technicianData) {
  try {
    // Clean up user data to ensure fields are properly provided
    const processedData = { ...technicianData };
    
    // Ensure user_email is not empty if provided
    if (processedData.user_email && processedData.user_email.trim() === '') {
      delete processedData.user_email;
    }
    
    // Make sure we have either user_id or user_email
    if (!processedData.user_id && !processedData.user_email) {
      throw new Error("Either user_id or user_email must be provided");
    }
    
    // Log the processed data for debugging
    console.log('Submitting technician data to API:', JSON.stringify(processedData, null, 2));
    
    // Use endpoint with trailing slash to avoid 307 redirect (which can cause data loss)
    const result = await apiClient('technicians/', {
      method: 'POST',
      body: JSON.stringify(processedData)
    });
    
    return result;
  } catch (error) {
    console.error('Error creating technician:', error);
    throw error;
  }
}

/**
 * Update an existing technician
 */
export async function updateTechnician(id, technicianData) {
  try {
    const result = await apiClient(`technicians/${id}`, {
      method: 'PUT',
      body: JSON.stringify(technicianData)
    });
    return result;
  } catch (error) {
    console.error(`Error updating technician ${id}:`, error);
    throw error;
  }
}

/**
 * Delete a technician
 */
export async function deleteTechnician(id) {
  try {
    const result = await apiClient(`technicians/${id}`, {
      method: 'DELETE'
    });
    return result;
  } catch (error) {
    console.error(`Error deleting technician ${id}:`, error);
    throw error;
  }
}

/**
 * Get technician workload
 */
export async function getTechnicianWorkload(id, startDate, endDate) {
  try {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('start_date', startDate.toISOString());
    if (endDate) queryParams.append('end_date', endDate.toISOString());
    
    const url = `technicians/${id}/workload?${queryParams.toString()}`;
    const result = await apiClient(url);
    return result;
  } catch (error) {
    console.error(`Error fetching workload for technician ${id}:`, error);
    throw error;
  }
}

/**
 * Get technician performance metrics
 */
export async function getTechnicianPerformance(id, period = 'month') {
  try {
    const result = await apiClient(`technicians/${id}/performance?period=${period}`);
    return result;
  } catch (error) {
    console.error(`Error fetching performance for technician ${id}:`, error);
    throw error;
  }
}

/**
 * Get all available skills
 */
export async function getSkills() {
  try {
    const result = await apiClient('skills');
    return result?.items || [];
  } catch (error) {
    console.error('Error fetching skills:', error);
    throw error;
  }
}

/**
 * Get technician availability
 */
export async function getTechnicianAvailability(id, startDate, endDate) {
  try {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('start_date', startDate.toISOString());
    if (endDate) queryParams.append('end_date', endDate.toISOString());
    
    const url = `technicians/${id}/availability?${queryParams.toString()}`;
    const result = await apiClient(url);
    return result;
  } catch (error) {
    console.error(`Error fetching availability for technician ${id}:`, error);
    throw error;
  }
}

/**
 * Update technician availability
 */
export async function updateTechnicianAvailability(id, availabilityData) {
  try {
    const result = await apiClient(`technicians/${id}/availability`, {
      method: 'PUT',
      body: JSON.stringify(availabilityData)
    });
    return result;
  } catch (error) {
    console.error(`Error updating availability for technician ${id}:`, error);
    throw error;
  }
}

/**
 * Get technician schedule
 */
export async function getTechnicianSchedule(id, startDate, endDate) {
  try {
    const queryParams = new URLSearchParams();
    if (startDate) queryParams.append('start_date', startDate.toISOString());
    if (endDate) queryParams.append('end_date', endDate.toISOString());
    
    const url = `technicians/${id}/schedule?${queryParams.toString()}`;
    const result = await apiClient(url);
    return result;
  } catch (error) {
    console.error(`Error fetching schedule for technician ${id}:`, error);
    throw error;
  }
}
