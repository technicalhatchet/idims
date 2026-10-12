/**
 * Inline script body for earliest homepage paint diagnostic (parsed before React bundles).
 * Injected only when NEXT_PUBLIC_HOMEPAGE_PAINT_DIAG=1 on pages/index.js.
 */
export const HOMEPAGE_PAINT_DIAG_INLINE_SCRIPT = `
(function () {
  var G = '__HOMEPAGE_PAINT_DIAG__';
  var META = '__HOMEPAGE_PAINT_DIAG_META__';
  var HERO_ID = 'homepage-paint-diag-hero-h1';
  var MAIN_ID = 'homepage-paint-diag-main';

  function elapsedMs() {
    return typeof performance !== 'undefined' ? performance.now() : null;
  }

  function viewport() {
    return {
      innerWidth: window.innerWidth,
      innerHeight: window.innerHeight,
      devicePixelRatio: window.devicePixelRatio,
    };
  }

  function log(label, extra) {
    var entry = {
      label: label,
      elapsedMs: elapsedMs(),
      wallMs: Date.now(),
      timeOrigin: typeof performance !== 'undefined' ? performance.timeOrigin : null,
      visibilityState: document.visibilityState,
      documentHidden: document.hidden,
      readyState: document.readyState,
      viewport: viewport(),
    };
    if (extra && typeof extra === 'object') {
      for (var k in extra) {
        if (Object.prototype.hasOwnProperty.call(extra, k)) entry[k] = extra[k];
      }
    }
    window[G] = window[G] || [];
    window[G].push(entry);
    try {
      console.log('[homepage-paint-diag]', JSON.stringify(entry));
    } catch (e) {
      console.log('[homepage-paint-diag]', label, entry);
    }
  }

  function navSnapshot() {
    try {
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
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
          domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
          loadEventEnd: nav.loadEventEnd,
          duration: nav.duration,
        },
      };
    } catch (e) {
      return { supported: false, error: String(e) };
    }
  }

  function paintSnapshot() {
    try {
      var paints = performance.getEntriesByType && performance.getEntriesByType('paint');
      return {
        supported: true,
        paints: paints
          ? paints.map(function (p) {
              return { name: p.name, startTime: p.startTime };
            })
          : [],
      };
    } catch (e) {
      return { supported: false, error: String(e) };
    }
  }

  function probePair() {
    var hero = document.getElementById(HERO_ID);
    var main = document.getElementById(MAIN_ID);
    function probe(el) {
      if (!el) return { present: false };
      var rect = el.getBoundingClientRect();
      var style = window.getComputedStyle(el);
      var opacity = parseFloat(style.opacity);
      return {
        present: true,
        hasBox: rect.width > 0 && rect.height > 0,
        rect: {
          top: Math.round(rect.top),
          left: Math.round(rect.left),
          width: Math.round(rect.width),
          height: Math.round(rect.height),
        },
        opacity: opacity,
        visibility: style.visibility,
        display: style.display,
        color: style.color,
        backgroundColor: style.backgroundColor,
      };
    }
    var surfaces = {};
    try {
      surfaces.htmlBackground = window.getComputedStyle(document.documentElement).backgroundColor;
      surfaces.bodyBackground = window.getComputedStyle(document.body).backgroundColor;
    } catch (e) {
      surfaces.error = String(e);
    }
    return { hero: probe(hero), main: probe(main), surfaces: surfaces };
  }

  window[META] = window[META] || {
    observers: { paint: null, lcp: null },
    react: { useLayoutEffectMs: null, useEffectMs: null },
    errors: [],
  };

  log('inline:script_start', {
    navigation: navSnapshot(),
    paint: paintSnapshot(),
    probes: probePair(),
  });

  var dclFired = false;
  function onDomContentLoaded() {
    if (dclFired) return;
    dclFired = true;
    log('inline:DOMContentLoaded', {
      navigation: navSnapshot(),
      probes: probePair(),
    });
  }

  var loadFired = false;
  function onWindowLoad() {
    if (loadFired) return;
    loadFired = true;
    log('inline:window_load', {
      navigation: navSnapshot(),
      paint: paintSnapshot(),
      probes: probePair(),
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', onDomContentLoaded);
  } else {
    log('inline:DOMContentLoaded_already', { readyState: document.readyState });
    onDomContentLoaded();
  }

  if (document.readyState === 'complete') {
    log('inline:window_load_already', { readyState: document.readyState });
    onWindowLoad();
  } else {
    window.addEventListener('load', onWindowLoad);
  }

  window.addEventListener('pageshow', function (ev) {
    log('inline:pageshow', { persisted: ev.persisted });
  });

  window.addEventListener('pagehide', function (ev) {
    log('inline:pagehide', { persisted: ev.persisted });
  });

  document.addEventListener('visibilitychange', function () {
    log('inline:visibilitychange', {
      visibilityState: document.visibilityState,
      documentHidden: document.hidden,
    });
  });

  try {
    if (typeof PerformanceObserver !== 'undefined') {
      var paintObs = new PerformanceObserver(function (list) {
        list.getEntries().forEach(function (entry) {
          log('inline:observer_paint', { name: entry.name, startTime: entry.startTime });
        });
      });
      paintObs.observe({ type: 'paint', buffered: true });
      window[META].observers.paint = 'inline:supported';
    } else {
      window[META].observers.paint = 'inline:PerformanceObserver_missing';
    }
  } catch (e) {
    window[META].observers.paint = 'inline:error';
    window[META].errors.push({ context: 'inline_paint_observer', error: String(e), atMs: elapsedMs() });
    log('inline:observer_paint_error', { error: String(e) });
  }
})();
`.trim();
