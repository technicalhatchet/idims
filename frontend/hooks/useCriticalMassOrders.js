import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useUser } from '@auth0/nextjs-auth0/client';
import { apiClient } from '../utils/api-client';
import { getUserRole } from '../utils/auth0-helpers';
import { useWorkOrders } from './useWorkOrders';
import { sortCriticalMass } from '../utils/criticalMass';

// Same fetch as the Critical Mass page (/techboard/mass), so the two share one cached list
// and "Open full list" lands instantly after the panel has loaded.
const FETCH_LIMIT = 500;

/**
 * Overdue work orders for the dashboard Critical Mass panel, most overdue first.
 * Technicians see only their own jobs (matched by email, like the Critical Mass page).
 * Nothing is fetched until `enabled` (the panel is opened).
 */
export function useCriticalMassOrders({ enabled = false } = {}) {
  const { user, isLoading: authLoading } = useUser();
  const isTechnician = user ? getUserRole(user) === 'technician' : false;

  const techQuery = useQuery({
    queryKey: ['technicians', 'mine', user?.email || ''],
    queryFn: async () => {
      const res = await apiClient('technicians');
      const mine = (res?.items || []).find((t) => t.user?.email === user.email || t.user_email === user.email);
      return mine ? String(mine.id) : '';
    },
    enabled: enabled && isTechnician && Boolean(user?.email),
    staleTime: 10 * 60 * 1000,
  });
  const myTechId = techQuery.data || '';

  const params = useMemo(() => {
    const base = { page: 1, limit: FETCH_LIMIT };
    return isTechnician && myTechId ? { ...base, technician_id: myTechId } : base;
  }, [isTechnician, myTechId]);

  const ready = enabled && !authLoading && (!isTechnician || Boolean(myTechId));
  const { data, isLoading, error, refetch } = useWorkOrders(params, { enabled: ready });

  const rows = useMemo(() => sortCriticalMass(data?.items || []), [data]);

  return {
    rows,
    total: rows.length,
    loading: enabled && (!data && (isLoading || !ready) && !error && !techQuery.error),
    error: error || techQuery.error || null,
    // A technician with no matching technician record has nothing to show.
    noTechRecord: isTechnician && techQuery.isSuccess && !myTechId,
    refetch,
  };
}
