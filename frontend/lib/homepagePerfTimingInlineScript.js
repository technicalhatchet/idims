/**
 * Passive navigation / paint timing for homepage perf experiments.
 * Updates #homepage-perf-timing on window load (no React, no PerformanceObserver).
 */
export const HOMEPAGE_PERF_TIMING_INLINE_SCRIPT = `
(function () {
  var el = document.getElementById('homepage-perf-timing');
  if (!el) return;

  function round(v) {
    return typeof v === 'number' && isFinite(v) ? Math.round(v) : '—';
  }

  function snapshot() {
    var parts = [];
    try {
      if (typeof performance !== 'undefined' && performance.timeOrigin) {
        parts.push('timeOrigin ' + Math.round(performance.timeOrigin));
      }
      parts.push('now ' + round(performance.now()));
      var nav = performance.getEntriesByType && performance.getEntriesByType('navigation')[0];
      if (nav) {
        parts.push('responseEnd ' + round(nav.responseEnd));
        parts.push('domInteractive ' + round(nav.domInteractive));
        parts.push('dcl ' + round(nav.domContentLoadedEventEnd));
        parts.push('load ' + round(nav.loadEventEnd));
      }
      var paints = performance.getEntriesByType && performance.getEntriesByType('paint');
      if (paints && paints.length) {
        paints.forEach(function (p) {
          parts.push(p.name + ' ' + round(p.startTime));
        });
      } else {
        parts.push('paint (none yet)');
      }
    } catch (e) {
      parts.push('error ' + String(e));
    }
    el.textContent = parts.join(' · ');
  }

  window.addEventListener('load', snapshot);
  if (document.readyState === 'complete') {
    snapshot();
  }
})();
`.trim();
