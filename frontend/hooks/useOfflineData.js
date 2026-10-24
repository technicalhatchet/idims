/**
 * useOfflineData — IndexedDB + API via shared react-query fetchers
 */

import { useQuery } from '@tanstack/react-query';
import { useOnlineStatus } from './useOnlineStatus';
import { isOffline } from '../lib/offlineMutations';
import { WorkOrderStore, ClientStore, PropertyStore } from '../lib/db';
import { apiClient } from '../utils/api-client';
import {
  SCHEDULE_CACHE_FRESH_MS,
  WORK_ORDERS_CACHE_FRESH_MS,
} from '../lib/offlineCache';
import {
  techdeckQueryKeys,
  fetchTechdeckScheduleCombined,
  fetchTechdeckWorkOrdersPage,
} from '../lib/techdeckQueries';

export function useOfflineSchedule() {
  const { isOnline } = useOnlineStatus();
  const query = useQuery({
    queryKey: techdeckQueryKeys.schedule(),
    queryFn: fetchTechdeckScheduleCombined,
    staleTime: SCHEDULE_CACHE_FRESH_MS,
    enabled: isOnline || isOffline(),
  });
  return {
    data: query.data ?? [],
    isLoading: query.isLoading,
    source: query.isFetching ? 'network' : 'cache',
  };
}

export function useOfflineWorkOrders(limit = 100) {
  const { isOnline } = useOnlineStatus();
  const query = useQuery({
    queryKey: techdeckQueryKeys.workOrders(limit),
    queryFn: () => fetchTechdeckWorkOrdersPage(limit),
    staleTime: WORK_ORDERS_CACHE_FRESH_MS,
    enabled: isOnline || isOffline(),
  });
  return {
    data: query.data ?? { items: [], total: 0 },
    isLoading: query.isLoading,
    source: query.isFetching ? 'network' : 'cache',
  };
}

export function useOfflineWorkOrdersCache(limit = 100) {
  return useQuery({
    queryKey: techdeckQueryKeys.workOrders(limit),
    queryFn: () => fetchTechdeckWorkOrdersPage(limit),
    enabled: false,
    staleTime: WORK_ORDERS_CACHE_FRESH_MS,
  });
}

/**
 * useOfflineWorkOrder — returns a single work order by ID
 */
export function useOfflineWorkOrder(id) {
  const { isOnline } = useOnlineStatus();
  const query = useQuery({
    queryKey: ['techdeck', 'workOrder', id],
    queryFn: async () => {
      if (!isOffline()) {
        try {
          const result = await apiClient(`work-orders/${id}`);
          if (result) WorkOrderStore.put(result);
          return result;
        } catch (err) {
          console.warn('[useOfflineWorkOrder] Network failed, falling back to IndexedDB:', err);
          return WorkOrderStore.get(id);
        }
      }
      return WorkOrderStore.get(id);
    },
    enabled: Boolean(id),
  });
  return { data: query.data ?? null, isLoading: query.isLoading, source: 'network' };
}

export function useOfflineClient(id) {
  const { isOnline } = useOnlineStatus();
  const query = useQuery({
    queryKey: ['techdeck', 'client', id],
    queryFn: async () => {
      if (!isOffline()) {
        try {
          const result = await apiClient(`clients/${id}`);
          if (result) ClientStore.put(result);
          return result;
        } catch {
          return ClientStore.get(id);
        }
      }
      return ClientStore.get(id);
    },
    enabled: Boolean(id),
  });
  return { data: query.data ?? null, isLoading: query.isLoading };
}

export function useOfflineProperties(clientId) {
  const { isOnline } = useOnlineStatus();
  const query = useQuery({
    queryKey: ['techdeck', 'properties', clientId],
    queryFn: async () => {
      if (!isOffline()) {
        try {
          const result = await apiClient(`properties/client/${clientId}`);
          const props = Array.isArray(result) ? result : [];
          if (props.length) PropertyStore.putAll(props);
          return props;
        } catch {
          return PropertyStore.getByClient(clientId);
        }
      }
      return PropertyStore.getByClient(clientId);
    },
    enabled: Boolean(clientId),
  });
  return { data: query.data ?? [], isLoading: query.isLoading };
}
