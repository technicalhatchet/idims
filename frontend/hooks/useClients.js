import { useQuery, useMutation, useQueryClient } from 'react-query';
import { apiClient } from '../utils/api-client';

const API_URL = process.env.NEXT_PUBLIC_API_URL || '';

/**
 * Fetch clients with pagination and filters
 */
async function fetchClients(params = {}) {
  const { 
    page = 1, 
    limit = 10, 
    search,
    sort_by,
    sort_order
  } = params;

  // Build query string
  const queryParams = new URLSearchParams();
  queryParams.append('page', page);
  queryParams.append('limit', limit);
  
  if (search) queryParams.append('search', search);
  if (sort_by) queryParams.append('sort_by', sort_by);
  if (sort_order) queryParams.append('sort_order', sort_order);
  
  return apiClient(`${API_URL}/api/clients?${queryParams.toString()}`);
}

/**
 * Fetch a single client by ID
 */
async function fetchClient(id) {
  return apiClient(`${API_URL}/api/clients/${id}`);
}

/**
 * Create a new client
 */
async function createClient(clientData) {
  return apiClient(`${API_URL}/api/clients`, {
    method: 'POST',
    body: JSON.stringify(clientData),
  });
}

/**
 * Update an existing client
 */
async function updateClient(id, clientData) {
  return apiClient(`${API_URL}/api/clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(clientData),
  });
}

/**
 * Delete a client
 */
async function deleteClient(id) {
  return apiClient(`${API_URL}/api/clients/${id}`, {
    method: 'DELETE',
  });
}

/**
 * Hook for fetching clients list with pagination and filters
 */
export function useClients(params = {}, options = {}) {
  return useQuery(
    ['clients', params],
    () => fetchClients(params),
    {
      keepPreviousData: true,
      staleTime: 30000, // 30 seconds
      ...options,
    }
  );
}

/**
 * Hook for fetching a single client
 */
export function useClient(id, options = {}) {
  return useQuery(
    ['client', id],
    () => fetchClient(id),
    {
      enabled: !!id,
      ...options,
    }
  );
}

/**
 * Hooks for client mutations with cache updates
 */
export function useClientMutations() {
  const queryClient = useQueryClient();
  
  // Create client
  const createMutation = useMutation(createClient, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('clients');
      return data;
    },
  });
  
  // Update client
  const updateMutation = useMutation(
    ({ id, data }) => updateClient(id, data),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['client', data.id]);
        queryClient.invalidateQueries('clients');
        return data;
      },
    }
  );
  
  // Delete client
  const deleteMutation = useMutation(deleteClient, {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['client', id]);
      queryClient.invalidateQueries('clients');
    },
  });
  
  return {
    createClient: createMutation.mutateAsync,
    updateClient: updateMutation.mutateAsync,
    deleteClient: deleteMutation.mutateAsync,
    isLoading: 
      createMutation.isLoading || 
      updateMutation.isLoading || 
      deleteMutation.isLoading,
    error:
      createMutation.error ||
      updateMutation.error ||
      deleteMutation.error,
  };
} 