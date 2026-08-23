/**
 * Tracks pending offline mutations and flushes queue when online.
 */

import { useState, useEffect, useCallback } from 'react';
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

  useEffect(() => {
    const trySync = () => {
      if (navigator.onLine) runSync();
    };
    window.addEventListener('online', trySync);
    window.addEventListener(SYNC_EVENT, trySync);
    trySync();
    return () => {
      window.removeEventListener('online', trySync);
      window.removeEventListener(SYNC_EVENT, trySync);
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
