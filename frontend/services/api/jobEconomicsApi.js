import { apiClient } from '../../utils/api-client';

const BASE = 'job-economics';

export async function getExpenseCategories() {
  return apiClient(`${BASE}/categories`);
}

export async function getExpenseVendors() {
  return apiClient(`${BASE}/vendors`);
}

export async function getWorkOrderExpenses(workOrderId) {
  return apiClient(`${BASE}/work-orders/${workOrderId}/expenses`);
}

export async function createWorkOrderExpense(workOrderId, data) {
  return apiClient(`${BASE}/work-orders/${workOrderId}/expenses`, {
    method: 'POST',
    body: JSON.stringify(data),
  });
}

export async function deleteWorkOrderExpense(expenseId) {
  return apiClient(`${BASE}/expenses/${expenseId}`, { method: 'DELETE' });
}

export async function getWorkOrderReceipts(workOrderId) {
  return apiClient(`${BASE}/work-orders/${workOrderId}/receipts`);
}

export async function uploadWorkOrderReceipt(workOrderId, file, { expenseId, category, vendorName } = {}) {
  const form = new FormData();
  form.append('file', file);
  if (expenseId) form.append('expense_id', expenseId);
  if (category) form.append('category', category);
  if (vendorName) form.append('vendor_name', vendorName);

  const tokenRes = await fetch('/api/auth/token', { credentials: 'same-origin', cache: 'no-cache' });
  const tokenData = tokenRes.ok ? await tokenRes.json() : null;
  const base = (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000/').replace(/\/$/, '');
  const url = `${base}/api/${BASE}/work-orders/${workOrderId}/receipts`;

  const response = await fetch(url, {
    method: 'POST',
    headers: tokenData?.accessToken ? { Authorization: `Bearer ${tokenData.accessToken}` } : {},
    body: form,
    credentials: 'include',
  });

  if (!response.ok) {
    let detail = 'Upload failed';
    try {
      const err = await response.json();
      detail = err.detail || err.message || detail;
    } catch (_) { /* ignore */ }
    throw new Error(typeof detail === 'string' ? detail : 'Upload failed');
  }
  return response.json();
}

export async function getWorkOrderMileage(workOrderId) {
  return apiClient(`${BASE}/work-orders/${workOrderId}/mileage`);
}

export async function upsertAppointmentMileage(appointmentId, data) {
  return apiClient(`${BASE}/appointments/${appointmentId}/mileage`, {
    method: 'PUT',
    body: JSON.stringify(data),
  });
}

export async function getJobEconomics(workOrderId) {
  return apiClient(`${BASE}/work-orders/${workOrderId}/economics`);
}

export async function getMonthlyEconomicsReport(year, month) {
  return apiClient(`${BASE}/reports/monthly?year=${year}&month=${month}`);
}

export async function getPropertyServiceHistory(propertyId) {
  return apiClient(`${BASE}/properties/${propertyId}/service-history`);
}
