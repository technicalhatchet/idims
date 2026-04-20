import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getClient, 
  getClients, 
  createClient, 
  updateClient, 
  deleteClient,
  getClientPaymentMethods,
  sendRegistrationEmail
} from '../services/api/clientsApi';

/**
 * Hook for clients list with pagination and filtering
 */
export function useClients(params = {}, options = {}) {
  return useQuery({
    queryKey: ['clients', params],
    queryFn: () => getClients(params),
    keepPreviousData: true,
    staleTime: 10000, // 10 seconds
    ...options,
  });
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
  const createMutation = useMutation({
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
  const updateMutation = useMutation({
    mutationFn: ({ id, ...data }) => updateClient(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['client', data.id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
      return data;
    },
  });
  
  // Delete client
  const deleteMutation = useMutation({
    mutationFn: (id) => deleteClient(id),
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['client', id] });
      queryClient.invalidateQueries({ queryKey: ['clients'] });
    },
  });
  
  // Send registration email
  const emailMutation = useMutation({
    mutationFn: (params) => sendRegistrationEmail(params),
  });
  
  return {
    createClient: createMutation.mutateAsync,
    updateClient: updateMutation.mutateAsync,
    deleteClient: deleteMutation.mutateAsync,
    sendRegistrationEmail: emailMutation.mutateAsync,
    isLoading: 
      createMutation.isPending || 
      updateMutation.isPending || 
      deleteMutation.isPending ||
      emailMutation.isPending,
    error:
      createMutation.error ||
      updateMutation.error ||
      deleteMutation.error ||
      emailMutation.error,
  };
} 