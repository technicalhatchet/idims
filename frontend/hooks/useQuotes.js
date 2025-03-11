import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  getQuotes, 
  getQuote, 
  createQuote, 
  updateQuote, 
  deleteQuote,
  updateQuoteStatus,
  sendQuote,
  convertQuote,
  downloadQuote,
  calculateQuote
} from '@/services/api/quotesApi';

/**
 * Hook for quotes list with pagination and filtering
 */
export function useQuotes(params = {}, options = {}) {
  return useQuery(
    ['quotes', params],
    () => getQuotes(params),
    {
      keepPreviousData: true,
      staleTime: 10000, // 10 seconds
      ...options,
    }
  );
}

/**
 * Hook for single quote by ID
 */
export function useQuote(id, options = {}) {
  return useQuery(
    ['quote', id],
    () => getQuote(id),
    {
      enabled: !!id,
      ...options,
    }
  );
}

/**
 * Hook for calculating quote totals
 */
export function useQuoteCalculator() {
  const queryClient = useQueryClient();
  
  return useMutation(calculateQuote, {
    // No cache invalidation needed as this is just a calculation
  });
}

/**
 * Hooks for quote mutations with cache updates
 */
export function useQuoteMutations() {
  const queryClient = useQueryClient();
  
  // Create quote
  const createMutation = useMutation(createQuote, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('quotes');
      return data;
    },
  });
  
  // Update quote
  const updateMutation = useMutation(
    ({ id, data }) => updateQuote(id, data),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['quote', data.id]);
        queryClient.invalidateQueries('quotes');
        return data;
      },
    }
  );
  
  // Delete quote
  const deleteMutation = useMutation(deleteQuote, {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['quote', id]);
      queryClient.invalidateQueries('quotes');
    },
  });
  
  // Update quote status
  const updateStatusMutation = useMutation(
    ({ id, status, notes }) => updateQuoteStatus(id, { status, notes }),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['quote', data.id]);
        queryClient.invalidateQueries('quotes');
        return data;
      },
    }
  );
  
  // Send quote
  const sendMutation = useMutation(
    ({ id, data }) => sendQuote(id, data),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['quote', data.id]);
        queryClient.invalidateQueries('quotes');
        return data;
      },
    }
  );
  
  // Convert quote
  const convertMutation = useMutation(
    ({ id, data }) => convertQuote(id, data),
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries(['quote', variables.id]);
        queryClient.invalidateQueries('quotes');
        
        // Also invalidate related entities based on conversion type
        if (variables.data.convert_to === 'work_order') {
          queryClient.invalidateQueries('workOrders');
          if (data.work_order_id) {
            queryClient.invalidateQueries(['workOrder', data.work_order_id]);
          }
        } else if (variables.data.convert_to === 'invoice') {
          queryClient.invalidateQueries('invoices');
          if (data.invoice_id) {
            queryClient.invalidateQueries(['invoice', data.invoice_id]);
          }
        }
        
        return data;
      },
    }
  );
  
  // Download quote
  const downloadMutation = useMutation(
    ({ id, format }) => downloadQuote(id, format),
    {
      // No cache invalidation needed for downloads
    }
  );
  
  return {
    createQuote: createMutation.mutateAsync,
    updateQuote: updateMutation.mutateAsync,
    deleteQuote: deleteMutation.mutateAsync,
    updateQuoteStatus: updateStatusMutation.mutateAsync,
    sendQuote: sendMutation.mutateAsync,
    convertQuote: convertMutation.mutateAsync,
    downloadQuote: downloadMutation.mutateAsync,
    isLoading: 
      createMutation.isLoading || 
      updateMutation.isLoading || 
      deleteMutation.isLoading || 
      updateStatusMutation.isLoading ||
      sendMutation.isLoading ||
      convertMutation.isLoading ||
      downloadMutation.isLoading,
    error:
      createMutation.error ||
      updateMutation.error ||
      deleteMutation.error ||
      updateStatusMutation.error ||
      sendMutation.error ||
      convertMutation.error ||
      downloadMutation.error,
  };
}
