/**
 * Phase 1 offline writes — status updates, part status, notes.
 */

import {
  WorkOrderStore,
  AppointmentStore,
  ScheduleStore,
  PartStore,
  NotesStore,
} from './db';
import { executeOfflineCapableMutation } from './offlineMutations';
import { apiClient } from '../utils/api-client';

function patchAppointmentStatusInList(items, appointmentId, newStatus) {
  return items.map((a) =>
    a.id === appointmentId ? { ...a, status: newStatus } : a
  );
}

async function patchAppointmentStatusEverywhere(appointmentId, newStatus) {
  const appts = await AppointmentStore.getAll();
  await AppointmentStore.putAll(patchAppointmentStatusInList(appts, appointmentId, newStatus));

  const sched = await ScheduleStore.getAll();
  await ScheduleStore.putAll(patchAppointmentStatusInList(sched, appointmentId, newStatus));

  const wos = await WorkOrderStore.getAll();
  for (const wo of wos) {
    if (wo.appointments?.some((a) => a.id === appointmentId)) {
      await WorkOrderStore.put({
        ...wo,
        status: newStatus === 'in_progress' ? 'in_progress' : wo.status,
        appointments: patchAppointmentStatusInList(wo.appointments, appointmentId, newStatus),
      });
    }
  }
}

export async function updateAppointmentStatus({ appointmentId, status }) {
  const endpoint = `work-orders/appointments/${appointmentId}`;
  return executeOfflineCapableMutation({
    type: 'APPOINTMENT_STATUS',
    endpoint,
    method: 'PUT',
    body: { status },
    onOptimistic: () => patchAppointmentStatusEverywhere(appointmentId, status),
  });
}

export async function updateWorkOrderStatusOffline({ id, status, notes = '' }) {
  return executeOfflineCapableMutation({
    type: 'WORK_ORDER_STATUS',
    endpoint: `work-orders/${id}/status`,
    method: 'PUT',
    body: { status, notes },
    onOptimistic: async () => {
      const wo = await WorkOrderStore.get(id);
      if (wo) {
        await WorkOrderStore.put({ ...wo, status });
      }
    },
  });
}

export async function updatePartStatusOffline({ partId, status, amountUpfrontCollected, partSnapshot }) {
  return executeOfflineCapableMutation({
    type: 'PART_STATUS',
    endpoint: `work-orders/parts/${partId}`,
    method: 'PUT',
    body: {
      status,
      amount_upfront_collected: amountUpfrontCollected,
    },
    onOptimistic: async () => {
      const updated = {
        ...partSnapshot,
        id: partId,
        status,
        amount_upfront_collected: amountUpfrontCollected,
      };
      await PartStore.put(updated);

      const wos = await WorkOrderStore.getAll();
      for (const wo of wos) {
        if (wo.parts?.some((p) => p.id === partId)) {
          await WorkOrderStore.put({
            ...wo,
            parts: wo.parts.map((p) => (p.id === partId ? { ...p, ...updated } : p)),
          });
        }
      }
    },
  });
}

function createTempNoteId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `pending-${crypto.randomUUID()}`;
  }
  return `pending-${Date.now()}`;
}

export async function createWorkOrderNoteOffline({ workOrderId, note, isPrivate = false }) {
  const tempNoteId = createTempNoteId();
  const payload = {
    work_order_id: workOrderId,
    note,
    is_private: isPrivate,
  };

  return executeOfflineCapableMutation({
    type: 'CREATE_NOTE',
    endpoint: `work-orders/${workOrderId}/notes`,
    method: 'POST',
    body: payload,
    meta: { tempNoteId },
    onOptimistic: async () => {
      await NotesStore.put({
        id: tempNoteId,
        work_order_id: workOrderId,
        note,
        is_private: isPrivate,
        created_at: new Date().toISOString(),
        pendingSync: true,
      });
    },
  });
}

export async function fetchWorkOrderNotes(workOrderId) {
  try {
    const response = await apiClient(`work-orders/${workOrderId}/notes`);
    const notes = Array.isArray(response) ? response : [];
    if (notes.length) {
      await NotesStore.putAll(notes);
    }
    return notes;
  } catch (err) {
    const cached = await NotesStore.getByWorkOrder(workOrderId);
    return cached.sort(
      (a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0)
    );
  }
}
