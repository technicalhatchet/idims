/**
 * Homepage first-paint diagnostic (opt-in via NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG=1).
 * No network; console + window.__HOMEPAGE_PAINT_DIAG__ + on-page report when enabled.
 */

export const HOMEPAGE_PAINT_DIAG_ENV = 'NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG';

export function isHomepagePaintDiagEnabled() {
  return process.env.NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG === '1';
}

/** Optional backup only — primary retrieval is Copy report / textarea on the panel. */
export const HOMEPAGE_PAINT_DIAG_STORAGE_KEY = 'homepage_paint_diag_report_v1';

export const HOMEPAGE_PAINT_DIAG_GLOBAL = '__HOMEPAGE_PAINT_DIAG__';
export const HOMEPAGE_PAINT_DIAG_META_GLOBAL = '__HOMEPAGE_PAINT_DIAG_META__';

export const HOMEPAGE_PAINT_DIAG_HERO_ID = 'homepage-paint-diag-hero-h1';
export const HOMEPAGE_PAINT_DIAG_MAIN_ID = 'homepage-paint-diag-main';

export const REPORT_LIMITATION =
  'DOM/CSS probes (likelyVisible, opacity, display) do not prove pixels were composited to the screen. A black viewport with likelyVisible:true suggests a paint/compositor gap, not missing markup.';

/** Milliseconds since navigation start (same origin as Performance Timeline / performance.now()). */
export function elapsedMs() {
  if (typeof performance === 'undefined') return null;
  return performance.now();
}

export function viewportSnapshot() {
  if (typeof window === 'undefined') {
    return { innerWidth: null, innerHeight: null, devicePixelRatio: null };
  }
  return {
    innerWidth: window.innerWidth,
    innerHeight: window.innerHeight,
    devicePixelRatio: window.devicePixelRatio,
  };
}

function ensureMeta() {
  if (typeof window === 'undefined') return {};
  if (!window[HOMEPAGE_PAINT_DIAG_META_GLOBAL]) {
    window[HOMEPAGE_PAINT_DIAG_META_GLOBAL] = {
      observers: { paint: null, lcp: null },
      react: { useLayoutEffectMs: null, useEffectMs: null },
      errors: [],
      limitation: REPORT_LIMITATION,
    };
  }
  return window[HOMEPAGE_PAINT_DIAG_META_GLOBAL];
}

/** @param {string} label */
export function diagLog(label, extra = {}) {
  if (typeof window === 'undefined') return null;

  const bucket = window[HOMEPAGE_PAINT_DIAG_GLOBAL] || [];
  window[HOMEPAGE_PAINT_DIAG_GLOBAL] = bucket;

  const entry = {
    label,
    elapsedMs: elapsedMs(),
    wallMs: Date.now(),
    timeOrigin: typeof performance !== 'undefined' ? performance.timeOrigin : null,
    visibilityState: typeof document !== 'undefined' ? document.visibilityState : null,
    documentHidden: typeof document !== 'undefined' ? document.hidden : null,
    readyState: typeof document !== 'undefined' ? document.readyState : null,
    viewport: viewportSnapshot(),
    ...extra,
  };

  bucket.push(entry);
  try {
    console.log('[homepage-paint-diag]', JSON.stringify(entry));
  } catch {
    console.log('[homepage-paint-diag]', label, entry);
  }
  return entry;
}

export function recordObserverStatus(type, status) {
  const meta = ensureMeta();
  meta.observers[type] = status;
}

export function recordReactLifecycle(phase, ms) {
  const meta = ensureMeta();
  meta.react[phase] = ms;
}

export function recordDiagError(context, error) {
  const meta = ensureMeta();
  meta.errors.push({ context, error: String(error), atMs: elapsedMs() });
}

/** Read-only visibility probe — does not change layout or styles. */
export function probeElementVisibility(element) {
  if (!element || typeof window === 'undefined') {
    return { present: false };
  }

  const rect = element.getBoundingClientRect();
  let style = null;
  try {
    style = window.getComputedStyle(element);
  } catch {
    style = null;
  }

  const opacity = style ? parseFloat(style.opacity) : null;
  const visibility = style ? style.visibility : null;
  const display = style ? style.display : null;
  const color = style ? style.color : null;
  const backgroundColor = style ? style.backgroundColor : null;

  const hasBox = rect.width > 0 && rect.height > 0;
  const likelyVisible =
    hasBox &&
    visibility !== 'hidden' &&
    display !== 'none' &&
    (opacity === null || opacity > 0.01);

  return {
    present: true,
    hasBox,
    likelyVisible,
    rect: {
      top: Math.round(rect.top),
      left: Math.round(rect.left),
      width: Math.round(rect.width),
      height: Math.round(rect.height),
    },
    opacity,
    visibility,
    display,
    color,
    backgroundColor,
  };
}

