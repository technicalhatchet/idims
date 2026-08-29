import { useCallback, useEffect, useState } from 'react';
import { SYNC_EVENT } from '../lib/offlineMutations';
import { listStandaloneDiagnosticsOffline } from '../lib/solomonOfflineWrites';

function pickContinueTarget(items = []) {
  return items.find((row) => row.status !== 'abandoned') || null;
}

export function useSolomonContinue() {
  const [continueTarget, setContinueTarget] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);

  const reload = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await listStandaloneDiagnosticsOffline({
        limit: 20,
      });
      const target = pickContinueTarget(res?.items || []);
      setContinueTarget(target);
      setError(null);
    } catch (err) {
      setError(err.message || 'Could not load diagnostics');
      setContinueTarget(null);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    reload();
    const onSync = () => reload();
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [reload]);

  return { continueTarget, isLoading, error, reload };
}
