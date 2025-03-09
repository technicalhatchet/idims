import { useQuery, useMutation, useQueryClient } from 'react-query';
import { useCallback } from 'react';
import { 
  getWorkOrders, 
  getWorkOrder, 
  createWorkOrder, 
  updateWorkOrder, 
  deleteWorkOrder,
  updateWorkOrderStatus,
  assignWorkOrder
} from '@/services/api/workOrdersApi';

/**
 * Hook for work orders list with pagination and filtering
 */
export function useWorkOrders(params = {}, options = {}) {
  return useQuery(
    ['workOrders', params],
    () => getWorkOrders(params),
    {
      keepPreviousData: true,
      staleTime: 10000, // 10 seconds
      ...options,
    }
  );
}

/**
 * Hook for single work order by ID
 */
export function useWorkOrder(id, options = {}) {
  return useQuery(
    ['workOrder', id],
    () => getWorkOrder(id),
    {
      enabled: !!id,
      ...options,
    }
  );
}

/**
 * Hooks for work order mutations with cache updates
 */
export function useWorkOrderMutations() {
  const queryClient = useQueryClient();
  
  // Create work order
  const createMutation = useMutation(createWorkOrder, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('workOrders');
      return data;
    },
  });
  
  // Update work order
  const updateMutation = useMutation(
    ({ id, data }) => updateWorkOrder(id, data),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['workOrder', data.id]);
        queryClient.invalidateQueries('workOrders');
        return data;
      },
    }
  );
  
  // Delete work order
  const deleteMutation = useMutation(deleteWorkOrder, {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['workOrder', id]);
      queryClient.invalidateQueries('workOrders');
    },
  });
  
  // Update work order status
  const updateStatusMutation = useMutation(
    ({ id, status, notes }) => updateWorkOrderStatus(id, status, notes),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['workOrder', data.id]);
        queryClient.invalidateQueries('workOrders');
        return data;
      },
    }
  );
  
  // Assign work order to technician
  const assignMutation = useMutation(
    ({ id, technicianId }) => assignWorkOrder(id, technicianId),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['workOrder', data.id]);
        queryClient.invalidateQueries('workOrders');
        return data;
      },
    }
  );
  
  return {
    createWorkOrder: createMutation.mutateAsync,
    updateWorkOrder: updateMutation.mutateAsync,
    deleteWorkOrder: deleteMutation.mutateAsync,
    updateWorkOrderStatus: updateStatusMutation.mutateAsync,
    assignWorkOrder: assignMutation.mutateAsync,
    isLoading: 
      createMutation.isLoading || 
      updateMutation.isLoading || 
      deleteMutation.isLoading || 
      updateStatusMutation.isLoading ||
      assignMutation.isLoading,
    error:
      createMutation.error ||
      updateMutation.error ||
      deleteMutation.error ||
      updateStatusMutation.error ||
      assignMutation.error,
  };
}