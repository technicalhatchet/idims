import { apiClient } from '../../utils/api-client';
import { updateWorkOrderStatusOffline } from '../../lib/offlineWrites';

/**
 * Get work orders with pagination and filters
 */
export async function getWorkOrders(params = {}) {
  console.log('getWorkOrders API function called with params:', params);
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
  
  try {
    const url = `work-orders?${queryParams.toString()}`;
    console.log('Calling apiClient with URL:', url);
    const result = await apiClient(url);
    console.log('getWorkOrders API call successful:', result);
    return result;
  } catch (error) {
    console.error('getWorkOrders API call failed:', error);
    throw error;
  }
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
  console.log('Creating work order with data:', workOrderData);
  try {
    const response = await apiClient('work-orders', {
      method: 'POST',
      body: JSON.stringify(workOrderData)
    });
    console.log('Work order created successfully:', response);
    // Make sure we return the full response with ID
    return response;
  } catch (error) {
    console.error('Work order creation failed:', error);
    throw error;
  }
}

/**
 * Create work order + first appointment in one atomic API call (same DB transaction).
 * Body matches WorkOrderWithInitialAppointmentCreate (work order fields + initial_appointment).
 */
export async function createWorkOrderWithInitialAppointment(payload) {
  const response = await apiClient('work-orders/with-initial-appointment', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
  return response;
}

/**
 * Update an existing work order
 */
export async function updateWorkOrder(id, workOrderData) {
  return apiClient(`work-orders/${id}`, {
    method: 'PUT',
    body: JSON.stringify(workOrderData)
  });
}

/**
 * Delete a work order
 */
export async function deleteWorkOrder(id) {
  return apiClient(`work-orders/${id}`, {
    method: 'DELETE'
  });
}

/**
 * Update work order status
 */
export async function updateWorkOrderStatus({ id, status, notes }) {
  console.log('updateWorkOrderStatus called with:', { id, status, notes });
  const result = await updateWorkOrderStatusOffline({ id, status, notes });
  if (result?.queued) {
    return { id, status, notes, queued: true };
  }
  return result;
}

/**
 * Assign work order to technician
 */
export async function assignWorkOrder(id, technicianId) {
  return apiClient(`work-orders/${id}/assign`, {
    method: 'POST',
    body: JSON.stringify({ technician_id: technicianId })
  });
}

/**
 * Get work order timeline
 */
export async function getWorkOrderTimeline(id) {
  return apiClient(`work-orders/${id}/timeline`);
} 