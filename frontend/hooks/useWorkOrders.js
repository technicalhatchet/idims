import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { 
  getWorkOrders, 
  getWorkOrder, 
  createWorkOrder, 
  updateWorkOrder, 
  deleteWorkOrder,
  updateWorkOrderStatus,
  assignWorkOrder,
  getWorkOrderTimeline
} from '../services/api/workOrdersApi';

/**
 * Hook for work orders list with pagination and filtering
 */
export function useWorkOrders(params = {}, options = {}) {
  return useQuery({
    queryKey: ['workOrders', params],
    queryFn: () => getWorkOrders(params),
    staleTime: 10000, // 10 seconds
    ...options,
  });
}

/**
 * Hook for single work order by ID
 */
export function useWorkOrder(id, options = {}) {
  return useQuery({
    queryKey: ['workOrder', id],
    queryFn: () => getWorkOrder(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hook for work order timeline
 */
export function useWorkOrderTimeline(id, options = {}) {
  return useQuery({
    queryKey: ['workOrderTimeline', id],
    queryFn: () => getWorkOrderTimeline(id),
    enabled: !!id,
    ...options,
  });
}

/**
 * Hooks for work order mutations with cache updates
 */
export function useWorkOrderMutations() {
  const queryClient = useQueryClient();
  
  // Create work order
  const createMutation = useMutation({
    mutationFn: createWorkOrder,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      return data;
    },
  });
  
  // Update work order
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateWorkOrder(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workOrder', data.id] });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      return data;
    },
  });
  
  // Delete work order
  const deleteMutation = useMutation({
    mutationFn: deleteWorkOrder,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['workOrder', id] });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
    },
  });
  
  // Update work order status
  const updateStatusMutation = useMutation({
    mutationFn: ({ id, status, notes }) => updateWorkOrderStatus(id, status, notes),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workOrder', data.id] });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      return data;
    },
  });
  
  // Assign technician
  const assignMutation = useMutation({
    mutationFn: ({ id, technicianId }) => assignWorkOrder(id, technicianId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workOrder', data.id] });
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      return data;
    },
  });
  
  return {
    createWorkOrder: createMutation.mutateAsync,
    updateWorkOrder: updateMutation.mutateAsync,
    deleteWorkOrder: deleteMutation.mutateAsync,
    updateWorkOrderStatus: updateStatusMutation.mutateAsync,
    assignTechnician: assignMutation.mutateAsync,
    isLoading: 
      createMutation.isPending || 
      updateMutation.isPending || 
      deleteMutation.isPending || 
      updateStatusMutation.isPending ||
      assignMutation.isPending,
    error:
      createMutation.error ||
      updateMutation.error ||
      deleteMutation.error ||
      updateStatusMutation.error ||
      assignMutation.error,
  };
}