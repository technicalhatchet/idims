import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getPayments, 
  getPayment, 
  createPayment, 
  refundPayment,
  getClientPaymentMethods,
  createPaymentMethod,
  deletePaymentMethod,
  createPaymentIntent,
  processPayment,
  getPaymentStats
} from '../services/api/paymentsApi';

/**
 * Hook for payments list with pagination and filtering
 */
export function usePayments(params = {}, options = {}) {
  return useQuery({
    queryKey: ['payments', params],
    queryFn: () => getPayments(params),
    keepPreviousData: true,
    staleTime: 10000, // 10 seconds
    ...options,
  });
}

/**
 * Hook for single payment by ID
 */
export function usePayment(id, options = {}) {
  return useQuery({
    queryKey: ['payment', id],
    queryFn: () => getPayment(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook for payment statistics
 */
export function usePaymentStats(params = {}, options = {}) {
  return useQuery({
    queryKey: ['paymentStats', params],
    queryFn: () => getPaymentStats(params),
    staleTime: 300000, // 5 minutes
    ...options,
  });
}

/**
 * Hook for client payment methods
 */
export function useClientPaymentMethods(clientId, options = {}) {
  return useQuery({
    queryKey: ['paymentMethods', clientId],
    queryFn: () => getClientPaymentMethods(clientId),
    enabled: !!clientId,
    ...options,
  });
}

/**
 * Hooks for payment mutations with cache updates
 */
export function usePaymentMutations() {
  const queryClient = useQueryClient();
  
  // Create payment
  const createMutation = useMutation({
    mutationFn: (data) => createPayment(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      // Also invalidate the associated invoice
      if (data.invoice_id) {
        queryClient.invalidateQueries({ queryKey: ['invoice', data.invoice_id] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }
      return data;
    },
  });
  
  // Refund payment
  const refundMutation = useMutation({
    mutationFn: ({ id, amount, reason }) => refundPayment(id, { amount, reason }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payment', data.id] });
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      // Also invalidate the associated invoice
      if (data.invoice_id) {
        queryClient.invalidateQueries({ queryKey: ['invoice', data.invoice_id] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }
      return data;
    },
  });
  
  // Create payment method
  const createPaymentMethodMutation = useMutation({
    mutationFn: ({ clientId, data }) => createPaymentMethod(clientId, data),
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', variables.clientId] });
      return data;
    },
  });
  
  // Delete payment method
  const deletePaymentMethodMutation = useMutation({
    mutationFn: ({ clientId, paymentMethodId }) => deletePaymentMethod(clientId, paymentMethodId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['paymentMethods', variables.clientId] });
    },
  });
  
  // Create payment intent
  const createPaymentIntentMutation = useMutation({
    mutationFn: (data) => createPaymentIntent(data),
    // No cache invalidation needed for payment intent creation
  });
  
  // Process payment
  const processPaymentMutation = useMutation({
    mutationFn: (data) => processPayment(data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['payments'] });
      // Also invalidate the associated invoice
      if (data.invoice_id) {
        queryClient.invalidateQueries({ queryKey: ['invoice', data.invoice_id] });
        queryClient.invalidateQueries({ queryKey: ['invoices'] });
      }
      return data;
    },
  });
  
  return {
    createPayment: createMutation.mutateAsync,
    refundPayment: refundMutation.mutateAsync,
    createPaymentMethod: createPaymentMethodMutation.mutateAsync,
    deletePaymentMethod: deletePaymentMethodMutation.mutateAsync,
    createPaymentIntent: createPaymentIntentMutation.mutateAsync,
    processPayment: processPaymentMutation.mutateAsync,
    isLoading: 
      createMutation.isPending || 
      refundMutation.isPending || 
      createPaymentMethodMutation.isPending || 
      deletePaymentMethodMutation.isPending ||
      createPaymentIntentMutation.isPending ||
      processPaymentMutation.isPending,
    error:
      createMutation.error ||
      refundMutation.error ||
      createPaymentMethodMutation.error ||
      deletePaymentMethodMutation.error ||
      createPaymentIntentMutation.error ||
      processPaymentMutation.error,
  };
}
