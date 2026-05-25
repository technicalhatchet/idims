/**
 * Offline mutation outbox — queue writes when offline, sync when back online.
 */

import { apiClient, ErrorTypes } from '../utils/api-client';
import { PendingMutationStore, NotesStore } from './db';

export const SYNC_EVENT = 'idims-sync-change';
export const SYNC_STATE_EVENT = 'idims-sync-state';

let syncInProgress = false;

function createMutationId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return `mut-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function isOffline() {
  return typeof navigator !== 'undefined' && !navigator.onLine;
}

export function isQueueableNetworkError(err) {
  if (!err) return false;
  if (isOffline()) return true;
  const name = err.name || '';
  if (name === 'TimeoutError' || name === 'AbortError') return true;
  if (err.type === ErrorTypes.NETWORK) return true;
  const msg = String(err.message || '').toLowerCase();
  return msg.includes('failed to fetch') || msg.includes('network') || msg.includes('load failed');
}

export function notifyQueueChange() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_EVENT));
  }
}

function notifySyncState(state, detail) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(SYNC_STATE_EVENT, { detail: { state, ...detail } }));
  }
}

export async function enqueueMutation(mutation) {
  const record = {
    id: createMutationId(),
    createdAt: Date.now(),
    ...mutation,
  };
  await PendingMutationStore.add(record);
  notifyQueueChange();
  return record;
}

export async function getPendingCount() {
  return PendingMutationStore.count();
}

async function onMutationSynced(mutation, result) {
  if (mutation.type === 'CREATE_NOTE' && mutation.meta?.tempNoteId && result?.id) {
    await NotesStore.remove(mutation.meta.tempNoteId);
    await NotesStore.put(result);
  }
}

export async function syncPendingMutations() {
  if (typeof navigator === 'undefined' || !navigator.onLine) {
    return { synced: 0, failed: 0, skipped: true };
  }
  if (syncInProgress) {
    return { synced: 0, failed: 0, skipped: true, reason: 'in_progress' };
  }

  syncInProgress = true;
  notifySyncState('syncing');

  let synced = 0;
  let failed = 0;

  try {
    const pending = await PendingMutationStore.getAll();

    for (const mutation of pending) {
      try {
        const result = await apiClient(mutation.endpoint, {
          method: mutation.method || 'PUT',
          body: JSON.stringify(mutation.body),
        });
        await onMutationSynced(mutation, result);
        await PendingMutationStore.remove(mutation.id);
        synced += 1;
        notifyQueueChange();
      } catch (err) {
        console.error('[OfflineSync] Failed to sync mutation:', mutation, err);
        failed += 1;
        notifySyncState('error', { message: err.message });
        break;
      }
    }
  } finally {
    syncInProgress = false;
    notifySyncState('idle', { synced, failed });
  }

  return { synced, failed };
}

/**
 * Try network first; queue + optimistic update when offline or unreachable.
 */
export async function executeOfflineCapableMutation({
  type,
  endpoint,
  method = 'PUT',
  body,
  meta,
  onOptimistic,
  queueOnNetworkError = true,
}) {
  const runOptimistic = async () => {
    if (onOptimistic) await onOptimistic();
  };

  if (isOffline()) {
    await runOptimistic();
    const record = await enqueueMutation({ type, endpoint, method, body, meta });
    return { queued: true, mutationId: record.id };
  }

  try {
    const result = await apiClient(endpoint, {
      method,
      body: JSON.stringify(body),
    });
    return result;
  } catch (err) {
    if (queueOnNetworkError && isQueueableNetworkError(err)) {
      await runOptimistic();
      const record = await enqueueMutation({ type, endpoint, method, body, meta });
      return { queued: true, mutationId: record.id, queuedAfterError: true };
    }
    throw err;
  }
}
