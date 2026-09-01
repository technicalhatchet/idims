import { useCallback, useEffect, useMemo, useState } from 'react';
import { SYNC_EVENT } from '../lib/offlineMutations';
import { listStandaloneDiagnosticsOffline } from '../lib/solomonOfflineWrites';
import { listDmaRepairRecords } from '../services/api/dmaApi';
import {
  SOLOMON_DIAGNOSTIC_STATUS,
  resolveSolomonDiagnosticStatus,
} from '../components/solomon/solomonDiagnosticStatus';
import { computeSolomonDiagnosticLead } from '../components/solomon/useSolomonDiagnosticLead';

function startOfWeek(date = new Date()) {
  const start = new Date(date);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - start.getDay());
  return start;
}

function isThisWeek(isoDate) {
  if (!isoDate) return false;
  const value = new Date(isoDate);
  if (Number.isNaN(value.getTime())) return false;
  return value >= startOfWeek();
}

function sessionTimestamp(item) {
  return item?.created_at || item?.updated_at;
}

function computeAvgLeadConfidence(items = []) {
  const percents = items
    .slice(0, 10)
    .map((item) => computeSolomonDiagnosticLead(item)?.percent)
    .filter((value) => typeof value === 'number' && !Number.isNaN(value));

  if (percents.length < 2) return null;
  return Math.round(percents.reduce((sum, value) => sum + value, 0) / percents.length);
}

export function useSolomonHomeDashboard({ enabled = true } = {}) {
  const [diagnostics, setDiagnostics] = useState([]);
  const [outcomesCount, setOutcomesCount] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const reload = useCallback(() => {
    setReloadKey((key) => key + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setDiagnostics([]);
      setOutcomesCount(null);
      setIsLoading(false);
      return undefined;
    }

    let cancelled = false;
    setIsLoading(true);

    Promise.all([
      listStandaloneDiagnosticsOffline({ limit: 50 }),
      listDmaRepairRecords({ limit: 50 }).catch(() => null),
    ])
      .then(([diagRes, outcomesRes]) => {
        if (cancelled) return;
        setDiagnostics(Array.isArray(diagRes?.items) ? diagRes.items : []);
        if (outcomesRes && Array.isArray(outcomesRes.items)) {
          setOutcomesCount(outcomesRes.items.length);
        } else {
          setOutcomesCount(null);
        }
        setError(null);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err.message || 'Could not load dashboard');
          setDiagnostics([]);
          setOutcomesCount(null);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, reloadKey]);

  useEffect(() => {
    if (!enabled) return undefined;
    const onSync = () => reload();
    window.addEventListener(SYNC_EVENT, onSync);
    return () => window.removeEventListener(SYNC_EVENT, onSync);
  }, [enabled, reload]);

  const metrics = useMemo(() => {
    const openSessions = diagnostics.filter(
      (item) => resolveSolomonDiagnosticStatus(item).lifecycleKey
        === SOLOMON_DIAGNOSTIC_STATUS.diagnostic_in_progress,
    ).length;

    const sessionsThisWeek = diagnostics.filter(
      (item) => isThisWeek(sessionTimestamp(item)),
    ).length;

    return {
      sessionsThisWeek,
      openSessions,
      outcomesRecorded: outcomesCount,
      avgLeadConfidence: computeAvgLeadConfidence(diagnostics),
    };
  }, [diagnostics, outcomesCount]);

  return {
    diagnostics,
    metrics,
    isLoading,
    error,
    reload,
  };
}

export default useSolomonHomeDashboard;
