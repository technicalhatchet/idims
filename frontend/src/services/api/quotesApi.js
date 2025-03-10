import { apiClient } from '@/utils/fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get quotes with pagination and filters
 */
export async function getQuotes(params = {}) {
  const { page = 1, limit = 10, client_id, status, start_date, end_date } = params;
  
  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  if (client_id) queryParams.append('client_id', client_id);
  if (status) queryParams.append('status', status);
  if (start_date) queryParams.append('start_date', start_date.toISOString().split('T')[0]);
  if (end_date) queryParams.append('end_date', end_date.toISOString().split('T')[0]);
  
  return apiClient(`${API_URL}/api/quotes?${queryParams.toString()}`);
}

/**
 * Get a specific quote by ID
 */
export async function getQuote(id) {
  return apiClient(`${API_URL}/api/quotes/${id}`);
}

/**
 * Create a new quote
 */
export async function createQuote(quoteData) {
  return apiClient(`${API_URL}/api/quotes`, {
    method: 'POST',
    body: JSON.stringify(quoteData),
  });
}

/**
 * Update an existing quote
 */
export async function updateQuote(id, quoteData) {
  return apiClient(`${API_URL}/api/quotes/${id}`, {
    method: 'PUT',
    body: JSON.stringify(quoteData),
  });
}

/**
 * Delete a quote
 */
export async function deleteQuote(id) {
  const response = await apiClient(`${API_URL}/api/quotes/${id}`, {
    method: 'DELETE',
  });
  
  return response === null; // 204 No Content
}

/**
 * Update quote status
 */
export async function updateQuoteStatus(id, statusData) {
  return apiClient(`${API_URL}/api/quotes/${id}/status`, {
    method: 'PUT',
    body: JSON.stringify(statusData),
  });
}

/**
 * Send a quote to client
 */
export async function sendQuote(id, sendData) {
  return apiClient(`${API_URL}/api/quotes/${id}/send`, {
    method: 'POST',
    body: JSON.stringify(sendData),
  });
}

/**
 * Convert a quote to a work order or invoice
 */
export async function convertQuote(id, convertData) {
  return apiClient(`${API_URL}/api/quotes/${id}/convert`, {
    method: 'POST',
    body: JSON.stringify(convertData),
  });
}

/**
 * Download a quote document
 */
export async function downloadQuote(id, format = 'pdf') {
  const queryParams = new URLSearchParams();
  queryParams.append('format', format);
  
  return apiClient(`${API_URL}/api/quotes/${id}/download?${queryParams.toString()}`);
}

/**
 * Calculate quote total from items
 */
export async function calculateQuote(quoteItems) {
  return apiClient(`${API_URL}/api/quotes/calculate`, {
    method: 'POST',
    body: JSON.stringify({ items: quoteItems }),
  });
}
