import { useCallback, useEffect, useState } from 'react';
import { apiClient } from '../utils/api-client';
import { useFeature } from '../context/FeatureFlagsContext';
import { useUser } from '@auth0/nextjs-auth0/client';
import { getUserRole } from '../utils/auth0-helpers';

export const RECALL_PENDING_COUNT_EVENT = 'recall-pending-count-changed';

const POLL_MS = 5 * 60 * 1000;

export function notifyRecallPendingCountChanged() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(RECALL_PENDING_COUNT_EVENT));
  }
}

export function usePendingRecallCount() {
  const recallOn = useFeature('recall_alerts');
  const { user, isLoading } = useUser();
  const role = user && !isLoading ? getUserRole(user) : null;
  const isOffice = role === 'admin' || role === 'manager';
  const [pending, setPending] = useState(0);

  const refresh = useCallback(async () => {
    if (!recallOn || !isOffice) {
      setPending(0);
      return;
    }
    try {
      const data = await apiClient('/api/recalls/matches/pending-count');
      setPending(typeof data?.pending === 'number' ? data.pending : 0);
    } catch {
      setPending(0);
    }
  }, [recallOn, isOffice]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    if (!recallOn || !isOffice) return undefined;
    const onVis = () => {
      if (document.visibilityState === 'visible') refresh();
    };
    const onFocus = () => refresh();
    const onCustom = () => refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    window.addEventListener(RECALL_PENDING_COUNT_EVENT, onCustom);
    const id = window.setInterval(refresh, POLL_MS);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
      window.removeEventListener(RECALL_PENDING_COUNT_EVENT, onCustom);
      window.clearInterval(id);
    };
  }, [recallOn, isOffice, refresh]);

  return { pending, refresh, enabled: recallOn && isOffice };
}
