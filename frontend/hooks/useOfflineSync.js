/**
 * Tracks pending offline mutations and flushes queue when online.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useOnlineStatus } from './useOnlineStatus';
import {
  getPendingCount,
  syncPendingMutations,
  SYNC_EVENT,
  SYNC_STATE_EVENT,
} from '../lib/offlineMutations';

export function useOfflineSync() {
  const { isOnline } = useOnlineStatus();
  const [pendingCount, setPendingCount] = useState(0);
  const [syncState, setSyncState] = useState('idle');
  const [lastSyncError, setLastSyncError] = useState(null);

  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch (err) {
      console.warn('[OfflineSync] Could not read pending count', err);
    }
  }, []);

  const runSync = useCallback(async () => {
    if (!navigator.onLine) return;
    const result = await syncPendingMutations();
    await refreshCount();
    return result;
  }, [refreshCount]);

  useEffect(() => {
    refreshCount();
  }, [refreshCount]);

  useEffect(() => {
    const onQueueChange = () => refreshCount();
    const onSyncState = (e) => {
      setSyncState(e.detail?.state || 'idle');
      if (e.detail?.state === 'error') {
        setLastSyncError(e.detail.message || 'Sync failed');
      }
      if (e.detail?.state === 'idle' && (e.detail?.synced || 0) > 0) {
        setLastSyncError(null);
      }
    };

    window.addEventListener(SYNC_EVENT, onQueueChange);
    window.addEventListener(SYNC_STATE_EVENT, onSyncState);
    return () => {
      window.removeEventListener(SYNC_EVENT, onQueueChange);
      window.removeEventListener(SYNC_STATE_EVENT, onSyncState);
    };
  }, [refreshCount]);

  const syncDebounceRef = useRef(null);

  useEffect(() => {
    const trySyncNow = () => {
      if (typeof navigator !== 'undefined' && !navigator.onLine) return;
      runSync();
    };
    const trySyncDebounced = () => {
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
      }
      syncDebounceRef.current = setTimeout(() => {
        syncDebounceRef.current = null;
        trySyncNow();
      }, 2000);
    };
    window.addEventListener('online', trySyncNow);
    window.addEventListener(SYNC_EVENT, trySyncDebounced);
    trySyncNow();
    return () => {
      window.removeEventListener('online', trySyncNow);
      window.removeEventListener(SYNC_EVENT, trySyncDebounced);
      if (syncDebounceRef.current) {
        clearTimeout(syncDebounceRef.current);
        syncDebounceRef.current = null;
      }
    };
  }, [runSync]);

  return {
    pendingCount,
    syncState,
    lastSyncError,
    isOnline,
    runSync,
    refreshCount,
  };
}
