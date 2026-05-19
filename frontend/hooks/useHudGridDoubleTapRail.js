import { useLayoutEffect, useEffect, useRef } from 'react';
import { useTechDashboardRail } from '../components/layouts/TechDashboardLayout';

const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_MAX_DIST_PX = 48;

/** Double-tap empty tactical grid background to open the tech dashboard icon rail. */
export function useHudGridDoubleTapRail() {
  const railContext = useTechDashboardRail();
  const { openRail } = railContext || {};
  const gridTapLayerRef = useRef(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  useEffect(() => {
    const layer = gridTapLayerRef.current;
    console.log('[DoubleTap] useEffect running', { 
      hasLayer: !!layer, 
      hasOpenRail: !!openRail,
      hasContext: !!railContext 
    });
    if (!layer) {
      console.error('[DoubleTap] No layer element found!');
      return undefined;
    }
    if (!openRail) {
      console.error('[DoubleTap] No openRail function!', { railContext });
      return undefined;
    }
    console.log('[DoubleTap] Successfully attached to element:', layer.className);

    const tryOpenRailFromDoubleTap = (x, y) => {
      const now = Date.now();
      const prev = lastTap.current;
      const dt = now - prev.t;
      const dist = Math.hypot(x - prev.x, y - prev.y);
      if (prev.t && dt < DOUBLE_TAP_MS && dist < DOUBLE_TAP_MAX_DIST_PX) {
        lastTap.current = { t: 0, x: 0, y: 0 };
        openRail?.();
        return true;
      }
      lastTap.current = { t: now, x, y };
      return false;
    };

    const onTouchStart = (e) => {
      console.log('[DoubleTap] touchstart event', { touches: e.touches.length, target: e.target.className });
      if (e.touches.length !== 1) return;
      const { clientX, clientY } = e.touches[0];
      console.log('[DoubleTap] Position:', { x: clientX, y: clientY });
      const result = tryOpenRailFromDoubleTap(clientX, clientY);
      console.log('[DoubleTap] Detection result:', result);
      if (result) {
        console.log('[DoubleTap] 🎉 DOUBLE-TAP DETECTED! Opening rail...');
        e.preventDefault();
      }
    };

    const onDoubleClick = () => {
      console.log('[DoubleTap] dblclick event (desktop)');
      openRail?.();
    };

    layer.addEventListener('touchstart', onTouchStart, { passive: false });
    layer.addEventListener('dblclick', onDoubleClick);
    return () => {
      layer.removeEventListener('touchstart', onTouchStart);
      layer.removeEventListener('dblclick', onDoubleClick);
    };
  }, [openRail]);

  return gridTapLayerRef;
}
