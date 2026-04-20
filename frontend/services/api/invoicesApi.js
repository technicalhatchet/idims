import { apiClient } from '../../utils/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

/**
 * Get invoices with optional pagination and filters
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {string} params.status - Filter by status
 * @param {string} params.client_id - Filter by client ID
 * @param {string} params.search - Search term
 * @returns {Promise<Object>} Paginated invoices data
 */
export const getInvoices = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.status) queryParams.append('status', params.status);
    if (params.client_id) queryParams.append('client_id', params.client_id);
    if (params.search) queryParams.append('search', params.search);
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);
    if (params.start_date) queryParams.append('start_date', params.start_date);
    if (params.end_date) queryParams.append('end_date', params.end_date);
    if (params.work_order_id) queryParams.append('work_order_id', params.work_order_id);
    
    const url = `invoices${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return await apiClient(url);
  } catch (error) {
    console.error('Error fetching invoices:', error);
    throw error;
  }
};

/**
 * Get invoice by ID
 * @param {string} id - Invoice ID
 * @returns {Promise<Object>} Invoice data
 */
export const getInvoice = async (id) => {
  try {
    return await apiClient(`invoices/${id}`);
  } catch (error) {
    console.error('Error fetching invoice:', error);
    throw error;
  }
};

/**
 * Create a new invoice
 * @param {Object} data - Invoice data
 * @returns {Promise<Object>} Created invoice data
 */
export const createInvoice = async (data) => {
  try {
    return await apiClient('invoices', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Error creating invoice:', error);
    throw error;
  }
};

/**
 * Update an existing invoice
 * @param {string} id - Invoice ID
 * @param {Object} data - Updated invoice data
 * @returns {Promise<Object>} Updated invoice data
 */
export const updateInvoice = async (id, data) => {
  try {
    return await apiClient(`invoices/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Error updating invoice:', error);
    throw error;
  }
};

/**
 * Delete an invoice
 * @param {string} id - Invoice ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteInvoice = async (id) => {
  try {
    return await apiClient(`invoices/${id}`, {
      method: 'DELETE'
    });
  } catch (error) {
    console.error('Error deleting invoice:', error);
    throw error;
  }
};

/**
 * Update an invoice's status
 * @param {string} id - Invoice ID
 * @param {Object} data - Status data with status and optional notes
 * @returns {Promise<Object>} Updated invoice
 */
