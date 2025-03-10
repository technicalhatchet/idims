import { useQuery, useMutation, useQueryClient } from 'react-query';
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
} from '@/services/api/paymentsApi';

/**
 * Hook for payments list with pagination and filtering
 */
export function usePayments(params = {}, options = {}) {
  return useQuery(
    ['payments', params],
    () => getPayments(params),
    {
      keepPreviousData: true,
      staleTime: 10000, // 10 seconds
      ...options,
    }
  );
}

/**
 * Hook for single payment by ID
 */
export function usePayment(id, options = {}) {
  return useQuery(
    ['payment', id],
    () => getPayment(id),
    {
      enabled: !!id,
      ...options,
    }
  );
}

/**
 * Hook for payment statistics
 */
export function usePaymentStats(params = {}, options = {}) {
  return useQuery(
    ['paymentStats', params],
    () => getPaymentStats(params),
    {
      staleTime: 300000, // 5 minutes
      ...options,
    }
  );
}

/**
 * Hook for client payment methods
 */
export function useClientPaymentMethods(clientId, options = {}) {
  return useQuery(
    ['paymentMethods', clientId],
    () => getClientPaymentMethods(clientId),
    {
      enabled: !!clientId,
      ...options,
    }
  );
}

/**
 * Hooks for payment mutations with cache updates
 */
export function usePaymentMutations() {
  const queryClient = useQueryClient();
  
  // Create payment
  const createMutation = useMutation(createPayment, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('payments');
      // Also invalidate the associated invoice
      if (data.invoice_id) {
        queryClient.invalidateQueries(['invoice', data.invoice_id]);
        queryClient.invalidateQueries('invoices');
      }
      return data;
    },
  });
  
  // Refund payment
  const refundMutation = useMutation(
    ({ id, amount, reason }) => refundPayment(id, { amount, reason }),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['payment', data.id]);
        queryClient.invalidateQueries('payments');
        // Also invalidate the associated invoice
        if (data.invoice_id) {
          queryClient.invalidateQueries(['invoice', data.invoice_id]);
          queryClient.invalidateQueries('invoices');
        }
        return data;
      },
    }
  );
  
  // Create payment method
  const createPaymentMethodMutation = useMutation(
    ({ clientId, data }) => createPaymentMethod(clientId, data),
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries(['paymentMethods', variables.clientId]);
        return data;
      },
    }
  );
  
  // Delete payment method
  const deletePaymentMethodMutation = useMutation(
    ({ clientId, paymentMethodId }) => deletePaymentMethod(clientId, paymentMethodId),
    {
      onSuccess: (_, variables) => {
        queryClient.invalidateQueries(['paymentMethods', variables.clientId]);
      },
    }
  );
  
  // Create payment intent
  const createPaymentIntentMutation = useMutation(createPaymentIntent, {
    // No cache invalidation needed for payment intent creation
  });
  
  // Process payment
  const processPaymentMutation = useMutation(processPayment, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('payments');
      // Also invalidate the associated invoice
      if (data.invoice_id) {
        queryClient.invalidateQueries(['invoice', data.invoice_id]);
        queryClient.invalidateQueries('invoices');
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
      createMutation.isLoading || 
      refundMutation.isLoading || 
      createPaymentMethodMutation.isLoading || 
      deletePaymentMethodMutation.isLoading ||
      createPaymentIntentMutation.isLoading ||
      processPaymentMutation.isLoading,
    error:
      createMutation.error ||
      refundMutation.error ||
      createPaymentMethodMutation.error ||
      deletePaymentMethodMutation.error ||
      createPaymentIntentMutation.error ||
      processPaymentMutation.error,
  };
}
