/**
 * Solomon standalone diagnostics — offline create/update + cached reads.
 */

import { PendingMutationStore, StandaloneDiagnosticStore } from './db';
import {
  executeOfflineCapableMutation,
  enqueueMutation,
  isOffline,
  notifyQueueChange,
} from './offlineMutations';
import { apiClient, getAuthHeaders } from '../utils/api-client';
import {
  isPendingDiagnosticId,
  standaloneRowFromApiBody,
} from '../utils/standaloneDiagnostic';

function createTempDiagnosticId() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `pending-${crypto.randomUUID()}`;
  }
  return `pending-${Date.now()}`;
}

function sortByUpdated(items) {
  return [...items].sort(
    (a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0)
  );
}

function filterLocalDiagnostics(items, params = {}) {
  let filtered = items;
  if (params.linked === true) {
    filtered = filtered.filter((row) => row.outcome_id);
  } else if (params.linked === false) {
    filtered = filtered.filter((row) => !row.outcome_id);
  }
  if (params.outcome_id) {
    filtered = filtered.filter((row) => row.outcome_id === params.outcome_id);
  }
  const limit = params.limit ?? 50;
  return sortByUpdated(filtered).slice(0, limit);
}

function dmaDiagnosticsQuery(params = {}) {
  const query = new URLSearchParams();
  if (params.limit != null) query.set('limit', String(params.limit));
  if (params.linked === true) query.set('linked', 'true');
  if (params.linked === false) query.set('linked', 'false');
  if (params.outcome_id) query.set('outcome_id', params.outcome_id);
  return query.toString();
}

/** Airplane mode often leaves navigator.onLine true but token/API unreachable. */
async function shouldQueueStandaloneWrite() {
  if (isOffline()) return true;
  const headers = await getAuthHeaders();
  return !headers.Authorization;
}

function cloneForStorage(value) {
  return JSON.parse(JSON.stringify(value));
}

async function putStandaloneRow(id, body, extra = {}) {
  const row = standaloneRowFromApiBody(id, body, extra);
  await StandaloneDiagnosticStore.put(cloneForStorage(row));
  return row;
}

async function mergePendingCreateBody(tempDiagnosticId, body) {
  const pending = await PendingMutationStore.getAll();
  const createMut = pending.find(
    (m) =>
      m.type === 'CREATE_STANDALONE_DIAGNOSTIC'
      && m.meta?.tempDiagnosticId === tempDiagnosticId
  );
  if (!createMut) return false;
  await PendingMutationStore.add({ ...createMut, body });
  notifyQueueChange();
  return true;
}

async function queueStandaloneCreate(tempDiagnosticId, body) {
  await putStandaloneRow(tempDiagnosticId, body, { pendingSync: true });
  await enqueueMutation({
    type: 'CREATE_STANDALONE_DIAGNOSTIC',
    endpoint: 'dma/diagnostics',
    method: 'POST',
    body,
    meta: { tempDiagnosticId },
  });
  notifyQueueChange();
  return standaloneRowFromApiBody(tempDiagnosticId, body, {
    pendingSync: true,
    queued: true,
  });
}

async function queueStandaloneUpdate(diagnosticId, body, existing) {
  await putStandaloneRow(diagnosticId, body, {
    ...existing,
    pendingSync: true,
    created_at: existing?.created_at,
    updated_at: new Date().toISOString(),
  });
  await enqueueMutation({
    type: 'UPDATE_STANDALONE_DIAGNOSTIC',
    endpoint: `dma/diagnostics/${diagnosticId}`,
    method: 'PUT',
    body,
    meta: { diagnosticId },
  });
  notifyQueueChange();
  const row = await StandaloneDiagnosticStore.get(diagnosticId);
  return { ...row, queued: true };
}

export async function createStandaloneDiagnosticOffline({ body }) {
  const tempDiagnosticId = createTempDiagnosticId();

  try {
    if (await shouldQueueStandaloneWrite()) {
      return await queueStandaloneCreate(tempDiagnosticId, body);
    }

    const result = await executeOfflineCapableMutation({
      type: 'CREATE_STANDALONE_DIAGNOSTIC',
      endpoint: 'dma/diagnostics',
      method: 'POST',
      body,
      meta: { tempDiagnosticId },
      onOptimistic: async () => {
        await putStandaloneRow(tempDiagnosticId, body, { pendingSync: true });
      },
    });

    if (result?.queued) {
      return standaloneRowFromApiBody(tempDiagnosticId, body, {
        pendingSync: true,
        queued: true,
      });
    }

    if (!result?.id) {
      return await queueStandaloneCreate(tempDiagnosticId, body);
    }

    await StandaloneDiagnosticStore.put(cloneForStorage({ ...result, pendingSync: false }));
    return result;
  } catch (err) {
    console.warn('[Solomon] Online save failed — queueing locally', err);
    return await queueStandaloneCreate(tempDiagnosticId, body);
  }
}

