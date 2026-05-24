import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  getTechnicians, 
  getTechnician, 
  createTechnician,
  updateTechnician,
  deleteTechnician,
  getSkills,
  getTechnicianAvailability,
  updateTechnicianAvailability,
  getTechnicianSchedule,
  getTechnicianWorkload,
  getTechnicianPerformance,
  getMyTechnicianPerformance
} from '../services/api/techniciansApi';

/**
 * Hook to fetch technicians with optional filtering
 */
export function useTechnicians(params = {}) {
  return useQuery({
    queryKey: ['technicians', params],
    queryFn: () => getTechnicians(params),
    keepPreviousData: true,
    staleTime: 30000
  });
}

/**
 * Hook to fetch a specific technician by ID
 */
export function useTechnician(id) {
  return useQuery({
    queryKey: ['technician', id],
    queryFn: () => getTechnician(id),
    enabled: !!id,
    staleTime: 30000
  });
}

/**
 * Hook for technician mutations (create, update, delete)
 */
export function useTechnicianMutations() {
  const queryClient = useQueryClient();

  // Create technician mutation
  const createMutation = useMutation({
    mutationFn: async (data) => {
      try {
        console.log("Creating technician with data:", data);
        const result = await createTechnician(data);
        console.log("Technician created successfully:", result);
        return result;
      } catch (error) {
        console.error("Error in createTechnician mutation:", error);
        // Rethrow to let the component handle it
        throw error;
      }
    },
    onSuccess: () => {
      console.log("Technician creation mutation succeeded");
      queryClient.invalidateQueries({queryKey: ['technicians']});
    },
    onError: (error) => {
      console.error("Technician creation mutation failed", error);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => updateTechnician(id, data),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({queryKey: ['technicians']});
      queryClient.invalidateQueries({queryKey: ['technician', id]});
    }
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => {
      console.log(`Deleting technician with ID: ${id}`);
      return deleteTechnician(id);
    },
    onSuccess: () => {
      console.log("Technician deleted successfully");
      queryClient.invalidateQueries({queryKey: ['technicians']});
    },
    onError: (error) => {
      console.error("Failed to delete technician:", error);
    }
  });

  const updateAvailabilityMutation = useMutation({
    mutationFn: ({ id, data }) => updateTechnicianAvailability(id, data),
    onSuccess: (data, { id }) => {
      queryClient.invalidateQueries({queryKey: ['technician', id]});
      queryClient.invalidateQueries({queryKey: ['technician', id, 'availability']});
    }
  });

  return {
    create: createMutation.mutateAsync,
    update: updateMutation.mutateAsync,
    delete: deleteMutation.mutateAsync,
    updateAvailability: updateAvailabilityMutation.mutateAsync,
    isLoading: createMutation.isLoading || updateMutation.isLoading || deleteMutation.isLoading || updateAvailabilityMutation.isLoading,
    error: createMutation.error || updateMutation.error || deleteMutation.error || updateAvailabilityMutation.error
  };
}

/**
 * Hook for technician workload
 */
export function useTechnicianWorkload(id, startDate, endDate, options = {}) {
  return useQuery({
    queryKey: ['technicianWorkload', id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => getTechnicianWorkload(id, startDate, endDate),
    enabled: !!id,
    ...options
  });
}

/**
 * Hook for technician performance
 */
export function useTechnicianPerformance(id, period = 'month') {
  return useQuery({
    queryKey: ['technicianPerformance', id, period],
    queryFn: () => getTechnicianPerformance(id, period),
    enabled: !!id,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}

export function useTechnicianMyPerformance(period = 'month') {
  return useQuery({
    queryKey: ['technicianPerformance', 'me', period],
    queryFn: () => getMyTechnicianPerformance(period),
    staleTime: 5 * 60 * 1000,
  });
}

/**
 * Hook for skills list
 */
export function useSkills(options = {}) {
  return useQuery({
    queryKey: ['skills'],
    queryFn: () => getSkills(),
    staleTime: 5 * 60 * 1000, // 5 minutes
    ...options
  });
}

/**
 * Hook for technician availability
 */
export function useTechnicianAvailability(id, startDate, endDate, options = {}) {
  return useQuery({
    queryKey: ['technicianAvailability', id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => getTechnicianAvailability(id, startDate, endDate),
    enabled: !!id,
    ...options
  });
}

/**
 * Hook for technician schedule
 */
export function useTechnicianSchedule(id, startDate, endDate) {
  return useQuery({
    queryKey: ['technicianSchedule', id, startDate?.toISOString(), endDate?.toISOString()],
    queryFn: () => getTechnicianSchedule(id, startDate, endDate),
    enabled: !!id,
    staleTime: 5 * 60 * 1000 // 5 minutes
  });
}