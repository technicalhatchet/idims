import { useCallback, useEffect, useRef, useState } from 'react';
import { markSolomonSession } from './useSolomonAuth';
import {
  createStandaloneDiagnosticOffline,
  updateStandaloneDiagnosticOffline,
} from '../lib/solomonOfflineWrites';
import { buildStandaloneDiagnosticBody } from '../utils/standaloneDiagnostic';
import {
  hasSolomonDiagnosticProgress,
  standaloneUpdateBodyFromCreateBody,
} from '../utils/solomonDiagnosticProgress';

/**
 * Create in_progress standalone diagnostic on first progress, then update on each save.
 */
export function useSolomonDiagnosticProgress({
  equipment,
  outcomeId = null,
  initialDiagnosticId = null,
  status = 'in_progress',
} = {}) {
  const diagnosticIdRef = useRef(initialDiagnosticId || null);
  const [diagnosticId, setDiagnosticId] = useState(initialDiagnosticId || null);
  const inFlightRef = useRef(false);
  const queuedPayloadRef = useRef(null);
  const debounceTimerRef = useRef(null);
  const [syncHint, setSyncHint] = useState(null);

  useEffect(() => {
    if (initialDiagnosticId) {
      diagnosticIdRef.current = initialDiagnosticId;
      setDiagnosticId(initialDiagnosticId);
    }
  }, [initialDiagnosticId]);

  const buildBody = useCallback(
    (payload) =>
      buildStandaloneDiagnosticBody(payload, {
        ...equipment,
        outcome_id: outcomeId,
        status,
      }),
    [equipment, outcomeId, status],
  );

  const runPersist = useCallback(
    async (payload) => {
      if (!hasSolomonDiagnosticProgress(payload)) return null;

      const body = buildBody(payload);
      const id = diagnosticIdRef.current;

      if (!id) {
        const created = await createStandaloneDiagnosticOffline({ body });
        if (!created?.id) return created;
        diagnosticIdRef.current = created.id;
        setDiagnosticId(created.id);
        markSolomonSession();
        setSyncHint(created.queued ? 'queued' : 'saved');
        return created;
      }

      const updated = await updateStandaloneDiagnosticOffline({
        diagnosticId: id,
        body: standaloneUpdateBodyFromCreateBody(body, status),
      });
      setSyncHint(updated?.queued ? 'queued' : 'saved');
      return updated;
    },
    [buildBody, status],
  );

  const flushProgress = useCallback(
    async (payload) => {
      if (inFlightRef.current) {
        queuedPayloadRef.current = payload;
        return null;
      }
      inFlightRef.current = true;
      let result = null;
      try {
        result = await runPersist(payload);
        while (queuedPayloadRef.current) {
          const next = queuedPayloadRef.current;
          queuedPayloadRef.current = null;
          result = await runPersist(next);
        }
      } catch (err) {
        console.warn('[Solomon] Progress save failed', err);
        setSyncHint('error');
      } finally {
        inFlightRef.current = false;
      }
      return result;
    },
    [runPersist],
  );

  const persistProgress = useCallback(
    (payload, { immediate = false, debounceMs = 1400 } = {}) => {
      if (!payload?.templateId) return;
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      const delay = immediate ? 0 : debounceMs;
      debounceTimerRef.current = setTimeout(() => {
        debounceTimerRef.current = null;
        void flushProgress(payload);
      }, delay);
    },
    [flushProgress],
  );

  const persistFinal = useCallback(
    async (payload) => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
        debounceTimerRef.current = null;
      }
      return flushProgress(payload);
    },
    [flushProgress],
  );

  return {
    diagnosticId,
    persistProgress,
    persistFinal,
    syncHint,
  };
}
