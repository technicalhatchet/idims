import { apiClient } from '../../utils/api-client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { fetchClientsWithCache } from '../../lib/offlineReads';
import { isOffline } from '../../lib/offlineMutations';

/**
 * Get client by ID
 * @param {string} id - Client ID
 * @returns {Promise<Object>} Client data
 */
export const getClient = async (id) => {
  try {
    return await apiClient(`/clients/${id}`);
  } catch (error) {
    console.error('Error fetching client:', error);
    throw error;
  }
};

/**
 * Get all clients with optional pagination and filters
 * @param {Object} params - Query parameters
 * @param {number} params.page - Page number
 * @param {number} params.limit - Items per page
 * @param {string} params.search - Search term
 * @param {string} params.status - Filter by status
 * @returns {Promise<Object>} Paginated clients data
 */
export const getClients = async (params = {}) => {
  try {
    const queryParams = new URLSearchParams();
    
    if (params.page) queryParams.append('page', params.page);
    if (params.limit) queryParams.append('limit', params.limit);
    if (params.search) queryParams.append('search', params.search);
    if (params.status) queryParams.append('status', params.status);
    if (params.sort) queryParams.append('sort', params.sort);
    if (params.order) queryParams.append('order', params.order);
    
    const url = `/clients${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    return await apiClient(url);
  } catch (error) {
    console.error('Error fetching clients:', error);
    throw error;
  }
};

/**
 * Create a new client
 * @param {Object} data - Client data
 * @returns {Promise<Object>} Created client data
 */
export const createClient = async (data) => {
  try {
    return await apiClient('/clients/', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Error creating client:', error);
    throw error;
  }
};

/**
 * Update an existing client
 * @param {string} id - Client ID
 * @param {Object} data - Updated client data
 * @returns {Promise<Object>} Updated client data
 */
export const updateClient = async (id, data) => {
  try {
    return await apiClient(`/clients/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Error updating client:', error);
    throw error;
  }
};

/**
 * Delete a client
 * @param {string} id - Client ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteClient = async (id) => {
  try {
    return await apiClient(`/clients/${id}`, {
      method: 'DELETE'
    });
  } catch (error) {
    console.error('Error deleting client:', error);
    throw error;
  }
};

/**
 * Get client payment methods
 * @param {string} clientId - Client ID
 * @returns {Promise<Array>} Client payment methods
 */
export const getClientPaymentMethods = async (clientId) => {
  try {
    return await apiClient(`/clients/${clientId}/payment-methods`);
  } catch (error) {
    console.error('Error fetching client payment methods:', error);
    throw error;
  }
};

/**
 * Add a payment method for a client
 * @param {string} clientId - Client ID
 * @param {Object} data - Payment method data
 * @returns {Promise<Object>} Created payment method
 */
export const addClientPaymentMethod = async (clientId, data) => {
  try {
    return await apiClient(`/clients/${clientId}/payment-methods`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  } catch (error) {
    console.error('Error adding client payment method:', error);
    throw error;
  }
};

/**
 * Delete a client payment method
 * @param {string} clientId - Client ID
 * @param {string} methodId - Payment method ID
 * @returns {Promise<Object>} Deletion result
 */
export const deleteClientPaymentMethod = async (clientId, methodId) => {
  try {
    return await apiClient(`/clients/${clientId}/payment-methods/${methodId}`, {
      method: 'DELETE'
    });
  } catch (error) {
    console.error('Error deleting client payment method:', error);
    throw error;
  }
};

/**
 * Send a registration email to a client
 * @param {Object} params - Registration email parameters
 * @param {string} params.clientId - The client ID
 * @param {Object} params.data - Email data
 * @returns {Promise<Object>} - Response from the API
 */
export async function sendRegistrationEmail({ clientId, data }) {
  try {
    const response = await apiClient(`/clients/${clientId}/invite`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
    return response;
  } catch (error) {
    console.error('Error sending portal invite:', error);
    throw error;
  }
}

/**
 * Hook for a single client by ID
 */
export function useClient(id, options = {}) {
  return useQuery({
    queryKey: ['client', id],
    queryFn: () => getClient(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook for clients list with pagination and filtering
 */
export function useClients(params = {}, options = {}) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: () => fetchClientsWithCache(params),
    keepPreviousData: true,
    staleTime: 10000, // 10 seconds
    retry: (count) => !isOffline() && count < 1,
    ...options,
  });
}

/**
 * Hook for client payment methods
 */
export function useClientPaymentMethods(clientId, options = {}) {
  return useQuery({
    queryKey: ['clientPaymentMethods', clientId],
    queryFn: () => getClientPaymentMethods(clientId),
    enabled: !!clientId,
    ...options,
  });
}

/**
 * Hook for client mutations (create, update, delete)
 */
export function useClientMutations() {
  const queryClient = useQueryClient();
  
  // Create client
  const createClientMutation = useMutation({
    mutationFn: (data) => createClient(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      if (data && data.id) {
        queryClient.invalidateQueries({ queryKey: ['client', data.id] });
      }
      return data;
    },
  });
  
  // Update client
  const updateClientMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateClient(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client', data.id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      return data;
    },
  });
  
  // Delete client
  const deleteClientMutation = useMutation({
    mutationFn: (id) => deleteClient(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
  
  // Send registration email
  const sendRegistrationEmailMutation = useMutation({
    mutationFn: ({ clientId, data }) => sendRegistrationEmail({ clientId, data }),
  });
  
  return {
    createClient: createClientMutation.mutateAsync,
    updateClient: updateClientMutation.mutateAsync,
    deleteClient: deleteClientMutation.mutateAsync,
    sendRegistrationEmail: sendRegistrationEmailMutation.mutateAsync,
    isLoading: 
      createClientMutation.isPending || 
      updateClientMutation.isPending || 
      deleteClientMutation.isPending ||
      sendRegistrationEmailMutation.isPending,
    error:
      createClientMutation.error ||
      updateClientMutation.error ||
      deleteClientMutation.error ||
      sendRegistrationEmailMutation.error,
  };
} 