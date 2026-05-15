import { useEffect, useRef } from 'react';
import { useTechDashboardRail } from '../components/layouts/TechDashboardLayout';

const DOUBLE_TAP_MS = 350;
const DOUBLE_TAP_MAX_DIST_PX = 48;

/** Double-tap empty tactical grid background to open the tech dashboard icon rail. */
export function useHudGridDoubleTapRail() {
  const { openRail } = useTechDashboardRail() || {};
  const gridTapLayerRef = useRef(null);
  const lastTap = useRef({ t: 0, x: 0, y: 0 });

  useEffect(() => {
    const layer = gridTapLayerRef.current;
    if (!layer) return undefined;

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
      if (e.touches.length !== 1) return;
      const { clientX, clientY } = e.touches[0];
      if (tryOpenRailFromDoubleTap(clientX, clientY)) {
        e.preventDefault();
      }
    };

    const onDoubleClick = () => {
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
