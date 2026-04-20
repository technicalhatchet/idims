import { apiClient } from '../api-client';

// Work Order API Functions
export async function getWorkOrders(filters = {}) {
  const response = await apiClient.get('/api/work_orders/', { params: filters });
  return response.data;
}

export async function getWorkOrder(id) {
  const response = await apiClient.get(`/api/work_orders/${id}`);
  return response.data;
}

export async function createWorkOrder(workOrderData) {
  const response = await apiClient.post('/api/work_orders/', workOrderData);
  return response.data;
}

export async function updateWorkOrder(id, workOrderData) {
  const response = await apiClient.put(`/api/work_orders/${id}`, workOrderData);
  return response.data;
}

export async function deleteWorkOrder(id) {
  const response = await apiClient.delete(`/api/work_orders/${id}`);
  return response.data;
}

export async function updateWorkOrderStatus(id, statusData) {
  const response = await apiClient.patch(`/api/work_orders/${id}/status`, statusData);
  return response.data;
}

// Work Order Appointments API Functions
export async function getWorkOrderAppointments(workOrderId) {
  const response = await apiClient.get(`/api/work_orders/${workOrderId}/appointments`);
  return response.data;
}

export async function getWorkOrderAppointment(workOrderId, appointmentId) {
  const response = await apiClient.get(`/api/work_orders/${workOrderId}/appointments/${appointmentId}`);
  return response.data;
}

export async function createWorkOrderAppointment(workOrderId, appointmentData) {
  const response = await apiClient.post(`/api/work_orders/${workOrderId}/appointments`, appointmentData);
  return response.data;
}

export async function updateWorkOrderAppointment(workOrderId, appointmentId, appointmentData) {
  const response = await apiClient.put(`/api/work_orders/${workOrderId}/appointments/${appointmentId}`, appointmentData);
  return response.data;
}

export async function deleteWorkOrderAppointment(workOrderId, appointmentId) {
  const response = await apiClient.delete(`/api/work_orders/${workOrderId}/appointments/${appointmentId}`);
  return response.data;
} 