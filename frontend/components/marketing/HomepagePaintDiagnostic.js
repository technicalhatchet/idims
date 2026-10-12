import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import {
  HOMEPAGE_PAINT_DIAG_HERO_ID,
  HOMEPAGE_PAINT_DIAG_MAIN_ID,
  HOMEPAGE_PAINT_DIAG_STORAGE_KEY,
  buildHomepagePaintReport,
  diagLog,
  elapsedMs,
  isHomepagePaintDiagEnabled,
  navigationTimingSnapshot,
  paintTimingSnapshot,
  recordDiagError,
  recordObserverStatus,
  recordReactLifecycle,
  runHomepageProbePair,
} from '../../lib/homepagePaintDiag';

/** Bounded post-mount probe delays (ms). No indefinite timers. */
const PROBE_CHECKPOINT_MS = [0, 50, 100, 250, 500, 1000, 2000, 5000, 10000];

function formatPanelPreview(reportText) {
  try {
    const parsed = JSON.parse(reportText);
    const lines = (parsed.timeline || []).map((e) => {
      const ms = e.elapsedMs != null ? Math.round(e.elapsedMs) : '?';
      return ms + 'ms ' + e.label;
    });
    const tail = lines.slice(-12);
    return {
      previewLines: tail,
      summary: {
        events: parsed.timelineEventCount,
        react: parsed.reactLifecycleMs,
        observers: parsed.observers,
      },
    };
  } catch {
    return { previewLines: ['Report ready — use Copy or select text below.'], summary: null };
  }
}

/**
 * Opt-in homepage paint diagnostic — no visual/loading/SW changes when flag is off.
 */