export const updateInvoiceStatus = async (id, data) => {
  try {
    return await apiClient(`invoices/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Error updating invoice status:', error);
    throw error;
  }
};

/**
 * Get invoices for a work order
 * @param {string} workOrderId - Work order ID
 * @returns {Promise<Array>} Invoices for the work order
 */
export const getWorkOrderInvoices = async (workOrderId) => {
  try {
    // Use the standard invoices endpoint with a work_order_id filter
    const queryParams = new URLSearchParams();
    queryParams.append('work_order_id', workOrderId);
    
    return await apiClient(`invoices?${queryParams.toString()}`);
  } catch (error) {
    console.error('Error fetching work order invoices:', error);
    throw error;
  }
};

/**
 * Create an invoice for a work order
 * @param {string} workOrderId - Work order ID
 * @param {Object} data - Invoice data
 * @returns {Promise<Object>} Created invoice
 */
export const createWorkOrderInvoice = async (workOrderId, data) => {
  try {
    // Ensure work_order_id is set in the data
    const invoiceData = {
      ...data,
      work_order_id: workOrderId
    };
    
    return await apiClient('invoices', {
      method: 'POST',
      body: JSON.stringify(invoiceData)
    });
  } catch (error) {
    console.error('Error creating work order invoice:', error);
    throw error;
  }
};

/**
 * Send an invoice to a client
 * @param {string} id - Invoice ID
 * @param {Object} data - Email data with message, etc.
 * @returns {Promise<Object>} Response data
 */
export const sendInvoice = async (id, data) => {
  try {
    return await apiClient(`invoices/${id}/send`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Error sending invoice:', error);
    throw error;
  }
};

/**
 * Download an invoice in the specified format
 * @param {string} id - Invoice ID
 * @param {string} format - Format ('pdf' or 'csv')
 * @returns {Promise<Blob>} The invoice document
 */
export const downloadInvoice = async (id, format = 'pdf') => {
  try {
    return await apiClient(`invoices/${id}/download?format=${format}`, {
      responseType: 'blob'
    });
  } catch (error) {
    console.error('Error downloading invoice:', error);
    throw error;
  }
};

/**
 * Hook for a single invoice by ID
 */
export function useInvoice(id, options = {}) {
  return useQuery({
    queryKey: ['invoice', id],
    queryFn: () => getInvoice(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook for invoices list with pagination and filtering
 */
export function useInvoices(params = {}, options = {}) {
  return useQuery({
    queryKey: ['invoices', params],
    queryFn: () => getInvoices(params),
    keepPreviousData: true,
    ...options,
  });
}

/**
 * Hook for work order invoices
 */
export function useWorkOrderInvoices(workOrderId, options = {}) {
  return useQuery({
    queryKey: ['workOrderInvoices', workOrderId],
    queryFn: () => getWorkOrderInvoices(workOrderId),
    enabled: !!workOrderId,
    ...options,
  });
}

/**
 * Hook for invoice mutations (create, update, delete)
 */
export function useInvoiceMutations() {
  const queryClient = useQueryClient();
  
  // Create invoice
  const createInvoiceMutation = useMutation({
    mutationFn: (data) => createInvoice(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (data && data.id) {
        queryClient.invalidateQueries({ queryKey: ['invoice', data.id] });
      }
      if (data && data.work_order_id) {
        queryClient.invalidateQueries({ queryKey: ['workOrderInvoices', data.work_order_id] });
      }
      return data;
    },
  });
  
  // Update invoice
  const updateInvoiceMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateInvoice(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', data.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (data && data.work_order_id) {
        queryClient.invalidateQueries({ queryKey: ['workOrderInvoices', data.work_order_id] });
      }
      return data;
    },
  });
  
  // Delete invoice
  const deleteInvoiceMutation = useMutation({
    mutationFn: (id) => deleteInvoice(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
    },
  });
  
  // Create work order invoice
  const createWorkOrderInvoiceMutation = useMutation({
    mutationFn: ({ workOrderId, data }) => createWorkOrderInvoice(workOrderId, data),
    onSuccess: (data, { workOrderId }) => {
      queryClient.invalidateQueries({ queryKey: ['workOrderInvoices', workOrderId] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (data && data.id) {
        queryClient.invalidateQueries({ queryKey: ['invoice', data.id] });
      }
      return data;
    },
  });
  
  // Update invoice status
  const updateInvoiceStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }) => updateInvoiceStatus(id, { status, notes }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', data.id] });
      queryClient.invalidateQueries({ queryKey: ['invoices'] });
      if (data && data.work_order_id) {
        queryClient.invalidateQueries({ queryKey: ['workOrderInvoices', data.work_order_id] });
      }
      return data;
    },
  });
  
  // Send invoice
  const sendInvoiceMutation = useMutation({
    mutationFn: ({ id, data }) => sendInvoice(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['invoice', data.id] });
      return data;
    },
  });
  
  return {
    createInvoice: createInvoiceMutation.mutateAsync,
    updateInvoice: updateInvoiceMutation.mutateAsync,
    deleteInvoice: deleteInvoiceMutation.mutateAsync,
    createWorkOrderInvoice: createWorkOrderInvoiceMutation.mutateAsync,
    updateInvoiceStatus: updateInvoiceStatusMutation.mutateAsync,
    sendInvoice: sendInvoiceMutation.mutateAsync,
    isLoading: 
      createInvoiceMutation.isPending || 
      updateInvoiceMutation.isPending || 
      deleteInvoiceMutation.isPending || 
      createWorkOrderInvoiceMutation.isPending ||
      updateInvoiceStatusMutation.isPending ||
      sendInvoiceMutation.isPending,
  };
} 