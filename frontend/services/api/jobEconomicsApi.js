import { apiClient, buildApiUrl, getAuthHeaders } from '../../utils/api-client';

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

  const headers = await getAuthHeaders();
  const url = buildApiUrl(`job-economics/work-orders/${workOrderId}/receipts`);

  const response = await fetch(url, {
    method: 'POST',
    headers,
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

export async function getDriveStorageStatus() {
  return apiClient(`${BASE}/drive-status`);
}

export async function getPropertyServiceHistory(propertyId) {
  return apiClient(`${BASE}/properties/${propertyId}/service-history`);
}

export function getReceiptDownloadUrl(receiptId) {
  return buildApiUrl(`job-economics/receipts/${receiptId}/download`);
}

export async function fetchReceiptBlob(receiptId) {
  const headers = await getAuthHeaders();
  const url = getReceiptDownloadUrl(receiptId);
  const response = await fetch(url, { headers, credentials: 'include' });
  if (!response.ok) {
    let detail = 'Could not open receipt';
    try {
      const err = await response.json();
      detail = err.detail || detail;
    } catch (_) { /* ignore */ }
    throw new Error(typeof detail === 'string' ? detail : detail);
  }
  const blob = await response.blob();
  return {
    blobUrl: URL.createObjectURL(blob),
    mimeType: blob.type || response.headers.get('content-type') || '',
  };
}

/** @deprecated use fetchReceiptBlob + ReceiptViewerModal */
export async function openReceiptDownload(receiptId) {
  const { blobUrl } = await fetchReceiptBlob(receiptId);
  window.open(blobUrl, '_blank', 'noopener,noreferrer');
  setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
}
