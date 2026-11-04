/**
 * Double-tap on empty background opens the TechDeck icon rail.
 *
 * Only real taps on dead space count: a touch that moves (a swipe or scroll) or is held is
 * never a tap, and touches that start on a card or a control are ignored, so only the gaps
 * between cards and the empty grid open the rail. Listeners are
 * passive and never cancel the touch, so scrolling (like the work order tab row) starts
 * immediately and is never eaten by a "double tap".
 */
export const DOUBLE_TAP_MS = 350;
export const DOUBLE_TAP_MAX_DIST_PX = 48;
export const TAP_MAX_MOVE_PX = 10;
export const TAP_MAX_MS = 300;

// Cards and controls: the same elements TechDashboardLayout makes touchable inside
// .hud-grid-content (everything else there lets taps fall through to the grid).
const SKIP_SELECTOR = [
  '[data-hud-card]', '[data-techboard-card]', '[data-touch-surface]', '[data-action-menu]', 'nav',
  'a', 'button', 'input', 'textarea', 'select', 'label', 'summary',
  '[role="button"]', '[role="tab"]', '[role="dialog"]', '[contenteditable="true"]', '[data-no-rail-tap]',
].join(', ');

export function createDoubleTapDetector({ now = () => Date.now() } = {}) {
  let start = null;
  let last = null;
  return {
    start(x, y, skip = false) {
      start = skip ? null : { x, y, t: now(), moved: false };
    },
    move(x, y) {
      if (start && Math.hypot(x - start.x, y - start.y) > TAP_MAX_MOVE_PX) start.moved = true;
    },
    cancel() {
      start = null;
    },
    /** @returns {boolean} true when this touch completes a double tap */
    end() {
      if (!start) return false;
      const s = start;
      start = null;
      const t = now();
      if (s.moved || t - s.t > TAP_MAX_MS) {
        last = null;
        return false;
      }
      if (last && t - last.t < DOUBLE_TAP_MS && Math.hypot(s.x - last.x, s.y - last.y) < DOUBLE_TAP_MAX_DIST_PX) {
        last = null;
        return true;
      }
      last = { x: s.x, y: s.y, t };
      return false;
    },
  };
}

function isControl(target) {
  return Boolean(target && typeof target.closest === 'function' && target.closest(SKIP_SELECTOR));
}

/** Attach to a layer element; returns a cleanup function. */
export function attachRailDoubleTap(layer, onDoubleTap) {
  const d = createDoubleTapDetector();
  // A touch double tap can also produce a dblclick; only open the rail once per gesture.
  let lastFired = 0;
  const fire = () => {
    const now = Date.now();
    if (now - lastFired < 600) return;
    lastFired = now;
    onDoubleTap();
  };
  const onStart = (e) => {
    if (e.touches.length !== 1) {
      d.cancel();
      return;
    }
    const p = e.touches[0];
    d.start(p.clientX, p.clientY, isControl(e.target));
  };
  const onMove = (e) => {
    const p = e.touches[0];
    if (p) d.move(p.clientX, p.clientY);
  };
  const onEnd = () => {
    if (d.end()) fire();
  };
  const onCancel = () => d.cancel();
  const onDblClick = (e) => {
    if (!isControl(e.target)) fire();
  };
  const opts = { passive: true };
  layer.addEventListener('touchstart', onStart, opts);
  layer.addEventListener('touchmove', onMove, opts);
  layer.addEventListener('touchend', onEnd, opts);
  layer.addEventListener('touchcancel', onCancel, opts);
  layer.addEventListener('dblclick', onDblClick);
  return () => {
    layer.removeEventListener('touchstart', onStart, opts);
    layer.removeEventListener('touchmove', onMove, opts);
    layer.removeEventListener('touchend', onEnd, opts);
    layer.removeEventListener('touchcancel', onCancel, opts);
    layer.removeEventListener('dblclick', onDblClick);
  };
}
