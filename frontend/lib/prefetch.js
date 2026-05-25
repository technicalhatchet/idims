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

/**
 * Check if we need to prefetch based on last sync time
 */
async function shouldPrefetch() {
  const lastSync = await MetaStore.get('lastPrefetch');
  if (!lastSync) return true;
  return Date.now() - lastSync > PREFETCH_INTERVAL_MS;
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

  console.log('[Prefetch] Starting prefetch...');
  const today = new Date();
  const todayStr = format(today, 'yyyy-MM-dd');
  const nextWeekStr = format(addDays(today, 7), 'yyyy-MM-dd');

  try {
    onProgress?.('Fetching schedule...');

    // 1. Fetch today's schedule + next 7 days
    const schedData = await apiClient(
      `scheduling/schedule/combined?start_date=${todayStr}&end_date=${nextWeekStr}&view_type=day`
    );
    const appointments = schedData?.appointments || schedData?.schedule || schedData?.data || [];

    // Store appointments with a date field for indexing
    const apptItems = appointments.map((a) => ({
      ...a,
      id: a.id || `${a.work_order_id}-${a.scheduled_start || a.start}`,
      date: (a.scheduled_start || a.start || '').substring(0, 10),
    }));
    await AppointmentStore.putAll(apptItems);
    await ScheduleStore.putAll(apptItems);

    onProgress?.('Fetching work orders...');

    // 2. Fetch all active work orders (not completed/cancelled)
    const woData = await apiClient('work-orders?page=1&limit=200');
    const workOrders = woData?.items || [];
    await WorkOrderStore.putAll(workOrders);

    // 3. Fetch full detail for today's work orders
    const todayWOIds = apptItems
      .filter((a) => a.date === todayStr)
      .map((a) => a.work_order_id)
      .filter(Boolean)
      .filter((id, i, arr) => arr.indexOf(id) === i); // dedupe

    onProgress?.(`Fetching ${todayWOIds.length} work order details...`);

    const woDetails = await Promise.allSettled(
      todayWOIds.map((id) => apiClient(`work-orders/${id}`))
    );
    const detailedWOs = woDetails
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);
    await WorkOrderStore.putAll(detailedWOs);

    // 4. Fetch clients for today's work orders
    const clientIds = [
      ...new Set(
        [...workOrders, ...detailedWOs]
          .map((w) => w.client_id)
          .filter(Boolean)
      ),
    ];

    onProgress?.(`Fetching ${clientIds.length} clients...`);

    const clientResults = await Promise.allSettled(
      clientIds.map((id) => apiClient(`clients/${id}`))
    );
    const clients = clientResults
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);
    await ClientStore.putAll(clients);

    // 5. Fetch properties for those clients
    onProgress?.('Fetching properties...');

    const propertyResults = await Promise.allSettled(
      clientIds.map((id) => apiClient(`properties/client/${id}`))
    );
    const allProperties = propertyResults
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => (Array.isArray(r.value) ? r.value : []))
      .filter((p) => p && p.id);
    await PropertyStore.putAll(allProperties);

    // 6. Fetch parts for today's work orders
    onProgress?.('Fetching parts...');

    const partsResults = await Promise.allSettled(
      todayWOIds.map((id) =>
        apiClient(`work-orders/${id}/parts`).then((data) =>
          (Array.isArray(data) ? data : data?.items || []).map((p) => ({
            ...p,
            work_order_id: id,
          }))
        )
      )
    );
    const allParts = partsResults
      .filter((r) => r.status === 'fulfilled')
      .flatMap((r) => r.value)
      .filter((p) => p && p.id);
    await PartStore.putAll(allParts);

    // 7. Mark sync time
    await MetaStore.set('lastPrefetch', Date.now());
    await MetaStore.set('lastPrefetchDate', todayStr);

    const summary = {
      appointments: apptItems.length,
      workOrders: workOrders.length,
      detailedWorkOrders: detailedWOs.length,
      clients: clients.length,
      properties: allProperties.length,
      parts: allParts.length,
    };

    console.log('[Prefetch] Complete:', summary);
    onProgress?.('Ready for offline use');
    return { success: true, summary };
  } catch (err) {
    console.error('[Prefetch] Error:', err);
    return { success: false, error: err.message };
  }
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

    // Refresh work order statuses
    const woData = await apiClient('work-orders?page=1&limit=200');
    if (woData?.items) {
      await WorkOrderStore.putAll(woData.items);
    }
  } catch (err) {
    console.error('[Prefetch] Schedule refresh error:', err);
  }
}