export async function updateStandaloneDiagnosticOffline({ diagnosticId, body }) {
  const existing = await StandaloneDiagnosticStore.get(diagnosticId);

  const onOptimistic = async () => {
    await putStandaloneRow(diagnosticId, body, {
      ...existing,
      pendingSync: true,
      created_at: existing?.created_at,
      updated_at: new Date().toISOString(),
    });
  };

  try {
    if (isPendingDiagnosticId(diagnosticId)) {
      const merged = await mergePendingCreateBody(diagnosticId, body);
      if (merged) {
        await onOptimistic();
        const row = await StandaloneDiagnosticStore.get(diagnosticId);
        return { ...row, queued: true };
      }
    }

    if (await shouldQueueStandaloneWrite()) {
      if (isPendingDiagnosticId(diagnosticId)) {
        const merged = await mergePendingCreateBody(diagnosticId, body);
        if (merged) {
          await onOptimistic();
          const row = await StandaloneDiagnosticStore.get(diagnosticId);
          return { ...row, queued: true };
        }
      }
      return await queueStandaloneUpdate(diagnosticId, body, existing);
    }

    const result = await executeOfflineCapableMutation({
      type: 'UPDATE_STANDALONE_DIAGNOSTIC',
      endpoint: `dma/diagnostics/${diagnosticId}`,
      method: 'PUT',
      body,
      meta: { diagnosticId },
      onOptimistic,
    });

    if (result?.queued) {
      const row = await StandaloneDiagnosticStore.get(diagnosticId);
      return { ...row, queued: true };
    }

    if (!result?.id) {
      return await queueStandaloneUpdate(diagnosticId, body, existing);
    }

    await StandaloneDiagnosticStore.put(cloneForStorage({ ...result, pendingSync: false }));
    return result;
  } catch (err) {
    console.warn('[Solomon] Online update failed — queueing locally', err);
    if (isPendingDiagnosticId(diagnosticId)) {
      const merged = await mergePendingCreateBody(diagnosticId, body);
      if (merged) {
        await onOptimistic();
        const row = await StandaloneDiagnosticStore.get(diagnosticId);
        return { ...row, queued: true };
      }
    }
    return await queueStandaloneUpdate(diagnosticId, body, existing);
  }
}

export async function fetchStandaloneDiagnostic(diagnosticId) {
  const local = await StandaloneDiagnosticStore.get(diagnosticId);
  if (local?.pendingSync) {
    return local;
  }

  try {
    const data = await apiClient(`dma/diagnostics/${diagnosticId}`);
    if (!data?.id) {
      if (local) return local;
      throw new Error('Diagnostic not found');
    }
    await StandaloneDiagnosticStore.put({ ...data, pendingSync: false });
    return data;
  } catch (err) {
    if (local) return local;
    throw err;
  }
}

export async function listStandaloneDiagnosticsOffline(params = {}) {
  async function fromLocalCache() {
    const cached = await StandaloneDiagnosticStore.getAll();
    const items = filterLocalDiagnostics(cached, params);
    return { items, total: items.length, fromCache: true };
  }

  if (isOffline()) {
    try {
      return await fromLocalCache();
    } catch (err) {
      return { items: [], total: 0, fromCache: true, error: err.message };
    }
  }

  const qs = dmaDiagnosticsQuery(params);

  try {
    const res = await apiClient(`dma/diagnostics${qs ? `?${qs}` : ''}`);
    const serverItems = Array.isArray(res?.items) ? res.items : [];
    if (serverItems.length) {
      await StandaloneDiagnosticStore.putAll(
        serverItems.map((item) => ({ ...item, pendingSync: false }))
      );
    }

    const pendingLocals = await StandaloneDiagnosticStore.getPending();
    const serverIds = new Set(serverItems.map((item) => item.id));
    const unsynced = filterLocalDiagnostics(
      pendingLocals.filter((item) => !serverIds.has(item.id)),
      params
    );

    const merged = sortByUpdated([...unsynced, ...serverItems]);
    const limit = params.limit ?? 50;

    return {
      ...res,
      items: merged.slice(0, limit),
      total: (res?.total ?? serverItems.length) + unsynced.length,
    };
  } catch (err) {
    try {
      return await fromLocalCache();
    } catch (cacheErr) {
      return { items: [], total: 0, fromCache: true, error: cacheErr.message || err.message };
    }
  }
}