export default function HomepagePaintDiagnostic() {
  const heroVisibleLoggedRef = useRef(false);
  const [reportText, setReportText] = useState('');
  const [panelLines, setPanelLines] = useState([]);
  const [copyStatus, setCopyStatus] = useState('');
  const [showFullReport, setShowFullReport] = useState(false);

  const refreshReport = () => {
    const text = buildHomepagePaintReport();
    setReportText(text);
    const { previewLines } = formatPanelPreview(text);
    setPanelLines(previewLines);
  };

  useLayoutEffect(() => {
    if (!isHomepagePaintDiagEnabled()) return;
    const ms = elapsedMs();
    recordReactLifecycle('useLayoutEffectMs', ms);
    diagLog('react:useLayoutEffect', { elapsedMs: ms });
  }, []);

  useEffect(() => {
    if (!isHomepagePaintDiagEnabled()) return;

    const effectMs = elapsedMs();
    recordReactLifecycle('useEffectMs', effectMs);
    diagLog('react:useEffect_mount', { elapsedMs: effectMs });
    diagLog('react:navigation_snapshot', navigationTimingSnapshot());
    diagLog('react:paint_snapshot_initial', paintTimingSnapshot());

    let paintObserver;
    let lcpObserver;

    try {
      if (typeof PerformanceObserver === 'undefined') {
        recordObserverStatus('paint', 'react:PerformanceObserver_missing');
        recordObserverStatus('lcp', 'react:PerformanceObserver_missing');
        diagLog('observer:paint_unsupported', { reason: 'PerformanceObserver_missing' });
      } else {
        try {
          paintObserver = new PerformanceObserver((list) => {
            for (const entry of list.getEntries()) {
              diagLog('observer:paint', {
                name: entry.name,
                startTime: entry.startTime,
              });
            }
          });
          paintObserver.observe({ type: 'paint', buffered: true });
          recordObserverStatus('paint', 'react:supported');
        } catch (err) {
          recordObserverStatus('paint', 'react:error');
          recordDiagError('react_paint_observer', err);
          diagLog('observer:paint_error', { error: String(err) });
        }

        try {
          lcpObserver = new PerformanceObserver((list) => {
            const entries = list.getEntries();
            const last = entries[entries.length - 1];
            if (last) {
              diagLog('observer:largest-contentful-paint', {
                startTime: last.startTime,
                size: last.size,
                id: last.id || null,
                element: last.element ? last.element.tagName : null,
              });
            }
          });
          lcpObserver.observe({ type: 'largest-contentful-paint', buffered: true });
          recordObserverStatus('lcp', 'react:supported');
        } catch (err) {
          recordObserverStatus('lcp', 'react:error');
          recordDiagError('react_lcp_observer', err);
          diagLog('observer:lcp_error', { error: String(err) });
        }
      }
    } catch (err) {
      recordDiagError('react_observer_setup', err);
    }

    let lastHeroLikelyVisible = null;
    let lastDocumentHidden = null;

    function sampleTargets(label, { force } = { force: false }) {
      const probes = runHomepageProbePair(
        HOMEPAGE_PAINT_DIAG_HERO_ID,
        HOMEPAGE_PAINT_DIAG_MAIN_ID,
      );
      const heroLikely = probes.hero?.likelyVisible ?? null;
      const documentHidden = document.hidden;
      const changed =
        force ||
        heroLikely !== lastHeroLikelyVisible ||
        documentHidden !== lastDocumentHidden;

      lastHeroLikelyVisible = heroLikely;
      lastDocumentHidden = documentHidden;

      if (changed) {
        diagLog(label, probes);
      }

      if (!heroVisibleLoggedRef.current && probes.hero?.likelyVisible) {
        heroVisibleLoggedRef.current = true;
        diagLog('probe:hero_likely_visible_first', probes);
      }
    }

    sampleTargets('probe:checkpoint_mount', { force: true });

    const checkpointTimers = PROBE_CHECKPOINT_MS.map((delay) =>
      window.setTimeout(() => {
        sampleTargets('probe:checkpoint_' + delay + 'ms', { force: true });
        refreshReport();
      }, delay),
    );

    const finalizeTimer = window.setTimeout(() => {
      diagLog('probe:sampling_complete', {
        checkpoints: PROBE_CHECKPOINT_MS,
        paint: paintTimingSnapshot(),
        navigation: navigationTimingSnapshot(),
      });
      refreshReport();
    }, 10500);

    refreshReport();

    const onPageHide = () => {
      refreshReport();
      try {
        sessionStorage.setItem(HOMEPAGE_PAINT_DIAG_STORAGE_KEY, buildHomepagePaintReport());
      } catch (err) {
        recordDiagError('sessionStorage_backup', err);
      }
    };
    window.addEventListener('pagehide', onPageHide);

    return () => {
      checkpointTimers.forEach((id) => window.clearTimeout(id));
      window.clearTimeout(finalizeTimer);
      window.removeEventListener('pagehide', onPageHide);
      try {
        paintObserver?.disconnect();
      } catch {
        /* ignore */
      }
      try {
        lcpObserver?.disconnect();
      } catch {
        /* ignore */
      }
    };
  }, []);

  if (!isHomepagePaintDiagEnabled()) {
    return null;
  }

  const handleCopy = async () => {
    const text = buildHomepagePaintReport();
    setReportText(text);
    try {
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopyStatus('Copied');
        return;
      }
      throw new Error('clipboard API unavailable');
    } catch {
      setShowFullReport(true);
      setCopyStatus('Select all text below, then Copy');
    }
  };

  return (
    <div
      data-homepage-paint-diag-panel="1"
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 99999,
        maxHeight: showFullReport ? '70vh' : '42vh',
        overflow: 'auto',
        background: 'rgba(0,0,0,0.92)',
        color: '#7dd3fc',
        fontFamily: 'ui-monospace, monospace',
        fontSize: '10px',
        lineHeight: 1.35,
        padding: '8px 10px',
        borderTop: '1px solid rgba(34,211,238,0.35)',
        pointerEvents: 'auto',
      }}
    >
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ color: '#fbbf24' }}>Homepage paint diag</strong>
        <button
          type="button"
          onClick={handleCopy}
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid #22d3ee',
            background: '#0f172a',
            color: '#e2e8f0',
          }}
        >
          Copy report
        </button>
        <button
          type="button"
          onClick={() => {
            setShowFullReport((v) => !v);
            refreshReport();
          }}
          style={{
            fontSize: 10,
            padding: '4px 8px',
            borderRadius: 4,
            border: '1px solid #64748b',
            background: '#0f172a',
            color: '#e2e8f0',
          }}
        >
          {showFullReport ? 'Hide full report' : 'Show full report'}
        </button>
        <span style={{ color: '#cbd5e1' }}>{copyStatus}</span>
      </div>
      <div style={{ color: '#94a3b8', marginBottom: 6 }}>
        DOM likelyVisible ≠ pixels painted. Use timeline + navigation/paint timings.
      </div>
      <div>
        {panelLines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
      {showFullReport ? (
        <textarea
          readOnly
          value={reportText}
          aria-label="Homepage paint diagnostic full report"
          onFocus={(e) => e.target.select()}
          style={{
            width: '100%',
            minHeight: '28vh',
            marginTop: 8,
            fontSize: 9,
            fontFamily: 'ui-monospace, monospace',
            color: '#e2e8f0',
            background: '#020617',
            border: '1px solid #334155',
            borderRadius: 4,
            padding: 6,
          }}
        />
      ) : null}
    </div>
  );
}
