import apiClient from '../../utils/api-client';
import { useQuery, useMutation, useQueryClient } from 'react-query';

/**
 * Get client by ID
 */
export const getClient = async (id) => {
  return apiClient(`clients/${id}`);
};

/**
 * Get all clients with optional pagination and filters
 */
export const getClients = async (params = {}) => {
  const queryParams = new URLSearchParams();
  
  if (params.page) queryParams.append('page', params.page);
  if (params.limit) queryParams.append('limit', params.limit);
  if (params.search) queryParams.append('search', params.search);
  if (params.status) queryParams.append('status', params.status);
  
  const url = `clients?${queryParams.toString()}`;
  return apiClient(url);
};

/**
 * Create a new client
 */
export const createClient = async (data) => {
  return apiClient('clients', {
    method: 'POST',
    body: JSON.stringify(data)
  });
};

/**
 * Update an existing client
 */
export const updateClient = async ({ id, data }) => {
  return apiClient(`clients/${id}`, {
    method: 'PUT',
    body: JSON.stringify(data)
  });
};

/**
 * Delete a client
 */
export const deleteClient = async (id) => {
  return apiClient(`clients/${id}`, {
    method: 'DELETE'
  });
};

/**
 * Hook for a single client by ID
 */
export function useClient(id, options = {}) {
  return useQuery(
    ['client', id],
    () => getClient(id),
    {
      enabled: !!id,
      ...options,
    }
  );
}

/**
 * Hook for clients list with pagination and filtering
 */
export function useClients(params = {}, options = {}) {
  return useQuery(
    ['clients', params],
    () => getClients(params),
    {
      keepPreviousData: true,
      staleTime: 10000, // 10 seconds
      ...options,
    }
  );
}

/**
 * Hook for client mutations (create, update, delete)
 */
export function useClientMutations() {
  const queryClient = useQueryClient();
  
  const createClientMutation = useMutation(
    createClient,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('clients');
      }
    }
  );
  
  const updateClientMutation = useMutation(
    updateClient,
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries(['client', variables.id]);
        queryClient.invalidateQueries('clients');
      }
    }
  );
  
  const deleteClientMutation = useMutation(
    deleteClient,
    {
      onSuccess: () => {
        queryClient.invalidateQueries('clients');
      }
    }
  );
  
  return {
    createClient: createClientMutation.mutateAsync,
    updateClient: updateClientMutation.mutateAsync,
    deleteClient: deleteClientMutation.mutateAsync,
    isLoading: createClientMutation.isLoading || 
               updateClientMutation.isLoading || 
               deleteClientMutation.isLoading
  };
} 