import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getTechnicians } from '../services/api/techniciansApi';
import { useUserRole } from '../utils/auth0-helpers';

const TECHNICIANS_STALE_MS = 5 * 60 * 1000;

/** Warm the technicians React Query cache before the Appointments tab mounts. */
export function usePrefetchTechnicians() {
  const queryClient = useQueryClient();
  const { user, role } = useUserRole();

  useEffect(() => {
    if (!user) return;
    if (role !== 'technician' && role !== 'manager' && role !== 'admin') return;

    queryClient.prefetchQuery({
      queryKey: ['technicians', {}],
      queryFn: () => getTechnicians({}),
      staleTime: TECHNICIANS_STALE_MS,
    });
  }, [user, role, queryClient]);
}
