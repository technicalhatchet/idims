/**
 * Offline-aware read helpers — try network, fall back to IndexedDB.
 */

import { apiClient } from '../utils/api-client';
import {
  WorkOrderStore,
  AppointmentStore,
  PartStore,
  ClientStore,
  ScheduleStore,
} from './db';
import { getWorkOrder } from '../services/api/workOrdersApi';
import { getClients } from '../services/api/clientsApi';
import { isOffline, isQueueableNetworkError } from './offlineMutations';

export function transformWorkOrderRecord(data) {
  if (!data) return data;

  if (data.client_name && !data.client) {
    let firstName = '';
    let lastName = '';
    const companyName = data.client_name;

    if (
      !data.client_name.includes('LLC') &&
      !data.client_name.includes('Inc') &&
      !data.client_name.includes('Company')
    ) {
      const nameParts = data.client_name.trim().split(' ');
      if (nameParts.length > 0) {
        firstName = nameParts[0];
        lastName = nameParts.slice(1).join(' ');
      }
    }

    data.client = {
      first_name: firstName,
      last_name: lastName,
      company_name: companyName,
      ...(data.client_user || {}),
    };
  }

  if (data.technician_name && !data.technician) {
    data.technician = {
      name: data.technician_name,
      ...(data.technician_user || {}),
    };
  }

  return data;
}

export async function getCachedWorkOrderEnriched(id) {
  const wo = await WorkOrderStore.get(id);
  if (!wo) return null;

  const [parts, appointments] = await Promise.all([
    PartStore.getByWorkOrder(id),
    AppointmentStore.getByWorkOrder(id),
  ]);

  return transformWorkOrderRecord({
    ...wo,
    parts: parts.length ? parts : wo.parts || [],
    appointments: appointments.length ? appointments : wo.appointments || [],
  });
}

/** Persist WO + related parts/appointments after a successful network load. */
export async function cacheWorkOrderBundle(workOrder) {
  if (!workOrder?.id) return;

  await WorkOrderStore.put(workOrder);

  if (Array.isArray(workOrder.parts) && workOrder.parts.length) {
    await PartStore.putAll(
      workOrder.parts.map((p) => ({ ...p, work_order_id: workOrder.id }))
    );
  }

  if (Array.isArray(workOrder.appointments) && workOrder.appointments.length) {
    await AppointmentStore.putAll(
      workOrder.appointments.map((a) => ({
        ...a,
        work_order_id: workOrder.id,
        date: (a.scheduled_start || a.start || '').substring(0, 10),
      }))
    );
  }
}

export async function fetchWorkOrderWithCache(id) {
  if (isOffline()) {
    const cached = await getCachedWorkOrderEnriched(id);
    if (!cached) {
      throw new Error(
        'This work order is not cached yet. Open it once while online, then try again.'
      );
    }
    return cached;
  }

  try {
    const data = await getWorkOrder(id);
    const transformed = transformWorkOrderRecord(data);
    if (transformed) {
      // Persist in background — don't block the UI on IndexedDB writes
      void cacheWorkOrderBundle(transformed).catch((err) => {
        console.warn('[fetchWorkOrderWithCache] Background cache failed:', err);
      });
    }
    return transformed;
  } catch (err) {
    const cached = await getCachedWorkOrderEnriched(id);
    if (cached) return cached;
    throw err;
  }
}

export async function fetchWorkOrderPartsWithCache(workOrderId) {
  if (isOffline()) {
    return PartStore.getByWorkOrder(workOrderId);
  }

  try {
    const response = await apiClient(`work-orders/${workOrderId}/parts`, {
      method: 'GET',
    });
    const parts = Array.isArray(response) ? response : response?.items || [];
    if (parts.length) {
      await PartStore.putAll(parts.map((p) => ({ ...p, work_order_id: workOrderId })));
    }
    return parts;
  } catch (err) {
    const cached = await PartStore.getByWorkOrder(workOrderId);
    if (cached.length || isQueueableNetworkError(err)) return cached;
    throw err;
  }
}

export async function fetchClientsWithCache(params = {}) {
  if (isOffline()) {
    const cached = await ClientStore.getAll();
    return {
      items: cached,
      total: cached.length,
      page: 1,
      pages: 1,
      fromCache: true,
    };
  }

  try {
    const result = await getClients(params);
    const items = result?.items || [];
    if (items.length) {
      await ClientStore.putAll(items);
    }
    return result;
  } catch (err) {
    const cached = await ClientStore.getAll();
    if (cached.length) {
      return {
        items: cached,
        total: cached.length,
        page: 1,
        pages: 1,
        fromCache: true,
      };
    }
    throw err;
  }
}

/** Pull fresh parts/appointments for a WO into IndexedDB (call while online). */
export async function warmWorkOrderCache(id) {
  if (isOffline() || !id) return;

  try {
    const cached = await getCachedWorkOrderEnriched(id);
    if (cached?.parts?.length && cached?.appointments?.length) {
      return;
    }

    const wo = cached || (await getWorkOrder(id));
    if (wo) await cacheWorkOrderBundle(wo);

    if (!cached?.parts?.length) {
      const parts = await apiClient(`work-orders/${id}/parts`);
      const partItems = Array.isArray(parts) ? parts : parts?.items || [];
      if (partItems.length) {
        await PartStore.putAll(partItems.map((p) => ({ ...p, work_order_id: id })));
      }
    }

    if (!cached?.appointments?.length) {
      const appts = await apiClient(`work-orders/${id}/appointments`);
      const apptItems = (appts?.items || appts || []).map((a) => ({
        ...a,
        work_order_id: id,
        date: (a.scheduled_start || a.start || '').substring(0, 10),
      }));
      if (apptItems.length) {
        await AppointmentStore.putAll(apptItems);
      }
    }
  } catch (err) {
    console.warn('[warmWorkOrderCache] Failed:', err);
  }
}
