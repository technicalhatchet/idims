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
} from '../services/api/techniciansApi';

/**
 * Hook for technicians list with pagination and filtering
 */
export function useTechnicians(params = {}) {
  return useQuery(
    ['technicians', params],
    () => getTechnicians(params),
    {
      keepPreviousData: true,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  );
}

/**
 * Hook for single technician by ID
 */
export function useTechnician(id) {
  return useQuery(
    ['technician', id],
    () => getTechnician(id),
    {
      enabled: !!id,
      staleTime: 5 * 60 * 1000 // 5 minutes
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
export function useTechnicianPerformance(id, period = 'month') {
  return useQuery(
    ['technician-performance', id, period],
    () => getTechnicianPerformance(id, period),
    {
      enabled: !!id,
      staleTime: 15 * 60 * 1000 // 15 minutes
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
  
  const createTechnicianMutation = useMutation(
    (technicianData) => createTechnician(technicianData),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('technicians');
      },
    }
  );
  
  const updateTechnicianMutation = useMutation(
    ({ id, data }) => updateTechnician(id, data),
    {
      onSuccess: (data, variables) => {
        queryClient.invalidateQueries(['technician', variables.id]);
        queryClient.invalidateQueries('technicians');
      },
    }
  );
  
  const deleteTechnicianMutation = useMutation(
    (id) => deleteTechnician(id),
    {
      onSuccess: () => {
        queryClient.invalidateQueries('technicians');
      },
    }
  );
  
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
    createTechnician: createTechnicianMutation.mutateAsync,
    updateTechnician: updateTechnicianMutation.mutateAsync,
    deleteTechnician: deleteTechnicianMutation.mutateAsync,
    updateTechnicianAvailability: updateAvailabilityMutation.mutateAsync,
    isLoading: 
      createTechnicianMutation.isLoading || 
      updateTechnicianMutation.isLoading || 
      deleteTechnicianMutation.isLoading || 
      updateAvailabilityMutation.isLoading,
    error:
      createTechnicianMutation.error ||
      updateTechnicianMutation.error ||
      deleteTechnicianMutation.error ||
      updateAvailabilityMutation.error,
  };
}

// Hook for fetching technician schedule/workload
export function useTechnicianSchedule(id, startDate, endDate) {
  return useQuery(
    ['technician-schedule', id, startDate?.toISOString(), endDate?.toISOString()],
    () => getTechnicianWorkload(id, startDate, endDate),
    {
      enabled: !!id && !!startDate && !!endDate,
      staleTime: 5 * 60 * 1000 // 5 minutes
    }
  );
}