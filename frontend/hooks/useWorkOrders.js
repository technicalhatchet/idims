import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { 
  getWorkOrders, 
  getWorkOrder, 
  createWorkOrder, 
  createWorkOrderWithInitialAppointment,
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
    queryFn: async () => {
      const result = await getWorkOrders(params);
      
      // Transform each work order to include client and technician objects
      if (result && result.items) {
        result.items = result.items.map(workOrder => {
          const transformedWorkOrder = { ...workOrder };
          
          // Add client object if client_name exists
          if (transformedWorkOrder.client_name) {
            // Try to parse client name into first and last name
            let firstName = '';
            let lastName = '';
            let companyName = transformedWorkOrder.client_name;
            
            // If it's not a company name (no LLC, Inc. etc.), try to split into first/last
            if (!transformedWorkOrder.client_name.includes('LLC') && 
                !transformedWorkOrder.client_name.includes('Inc') && 
                !transformedWorkOrder.client_name.includes('Company')) {
              const nameParts = transformedWorkOrder.client_name.trim().split(' ');
              if (nameParts.length > 0) {
                firstName = nameParts[0];
                lastName = nameParts.slice(1).join(' ');
              }
            }
            
            transformedWorkOrder.client = {
              first_name: firstName,
              last_name: lastName,
              company_name: companyName,
              // If client_user exists, add its properties
              ...(transformedWorkOrder.client_user || {})
            };
          }
          
          // Add technician object if technician_name exists
          if (transformedWorkOrder.technician_name) {
            transformedWorkOrder.technician = {
              name: transformedWorkOrder.technician_name,
              // If technician_user exists, add its properties
              ...(transformedWorkOrder.technician_user || {})
            };
          }
          
          return transformedWorkOrder;
        });
      }
      
      return result;
    },
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
    queryFn: async () => {
      const data = await getWorkOrder(id);
      
      // Create client and technician objects to match the expected structure
      // This adapts the flat structure from the API to the nested structure expected by UI
      if (data) {
        // Add client object if client_name exists
        if (data.client_name) {
          // Try to parse client name into first and last name
          let firstName = '';
          let lastName = '';
          let companyName = data.client_name;
          
          // If it's not a company name (no LLC, Inc. etc.), try to split into first/last
          if (!data.client_name.includes('LLC') && 
              !data.client_name.includes('Inc') && 
              !data.client_name.includes('Company')) {
            const nameParts = data.client_name.trim().split(' ');
            if (nameParts.length > 0) {
              firstName = nameParts[0];
              lastName = nameParts.slice(1).join(' ');
            }
          }
          
          data.client = {
            first_name: firstName,
            last_name: lastName,
            company_name: companyName,
            // If client_user exists, add its properties
            ...(data.client_user || {})
          };
        }
        
        // Add technician object if technician_name exists
        if (data.technician_name) {
          data.technician = {
            name: data.technician_name,
            // If technician_user exists, add its properties
            ...(data.technician_user || {})
          };
        }
      }
      
      return data;
    },
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