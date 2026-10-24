/**
 * Shared TechDeck data fetchers + react-query keys (single network call per key).
 */

import { format, addDays } from 'date-fns';
import { apiClient } from '../utils/api-client';
import {
  MetaStore,
  WorkOrderStore,
  AppointmentStore,
  ScheduleStore,
} from './db';
import {
  SCHEDULE_CACHE_FRESH_MS,
  WORK_ORDERS_CACHE_FRESH_MS,
  isMetaFresh,
} from './offlineCache';
import { isOffline } from './offlineMutations';

export const techdeckQueryKeys = {
  schedule: () => ['techdeck', 'schedule', 'combined-week'],
  workOrders: (limit) => ['techdeck', 'workOrders', { limit }],
  notifications: () => ['techdeck', 'notifications'],
  features: () => ['techdeck', 'features'],
};

function scheduleDateRange() {
  const today = new Date();
  return {
    todayStr: format(today, 'yyyy-MM-dd'),
    nextWeekStr: format(addDays(today, 7), 'yyyy-MM-dd'),
  };
}

export async function fetchTechdeckScheduleCombined() {
  const cached = await ScheduleStore.getAll();
  if (!isOffline()) {
    const scheduleFresh = await isMetaFresh('lastScheduleFetch', SCHEDULE_CACHE_FRESH_MS);
    if (scheduleFresh && cached.length) {
      return cached;
    }
    const { todayStr, nextWeekStr } = scheduleDateRange();
    const schedData = await apiClient(
      `scheduling/schedule/combined?start_date=${todayStr}&end_date=${nextWeekStr}&view_type=day`
    );
    const appts = schedData?.appointments || schedData?.schedule || schedData?.data || [];
    const list = Array.isArray(appts) ? appts : [];
    const apptItems = list.map((a) => ({
      ...a,
      id: a.id || `${a.work_order_id}-${a.scheduled_start || a.start}`,
      date: (a.scheduled_start || a.start || '').substring(0, 10),
    }));
    if (apptItems.length) {
      await AppointmentStore.putAll(apptItems);
      await ScheduleStore.putAll(apptItems);
      await MetaStore.set('lastScheduleFetch', Date.now());
    }
    return list;
  }
  return cached;
}

export async function fetchTechdeckWorkOrdersPage(limit = 100) {
  const cached = await WorkOrderStore.getAll();
  if (!isOffline()) {
    const workOrdersFresh = await isMetaFresh('lastWorkOrdersFetch', WORK_ORDERS_CACHE_FRESH_MS);
    if (workOrdersFresh && cached.length) {
      return { items: cached, total: cached.length };
    }
    const result = await apiClient(`work-orders?page=1&limit=${limit}`);
    const payload = result || { items: [], total: 0 };
    if (payload.items?.length) {
      await WorkOrderStore.putAll(payload.items);
      await MetaStore.set('lastWorkOrdersFetch', Date.now());
    }
    return payload;
  }
  return { items: cached, total: cached.length };
}

export async function fetchTechdeckNotifications() {
  const data = await apiClient('/notifications/notifications?limit=20');
  const list = data?.notifications || [];
  const unreadCount =
    typeof data?.unread_count === 'number'
      ? data.unread_count
      : list.filter((n) => !n.is_read).length;
  return { notifications: list, unreadCount };
}

export async function fetchTechdeckFeatureFlags() {
  const data = await apiClient('features');
  if (!data || !Array.isArray(data.features)) {
    throw new Error('Invalid features payload');
  }
  return new Set(data.features);
}

/** Background full list for offline cache (API max 100 per page). */
export async function prefetchTechdeckWorkOrdersBackground(queryClient) {
  if (typeof window === 'undefined' || !navigator.onLine) return;
  const run = () => {
    queryClient.prefetchQuery({
      queryKey: techdeckQueryKeys.workOrders(100),
      queryFn: () => fetchTechdeckWorkOrdersPage(100),
      staleTime: WORK_ORDERS_CACHE_FRESH_MS,
    });
  };
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 8000 });
  } else {
    setTimeout(run, 2500);
  }
}
