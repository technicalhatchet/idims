import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { 
  getWorkOrders, 
  createWorkOrder, 
  createWorkOrderWithInitialAppointment,
  updateWorkOrder, 
  deleteWorkOrder,
  updateWorkOrderStatus,
  assignWorkOrder,
  getWorkOrderTimeline
} from '../services/api/workOrdersApi';
import {
  fetchWorkOrderWithCache,
  transformWorkOrderRecord,
} from '../lib/offlineReads';
import { WorkOrderStore } from '../lib/db';
import { isOffline, isQueueableNetworkError } from '../lib/offlineMutations';

/**
 * Hook for work orders list with pagination and filtering
 */
export function useWorkOrders(params = {}, options = {}) {
  return useQuery({
    queryKey: ['workOrders', params],
    queryFn: async () => {
      if (isOffline()) {
        const cached = await WorkOrderStore.getAll();
        return {
          items: cached.map(transformWorkOrderRecord),
          total: cached.length,
          page: 1,
          pages: 1,
          fromCache: true,
        };
      }

      let result;
      try {
        result = await getWorkOrders(params);
      } catch (err) {
        const cached = await WorkOrderStore.getAll();
        if (cached.length && isQueueableNetworkError(err)) {
          return {
            items: cached.map(transformWorkOrderRecord),
            total: cached.length,
            page: 1,
            pages: 1,
            fromCache: true,
          };
        }
        throw err;
      }

      if (result?.items?.length) {
        await WorkOrderStore.putAll(result.items);
      }
      
      // Transform each work order to include client and technician objects
      if (result && result.items) {
        result.items = result.items.map((workOrder) =>
          transformWorkOrderRecord({ ...workOrder })
        );
      }
      
      return result;
    },
    staleTime: 10000, // 10 seconds
    retry: (count) => !isOffline() && count < 1,
    ...options,
  });
}

/**
 * Hook for single work order by ID
 */
export function useWorkOrder(id, options = {}) {
  return useQuery({
    queryKey: ['workOrder', id],
    queryFn: () => fetchWorkOrderWithCache(id),
    enabled: !!id,
    retry: (count) => !isOffline() && count < 1,
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
    mutationFn: async (workOrderData) => {
      console.log('useWorkOrderMutations - Creating work order with data:', workOrderData);
      try {
        const response = await createWorkOrder(workOrderData);
        console.log('useWorkOrderMutations - Work order creation response:', response);

        // Normal path: API returns a single created work order with `id`
        if (response && response.id && !response.items) {
          return response;
        }
        // Legacy mistake: POST was proxied to list and returned paginated shape; never trust items[0]
        if (response && response.items && response.items.length > 0) {
          console.warn(
            'useWorkOrderMutations - Create returned a list payload; expected a single work order. Check POST /api/work-orders proxy.'
          );
        }

        return response;
      } catch (error) {
        console.error('useWorkOrderMutations - Work order creation failed:', error);
        throw error;
      }
    },
    onSuccess: (data) => {
      console.log('useWorkOrderMutations - Work order creation successful, invalidating queries with data:', data);
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      if (data && data.id) {
        console.log('useWorkOrderMutations - New work order ID:', data.id);
        queryClient.invalidateQueries({ queryKey: ['workOrder', data.id] });
      }
      return data;
    },
  });

  const createWithInitialAppointmentMutation = useMutation({
    mutationFn: (payload) => createWorkOrderWithInitialAppointment(payload),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['workOrders'] });
      const wo = data?.work_order;
      if (wo?.id) {
        queryClient.invalidateQueries({ queryKey: ['workOrder', wo.id] });
      }
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
    mutationFn: (data) => updateWorkOrderStatus(data),
    onSuccess: (data) => {
      if (data?.queued && data.id) {
        queryClient.setQueryData(['workOrder', data.id], (old) =>
          old ? { ...old, status: data.status } : old
        );
      }
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
    createWorkOrderWithInitialAppointment: createWithInitialAppointmentMutation.mutateAsync,
    updateWorkOrder: updateMutation.mutateAsync,
    deleteWorkOrder: deleteMutation.mutateAsync,
    updateWorkOrderStatus: updateStatusMutation.mutateAsync,
    assignTechnician: assignMutation.mutateAsync,
    isLoading: 
      createMutation.isPending || 
      createWithInitialAppointmentMutation.isPending ||
      updateMutation.isPending || 
      deleteMutation.isPending || 
      updateStatusMutation.isPending ||
      assignMutation.isPending,
    error:
      createMutation.error ||
      createWithInitialAppointmentMutation.error ||
      updateMutation.error ||
      deleteMutation.error ||
      updateStatusMutation.error ||
      assignMutation.error,
  };
}