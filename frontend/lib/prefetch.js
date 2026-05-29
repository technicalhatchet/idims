/**
 * IDIMS Pre-fetch Engine
 * Runs on app open with signal. Pulls down everything needed for the day
 * and stores it in IndexedDB so the app works fully offline.
 */

import { apiClient } from '../utils/api-client';
import {
  WorkOrderStore,
  AppointmentStore,
  ClientStore,
  PropertyStore,
  PartStore,
  ScheduleStore,
  MetaStore,
} from './db';
import { format, addDays } from 'date-fns';

const PREFETCH_INTERVAL_MS = 5 * 60 * 1000; // Re-fetch every 5 minutes when online
const PREFETCH_CONCURRENCY = 2;
const PREFETCH_DEFER_AFTER_NETWORK_MS = 2 * 60 * 1000;

let prefetchInFlight = null;

async function mapWithConcurrency(items, fn, concurrency = PREFETCH_CONCURRENCY) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.allSettled(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/**
 * Check if we need to prefetch based on last sync time
 */
async function shouldPrefetch() {
  const lastSync = await MetaStore.get('lastPrefetch');
  if (!lastSync) return true;
  return Date.now() - lastSync > PREFETCH_INTERVAL_MS;
}

async function networkDataFresh(key) {
  const last = await MetaStore.get(key);
  return last && Date.now() - last < PREFETCH_DEFER_AFTER_NETWORK_MS;
}

/**
 * Main prefetch function — call this on app open when online.
 * Fetches everything needed for today and the next 7 days.
 */
export async function prefetchAll(options = {}) {
  const { force = false, onProgress } = options;

  if (!navigator.onLine) {
    console.log('[Prefetch] Offline — skipping prefetch');
    return { skipped: true, reason: 'offline' };
  }

  if (!force && !(await shouldPrefetch())) {
    console.log('[Prefetch] Recent sync found — skipping');
    return { skipped: true, reason: 'recent' };
  }

  if (prefetchInFlight) {
    console.log('[Prefetch] Already running — skipping duplicate');
    return prefetchInFlight;
  }

  prefetchInFlight = (async () => {
  console.log('[Prefetch] Starting prefetch...');
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const nextWeekStr = format(addDays(today, 7), 'yyyy-MM-dd');

  try {
    let appointments = [];
    let workOrders = [];

    const scheduleFresh = !force && (await networkDataFresh('lastScheduleFetch'));
    const workOrdersFresh = !force && (await networkDataFresh('lastWorkOrdersFetch'));

    if (scheduleFresh) {
      onProgress?.('Using recent schedule from cache...');
      appointments = await ScheduleStore.getAll();
    } else {
      onProgress?.('Fetching schedule...');
      const schedData = await apiClient(
        `scheduling/schedule/combined?start_date=${todayStr}&end_date=${nextWeekStr}&view_type=day`
      );
      appointments = schedData?.appointments || schedData?.schedule || schedData?.data || [];
    }

    const apptItems = appointments.map((a) => ({
      ...a,
      id: a.id || `${a.work_order_id}-${a.scheduled_start || a.start}`,
      date: (a.scheduled_start || a.start || '').substring(0, 10),
    }));
    if (apptItems.length) {
      await AppointmentStore.putAll(apptItems);
      await ScheduleStore.putAll(apptItems);
    }
    if (!scheduleFresh) {
      await MetaStore.set('lastScheduleFetch', Date.now());
    }

    if (workOrdersFresh) {
      onProgress?.('Using recent work orders from cache...');
      workOrders = await WorkOrderStore.getAll();
    } else {
      onProgress?.('Fetching work orders...');
      const woData = await apiClient('work-orders?page=1&limit=200');
      workOrders = woData?.items || [];
      if (workOrders.length) {
        await WorkOrderStore.putAll(workOrders);
      }
      await MetaStore.set('lastWorkOrdersFetch', Date.now());
    }

    const todayWOIds = apptItems
      .filter((a) => a.date === todayStr)
      .map((a) => a.work_order_id)
      .filter(Boolean)
      .filter((id, i, arr) => arr.indexOf(id) === i);

    onProgress?.(`Fetching ${todayWOIds.length} work order details...`);

    const woDetails = await mapWithConcurrency(todayWOIds, (id) =>
      apiClient(`work-orders/${id}`)
    );
    const detailedWOs = woDetails
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);
    if (detailedWOs.length) {
      await WorkOrderStore.putAll(detailedWOs);
    }

    // Client directory once — skip N individual client GETs
    onProgress?.('Fetching client directory...');
    let allClients = [];
    try {
      const clientList = await apiClient('clients?page=1&limit=100');
      allClients = clientList?.items || [];
      if (allClients.length) {
        await ClientStore.putAll(allClients);
      }
    } catch (err) {
      console.warn('[Prefetch] Client directory fetch failed:', err);
    }

    const clientIds = [
      ...new Set(
        [...detailedWOs, ...workOrders.filter((w) => todayWOIds.includes(w.id))]
          .map((w) => w.client_id)
          .filter(Boolean)
      ),
    ];

    onProgress?.(`Fetching properties for ${clientIds.length} clients...`);

    const propertyResults = await mapWithConcurrency(clientIds, (id) =>
      apiClient(`properties/client/${id}`)
    );
    const allProperties = propertyResults
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (Array.isArray(r.value) ? r.value : []))
      .filter((p) => p && p.id);
    if (allProperties.length) {
      await PropertyStore.putAll(allProperties);
    }

    onProgress?.('Fetching parts...');

    const partsResults = await mapWithConcurrency(todayWOIds, (id) =>
      apiClient(`work-orders/${id}/parts`).then((data) =>
        (Array.isArray(data) ? data : data?.items || []).map((p) => ({
          ...p,
          work_order_id: id,
        }))
      )
    );
    const allParts = partsResults
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .filter((p) => p && p.id);
    if (allParts.length) {
      await PartStore.putAll(allParts);
    }

    await MetaStore.set('lastPrefetch', Date.now());
    await MetaStore.set('lastPrefetchDate', todayStr);

    const summary = {
      appointments: apptItems.length,
      workOrders: workOrders.length,
      detailedWorkOrders: detailedWOs.length,
      clients: allClients.length,
      properties: allProperties.length,
      parts: allParts.length,
    };

    console.log('[Prefetch] Complete:', summary);
    onProgress?.('Ready for offline use');
    return { success: true, summary };
  } catch (err) {
    console.error('[Prefetch] Error:', err);
    return { success: false, error: err.message };
  } finally {
    prefetchInFlight = null;
  }
  })();

  return prefetchInFlight;
}

