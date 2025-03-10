import { useQuery, useMutation, useQueryClient } from 'react-query';
import { 
  getTechnicians, 
  getTechnician, 
  createTechnician, 
  updateTechnician, 
  deleteTechnician,
  getTechnicianWorkload,
  getTechnicianPerformance,
  getSkills,
  getTechnicianAvailability,
  updateTechnicianAvailability
} from '@/services/api/techniciansApi';

/**
 * Hook for technicians list with pagination and filtering
 */
export function useTechnicians(params = {}, options = {}) {
  return useQuery(
    ['technicians', params],
    () => getTechnicians(params),
    {
      keepPreviousData: true,
      staleTime: 10000, // 10 seconds
      ...options,
    }
  );
}

/**
 * Hook for single technician by ID
 */
export function useTechnician(id, options = {}) {
  return useQuery(
    ['technician', id],
    () => getTechnician(id),
    {
      enabled: !!id,
      ...options,
    }
  );
}

/**
 * Hook for technician workload
 */
export function useTechnicianWorkload(id, startDate, endDate, options = {}) {
  return useQuery(
    ['technicianWorkload', id, startDate?.toISOString(), endDate?.toISOString()],
    () => getTechnicianWorkload(id, startDate, endDate),
    {
      enabled: !!id && !!startDate && !!endDate,
      ...options,
    }
  );
}

/**
 * Hook for technician performance metrics
 */
export function useTechnicianPerformance(id, period = 'month', options = {}) {
  return useQuery(
    ['technicianPerformance', id, period],
    () => getTechnicianPerformance(id, period),
    {
      enabled: !!id,
      ...options,
    }
  );
}

/**
 * Hook for retrieving all available skills
 */
export function useSkills(options = {}) {
  return useQuery(
    'skills',
    getSkills,
    {
      staleTime: 600000, // 10 minutes
      ...options,
    }
  );
}

/**
 * Hook for technician availability
 */
export function useTechnicianAvailability(id, startDate, endDate, options = {}) {
  return useQuery(
    ['technicianAvailability', id, startDate?.toISOString(), endDate?.toISOString()],
    () => getTechnicianAvailability(id, startDate, endDate),
    {
      enabled: !!id && !!startDate && !!endDate,
      ...options,
    }
  );
}

/**
 * Hooks for technician mutations with cache updates
 */
export function useTechnicianMutations() {
  const queryClient = useQueryClient();
  
  // Create technician
  const createMutation = useMutation(createTechnician, {
    onSuccess: (data) => {
      queryClient.invalidateQueries('technicians');
      return data;
    },
  });
  
  // Update technician
  const updateMutation = useMutation(
    ({ id, data }) => updateTechnician(id, data),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['technician', data.id]);
        queryClient.invalidateQueries('technicians');
        return data;
      },
    }
  );
  
  // Delete technician
  const deleteMutation = useMutation(deleteTechnician, {
    onSuccess: (_, id) => {
      queryClient.invalidateQueries(['technician', id]);
      queryClient.invalidateQueries('technicians');
    },
  });
  
  // Update technician availability
  const updateAvailabilityMutation = useMutation(
    ({ id, data }) => updateTechnicianAvailability(id, data),
    {
      onSuccess: (data) => {
        queryClient.invalidateQueries(['technicianAvailability', data.id]);
        queryClient.invalidateQueries(['technician', data.id]);
        return data;
      },
    }
  );
  
  return {
    createTechnician: createMutation.mutateAsync,
    updateTechnician: updateMutation.mutateAsync,
    deleteTechnician: deleteMutation.mutateAsync,
    updateTechnicianAvailability: updateAvailabilityMutation.mutateAsync,
    isLoading: 
      createMutation.isLoading || 
      updateMutation.isLoading || 
      deleteMutation.isLoading || 
      updateAvailabilityMutation.isLoading,
    error:
      createMutation.error ||
      updateMutation.error ||
      deleteMutation.error ||
      updateAvailabilityMutation.error,
  };
}