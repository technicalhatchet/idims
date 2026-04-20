import { apiClient } from '../../utils/api-client';

/**
 * Get all services with optional pagination and filters
 */
export const getServices = async (params = {}) => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search) queryParams.append('search', params.search);
  if (params.category) queryParams.append('category', params.category);
  if (params.is_active !== undefined) queryParams.append('is_active', params.is_active);
  
  const url = `services?${queryParams.toString()}`;
  return apiClient(url);
};

/**
 * Get a specific service by ID
 */
export const getService = async (id) => {
  return apiClient(`services/${id}`);
};

/**
 * Create a new service
 */
export const createService = async (data) => {
  return apiClient('services', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

/**
 * Update an existing service
 */
export const updateService = async (id, data) => {
  return apiClient(`services/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

/**
 * Delete a service
 */
export const deleteService = async (id) => {
  return apiClient(`services/${id}`, {
    method: 'DELETE'
  });
};

/**
 * Get service categories
 */
export const getServiceCategories = async () => {
  return apiClient('services/categories');
}; 