export function probeDocumentSurfaces() {
  if (typeof document === 'undefined') return {};
  const surfaces = {};
  try {
    surfaces.htmlBackground = window.getComputedStyle(document.documentElement).backgroundColor;
    surfaces.bodyBackground = window.getComputedStyle(document.body).backgroundColor;
  } catch (err) {
    surfaces.error = String(err);
  }
  return surfaces;
}

export function runHomepageProbePair(heroId, mainId) {
  const hero = document.getElementById(heroId);
  const main = document.getElementById(mainId);
  return {
    hero: probeElementVisibility(hero),
    main: probeElementVisibility(main),
    surfaces: probeDocumentSurfaces(),
    viewport: viewportSnapshot(),
  };
}

export function navigationTimingSnapshot() {
  if (typeof performance === 'undefined') return { supported: false };

  try {
    const [nav] = performance.getEntriesByType('navigation');
    if (!nav) return { supported: true, navigation: null };

    return {
      supported: true,
      navigation: {
        type: nav.type,
        startTime: nav.startTime,
        fetchStart: nav.fetchStart,
        responseStart: nav.responseStart,
        responseEnd: nav.responseEnd,
        domInteractive: nav.domInteractive,
        domContentLoadedEventStart: nav.domContentLoadedEventStart,
        domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
        loadEventStart: nav.loadEventStart,
        loadEventEnd: nav.loadEventEnd,
        duration: nav.duration,
      },
    };
  } catch (err) {
    return { supported: false, error: String(err) };
  }
}

export function paintTimingSnapshot() {
  if (typeof performance === 'undefined') return { supported: false };

  try {
    const paints = performance.getEntriesByType('paint');
    return {
      supported: true,
      paints: paints.map((p) => ({ name: p.name, startTime: p.startTime })),
    };
  } catch (err) {
    return { supported: false, error: String(err) };
  }
}

const PROBE_RAF_LABEL = 'probe:raf';
const MAX_REPORT_CHARS = 450000;

/**
 * Keep all critical events; collapse repetitive RAF probes into a summary line.
 */
export function compactTimeline(entries) {
  if (!entries || !entries.length) return [];

  const out = [];
  let rafBatch = [];

  const flushRaf = () => {
    if (!rafBatch.length) return;
    const first = rafBatch[0];
    const last = rafBatch[rafBatch.length - 1];
    out.push({
      label: 'probe:raf_summary',
      elapsedMs: last.elapsedMs,
      count: rafBatch.length,
      firstElapsedMs: first.elapsedMs,
      lastElapsedMs: last.elapsedMs,
      firstHeroLikelyVisible: first.hero?.likelyVisible ?? null,
      lastHeroLikelyVisible: last.hero?.likelyVisible ?? null,
    });
    rafBatch = [];
  };

  for (const entry of entries) {
    if (entry.label === PROBE_RAF_LABEL) {
      rafBatch.push(entry);
      continue;
    }
    flushRaf();
    out.push(entry);
  }
  flushRaf();
  return out;
}

export function buildHomepagePaintReport() {
  if (typeof window === 'undefined') {
    return JSON.stringify({ error: 'report only available in browser' }, null, 2);
  }

  const entries = window[HOMEPAGE_PAINT_DIAG_GLOBAL] || [];
  const meta = window[HOMEPAGE_PAINT_DIAG_META_GLOBAL] || ensureMeta();

  const report = {
    generatedAt: new Date().toISOString(),
    limitation: REPORT_LIMITATION,
    userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : null,
    timeOrigin: typeof performance !== 'undefined' ? performance.timeOrigin : null,
    document: {
      visibilityState: document.visibilityState,
      hidden: document.hidden,
      readyState: document.readyState,
      viewport: viewportSnapshot(),
      surfaces: probeDocumentSurfaces(),
    },
    navigation: navigationTimingSnapshot(),
    paint: paintTimingSnapshot(),
    observers: meta.observers,
    reactLifecycleMs: meta.react,
    errors: meta.errors,
    timeline: compactTimeline(entries),
    timelineEventCount: entries.length,
  };

  let text = JSON.stringify(report, null, 2);
  if (text.length > MAX_REPORT_CHARS) {
    report.timeline = report.timeline.slice(0, Math.floor(report.timeline.length * 0.75));
    report.truncated = true;
    report.truncatedNote = 'Report truncated for size; early timeline events preserved where possible.';
    text = JSON.stringify(report, null, 2);
  }
  return text;
}
