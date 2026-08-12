import { apiClient } from '../../utils/api-client';
import { updateWorkOrderStatusOffline } from '../../lib/offlineWrites';

/**
 * Get work orders with pagination and filters
 */
export async function getWorkOrders(params = {}) {
  console.log('getWorkOrders API function called with params:', params);
  const { page = 1, limit = 10, status, status_filter, client_id, technician_id, start_date, end_date } = params;
  
  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  const statusParam = status_filter || status;
  if (statusParam) queryParams.append('status_filter', statusParam);
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

export async function getWorkOrderCloseReadiness(workOrderId) {
  return apiClient(`work-orders/${workOrderId}/close-readiness`);
}

export async function closeWorkOrder(workOrderId) {
  return apiClient(`work-orders/${workOrderId}/close`, { method: 'POST' });
}

export async function reopenWorkOrder(workOrderId) {
  return apiClient(`work-orders/${workOrderId}/reopen`, { method: 'POST' });
}

export async function recloseWorkOrder(workOrderId) {
  return apiClient(`work-orders/${workOrderId}/reclose`, { method: 'POST' });
}

export async function updateServiceBillingStatus(serviceId, billingStatus) {
  return apiClient(`work-orders/services/${serviceId}/billing-status`, {
    method: 'PUT',
    body: JSON.stringify({
      service_id: serviceId,
      billing_status: billingStatus,
    }),
  });
}

export async function updateWorkOrderServicePrice(serviceId, { name, unit_price, price }) {
  return apiClient(`work-orders/services/${serviceId}/price`, {
    method: 'PUT',
    body: JSON.stringify({ name, unit_price, price }),
  });
}

export async function addWorkOrderEstimateLines(workOrderId, serviceIds) {
  return apiClient(`work-orders/${workOrderId}/estimate-lines`, {
    method: 'POST',
    body: JSON.stringify({ service_ids: serviceIds }),
  });
}

export async function deleteWorkOrderEstimateLine(serviceLineId) {
  return apiClient(`work-orders/estimate-lines/${serviceLineId}`, {
    method: 'DELETE',
  });
}

export async function saveWorkOrderServiceLineEdits(
  serviceId,
  { name, unit_price, price, billing_status, previousBillingStatus },
) {
  const tasks = [
    updateWorkOrderServicePrice(serviceId, {
      name,
      unit_price: parseFloat(unit_price),
      price: parseFloat(price),
    }),
  ];
  if (billing_status && billing_status !== previousBillingStatus) {
    tasks.push(updateServiceBillingStatus(serviceId, billing_status));
  }
  await Promise.all(tasks);
}

export async function waiveWorkOrderDiagnosticFee(workOrderId) {
  return apiClient(`work-orders/${workOrderId}/admin-override`, {
    method: 'POST',
    body: JSON.stringify({ action: 'waive_diagnostic' }),
  });
}

export async function createRedoWorkOrder(
  workOrderId,
  { appointment_id, scheduled_start, scheduled_end, time_window } = {}
) {
  return apiClient(`work-orders/${workOrderId}/create-redo`, {
    method: 'POST',
    body: JSON.stringify({
      appointment_id,
      ...(scheduled_start ? { scheduled_start } : {}),
      ...(scheduled_end ? { scheduled_end } : {}),
      ...(time_window ? { time_window } : {}),
    }),
  });
}

export async function updateAppointmentStatus(appointmentId, status) {
  return apiClient(`work-orders/appointments/${appointmentId}`, {
    method: 'PUT',
    body: JSON.stringify({ status }),
  });
} 