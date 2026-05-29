/**
 * useOfflineData — reads from IndexedDB when offline, API when online
 * Drop-in for apiClient calls on critical pages
 */

import { useState, useEffect } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import { isOffline } from '../lib/offlineMutations';
import {
  WorkOrderStore,
  AppointmentStore,
  ClientStore,
  PropertyStore,
  PartStore,
  ScheduleStore,
  MetaStore,
} from '../lib/db';
import { apiClient } from '../utils/api-client';
import { format, isToday, addDays } from 'date-fns';

/**
 * useOfflineSchedule — returns today's + upcoming appointments
 * Falls back to IndexedDB when offline
 */
export function useOfflineSchedule() {
  const { isOnline } = useOnlineStatus();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState('network');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);

      const cached = await ScheduleStore.getAll();
      if (!cancelled && cached.length) {
        setData(cached);
        setIsLoading(false);
        setSource('cache');
      }

      if (!isOffline()) {
        try {
          const today = new Date();
          const todayStr = format(today, 'yyyy-MM-dd');
          const nextWeekStr = format(addDays(today, 7), 'yyyy-MM-dd');
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
          if (!cancelled) {
            setData(list);
            setSource('network');
          }
        } catch (err) {
          console.warn('[useOfflineSchedule] Network failed, falling back to IndexedDB:', err);
          if (!cancelled && !cached.length) {
            setData(cached);
            setSource('cache');
          }
        }
      } else if (!cancelled && !cached.length) {
        setData(cached);
        setSource('cache');
      }

      if (!cancelled) setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [isOnline]);

  return { data, isLoading, source };
}

/**
 * useOfflineWorkOrders — returns all work orders
 * Falls back to IndexedDB when offline
 */
export function useOfflineWorkOrders(limit = 200) {
  const { isOnline } = useOnlineStatus();
  const [data, setData] = useState({ items: [], total: 0 });
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState('network');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setIsLoading(true);

      const cached = await WorkOrderStore.getAll();
      if (!cancelled && cached.length) {
        setData({ items: cached, total: cached.length });
        setIsLoading(false);
        setSource('cache');
      }

      if (!isOffline()) {
        try {
          const result = await apiClient(`work-orders?page=1&limit=${limit}`);
          const payload = result || { items: [], total: 0 };
          if (payload.items?.length) {
            await WorkOrderStore.putAll(payload.items);
            await MetaStore.set('lastWorkOrdersFetch', Date.now());
          }
          if (!cancelled) {
            setData(payload);
            setSource('network');
          }
        } catch (err) {
          console.warn('[useOfflineWorkOrders] Network failed, falling back to IndexedDB:', err);
          if (!cancelled && !cached.length) {
            setData({ items: cached, total: cached.length });
            setSource('cache');
          }
        }
      } else if (!cancelled && !cached.length) {
        setData({ items: cached, total: cached.length });
        setSource('cache');
      }

      if (!cancelled) setIsLoading(false);
    }

    load();
    return () => { cancelled = true; };
  }, [isOnline, limit]);

  return { data, isLoading, source };
}

/**
 * useOfflineWorkOrder — returns a single work order by ID
 * Falls back to IndexedDB when offline
 */
export function useOfflineWorkOrder(id) {
  const { isOnline } = useOnlineStatus();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [source, setSource] = useState('network');

  useEffect(() => {
    if (!id) return;

    async function load() {
      setIsLoading(true);

      if (!isOffline()) {
        try {
          const result = await apiClient(`work-orders/${id}`);
          setData(result);
          setSource('network');
          // Update cache
          if (result) WorkOrderStore.put(result);
        } catch (err) {
          console.warn('[useOfflineWorkOrder] Network failed, falling back to IndexedDB:', err);
          const cached = await WorkOrderStore.get(id);
          setData(cached);
          setSource('cache');
        }
      } else {
        const cached = await WorkOrderStore.get(id);
        setData(cached);
        setSource('cache');
      }

      setIsLoading(false);
    }

    load();
  }, [id, isOnline]);

  return { data, isLoading, source };
}

/**
 * useOfflineClient — returns a single client by ID
 * Falls back to IndexedDB when offline
 */
export function useOfflineClient(id) {
  const { isOnline } = useOnlineStatus();
  const [data, setData] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!id) return;

    async function load() {
      setIsLoading(true);

      if (!isOffline()) {
        try {
          const result = await apiClient(`clients/${id}`);
          setData(result);
          if (result) ClientStore.put(result);
        } catch (err) {
          const cached = await ClientStore.get(id);
          setData(cached);
        }
      } else {
        const cached = await ClientStore.get(id);
        setData(cached);
      }

      setIsLoading(false);
    }

    load();
  }, [id, isOnline]);

  return { data, isLoading };
}

/**
 * useOfflineProperties — returns all properties for a client
 * Falls back to IndexedDB when offline
 */
export function useOfflineProperties(clientId) {
  const { isOnline } = useOnlineStatus();
  const [data, setData] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!clientId) return;

    async function load() {
      setIsLoading(true);

      if (!isOffline()) {
        try {
          const result = await apiClient(`properties/client/${clientId}`);
          const props = Array.isArray(result) ? result : [];
          setData(props);
          if (props.length) PropertyStore.putAll(props);
        } catch (err) {
          const cached = await PropertyStore.getByClient(clientId);
          setData(cached);
        }
      } else {
        const cached = await PropertyStore.getByClient(clientId);
        setData(cached);
      }

      setIsLoading(false);
    }

    load();
  }, [clientId, isOnline]);

  return { data, isLoading };
}