/**
 * Light refresh — just schedule and work order statuses.
 * Runs more frequently to keep data fresh while online.
 */
export async function prefetchScheduleOnly() {
  if (!navigator.onLine) return;

  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const nextWeekStr = format(addDays(today, 7), 'yyyy-MM-dd');

  try {
    const schedData = await apiClient(
      `scheduling/schedule/combined?start_date=${todayStr}&end_date=${nextWeekStr}&view_type=day`
    );
    const appointments = schedData?.appointments || schedData?.schedule || schedData?.data || [];
    const apptItems = appointments.map((a) => ({
      ...a,
      id: a.id || `${a.work_order_id}-${a.scheduled_start || a.start}`,
      date: (a.scheduled_start || a.start || '').substring(0, 10),
    }));
    await AppointmentStore.putAll(apptItems);
    await ScheduleStore.putAll(apptItems);
    await MetaStore.set('lastScheduleFetch', Date.now());

    // Refresh work order statuses
    const woData = await apiClient('work-orders?page=1&limit=200');
    if (woData?.items) {
      await WorkOrderStore.putAll(woData.items);
      await MetaStore.set('lastWorkOrdersFetch', Date.now());
    }
  } catch (err) {
    console.error('[Prefetch] Schedule refresh error:', err);
  }
}
