import apiClient from '../../utils/api-client';

/**
 * Get work orders with pagination and filters
 */
export async function getWorkOrders(params = {}) {
  const { page = 1, limit = 10, status, client_id, technician_id, start_date, end_date } = params;
  
  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  if (status) queryParams.append('status', status);
  if (client_id) queryParams.append('client_id', client_id);
  if (technician_id) queryParams.append('technician_id', technician_id);
  if (start_date) queryParams.append('start_date', start_date);
  if (end_date) queryParams.append('end_date', end_date);
  
  return apiClient(`work-orders?${queryParams.toString()}`);
}

/**
 * Get a specific work order by ID
 */
export async function getWorkOrder(id) {
  return apiClient(`work-orders/${id}`);
}

/**
 * Create a new work order
 */
export async function createWorkOrder(workOrderData) {
  return apiClient('work-orders', {
    method: 'POST',
    body: JSON.stringify(workOrderData),
  });
}

/**
 * Update an existing work order
 */
export async function updateWorkOrder(id, workOrderData) {
  return apiClient(`work-orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(workOrderData),
  });
}

/**
 * Delete a work order
 */
export async function deleteWorkOrder(id) {
  return apiClient(`work-orders/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Update work order status
 */
export async function updateWorkOrderStatus(id, status, notes) {
  return apiClient(`work-orders/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify({ status, notes }),
  });
}

/**
 * Assign work order to technician
 */
export async function assignWorkOrder(id, technicianId) {
  return apiClient(`work-orders/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ technician_id: technicianId }),
  });
}

/**
 * Get work order timeline
 */
export async function getWorkOrderTimeline(id) {
  return apiClient(`work-orders/${id}/timeline`);
} 