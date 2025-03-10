import { apiClient } from '@/utils/fetchWithAuth';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Get payments with pagination and filters
 */
export async function getPayments(params = {}) {
  const { 
    page = 1, 
    limit = 10, 
    invoice_id, 
    client_id, 
    status, 
    payment_method,
    start_date,
    end_date
  } = params;
  
  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  if (invoice_id) queryParams.append('invoice_id', invoice_id);
  if (client_id) queryParams.append('client_id', client_id);
  if (status) queryParams.append('status', status);
  if (payment_method) queryParams.append('payment_method', payment_method);
  if (start_date) queryParams.append('start_date', start_date.toISOString().split('T')[0]);
  if (end_date) queryParams.append('end_date', end_date.toISOString().split('T')[0]);
  
  return apiClient(`${API_URL}/api/payments?${queryParams.toString()}`);
}

/**
 * Get a specific payment by ID
 */
export async function getPayment(id) {
  return apiClient(`${API_URL}/api/payments/${id}`);
}

/**
 * Create a new payment
 */
export async function createPayment(paymentData) {
  return apiClient(`${API_URL}/api/payments`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
}

/**
 * Process a payment refund
 */
export async function refundPayment(id, refundData) {
  return apiClient(`${API_URL}/api/payments/${id}/refund`, {
    method: 'POST',
    body: JSON.stringify(refundData),
  });
}

/**
 * Get payment methods for a client
 */
export async function getClientPaymentMethods(clientId) {
  return apiClient(`${API_URL}/api/clients/${clientId}/payment-methods`);
}

/**
 * Add a payment method for a client
 */
export async function createPaymentMethod(clientId, paymentMethodData) {
  return apiClient(`${API_URL}/api/clients/${clientId}/payment-methods`, {
    method: 'POST',
    body: JSON.stringify(paymentMethodData),
  });
}

/**
 * Delete a payment method
 */
export async function deletePaymentMethod(clientId, paymentMethodId) {
  const response = await apiClient(`${API_URL}/api/clients/${clientId}/payment-methods/${paymentMethodId}`, {
    method: 'DELETE',
  });
  
  return response === null; // 204 No Content
}

/**
 * Create a payment intent with Stripe
 */
export async function createPaymentIntent(paymentIntentData) {
  return apiClient(`${API_URL}/api/payments/intent`, {
    method: 'POST',
    body: JSON.stringify(paymentIntentData),
  });
}

/**
 * Process a payment (for direct frontend payments without redirect)
 */
export async function processPayment(paymentData) {
  return apiClient(`${API_URL}/api/payments/process`, {
    method: 'POST',
    body: JSON.stringify(paymentData),
  });
}

/**
 * Get payment statistics
 */
export async function getPaymentStats(params = {}) {
  const { start_date, end_date, period = 'month' } = params;
  
  const queryParams = new URLSearchParams();
  if (start_date) queryParams.append('start_date', start_date.toISOString().split('T')[0]);
  if (end_date) queryParams.append('end_date', end_date.toISOString().split('T')[0]);
  queryParams.append('period', period);
  
  return apiClient(`${API_URL}/api/payments/stats?${queryParams.toString()}`);
}
